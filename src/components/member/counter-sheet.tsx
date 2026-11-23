'use client';

import React, { useEffect, useState } from 'react';
import { useAppShell } from '@/components/providers/app-shell-provider';
import type { LocalZikrDef } from '@/lib/offline/db';

interface Props {
  zikr: LocalZikrDef;
  target: number;
  done: number;
  arSize: number;
  submitting: boolean;
  onClose: () => void;
  onSave: (quantity: number) => void | Promise<void>;
}

const RING = 678.6; // 2 * pi * 108

/** Compteur du design « disciple » : anneau, tap +1, raccourcis, annuler, enregistrer. */
export function CounterSheet({ zikr, target, done, arSize, submitting, onClose, onSave }: Props) {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';
  const locale = isAr ? 'ar-u-nu-latn' : 'fr-FR';
  const nf = (n: number) => n.toLocaleString(locale);

  const [stack, setStack] = useState<number[]>([]);
  const [custom, setCustom] = useState('');

  const draft = stack.reduce((a, b) => a + b, 0);
  const total = done + draft;
  const remaining = Math.max(0, target - done);
  const pct = target > 0 ? Math.min(1, total / target) : 0;
  const scale = 0.8 + (arSize / 100) * 0.5;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const push = (n: number) => {
    if (n <= 0) return;
    setStack((s) => [...s, n]);
    if (n === 1 && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8);
  };

  const quick = 'h-14 flex-1 rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] text-base font-bold tabular-nums';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-[var(--scrim)]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isAr ? zikr.nameAr : zikr.nameFr}
        className="sheet-up relative w-full max-w-lg max-h-[94dvh] overflow-y-auto rounded-t-[28px] bg-[var(--bg-canvas)] border-t border-[var(--border-subtle)] px-5 pt-3 pb-6 safe-bottom space-y-4"
      >
        <span className="block mx-auto h-1.5 w-10 rounded-full bg-[var(--border-strong)]" />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Fermer'}
            className="h-12 w-12 shrink-0 rounded-full border-[1.5px] border-[var(--border-subtle)] flex items-center justify-center"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <div className="min-w-0">
            <div className="text-[17px] font-semibold truncate">{isAr ? zikr.nameAr : zikr.nameFr}</div>
            <div className="text-[13px] text-[var(--text-secondary)] tabular-nums">
              {isAr ? `الهدف ${nf(target)}` : `Objectif ${nf(target)}`}
            </div>
          </div>
        </div>

        {zikr.arabicText && (
          <p
            lang="ar"
            dir="rtl"
            className="font-arabic-script text-center text-[var(--accent-gold-text)]"
            style={{ fontSize: Math.round(40 * scale), lineHeight: 1.7 }}
          >
            {zikr.arabicText}
          </p>
        )}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => push(1)}
            aria-label="+1"
            className="relative h-[232px] w-[232px] rounded-full active:scale-[0.98] transition-transform"
          >
            <svg width="232" height="232" viewBox="0 0 232 232" aria-hidden="true">
              <circle cx="116" cy="116" r="108" fill="none" stroke="var(--bg-surface)" strokeWidth="8" />
              <circle
                cx="116"
                cy="116"
                r="108"
                fill="none"
                stroke="var(--accent-gold)"
                strokeWidth="8"
                strokeLinecap="round"
                transform="rotate(-90 116 116)"
                strokeDasharray={`${pct * RING} ${RING}`}
                style={{ transition: 'stroke-dasharray .2s ease' }}
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[52px] font-semibold leading-none tabular-nums" aria-live="polite">
                {nf(total)}
              </span>
              <span className="mt-1 text-sm text-[var(--text-secondary)] tabular-nums">
                {total >= target && target > 0
                  ? isAr
                    ? 'اكتمل الهدف'
                    : 'Objectif atteint'
                  : isAr
                  ? `من ${nf(target)}`
                  : `sur ${nf(target)}`}
              </span>
            </span>
          </button>
        </div>

        <div className="flex gap-2" dir="ltr">
          <button
            type="button"
            onClick={() => setStack((s) => s.slice(0, -1))}
            disabled={stack.length === 0}
            aria-label={isAr ? 'إلغاء آخر إضافة' : 'Annuler le dernier ajout'}
            className="h-14 w-14 shrink-0 rounded-xl border-[1.5px] border-[var(--border-subtle)] flex items-center justify-center disabled:opacity-40"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
          </button>
          {[10, 100, 1000].map((n) => (
            <button key={n} type="button" onClick={() => push(n)} className={quick}>
              +{n.toLocaleString(locale)}
            </button>
          ))}
        </div>

        {remaining - draft > 0 && (
          <button
            type="button"
            onClick={() => push(remaining - draft)}
            className="w-full h-12 rounded-xl bg-[var(--accent-gold-soft)] text-[var(--accent-gold-text)] font-bold text-sm tabular-nums"
          >
            {isAr ? `إتمام المتبقي (${nf(remaining - draft)})` : `Valider tout le reste (+${nf(remaining - draft)})`}
          </button>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = parseInt(custom, 10);
            if (!Number.isNaN(v) && v > 0) {
              push(v);
              setCustom('');
            }
          }}
          className="flex gap-2"
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder={isAr ? 'عدد مخصص...' : 'Quantité libre...'}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="flex-1 min-w-0 h-14 px-4 rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-lg font-bold tabular-nums focus:outline-none focus:border-[var(--accent-primary)]"
          />
          <button
            type="submit"
            disabled={!custom}
            className="h-14 px-5 rounded-xl border-[1.5px] border-[var(--border-subtle)] font-semibold disabled:opacity-40"
          >
            {isAr ? 'أضف' : 'Ajouter'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={draft <= 0 || submitting}
          className="w-full h-14 rounded-[14px] bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold text-[17px] disabled:opacity-45"
        >
          {draft > 0
            ? isAr
              ? `حفظ ${nf(draft)}+`
              : `Enregistrer +${nf(draft)}`
            : isAr
            ? 'حفظ'
            : 'Enregistrer'}
        </button>

      </div>
    </div>
  );
}
