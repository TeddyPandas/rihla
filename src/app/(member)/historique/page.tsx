'use client';

import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '@/lib/offline/db';
import { useAppShell } from '@/components/providers/app-shell-provider';

export default function HistoriquePage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';
  const zikrDefs = useLiveQuery(() => offlineDb.zikrDefs.toArray(), []) ?? [];
  const entries = useLiveQuery(() => offlineDb.entries.toArray(), []) ?? [];

  const days = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const e of entries) {
      if (e.status !== 'active' || e.source !== 'personal') continue;
      const perDay = map.get(e.entryDate) ?? new Map<string, number>();
      perDay.set(e.zikrId, (perDay.get(e.zikrId) ?? 0) + e.quantity);
      map.set(e.entryDate, perDay);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  const locale = isAr ? 'ar-u-nu-latn' : 'fr-FR';
  const fmt = (iso: string) => {
    const s = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      new Date(`${iso}T00:00:00Z`)
    );
    return isAr ? s : s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div className="space-y-4 pb-6">
      <h1 className="text-[28px] font-semibold">{isAr ? 'السجل' : 'Historique'}</h1>
      {days.length === 0 ? (
        <p className="text-base leading-relaxed text-[var(--text-secondary)] text-center py-10">
          {isAr ? 'ستظهر هنا تلاواتك المحفوظة.' : 'Vos récitations enregistrées apparaîtront ici.'}
        </p>
      ) : (
        days.map(([date, perZikr]) => {
          const total = [...perZikr.values()].reduce((a, b) => a + b, 0);
          return (
            <section key={date} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold text-[var(--accent-gold-text)]">{fmt(date)}</h2>
                <span className="text-sm tabular-nums text-[var(--text-secondary)]">{total.toLocaleString(locale)}</span>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] divide-y divide-[var(--border-subtle)]">
                {[...perZikr.entries()].map(([zikrId, qty]) => {
                  const z = zikrDefs.find((d) => d.id === zikrId);
                  return (
                    <div key={zikrId} className="px-4 py-3.5 flex items-center justify-between gap-3">
                      <span className="text-[15px] font-medium">{z ? (isAr ? z.nameAr : z.nameFr) : 'Zikr'}</span>
                      <b className="tabular-nums">{qty.toLocaleString(locale)}</b>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
