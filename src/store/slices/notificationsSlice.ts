import { StateCreator } from "zustand";
import { NotificationPrefs } from "../types";
import { CoreState, mutate } from "../core";

export interface NotificationsSlice {
  setNotificationPrefs: (patch: Partial<NotificationPrefs>) => void;
}

export const createNotificationsSlice = (
  persist: <T extends unknown[]>(fn: (...a: T) => void) => (...a: T) => void,
): StateCreator<CoreState & NotificationsSlice, [], [], NotificationsSlice> => (set) => ({
  setNotificationPrefs: persist((patch: Partial<NotificationPrefs>) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        notificationPrefs: { ...d.notificationPrefs, ...patch },
      })),
    ),
  ),
});
