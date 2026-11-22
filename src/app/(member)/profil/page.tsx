'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '@/lib/offline/db';
import { flushOutboxAndPull } from '@/lib/offline/sync-engine';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';

export default function ProfilPage() {
  const router = useRouter();
  const { lang, setLang, theme, toggleTheme, palette, setPalette, arSize, setArSize, isOnline } = useAppShell();
  const isAr = lang === 'ar';
  const profile = useLiveQuery(() => offlineDb.profile.toCollection().first(), []);
  const outboxCount = useLiveQuery(() => offlineDb.outbox.count(), []) ?? 0;
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const synced = outboxCount === 0;

  async function syncNow() {
    if (!profile?.ziyaraId || !navigator.onLine) return;
    setSyncing(true);
    try {
      await flushOutboxAndPull(profile.ziyaraId);
      setLastSync(new Date());
    } finally {
      setSyncing(false);
    }
  }

  async function logout() {
    if (outboxCount > 0) {
      const ok = window.confirm(
        isAr
          ? 'لديك تلاوات لم تُرسل بعد. تسجيل الخروج سيحذفها من هذا الجهاز. هل تريد المتابعة؟'
          : 'Des récitations n’ont pas encore été envoyées. Se déconnecter les effacera de cet appareil. Continuer ?'
      );
      if (!ok) return;
    }
    setLoggingOut(true);
    try {
      await createClient().auth.signOut();
      await Promise.all([
        offlineDb.profile.clear(),
        offlineDb.zikrDefs.clear(),
        offlineDb.goals.clear(),
        offlineDb.entries.clear(),
        offlineDb.groupSummary.clear(),
        offlineDb.outbox.clear(),
      ]);
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  const card = 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4';
  const seg = (on: boolean) =>
    `flex-1 h-12 rounded-xl text-[15px] font-semibold border-[1.5px] transition-colors ${
      on
        ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)] border-[var(--accent-primary)]'
        : 'border-[var(--border-subtle)] text-[var(--text-primary)]'
    }`;

  return (
    <div className="space-y-3.5 pb-6">
      <div className="flex items-center gap-3.5">
        <span className="h-14 w-14 rounded-full bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] flex items-center justify-center text-xl font-semibold">
          {(profile?.fullName || '?').trim().charAt(0).toUpperCase()}
        </span>
        <div>
          <div className="text-xl font-semibold">{profile?.fullName || '—'}</div>
          <div className="text-sm text-[var(--text-secondary)]">
            {profile?.role === 'cheikh' ? (isAr ? 'مسؤول' : 'Gestionnaire') : isAr ? 'عضو' : 'Membre'}
          </div>
        </div>
      </div>

      <section className={`${card} flex items-center gap-3`}>
        <span
          className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
            synced ? 'bg-[var(--status-ok-soft)] text-[var(--status-ok)]' : 'bg-[var(--status-offline-soft)] text-[var(--status-offline)]'
          }`}
        >
          {synced ? '✓' : '!'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold">
            {synced
              ? isAr
                ? 'تمت مزامنة كل شيء'
                : 'Tout est synchronisé'
              : isAr
              ? `${outboxCount} تلاوة بانتظار الإرسال`
              : `${outboxCount} récitation${outboxCount > 1 ? 's' : ''} en attente d’envoi`}
          </div>
          <div className="text-[13px] text-[var(--text-secondary)]">
            {lastSync
              ? (isAr ? 'آخر مزامنة ' : 'Dernière synchro ') + lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : !isOnline
              ? isAr
                ? 'لا يوجد اتصال حاليًا'
                : 'Pas de connexion pour le moment'
              : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing || !isOnline}
          className="h-12 px-4 rounded-xl border-[1.5px] border-[var(--border-subtle)] text-[15px] font-semibold disabled:opacity-50"
        >
          {syncing ? '…' : isAr ? 'زامن' : 'Synchroniser'}
        </button>
      </section>

      <section className={`${card} space-y-2.5`}>
        <div className="text-[15px] font-semibold">{isAr ? 'اللغة' : 'Langue'}</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setLang('fr')} className={seg(!isAr)} aria-pressed={!isAr}>
            Français
          </button>
          <button type="button" onClick={() => setLang('ar')} className={seg(isAr)} aria-pressed={isAr} lang="ar">
            العربية
          </button>
        </div>
      </section>

      <section className={`${card} space-y-2.5`}>
        <div className="text-[15px] font-semibold">{isAr ? 'الألوان' : 'Couleurs'}</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPalette('A')} className={seg(palette === 'A')} aria-pressed={palette === 'A'}>
            {isAr ? 'أخضر وذهبي' : 'Vert & or'}
          </button>
          <button type="button" onClick={() => setPalette('B')} className={seg(palette === 'B')} aria-pressed={palette === 'B'}>
            {isAr ? 'أزرق ليلي' : 'Bleu nuit'}
          </button>
        </div>
      </section>

      <section className={`${card} space-y-2`}>
        <div className="text-[15px] font-semibold">{isAr ? 'حجم الخط العربي' : 'Taille du texte arabe'}</div>
        <p
          lang="ar"
          dir="rtl"
          className="font-arabic-script text-center text-[var(--accent-gold-text)]"
          style={{ fontSize: Math.round(34 * (0.8 + arSize / 200)), lineHeight: 1.6 }}
        >
          سُبْحَانَ اللَّهِ
        </p>
        <div className="flex items-center gap-3" dir="ltr">
          <span className="font-arabic-script text-lg w-8 text-center" lang="ar">أ</span>
          <input
            type="range"
            min={0}
            max={100}
            value={arSize}
            onChange={(e) => setArSize(Number(e.target.value))}
            aria-label={isAr ? 'حجم الخط العربي' : 'Taille du texte arabe'}
            className="flex-1 accent-[var(--accent-primary)]"
          />
          <span className="font-arabic-script text-3xl w-8 text-center" lang="ar">أ</span>
        </div>
      </section>

      <button
        type="button"
        role="switch"
        aria-checked={theme === 'dark'}
        onClick={toggleTheme}
        className={`${card} w-full flex items-center justify-between text-[15px] font-semibold`}
      >
        <span>{isAr ? 'الوضع الداكن' : 'Mode sombre'}</span>
        <span
          className={`h-8 w-14 rounded-full p-1 transition-colors ${
            theme === 'dark' ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-strong)]'
          }`}
        >
          <span
            className={`block h-6 w-6 rounded-full bg-[var(--bg-elevated)] transition-transform ${
              theme === 'dark' ? (isAr ? '-translate-x-6' : 'translate-x-6') : ''
            }`}
          />
        </span>
      </button>

      <Link href="/biographie" className={`${card} flex items-center justify-between text-[15px] font-semibold`}>
        <span>{isAr ? 'السيرة' : 'Biographie'}</span>
        <span className="text-[var(--text-secondary)] flip">›</span>
      </Link>

      <button
        type="button"
        onClick={logout}
        disabled={loggingOut}
        className="w-full h-[52px] rounded-[14px] border-[1.5px] border-[var(--status-late)] text-[var(--status-late)] text-base font-semibold disabled:opacity-60"
      >
        {isAr ? 'تسجيل الخروج' : 'Se déconnecter'}
      </button>
      <div className="text-center text-[13px] text-[var(--text-secondary)]">Ziyara Fès 2026</div>
    </div>
  );
}
