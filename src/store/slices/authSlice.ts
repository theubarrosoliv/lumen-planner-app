import { StateCreator } from "zustand";
import { User, UserData, emptyUserData } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { CoreState, scheduleCloudSave, writeCache } from "../core";

export interface AuthSlice {
  signup: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  currentUser: () => User | null;
  verifySession: () => boolean;

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
    if (error) return { ok: false, error: error.message };
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
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ currentUserId: null, hydrated: false });
    writeCache({ currentUserId: null, users: get().users, data: get().data });
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
        return {
          hydrated: true,
          data: { ...s.data, [userId]: merged },
          users: s.users.map((u) =>
            u.id === userId ? { ...u, name: profile?.name || u.name } : u,
          ),
        };
      });
      // If cloud was empty but local had data, push it up so nothing is lost.
      if ((!cloud || !Object.keys(cloud).length) && get().data[userId]) {
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
