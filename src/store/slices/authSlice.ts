import { StateCreator } from "zustand";
import { User, UserData, emptyUserData } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { CoreState, scheduleCloudSave, writeCache } from "../core";
import { pruneCompletedTasks } from "@/lib/tasks";

/**
 * Some upstream error shapes (rate limits, gateway failures, non-standard
 * GoTrue error bodies) don't carry a real `.message` — the underlying object
 * can serialize to "{}" or "[object Object]" instead of readable text. Users
 * were seeing that literal garbage in the toast ("erro {}"). This guards
 * every auth error path so only a real message, or a clear Portuguese
 * fallback, ever reaches the UI.
 */
function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const msg = error.message?.trim();
    if (msg && msg !== "{}" && msg !== "[object Object]") return msg;
  }
  return fallback;
}

export interface AuthSlice {
  signup: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  currentUser: () => User | null;
  verifySession: () => boolean;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ ok: boolean; error?: string }>;
  updateProfileName: (name: string) => Promise<{ ok: boolean; error?: string }>;
  deleteAccount: () => Promise<{ ok: boolean; error?: string }>;

  // internal, wired up by the Supabase auth listener in useAppStore.ts
  _setSession: (userId: string | null, user?: Partial<User>) => void;
  _hydrateFromCloud: (userId: string) => Promise<void>;
}

export const createAuthSlice: StateCreator<
  CoreState & AuthSlice,
  [],
  [],
  AuthSlice
> = (set, get) => ({
  currentUser: () => {
    const { users, currentUserId } = get();
    return users.find((u) => u.id === currentUserId) ?? null;
  },

  verifySession: () => !!get().currentUserId,

  signup: async (name, email, password) => {
    const e = email.trim().toLowerCase();
    if (!name.trim() || !e || password.length < 8) {
      return { ok: false, error: "Preencha todos os campos (senha mínima de 8 caracteres)." };
    }
    const { data, error } = await supabase.auth.signUp({
      email: e,
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      return {
        ok: false,
        error: authErrorMessage(
          error,
          "Não foi possível criar a conta agora. Se você já tentou várias vezes, aguarde alguns minutos e tente de novo.",
        ),
      };
    }
    const userId = data.user?.id;
    if (!userId) return { ok: false, error: "Não foi possível criar a conta." };
    // The DB trigger already inserts a profile row; this upsert just keeps
    // the name in sync in case the trigger's metadata read ever changes.
    try {
      await supabase.from("profiles").upsert({ id: userId, name: name.trim() });
    } catch {
      /* non-fatal: profile will still exist from the trigger */
    }
    return { ok: true };
  },

  login: async (email, password) => {
    const e = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: e, password });
    if (error) {
      return { ok: false, error: authErrorMessage(error, "Não foi possível entrar. Confira seu e-mail e senha.") };
    }
    return { ok: true };
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ currentUserId: null, hydrated: false });
    writeCache({ currentUserId: null, users: get().users, data: get().data });
  },

  requestPasswordReset: async (email) => {
    const e = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(e, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) {
      return { ok: false, error: authErrorMessage(error, "Não foi possível enviar o link agora. Tente novamente em alguns minutos.") };
    }
    return { ok: true };
  },

  updatePassword: async (password) => {
    if (password.length < 8) {
      return { ok: false, error: "Sua senha precisa ter pelo menos 8 caracteres." };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return { ok: false, error: authErrorMessage(error, "Não foi possível redefinir a senha agora. Tente novamente.") };
    }
    return { ok: true };
  },

  updateProfileName: async (name) => {
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) return { ok: false, error: "Informe um nome." };
    const userId = get().currentUserId;
    if (!userId) return { ok: false, error: "Sessão expirada." };
    const { error } = await supabase.from("profiles").update({ name: trimmed }).eq("id", userId);
    if (error) {
      return { ok: false, error: authErrorMessage(error, "Não foi possível salvar o nome agora. Tente novamente.") };
    }
    set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, name: trimmed } : u)) }));
    writeCache({ currentUserId: get().currentUserId, users: get().users, data: get().data });
    return { ok: true };
  },

  deleteAccount: async () => {
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      return { ok: false, error: authErrorMessage(error, "Não foi possível excluir a conta agora. Tente novamente.") };
    }
    // The row behind this session is gone — sign out client-side too so no
    // stale token/cache lingers, then clear local state the same way logout does.
    await supabase.auth.signOut();
    set({ currentUserId: null, hydrated: false });
    writeCache({ currentUserId: null, users: get().users, data: get().data });
    return { ok: true };
  },

  _setSession: (userId, user) => {
    set((s) => {
      const users = userId
        ? (() => {
            const existing = s.users.find((u) => u.id === userId);
            if (existing) {
              return s.users.map((u) => (u.id === userId ? { ...u, ...user } : u));
            }
            return [
              ...s.users,
              {
                id: userId,
                name: user?.name ?? "",
                email: user?.email ?? "",
                createdAt: new Date().toISOString(),
                ...user,
              } as User,
            ];
          })()
        : s.users;
      return { currentUserId: userId, users };
    });
    writeCache({
      currentUserId: get().currentUserId,
      users: get().users,
      data: get().data,
    });
  },

  _hydrateFromCloud: async (userId) => {
    try {
      const [{ data: profile }, { data: row }] = await Promise.all([
        supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
        supabase.from("user_data").select("data").eq("user_id", userId).maybeSingle(),
      ]);
      const cloud = (row?.data as unknown as UserData) ?? null;
      let tasksWerePruned = false;
      set((s) => {
        const base = emptyUserData();
        // Deep-merge notificationPrefs/categories specifically, so a key
        // added after a user's prefs were first saved (e.g. a new
        // notification category) falls back to its default instead of
        // being silently absent from an old stored blob.
        const merged: UserData = cloud && Object.keys(cloud).length
          ? {
              ...base,
              ...cloud,
              notificationPrefs: {
                ...base.notificationPrefs,
                ...cloud.notificationPrefs,
                categories: {
                  ...base.notificationPrefs.categories,
                  ...cloud.notificationPrefs?.categories,
                },
              },
            }
          : (s.data[userId] ?? base);
        // Sweep completed tasks past their 3-day grace window on every load
        // — the only reliable point to run this without a server-side cron.
        const prunedTasks = pruneCompletedTasks(merged.tasks);
        tasksWerePruned = prunedTasks.length !== merged.tasks.length;
        const final = tasksWerePruned ? { ...merged, tasks: prunedTasks } : merged;
        return {
          hydrated: true,
          data: { ...s.data, [userId]: final },
          users: s.users.map((u) =>
            u.id === userId ? { ...u, name: profile?.name || u.name } : u,
          ),
        };
      });
      // If cloud was empty but local had data, push it up so nothing is lost.
      // Also push back up if pruning just changed the data, so the deletion
      // sticks in the cloud instead of the old tasks reappearing next sync.
      if (((!cloud || !Object.keys(cloud).length) || tasksWerePruned) && get().data[userId]) {
        scheduleCloudSave(userId, get().data[userId]);
      }
      writeCache({
        currentUserId: get().currentUserId,
        users: get().users,
        data: get().data,
      });
    } catch (e) {
      console.warn("hydrate failed", e);
      set({ hydrated: true });
    }
  },
});
