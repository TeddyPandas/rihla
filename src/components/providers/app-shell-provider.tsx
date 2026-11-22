'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { dictionary, Lang, ThemeMode, Palette } from '@/lib/i18n/dictionary';

interface AppShellContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  palette: Palette;
  setPalette: (p: Palette) => void;
  arSize: number;
  setArSize: (n: number) => void;
  isOnline: boolean;
  t: (typeof dictionary)[Lang];
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [palette, setPaletteState] = useState<Palette>('A');
  const [arSize, setArSizeState] = useState<number>(55);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    const savedLang = localStorage.getItem('ziyara_lang') as Lang | null;
    const savedTheme = localStorage.getItem('ziyara_theme') as ThemeMode | null;
    if (savedLang === 'fr' || savedLang === 'ar') setLangState(savedLang);
    if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme);
    const savedPalette = localStorage.getItem('ziyara_palette');
    if (savedPalette === 'A' || savedPalette === 'B') setPaletteState(savedPalette);
    const savedSize = Number(localStorage.getItem('ziyara_ar_size'));
    if (savedSize >= 0 && savedSize <= 100 && localStorage.getItem('ziyara_ar_size') !== null) setArSizeState(savedSize);

    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('ziyara_lang', lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ziyara_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem('ziyara_palette', palette);
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim());
  }, [palette, theme]);

  useEffect(() => {
    localStorage.setItem('ziyara_ar_size', String(arSize));
  }, [arSize]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  return (
    <AppShellContext.Provider
      value={{
        lang,
        setLang: setLangState,
        theme,
        toggleTheme,
        palette,
        setPalette: setPaletteState,
        arSize,
        setArSize: setArSizeState,
        isOnline,
        t: dictionary[lang],
      }}
    >
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error('useAppShell doit être utilisé dans AppShellProvider');
  return ctx;
}
