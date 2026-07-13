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

  const removeOption = (value: string) => {
    setCustom((prev) => prev.filter((c) => c !== value));
  };

  const renameOption = (oldValue: string, newValue: string) => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    setCustom((prev) => {
      if (prev.includes(trimmed) && trimmed !== oldValue) return prev.filter((c) => c !== oldValue);
      return prev.map((c) => (c === oldValue ? trimmed : c));
    });
  };

  const options = [...base, ...custom.filter((c) => !base.includes(c))];

  return { options, custom, addOption, removeOption, renameOption };
}
