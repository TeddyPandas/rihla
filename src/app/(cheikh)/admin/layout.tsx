'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppShell } from '@/components/providers/app-shell-provider';

export default function CheikhAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { lang, setLang, theme, toggleTheme, palette, setPalette } = useAppShell();
  const isAr = lang === 'ar';

  const tabs = [
    { href: '/admin', label: isAr ? 'لوحة المتابعة' : 'Tableau de bord' },
    { href: '/admin/zikr', label: isAr ? 'الأذكار والأهداف' : 'Zikr & Objectifs' },
    { href: '/admin/voyage', label: isAr ? 'الرحلة' : 'Voyage' },
    { href: '/admin/members', label: isAr ? 'الأعضاء' : 'Membres' },
    { href: '/admin/redistribute', label: isAr ? 'إعادة التوزيع' : 'Redistribution' },
    { href: '/admin/suivi', label: isAr ? 'المتابعة العامة' : 'Suivi global' },
    { href: '/admin/informations', label: isAr ? 'المعلومات' : 'Informations' },
    { href: '/admin/chambres', label: isAr ? 'الغرف' : 'Chambres' },
    { href: '/admin/rappels', label: isAr ? 'تذكيرات' : 'Rappels' },
    { href: '/admin/analytics', label: isAr ? 'الإحصائيات' : 'Graphiques' },
  ];

  const chip =
    'h-11 min-w-11 px-3.5 rounded-xl border-[1.5px] border-white/25 text-sm font-semibold flex items-center justify-center text-[var(--hero-text)] hover:bg-white/10 transition-colors';

  return (
    <div className="min-h-dvh flex flex-col pb-12">
      <header className="sticky top-0 z-30 bg-[var(--hero-bg)] text-[var(--hero-text)] safe-top shadow-sm">
        <div className="max-w-5xl mx-auto px-4 pt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <svg width="36" height="36" viewBox="0 0 44 44" fill="none" aria-hidden="true" className="shrink-0">
              <circle cx="22" cy="22" r="16" stroke="var(--hero-text)" strokeWidth="2" />
              <circle cx="22" cy="6" r="4.5" fill="var(--hero-accent)" />
            </svg>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[var(--hero-accent)]">
                {isAr ? 'فضاء المسؤول' : 'Espace Gestionnaire'}
              </div>
              <h1 className="text-lg font-semibold leading-tight truncate">
                {isAr ? 'زيارة فاس ٢٠٢٦' : 'Ziyara Fès 2026'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/" className={chip}>
              {isAr ? 'واجهة المريد' : 'Vue Membre'}
            </Link>
            <button
              type="button"
              onClick={() => setPalette(palette === 'A' ? 'B' : 'A')}
              aria-label={isAr ? 'تبديل الألوان' : 'Changer de palette'}
              title={isAr ? 'تبديل الألوان' : 'Changer de palette'}
              className={chip}
            >
              <span className="h-5 w-5 rounded-full border border-white/40" style={{ background: 'linear-gradient(135deg, var(--hero-bg) 50%, var(--hero-accent) 50%)' }} />
            </button>
            <button type="button" onClick={() => setLang(isAr ? 'fr' : 'ar')} lang={isAr ? 'fr' : 'ar'} className={chip}>
              {isAr ? 'FR' : 'عربي'}
            </button>
            <button type="button" onClick={toggleTheme} aria-label={isAr ? 'تغيير المظهر' : 'Changer de thème'} className={chip}>
              {theme === 'light' ? '☾' : '☀'}
            </button>
          </div>
        </div>

        <nav aria-label="Navigation gestionnaire" className="max-w-5xl mx-auto flex gap-1 overflow-x-auto px-4 pt-3 no-scrollbar">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 h-11 px-4 rounded-t-xl text-sm font-semibold flex items-center transition-colors ${
                  active
                    ? 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'
                    : 'text-[var(--hero-text)]/75 hover:text-[var(--hero-text)]'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 pt-5">{children}</main>
    </div>
  );
}
