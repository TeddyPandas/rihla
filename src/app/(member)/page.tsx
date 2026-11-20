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
  const { lang, t } = useAppShell();
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
  const [customQty, setCustomQty] = useState<string>('');
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

  async function handleQuickAdd(qty: number) {
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
      setCustomQty('');
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

  return (
    <div className="space-y-5 pb-6">
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-gold)]">
            {isAr ? 'مواقيت الصلاة • فاس' : 'Horaires de prière • Fès'}
          </span>
          <span className="text-xs text-[var(--text-secondary)] tabular-nums">{selectedDate}</span>
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

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {stayDates.map((d, idx) => {
          const active = d === selectedDate;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDate(d)}
              className={`shrink-0 h-12 px-3.5 rounded-xl border text-xs font-semibold tabular-nums transition-colors ${
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

      {groupedBySlot.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 text-center text-sm text-[var(--text-secondary)]">
          {isAr
            ? 'لا توجد أذكار مبرمجة لهذا اليوم بعد.'
            : 'Aucun objectif de zikr configuré pour cette journée.'}
        </div>
      ) : (
        groupedBySlot.map(({ slot, items }) => (
          <section key={slot} className="space-y-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] px-1">
              {t.slots[slot]}
            </h2>
            {items.map(({ zikr, effectiveTarget, donePersonal, remaining, pct, groupSummary: gs }) => {
              const completed = remaining === 0;
              return (
                <article
                  key={zikr.id}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                        {isAr ? zikr.nameAr : zikr.nameFr}
                      </h3>
                      {zikr.arabicText && (
                        <p className="font-arabic-script text-base text-[var(--accent-gold)] mt-0.5">
                          {zikr.arabicText}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold tabular-nums ${
                        completed
                          ? 'bg-[var(--accent-gold-soft)] text-[var(--accent-gold)]'
                          : 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>

                  <div className="h-2.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: completed ? 'var(--accent-gold)' : 'var(--accent-primary)',
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center bg-[var(--bg-surface)] rounded-xl p-2.5 tabular-nums">
                    <div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {isAr ? 'الهدف' : 'Objectif'}
                      </div>
                      <div className="text-sm font-bold">{effectiveTarget.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {isAr ? 'المُنجز' : 'Fait'}
                      </div>
                      <div className="text-sm font-bold text-[var(--accent-primary)]">
                        {donePersonal.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {isAr ? 'المتبقي' : 'Reste'}
                      </div>
                      <div className="text-sm font-bold text-[var(--accent-gold)]">
                        {remaining.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {gs && (
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)] tabular-nums">
                      <span>{isAr ? 'مجموع المجموعة :' : 'Total groupe :'}</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {(gs.totalDonePersonal + gs.totalDonePot).toLocaleString()} /{' '}
                        {gs.totalInitialTarget.toLocaleString()}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setActiveZikr(zikr);
                      setCustomQty('');
                    }}
                    className="w-full h-12 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--text-on-accent)] font-semibold text-sm transition-colors"
                  >
                    {isAr ? '+ تسجيل عدد' : '+ Saisir un comptage'}
                  </button>
                </article>
              );
            })}
          </section>
        ))
      )}

      {todayEntries.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] px-1">
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[var(--accent-primary)]">
                {isAr ? activeZikr.nameAr : activeZikr.nameFr}
              </h3>
              <button
                type="button"
                onClick={() => setActiveZikr(null)}
                className="h-10 w-10 rounded-xl bg-[var(--bg-surface)] font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 tabular-nums">
              {[100, 500, 1000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleQuickAdd(preset)}
                  className="h-14 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-primary)] font-bold text-base"
                >
                  +{preset.toLocaleString()}
                </button>
              ))}
            </div>

            {(() => {
              const card = zikrCards.find((c) => c.zikr.id === activeZikr.id);
              if (!card || card.remaining <= 0) return null;
              return (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleQuickAdd(card.remaining)}
                  className="w-full h-13 rounded-xl bg-[var(--accent-gold-soft)] text-[var(--accent-gold)] font-bold text-sm tabular-nums"
                >
                  {isAr
                    ? `إتمام المتبقي (${card.remaining.toLocaleString()})`
                    : `Valider tout le reste (+${card.remaining.toLocaleString()})`}
                </button>
              );
            })()}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = parseInt(customQty, 10);
                if (!Number.isNaN(val) && val > 0) void handleQuickAdd(val);
              }}
              className="flex gap-2"
            >
              <input
                type="number"
                inputMode="numeric"
                min={1}
                placeholder={isAr ? 'عدد مخصص...' : 'Quantité libre...'}
                value={customQty}
                onChange={(e) => setCustomQty(e.target.value)}
                className="flex-1 h-14 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-lg font-bold tabular-nums"
              />
              <button
                type="submit"
                disabled={submitting || !customQty}
                className="h-14 px-6 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-bold text-base disabled:opacity-50"
              >
                {isAr ? 'تأكيد' : 'Valider'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
