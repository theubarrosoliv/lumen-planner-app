import { create } from "zustand";
import { UserData } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { CoreState, cache, scheduleCloudSave, writeCache } from "./core";
import { AuthSlice, createAuthSlice } from "./slices/authSlice";
import { TasksSlice, createTasksSlice } from "./slices/tasksSlice";
import { HabitsSlice, createHabitsSlice } from "./slices/habitsSlice";
import { GoalsSlice, createGoalsSlice } from "./slices/goalsSlice";
import { ProjectsSlice, createProjectsSlice } from "./slices/projectsSlice";
import { EventsSlice, createEventsSlice } from "./slices/eventsSlice";
import { MindmapsSlice, createMindmapsSlice } from "./slices/mindmapsSlice";

type State = CoreState &
  AuthSlice &
  TasksSlice &
  HabitsSlice &
  GoalsSlice &
  ProjectsSlice &
  EventsSlice &
  MindmapsSlice;

export const useAppStore = create<State>()((set, get, api) => {
  // Persist to localStorage cache + schedule a debounced cloud save on every
  // state-changing action. Every domain slice shares this one code path.
  const persistAll = () => {
    const { currentUserId, users, data } = get();
    writeCache({ currentUserId, users, data });
    if (currentUserId && data[currentUserId]) {
      scheduleCloudSave(currentUserId, data[currentUserId]);
    }
  };

  const persist = <T extends unknown[]>(fn: (...a: T) => void) =>
    (...a: T) => {
      fn(...a);
      persistAll();
    };

  return {
    users: cache.users,
    currentUserId: cache.currentUserId,
    data: cache.data,
    hydrated: false,

    ...createAuthSlice(set, get, api),
    ...createTasksSlice(persist)(set, get, api),
    ...createHabitsSlice(persist)(set, get, api),
    ...createGoalsSlice(persist)(set, get, api),
    ...createProjectsSlice(persist)(set, get, api),
    ...createEventsSlice(persist)(set, get, api),
    ...createMindmapsSlice(persist, persistAll)(set, get, api),
  };
});

// -------- Wire Supabase auth into the store --------
supabase.auth.getSession().then(({ data }) => {
  const session = data.session;
  if (session?.user) {
    useAppStore.getState()._setSession(session.user.id, {
      email: session.user.email ?? "",
      name: (session.user.user_metadata?.name as string) ?? "",
    });
    useAppStore.getState()._hydrateFromCloud(session.user.id);
  } else {
    useAppStore.setState({ currentUserId: null, hydrated: true });
  }
});

supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    useAppStore.getState()._setSession(session.user.id, {
      email: session.user.email ?? "",
      name: (session.user.user_metadata?.name as string) ?? "",
    });
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
      useAppStore.getState()._hydrateFromCloud(session.user.id);
    }
  } else if (event === "SIGNED_OUT") {
    useAppStore.setState({ currentUserId: null, hydrated: true });
  }
});

// Stable empty reference — never return a fresh object from selectors,
// or useSyncExternalStore will loop forever.
const EMPTY_USER_DATA: UserData = { tasks: [], habits: [], goals: [], projects: [], events: [], mindmaps: [] };

// Selector helper to get current user's data slice reactively.
export const useUserData = (): UserData => {
  return useAppStore((s) =>
    s.currentUserId ? s.data[s.currentUserId] ?? EMPTY_USER_DATA : EMPTY_USER_DATA,
  );
};

export const getData = (state: State): UserData => {
  const id = state.currentUserId;
  if (!id) return EMPTY_USER_DATA;
  return state.data[id] ?? EMPTY_USER_DATA;
};

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
