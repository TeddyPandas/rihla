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
  const { lang, setLang, isOnline, t } = useAppShell();
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
    { href: '/', label: t.navProgram, icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' },
    { href: '/pot', label: t.navPot, icon: '<path d="M4 9h16l-1.5 10.5a1.5 1.5 0 0 1-1.5 1.3H7a1.5 1.5 0 0 1-1.5-1.3L4 9z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/>' },
    { href: '/historique', label: t.navHistory, icon: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>' },
    { href: '/notifications', label: t.navNotifs, icon: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15L6 17z"/><path d="M10 21a2 2 0 0 0 4 0"/>' },
    { href: '/profil', label: t.navProfile, icon: '<circle cx="12" cy="8.5" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>' },
  ];

  return (
    <div className="min-h-dvh flex flex-col pb-24">
      {(!isOnline || outboxCount > 0 || syncing) && (
        <div
          role="status"
          className={`safe-top sticky top-0 z-30 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 ${
            !isOnline
              ? 'bg-[var(--status-offline-soft)] text-[var(--status-offline)]'
              : 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
          }`}
        >
          {!isOnline ? t.offline : syncing ? t.syncing : null}
          {outboxCount > 0 && (
            <span className="tabular-nums font-semibold">
              {isOnline && !syncing ? '' : '· '}
              {outboxCount} {t.pendingMutations}
            </span>
          )}
        </div>
      )}

      <main className="flex-1 max-w-lg w-full mx-auto px-5 pt-4 safe-top">
        <div className="mb-5 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-[var(--text-secondary)] truncate">
              {profile ? (isAr ? profile.ziyaraTitleAr : profile.ziyaraTitleFr) : t.appName}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {profile?.role === 'cheikh' && (
                <Link
                  href="/admin"
                  className="h-10 px-3.5 rounded-xl bg-[var(--accent-gold-soft)] text-[var(--accent-gold-text)] text-sm font-semibold flex items-center"
                >
                  {t.navAdmin}
                </Link>
              )}
              <button
                type="button"
                onClick={() => setLang(isAr ? 'fr' : 'ar')}
                lang={isAr ? 'fr' : 'ar'}
                className="h-10 px-3.5 rounded-xl border-[1.5px] border-[var(--border-subtle)] text-sm font-semibold"
              >
                {isAr ? 'FR' : 'عربي'}
              </button>
            </div>
          </div>
          <div className="text-[26px] font-semibold leading-tight">
            {profile?.fullName
              ? isAr
                ? `السلام عليكم، ${profile.fullName}`
                : `Salam, ${profile.fullName.split(' ')[0]}`
              : t.appName}
          </div>
        </div>
        {children}
      </main>

      <nav
        aria-label="Navigation"
        className="fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] safe-bottom"
      >
        <div className="max-w-lg mx-auto grid grid-cols-5">
          {navItems.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                  active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                <span
                  className={`h-7 w-12 rounded-full flex items-center justify-center ${
                    active ? 'bg-[var(--accent-primary-soft)]' : ''
                  }`}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: item.icon }}
                  />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
