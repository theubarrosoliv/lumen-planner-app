import { StateCreator } from "zustand";
import { CalEvent } from "../types";
import { CoreState, mutate, uid } from "../core";

export interface EventsSlice {
  addEvent: (e: Omit<CalEvent, "id">) => void;
  updateEvent: (id: string, patch: Partial<CalEvent>) => void;
  removeEvent: (id: string) => void;
}

export const createEventsSlice = (
  persist: <T extends unknown[]>(fn: (...a: T) => void) => (...a: T) => void,
): StateCreator<CoreState & EventsSlice, [], [], EventsSlice> => (set) => ({
  addEvent: persist((e: Omit<CalEvent, "id">) =>
    set((s) => mutate(s, (d) => ({ ...d, events: [...d.events, { ...e, id: uid() }] }))),
  ),
  updateEvent: persist((id: string, patch: Partial<CalEvent>) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        events: d.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),
    ),
  ),
  removeEvent: persist((id: string) =>
    set((s) => mutate(s, (d) => ({ ...d, events: d.events.filter((e) => e.id !== id) }))),
  ),
});
