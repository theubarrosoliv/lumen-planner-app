import { UserData, User, emptyUserData } from "./types";
import { supabase } from "@/integrations/supabase/client";

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const LOCAL_CACHE = "lumen-cloud-cache-v1";

export type CacheShape = {
  currentUserId: string | null;
  users: User[];
  data: Record<string, UserData>;
};

export const readCache = (): CacheShape => {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE);
    if (!raw) return { currentUserId: null, users: [], data: {} };
    return JSON.parse(raw);
  } catch {
    return { currentUserId: null, users: [], data: {} };
  }
};

export const writeCache = (c: CacheShape) => {
  try {
    localStorage.setItem(LOCAL_CACHE, JSON.stringify(c));
  } catch {
    /* ignore: storage full or unavailable (private browsing, etc.) */
  }
};

/** Shared slice of state that every domain slice (tasks, habits, ...) needs. */
export interface CoreState {
  users: User[];
  currentUserId: string | null;
  data: Record<string, UserData>;
  hydrated: boolean;
}

// -------- Cloud sync (debounced) --------
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveFailedListeners: Array<(failed: boolean) => void> = [];

/** Subscribe to cloud-save failures so the UI can surface a "not synced" indicator. */
export const onCloudSaveStatus = (cb: (failed: boolean) => void) => {
  saveFailedListeners.push(cb);
  return () => {
    saveFailedListeners = saveFailedListeners.filter((l) => l !== cb);
  };
};

const notifySaveStatus = (failed: boolean) => {
  saveFailedListeners.forEach((l) => l(failed));
};

export const scheduleCloudSave = (userId: string, data: UserData) => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await supabase
        .from("user_data")
        .upsert({ user_id: userId, data: data as unknown as never }, { onConflict: "user_id" });
      notifySaveStatus(false);
    } catch (e) {
      console.warn("cloud save failed", e);
      notifySaveStatus(true);
    }
  }, 500);
};

/** Apply a transform to the current user's data slice; no-op if nobody is signed in. */
export const mutate = <S extends CoreState>(
  state: S,
  fn: (d: UserData) => UserData,
): Partial<S> => {
  const id = state.currentUserId;
  if (!id) return {};
  const next = fn(state.data[id] ?? emptyUserData());
  return { data: { ...state.data, [id]: next } } as Partial<S>;
};

export const cache = readCache();
