'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '@/lib/offline/db';
import { flushOutboxAndPull } from '@/lib/offline/sync-engine';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { lang, setLang, theme, toggleTheme, isOnline, t } = useAppShell();
  const isAr = lang === 'ar';
  const [syncing, setSyncing] = useState(false);

  const profile = useLiveQuery(() => offlineDb.profile.toCollection().first(), []);
  const outboxCount = useLiveQuery(() => offlineDb.outbox.count(), []) ?? 0;

  useEffect(() => {
    async function bootstrapProfile() {
      if (!navigator.onLine) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('group_members')
        .select('id, ziyara_id, full_name, role, ziyaras(title_fr, title_ar, start_date, end_date)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (member && member.ziyaras) {
        const z = Array.isArray(member.ziyaras) ? member.ziyaras[0] : member.ziyaras;
        await offlineDb.profile.put({
          memberId: member.id,
          ziyaraId: member.ziyara_id,
          ziyaraTitleFr: z.title_fr,
          ziyaraTitleAr: z.title_ar,
          startDate: z.start_date,
          endDate: z.end_date,
          fullName: member.full_name || '',
          role: member.role,
        });
        setSyncing(true);
        await flushOutboxAndPull(member.ziyara_id);
        setSyncing(false);
      }
    }
    void bootstrapProfile();
  }, []);

  useEffect(() => {
    if (!profile?.ziyaraId) return;
    const triggerSync = async () => {
      if (!navigator.onLine) return;
      setSyncing(true);
      await flushOutboxAndPull(profile.ziyaraId);
      setSyncing(false);
    };

    if (isOnline) void triggerSync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void triggerSync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isOnline, profile?.ziyaraId]);

  const navItems = [
    { href: '/', label: t.navProgram },
    { href: '/pot', label: t.navPot },
    { href: '/notifications', label: t.navNotifs },
    { href: '/biographie', label: t.navBio },
  ];

  return (
    <div className="min-h-dvh flex flex-col pb-24">
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/95 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-lg font-bold text-[var(--accent-primary)] leading-tight">
              {profile ? (isAr ? profile.ziyaraTitleAr : profile.ziyaraTitleFr) : t.appName}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium ${
                  !isOnline
                    ? 'bg-[var(--status-offline-soft)] text-[var(--status-offline)]'
                    : 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    !isOnline ? 'bg-[var(--status-offline)]' : 'bg-[var(--accent-primary)]'
                  }`}
                />
                {syncing ? t.syncing : isOnline ? t.online : t.offline}
              </span>
              {outboxCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--accent-gold-soft)] text-[var(--accent-gold)] font-semibold tabular-nums">
                  {outboxCount} {t.pendingMutations}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {profile?.role === 'cheikh' && (
              <Link
                href="/admin"
                className="h-10 px-3 rounded-xl bg-[var(--accent-gold-soft)] text-[var(--accent-gold)] text-xs font-semibold flex items-center"
              >
                {t.navAdmin}
              </Link>
            )}
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
              aria-label="Changer de thème"
              className="h-10 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold"
            >
              {theme === 'light' ? '☾' : '☀'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-4">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-2">
        <div className="max-w-lg mx-auto grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`h-12 rounded-xl flex items-center justify-center text-xs sm:text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
