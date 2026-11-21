'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppShell } from '@/components/providers/app-shell-provider';

export default function CheikhAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { lang, setLang, theme, toggleTheme } = useAppShell();
  const isAr = lang === 'ar';

  const tabs = [
    { href: '/admin', label: isAr ? 'لوحة المتابعة' : 'Tableau de bord' },
    { href: '/admin/zikr', label: isAr ? 'الأذكار والأهداف' : 'Zikr & Objectifs' },
    { href: '/admin/members', label: isAr ? 'الأعضاء' : 'Membres' },
    { href: '/admin/redistribute', label: isAr ? 'إعادة التوزيع' : 'Redistribution' },
    { href: '/admin/analytics', label: isAr ? 'الإحصائيات' : 'Graphiques' },
  ];

  return (
    <div className="min-h-dvh flex flex-col pb-12">
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/95 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-[var(--accent-gold-soft)] text-[var(--accent-gold)] text-xs font-bold uppercase">
              {isAr ? 'فضاء المسؤول' : 'Espace Gestionnaire'}
            </span>
            <h1 className="font-display text-lg font-bold text-[var(--accent-primary)]">
              {isAr ? 'زيارة فاس ٢٠٢٦' : 'Ziyara Fès 2026'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="h-10 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold flex items-center"
            >
              {isAr ? 'واجهة المريد' : 'Vue Membre'}
            </Link>
            <button
              type="button"
              onClick={() => setLang(isAr ? 'fr' : 'ar')}
              className="h-10 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold"
            >
              {isAr ? 'FR' : 'عربي'}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="h-10 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold"
            >
              {theme === 'light' ? '☾' : '☀'}
            </button>
          </div>
        </div>

        <nav className="max-w-5xl mx-auto flex gap-1.5 overflow-x-auto pt-3 pb-1 no-scrollbar">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`shrink-0 h-10 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center transition-colors ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
