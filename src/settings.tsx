import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BiRule } from './types';

export interface Settings {
  rule: BiRule;
  theme: 'auto' | 'light' | 'dark';
  showEmpty: boolean;   // include roots that have no verb in the Quran
}

const DEFAULTS: Settings = { rule: 'first-two', theme: 'auto', showEmpty: true };
const KEY = 'roots-forest-settings';

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* private mode etc. */
  }
  return DEFAULTS;
}

const Ctx = createContext<{ settings: Settings; update: (p: Partial<Settings>) => void }>({
  settings: DEFAULTS,
  update: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(read);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
    const root = document.documentElement;
    if (settings.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings]);
  const value = useMemo(
    () => ({ settings, update: (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p })) }),
    [settings],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  return useContext(Ctx);
}
