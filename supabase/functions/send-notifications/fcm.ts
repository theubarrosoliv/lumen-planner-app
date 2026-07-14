// FCM HTTP v1 delivery + Google OAuth2 JWT-bearer token minting for Deno.
// This is the highest-risk part of the pipeline — PEM parsing and
// crypto.subtle.importKey format mismatches are the most likely source of
// silent failures. See supabase/functions/send-notifications/index.ts for
// the env vars this expects (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
// FIREBASE_PROJECT_ID).

import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

export interface ServiceAccount {
  clientEmail: string;
  privateKey: string;
  projectId: string;
}

function pemToCryptoKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Mints (and briefly caches, per invocation) a Google OAuth2 access token scoped to FCM send. */
export async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const key = await pemToCryptoKey(sa.privateKey);
  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: sa.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: getNumericDate(0),
      exp: getNumericDate(3600),
    },
    key,
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth2 token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.token;
}

export interface PushResult {
  ok: boolean;
  /** Set when the send failed; "UNREGISTERED"/"NOT_FOUND" mean the token should be pruned. */
  errorCode?: string;
}

export async function sendPush(
  accessToken: string,
  projectId: string,
  token: string,
  notification: { title: string; body: string; link?: string },
): Promise<PushResult> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: notification.title, body: notification.body },
          webpush: notification.link
            ? { fcm_options: { link: notification.link } }
            : undefined,
        },
      }),
    },
  );
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => null);
  return { ok: false, errorCode: body?.error?.status ?? `HTTP_${res.status}` };
}
