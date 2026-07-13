import { useEffect, useState } from "react";
import { onCloudSaveStatus } from "@/store/core";

/**
 * Tracks whether the last debounced cloud save failed, so the UI can show a
 * small "not synced" indicator instead of silently losing changes.
 * Resets to `false` as soon as a save succeeds.
 */
export function useCloudSyncStatus(): { syncFailed: boolean } {
  const [syncFailed, setSyncFailed] = useState(false);

  useEffect(() => onCloudSaveStatus(setSyncFailed), []);

  return { syncFailed };
}
