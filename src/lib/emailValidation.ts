// Allowlist de provedores de e-mail reais aceitos no cadastro/login.
// Manter em sincronia com a função SQL public.is_allowed_email_domain.
export const ALLOWED_EMAIL_DOMAINS = new Set<string>([
  // Google
  "gmail.com",
  "googlemail.com",
  // Microsoft
  "outlook.com",
  "outlook.com.br",
  "hotmail.com",
  "hotmail.com.br",
  "live.com",
  "msn.com",
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  // Yahoo
  "yahoo.com",
  "yahoo.com.br",
  "ymail.com",
  // Proton
  "proton.me",
  "protonmail.com",
  // Outros comuns
  "zoho.com",
  "yandex.com",
  "gmx.com",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getEmailDomain(email: string): string | null {
  const e = normalizeEmail(email);
  if (!EMAIL_REGEX.test(e)) return null;
  return e.split("@")[1] ?? null;
}

export function isAllowedEmailProvider(email: string): boolean {
  const domain = getEmailDomain(email);
  return !!domain && ALLOWED_EMAIL_DOMAINS.has(domain);
}

export const ALLOWED_PROVIDERS_MESSAGE =
  "Use um e-mail de um provedor conhecido (Gmail, Outlook, Hotmail, iCloud, Yahoo, Proton…).";
