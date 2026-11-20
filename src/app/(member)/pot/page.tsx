'use client';

import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb, type LocalZikrDef } from '@/lib/offline/db';
import {
  recordZikrEntryOfflineFirst,
  cancelZikrEntryOfflineFirst,
} from '@/lib/offline/sync-engine';
import { getFesTodayDate } from '@/lib/prayer/fes-schedule';
import { useAppShell } from '@/components/providers/app-shell-provider';

export default function MemberCommonPotPage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';

  const profile = useLiveQuery(() => offlineDb.profile.toCollection().first(), []);
  const zikrDefs = useLiveQuery(() => offlineDb.zikrDefs.orderBy('sortOrder').toArray(), []) ?? [];
  const groupSummary = useLiveQuery(() => offlineDb.groupSummary.toArray(), []) ?? [];
  const entries = useLiveQuery(() => offlineDb.entries.toArray(), []) ?? [];

  const [selectedZikr, setSelectedZikr] = useState<LocalZikrDef | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fesDate = useMemo(() => {
    const today = getFesTodayDate();
    if (today >= '2026-12-19' && today <= '2026-12-27') return today;
    return '2026-12-19';
  }, []);

  const potCards = useMemo(() => {
    return zikrDefs
      .map((z) => {
        const gs = groupSummary.find((s) => s.zikrId === z.id);
        if (!gs || gs.potAllocated <= 0) return null;

        const unsyncedLocalPot = entries
          .filter((e) => e.zikrId === z.id && e.source === 'pot' && e.status === 'active' && !e.synced)
          .reduce((acc, e) => acc + e.quantity, 0);

        const remaining = Math.max(0, gs.potRemaining - unsyncedLocalPot);
        const myPotContribution = entries
          .filter((e) => e.zikrId === z.id && e.source === 'pot' && e.status === 'active')
          .reduce((acc, e) => acc + e.quantity, 0);

        return {
          zikr: z,
          allocated: gs.potAllocated,
          remaining,
          myPotContribution,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [zikrDefs, groupSummary, entries]);

  const myPotHistory = useMemo(() => {
    return entries
      .filter((e) => e.source === 'pot')
      .sort((a, b) => b.createdAtClient.localeCompare(a.createdAtClient));
  }, [entries]);

  async function handleContributePot(qty: number) {
    if (!selectedZikr || !profile?.ziyaraId || qty <= 0) return;
    setSubmitting(true);
    try {
      await recordZikrEntryOfflineFirst({
        ziyaraId: profile.ziyaraId,
        zikrId: selectedZikr.id,
        entryDate: fesDate,
        quantity: qty,
        source: 'pot',
      });
      setQtyInput('');
      setSelectedZikr(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 pb-6">
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
        <h2 className="font-display text-xl font-bold text-[var(--status-pot)]">
          {isAr ? 'الوعاء المشترك التطوعي' : 'Pot commun volontaire'}
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          {isAr
            ? 'المساهمة في الوعاء المشترك تطوعية وتُخصم من رصيد الوعاء دون التأثير على هدفك الشخصي.'
            : 'Prenez volontairement une part du pot ouvert par le Cheikh. Ces saisies réduisent le pot sans modifier votre objectif personnel.'}
        </p>
      </section>

      {potCards.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 text-center text-sm text-[var(--text-secondary)]">
          {isAr
            ? 'لا يوجد أي وعاء مشترك مفتوح حالياً.'
            : 'Aucun pot commun ouvert pour le moment.'}
        </div>
      ) : (
        <div className="space-y-3">
          {potCards.map(({ zikr, allocated, remaining, myPotContribution }) => (
            <article
              key={zikr.id}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3 tabular-nums"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold">
                    {isAr ? zikr.nameAr : zikr.nameFr}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {isAr ? 'مساهمتك في الوعاء:' : 'Votre contribution au pot :'}{' '}
                    <strong className="text-[var(--accent-primary)]">
                      {myPotContribution.toLocaleString()}
                    </strong>
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--status-pot-soft)] text-[var(--status-pot)]">
                  {isAr ? 'المتبقي:' : 'Disponible :'} {remaining.toLocaleString()} /{' '}
                  {allocated.toLocaleString()}
                </span>
              </div>

              <button
                type="button"
                disabled={remaining === 0}
                onClick={() => {
                  setSelectedZikr(zikr);
                  setQtyInput('');
                }}
                className="w-full h-12 rounded-xl bg-[var(--status-pot)] text-white font-semibold text-sm disabled:opacity-40"
              >
                {remaining === 0
                  ? isAr
                    ? 'اكتمل الوعاء'
                    : 'Pot entièrement accompli'
                  : isAr
                  ? '+ المساهمة في هذا الوعاء'
                  : '+ Contribuer au pot commun'}
              </button>
            </article>
          ))}
        </div>
      )}

      {myPotHistory.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] px-1">
            {isAr ? 'سجل مساهماتك في الوعاء' : 'Vos saisies « Pot commun »'}
          </h3>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] divide-y divide-[var(--border-subtle)]">
            {myPotHistory.map((entry) => {
              const z = zikrDefs.find((d) => d.id === entry.zikrId);
              const cancelled = entry.status === 'cancelled';
              return (
                <div key={entry.clientMutationId} className="p-3.5 flex items-center justify-between">
                  <div className={cancelled ? 'opacity-50 line-through' : ''}>
                    <div className="text-sm font-semibold">
                      {z ? (isAr ? z.nameAr : z.nameFr) : 'Zikr'} —{' '}
                      <span className="tabular-nums font-bold">+{entry.quantity.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                      {entry.entryDate}
                    </div>
                  </div>
                  {!cancelled && profile?.ziyaraId && (
                    <button
                      type="button"
                      onClick={() =>
                        void cancelZikrEntryOfflineFirst({
                          ziyaraId: profile.ziyaraId,
                          targetClientMutationId: entry.clientMutationId,
                        })
                      }
                      className="h-9 px-3 rounded-xl border border-[var(--status-late)] text-[var(--status-late)] text-xs font-semibold"
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

      {selectedZikr && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[var(--status-pot)]">
                {isAr ? selectedZikr.nameAr : selectedZikr.nameFr} (Pot)
              </h3>
              <button
                type="button"
                onClick={() => setSelectedZikr(null)}
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
                  onClick={() => void handleContributePot(preset)}
                  className="h-14 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-bold text-base"
                >
                  +{preset}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = parseInt(qtyInput, 10);
                if (!Number.isNaN(val) && val > 0) void handleContributePot(val);
              }}
              className="flex gap-2"
            >
              <input
                type="number"
                inputMode="numeric"
                min={1}
                placeholder={isAr ? 'العدد...' : 'Quantité...'}
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                className="flex-1 h-14 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-lg font-bold tabular-nums"
              />
              <button
                type="submit"
                disabled={submitting || !qtyInput}
                className="h-14 px-6 rounded-xl bg-[var(--status-pot)] text-white font-bold text-base disabled:opacity-50"
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
