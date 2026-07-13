import { useEffect, useState } from "react";

/**
 * Persists a growable list of custom categories/tags (e.g. added inline via
 * CreatableSelect) alongside a fixed base list, deduplicated, per storage key.
 */
export function useCustomOptions(storageKey: string, base: string[]) {
  const [custom, setCustom] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(custom));
    } catch {
      /* ignore: storage unavailable */
    }
  }, [storageKey, custom]);

  const addOption = (value: string) => {
    setCustom((prev) => (base.includes(value) || prev.includes(value) ? prev : [...prev, value]));
  };

  const options = [...base, ...custom.filter((c) => !base.includes(c))];

  return { options, addOption };
}
