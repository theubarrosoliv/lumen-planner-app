import { vi } from "vitest";

/**
 * A minimal chainable mock that satisfies every `supabase.from(...).select()...`
 * call shape used by the store, without touching the network.
 */
function chainable(): any {
  const handler: any = () =>
    new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") return undefined; // not a real promise until awaited via maybeSingle/upsert
          if (prop === "maybeSingle" || prop === "single") {
            return async () => ({ data: null, error: null });
          }
          if (prop === "upsert" || prop === "insert" || prop === "update" || prop === "delete") {
            return async () => ({ data: null, error: null });
          }
          return handler;
        },
      },
    );
  return handler();
}

export const supabase = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
    signUp: vi.fn(async () => ({ data: { user: { id: "test-user" } }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: { id: "test-user" } }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  },
  from: vi.fn(() => chainable()),
};
