'use client';

import React from 'react';
import type { TimeSlot } from '@/lib/offline/db';
import { useAppShell } from '@/components/providers/app-shell-provider';

export type SlotPlan = { slot: TimeSlot; qty: number }[];

const PLAN_SLOTS: TimeSlot[] = ['morning', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'night'];
const PRAYERS: TimeSlot[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

interface Props {
  value: SlotPlan;
  onChange: (plan: SlotPlan) => void;
  /** Texte d'aide sous le titre (dépend du mode : poids relatifs ou quantités exactes). */
  hint?: string;
}

/** Plan « X fois après chaque prière » : cases à cocher + quantité par créneau (même quantité en un clic). */
export function SlotPlanEditor({ value, onChange, hint }: Props) {
  const { lang, t } = useAppShell();
  const isAr = lang === 'ar';
  const map = new Map(value.map((p) => [p.slot, p.qty]));
  const sameQty = value.length > 0 && value.every((p) => p.qty === value[0].qty) ? String(value[0].qty) : '';
  const [bulk, setBulk] = React.useState('');

  const emit = (m: Map<TimeSlot, number>) =>
    onChange(PLAN_SLOTS.filter((s) => m.has(s)).map((s) => ({ slot: s, qty: m.get(s) as number })));

  const toggle = (s: TimeSlot) => {
    const m = new Map(map);
    if (m.has(s)) m.delete(s);
    else m.set(s, Number(bulk || sameQty) > 0 ? Number(bulk || sameQty) : 100);
    emit(m);
  };

  const setQty = (s: TimeSlot, q: number) => {
    const m = new Map(map);
    m.set(s, q);
    emit(m);
  };

  const applyBulk = (q: number) => {
    setBulk(String(q));
    if (!(q > 0)) return;
    emit(new Map(value.map((p) => [p.slot, q] as [TimeSlot, number])));
  };

  const input =
    'h-11 w-24 px-2 rounded-lg border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm tabular-nums text-center';

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{isAr ? 'الكمية بعد كل صلاة' : 'Quantité à chaque prière'}</span>
        <span className="flex flex-wrap gap-2 text-xs font-semibold">
          <button
            type="button"
            className="h-9 px-3 rounded-lg border border-[var(--border-subtle)] text-[var(--accent-primary)]"
            onClick={() => emit(new Map(PRAYERS.map((s) => [s, map.get(s) ?? (Number(bulk) > 0 ? Number(bulk) : 100)] as [TimeSlot, number])))}
          >
            {isAr ? 'الصلوات الخمس' : 'Les 5 prières'}
          </button>
          <button type="button" className="h-9 px-3 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)]" onClick={() => onChange([])}>
            {isAr ? 'مسح' : 'Effacer'}
          </button>
        </span>
      </div>
      {hint && <p className="text-xs text-[var(--text-secondary)]">{hint}</p>}

      <div className="flex items-center gap-2 text-sm">
        <span className="text-[var(--text-secondary)]">{isAr ? 'الكمية نفسها للجميع :' : 'Même quantité partout :'}</span>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          className={input}
          value={bulk || sameQty}
          onChange={(e) => applyBulk(Number(e.target.value))}
          disabled={value.length === 0}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PLAN_SLOTS.map((s) => {
          const on = map.has(s);
          return (
            <div
              key={s}
              className={`flex items-center justify-between gap-2 min-h-12 px-3 rounded-xl border-[1.5px] ${
                on ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]' : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)]'
              }`}
            >
              <label className="flex items-center gap-2.5 text-sm font-medium flex-1 cursor-pointer">
                <input type="checkbox" checked={on} onChange={() => toggle(s)} className="h-5 w-5 accent-[var(--accent-primary)]" />
                {t.slots[s]}
              </label>
              {on && (
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  className={input}
                  value={map.get(s)}
                  onChange={(e) => setQty(s, Number(e.target.value))}
                  aria-label={t.slots[s]}
                />
              )}
            </div>
          );
        })}
      </div>
      {value.length > 0 && (
        <div className="text-sm tabular-nums">
          {isAr ? 'المجموع في اليوم :' : 'Total par jour :'} <b>{value.reduce((a, p) => a + (p.qty || 0), 0).toLocaleString('fr-FR')}</b>
        </div>
      )}
    </div>
  );
}
