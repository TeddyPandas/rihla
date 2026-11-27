'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '@/lib/offline/db';
import { flushOutboxAndPull } from '@/lib/offline/sync-engine';
import { createClient } from '@/lib/supabase/client';
import { getManagedZiyara, pickMemberRow } from '@/lib/ziyara/current';
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

      const { data: rows } = await supabase
        .from('group_members')
        .select('id, ziyara_id, full_name, role, ziyaras(title_fr, title_ar, start_date, end_date, is_active)')
        .eq('user_id', user.id);
      const member = pickMemberRow(rows);

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
        try {
          await flushOutboxAndPull(member.ziyara_id);
        } catch (err) {
          console.error('[sync] échec', err);
        } finally {
          setSyncing(false);
        }
      }
    }
    void bootstrapProfile();
  }, []);

  useEffect(() => {
    if (!profile?.ziyaraId) return;
    const triggerSync = async () => {
      if (!navigator.onLine) return;
      setSyncing(true);
      try {
        await flushOutboxAndPull(profile.ziyaraId);
      } catch (err) {
        console.error('[sync] échec', err);
      } finally {
        setSyncing(false);
      }
    };

    if (isOnline) void triggerSync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void triggerSync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isOnline, profile?.ziyaraId]);

  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const svg = (html: string, size = 24) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
  const ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    basket: '<path d="M4 9h16l-1.5 10.5a1.5 1.5 0 0 1-1.5 1.3H7a1.5 1.5 0 0 1-1.5-1.3L4 9z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15L6 17z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    user: '<circle cx="12" cy="8.5" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  };

  const navItems = [
    { href: '/', label: isAr ? 'اليوم' : "Aujourd'hui", icon: ICONS.sun },
    { href: '/pot', label: isAr ? 'احتياطي المجموعة' : 'Réserve du groupe', icon: ICONS.basket },
  ];
  const drawerItems = [
    { href: '/informations', label: isAr ? 'معلومات' : 'Informations', icon: ICONS.info },
    { href: '/historique', label: t.navHistory, icon: ICONS.cal },
    { href: '/notifications', label: isAr ? 'التنبيهات والتذكيرات' : 'Notifications et rappels', icon: ICONS.bell },
    { href: '/biographie', label: isAr ? 'السيرة' : 'Biographie du Maître', icon: ICONS.book },
    { href: '/profil', label: t.navProfile, icon: ICONS.user },
  ];
  const menuActive = drawerItems.some((d) => pathname.startsWith(d.href));

  return (
    <div className="min-h-dvh flex flex-col pb-28">
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

      <main className="flex-1 max-w-lg md:max-w-2xl w-full mx-auto px-5 pt-4 safe-top">
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
        <div className="max-w-lg md:max-w-2xl mx-auto grid grid-cols-3">
          {navItems.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`h-[72px] flex flex-col items-center justify-center gap-1 text-[13px] font-semibold text-center leading-tight transition-colors ${
                  active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                <span className={`h-8 w-14 rounded-full flex items-center justify-center ${active ? 'bg-[var(--accent-primary-soft)]' : ''}`}>
                  {svg(item.icon, 26)}
                </span>
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className={`h-[72px] flex flex-col items-center justify-center gap-1 text-[13px] font-semibold ${
              menuActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            <span className={`h-8 w-14 rounded-full flex items-center justify-center ${menuActive ? 'bg-[var(--accent-primary-soft)]' : ''}`}>
              {svg(ICONS.menu, 26)}
            </span>
            {isAr ? 'القائمة' : 'Menu'}
          </button>
        </div>
      </nav>

      <div
        className={`fixed inset-0 z-40 ${menuOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          tabIndex={menuOpen ? 0 : -1}
          aria-label={isAr ? 'إغلاق' : 'Fermer'}
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside
          role="dialog"
          aria-label="Menu"
          className={`absolute top-0 bottom-0 start-0 w-[82%] max-w-sm bg-[var(--bg-elevated)] shadow-xl flex flex-col safe-top transition-transform duration-200 ease-out ${
            menuOpen ? 'translate-x-0' : isAr ? 'translate-x-full' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-5 h-16 border-b border-[var(--border-subtle)]">
            <div className="text-lg font-bold truncate">{profile?.fullName || t.appName}</div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label={isAr ? 'إغلاق' : 'Fermer'}
              className="h-12 w-12 rounded-full flex items-center justify-center text-2xl text-[var(--text-secondary)]"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {drawerItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`min-h-[68px] rounded-2xl border-[1.5px] px-4 flex items-center gap-4 text-lg font-semibold ${
                    active
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                  }`}
                >
                  <span className="text-[var(--accent-primary)]">{svg(item.icon, 28)}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
