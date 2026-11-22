'use client';

import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb, type LocalZikrDef, type TimeSlot } from '@/lib/offline/db';
import {
  recordZikrEntryOfflineFirst,
  cancelZikrEntryOfflineFirst,
} from '@/lib/offline/sync-engine';
import { getFesTodayDate, getFesPrayerTimes } from '@/lib/prayer/fes-schedule';
import { useAppShell } from '@/components/providers/app-shell-provider';
import { CounterSheet } from '@/components/member/counter-sheet';

const SLOT_ORDER: TimeSlot[] = [
  'morning',
  'fajr',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
  'night',
  'anytime',
];

export default function MemberProgramPage() {
  const { lang, t, arSize } = useAppShell();
  const isAr = lang === 'ar';

  const profile = useLiveQuery(() => offlineDb.profile.toCollection().first(), []);
  const zikrDefs = useLiveQuery(() => offlineDb.zikrDefs.orderBy('sortOrder').toArray(), []) ?? [];
  const goals = useLiveQuery(() => offlineDb.goals.toArray(), []) ?? [];
  const entries = useLiveQuery(() => offlineDb.entries.toArray(), []) ?? [];
  const groupSummary = useLiveQuery(() => offlineDb.groupSummary.toArray(), []) ?? [];

  const fesToday = useMemo(() => getFesTodayDate(), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (fesToday >= '2026-12-19' && fesToday <= '2026-12-27') return fesToday;
    return '2026-12-19';
  });

  const [activeZikr, setActiveZikr] = useState<LocalZikrDef | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const prayerTimes = useMemo(() => getFesPrayerTimes(selectedDate), [selectedDate]);

  const stayDates = useMemo(() => {
    const start = profile?.startDate || '2026-12-19';
    const end = profile?.endDate || '2026-12-27';
    const list: string[] = [];
    const cur = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (cur <= last) {
      list.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return list;
  }, [profile]);

  const zikrCards = useMemo(() => {
    return zikrDefs.map((z) => {
      const matchingGoals = goals.filter(
        (g) => g.zikrId === z.id && (g.targetDate === selectedDate || g.targetDate === null)
      );
      const effectiveTarget = matchingGoals.reduce(
        (acc, g) => acc + Math.max(0, g.initialTarget + g.adjustedDelta),
        0
      );
      const slot: TimeSlot = matchingGoals[0]?.slot || z.defaultSlot || 'anytime';

      const donePersonal = entries
        .filter(
          (e) =>
            e.zikrId === z.id &&
            e.source === 'personal' &&
            e.status === 'active' &&
            (z.scope === 'stay' || e.entryDate === selectedDate)
        )
        .reduce((acc, e) => acc + e.quantity, 0);

      const remaining = Math.max(0, effectiveTarget - donePersonal);
      const pct = effectiveTarget > 0 ? Math.min(100, Math.round((donePersonal / effectiveTarget) * 100)) : 100;
      const gSum = groupSummary.find((s) => s.zikrId === z.id);

      return {
        zikr: z,
        slot,
        effectiveTarget,
        donePersonal,
        remaining,
        pct,
        groupSummary: gSum,
      };
    });
  }, [zikrDefs, goals, entries, selectedDate, groupSummary]);

  const groupedBySlot = useMemo(() => {
    return SLOT_ORDER.map((slot) => ({
      slot,
      items: zikrCards.filter((c) => c.slot === slot && c.effectiveTarget > 0),
    })).filter((g) => g.items.length > 0);
  }, [zikrCards]);

  const todayEntries = useMemo(() => {
    return entries
      .filter((e) => e.entryDate === selectedDate && e.source === 'personal')
      .sort((a, b) => b.createdAtClient.localeCompare(a.createdAtClient));
  }, [entries, selectedDate]);

  async function handleSave(qty: number) {
    if (!activeZikr || !profile?.ziyaraId || qty <= 0) return;
    setSubmitting(true);
    try {
      await recordZikrEntryOfflineFirst({
        ziyaraId: profile.ziyaraId,
        zikrId: activeZikr.id,
        entryDate: selectedDate,
        quantity: qty,
        source: 'personal',
      });
      setActiveZikr(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelEntry(clientMutationId: string) {
    if (!profile?.ziyaraId) return;
    await cancelZikrEntryOfflineFirst({
      ziyaraId: profile.ziyaraId,
      targetClientMutationId: clientMutationId,
    });
  }

  const totals = zikrCards.reduce(
    (acc, c) => {
      if (c.effectiveTarget > 0) {
        acc.target += c.effectiveTarget;
        acc.done += Math.min(c.donePersonal, c.effectiveTarget);
        acc.count += 1;
        if (c.remaining === 0) acc.completed += 1;
      }
      return acc;
    },
    { target: 0, done: 0, count: 0, completed: 0 }
  );
  const heroPct = totals.target > 0 ? Math.round((totals.done / totals.target) * 100) : 0;
  const locale = isAr ? 'ar-u-nu-latn' : 'fr-FR';
  const nf = (n: number) => n.toLocaleString(locale);

  return (
    <div className="space-y-5 pb-6">
      <section className="rounded-[20px] bg-[var(--hero-bg)] text-[var(--hero-text)] p-5 space-y-3">
        <div className="text-sm font-semibold text-[var(--hero-accent)]">
          {isAr ? 'تقدمي في هذا اليوم' : 'Ma progression du jour'}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold tabular-nums">
            {totals.count > 0
              ? isAr
                ? `${totals.completed} من ${totals.count} مكتمل`
                : `${totals.completed} sur ${totals.count} terminé${totals.completed > 1 ? 's' : ''}`
              : isAr
              ? 'لا أهداف'
              : 'Aucun objectif'}
          </span>
          <span className="text-3xl font-semibold tabular-nums">
            {heroPct}
            {isAr ? '٪' : ' %'}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full rounded-full bg-[var(--hero-accent)] transition-all duration-300" style={{ width: `${heroPct}%` }} />
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {stayDates.map((d, idx) => {
          const active = d === selectedDate;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDate(d)}
              aria-pressed={active}
              className={`shrink-0 h-14 px-4 rounded-xl border-[1.5px] text-xs font-semibold tabular-nums transition-colors ${
                active
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
              }`}
            >
              <div>{isAr ? `اليوم ${idx + 1}` : `Jour ${idx + 1}`}</div>
              <div className="opacity-80">{d.slice(5)}</div>
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-semibold text-[var(--accent-gold-text)]">
            {isAr ? 'مواقيت الصلاة • فاس' : 'Horaires de prière • Fès'}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-center tabular-nums">
          {[
            { label: isAr ? 'الفجر' : 'Fajr', time: prayerTimes.fajr },
            { label: isAr ? 'الظهر' : 'Dhuhr', time: prayerTimes.dhuhr },
            { label: isAr ? 'العصر' : 'Asr', time: prayerTimes.asr },
            { label: isAr ? 'المغرب' : 'Maghrib', time: prayerTimes.maghrib },
            { label: isAr ? 'العشاء' : 'Isha', time: prayerTimes.isha },
          ].map((p) => (
            <div key={p.label} className="rounded-xl bg-[var(--bg-surface)] py-2 px-1">
              <div className="text-[11px] text-[var(--text-secondary)]">{p.label}</div>
              <div className="text-sm font-bold mt-0.5">{p.time}</div>
            </div>
          ))}
        </div>
      </section>

      {groupedBySlot.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 text-center text-base text-[var(--text-secondary)]">
          {isAr ? 'لا توجد أذكار مبرمجة لهذا اليوم بعد.' : 'Aucun objectif de zikr configuré pour cette journée.'}
        </div>
      ) : (
        groupedBySlot.map(({ slot, items }) => (
          <section key={slot} className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] px-1">{t.slots[slot]}</h2>
            {items.map(({ zikr, effectiveTarget, donePersonal, remaining, pct, groupSummary: gs }) => {
              const completed = remaining === 0;
              const started = donePersonal > 0;
              const badge = completed
                ? { cls: 'bg-[var(--status-ok-soft)] text-[var(--status-ok)]', label: isAr ? 'مكتمل' : 'Fait' }
                : started
                ? { cls: 'bg-[var(--status-offline-soft)] text-[var(--status-offline)]', label: isAr ? 'جارٍ' : 'En cours' }
                : { cls: 'bg-[var(--bg-surface)] text-[var(--text-secondary)]', label: isAr ? 'لم يبدأ' : 'Pas commencé' };
              return (
                <button
                  key={zikr.id}
                  type="button"
                  onClick={() => setActiveZikr(zikr)}
                  className={`w-full text-start rounded-2xl border-[1.5px] bg-[var(--bg-elevated)] p-4 space-y-3 transition-colors ${
                    started && !completed ? 'border-[var(--accent-gold)]' : 'border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold">{isAr ? zikr.nameAr : zikr.nameFr}</div>
                      {zikr.arabicText && (
                        <p lang="ar" dir="rtl" className="font-arabic-script text-xl leading-relaxed text-[var(--accent-gold-text)] mt-0.5">
                          {zikr.arabicText}
                        </p>
                      )}
                      <div className="text-sm text-[var(--text-secondary)] tabular-nums mt-0.5">
                        {isAr ? `${nf(donePersonal)} من ${nf(effectiveTarget)}` : `${nf(donePersonal)} sur ${nf(effectiveTarget)}`}
                        {!completed && (
                          <span>
                            {' · '}
                            {isAr ? `المتبقي ${nf(remaining)}` : `reste ${nf(remaining)}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: completed ? 'var(--status-ok)' : 'var(--accent-gold)' }}
                    />
                  </div>
                  {gs && (
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] tabular-nums">
                      <span>{isAr ? 'مجموع المجموعة' : 'Total du groupe'}</span>
                      <span dir="ltr" className="font-semibold text-[var(--text-primary)]">
                        {nf(gs.totalDonePersonal + gs.totalDonePot)} / {nf(gs.totalInitialTarget)}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </section>
        ))
      )}

      {todayEntries.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] px-1">
            {isAr ? 'سجل اليوم' : 'Historique des saisies du jour'}
          </h2>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] divide-y divide-[var(--border-subtle)]">
            {todayEntries.map((entry) => {
              const z = zikrDefs.find((d) => d.id === entry.zikrId);
              const isCancelled = entry.status === 'cancelled';
              return (
                <div
                  key={entry.clientMutationId}
                  className="p-3.5 flex items-center justify-between gap-3"
                >
                  <div className={isCancelled ? 'opacity-50 line-through' : ''}>
                    <div className="text-sm font-semibold">
                      {z ? (isAr ? z.nameAr : z.nameFr) : 'Zikr'} —{' '}
                      <span className="tabular-nums font-bold">
                        +{entry.quantity.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                      {new Date(entry.createdAtClient).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {!entry.synced && ` • ${isAr ? 'محلي' : 'En attente de sync'}`}
                      {isCancelled && ` • ${isAr ? 'ملغى' : 'Annulée'}`}
                    </div>
                  </div>
                  {!isCancelled && (
                    <button
                      type="button"
                      onClick={() => handleCancelEntry(entry.clientMutationId)}
                      className="h-10 px-3 rounded-xl border border-[var(--status-late)] text-[var(--status-late)] text-xs font-semibold"
                    >
                      {isAr ? 'إلغاء' : 'Annuler'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeZikr && (
        <CounterSheet
          zikr={activeZikr}
          target={zikrCards.find((c) => c.zikr.id === activeZikr.id)?.effectiveTarget ?? 0}
          done={zikrCards.find((c) => c.zikr.id === activeZikr.id)?.donePersonal ?? 0}
          arSize={arSize}
          submitting={submitting}
          onClose={() => setActiveZikr(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
