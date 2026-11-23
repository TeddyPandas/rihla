'use client';

import React, { useState } from 'react';
import chaptersData from '@/content/biography.json';
import { useAppShell } from '@/components/providers/app-shell-provider';

interface BioChapter {
  chapterNumber: number;
  isSample?: boolean;
  titleFr: string;
  titleAr: string;
  paragraphsFr: string[];
  paragraphsAr: string[];
}

export default function SeydinaCheikhBiographyPage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';

  const chapters = chaptersData as BioChapter[];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [fontScale, setFontScale] = useState<'base' | 'lg' | 'xl'>('base');

  const current = chapters[selectedIdx] ?? chapters[0];

  const textSizeClass =
    fontScale === 'xl'
      ? 'text-xl leading-9'
      : fontScale === 'lg'
      ? 'text-lg leading-8'
      : 'text-base leading-7';

  return (
    <div className="space-y-4 pb-8">
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-[var(--accent-gold-text)]">
            {isAr ? 'فضاء القراءة (متاح بدون إنترنت)' : 'Lecture hors-ligne'}
          </span>
          <h2 className="font-display text-lg font-bold text-[var(--accent-primary)]">
            {isAr ? 'سيرة سيدنا الشيخ' : 'Vie de Cheikh Ahmed Tijani'}
          </h2>
        </div>

        <div className="flex items-center gap-1 bg-[var(--bg-surface)] p-1 rounded-xl">
          {(
            [
              ['base', 'A'],
              ['lg', 'A+'],
              ['xl', 'A++'],
            ] as const
          ).map(([size, label]) => (
            <button
              key={size}
              type="button"
              onClick={() => setFontScale(size)}
              className={`h-9 px-3 rounded-lg text-xs font-bold transition-colors ${
                fontScale === size
                  ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {chapters.map((ch, idx) => {
          const active = idx === selectedIdx;
          return (
            <button
              key={ch.chapterNumber}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`shrink-0 h-11 px-4 rounded-xl border text-xs font-semibold transition-colors ${
                active
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
              }`}
            >
              {isAr && ch.titleAr ? ch.titleAr : ch.titleFr}
            </button>
          );
        })}
      </div>

      {current && (
        <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 sm:p-6 space-y-4">
          {current.isSample && (
            <div className="px-3 py-2 rounded-xl bg-[var(--status-offline-soft)] text-[var(--status-offline)] text-xs font-semibold">
              {isAr
                ? 'محتوى تجريبي (EXEMPLE) — في انتظار إدراج النص الرسمي.'
                : 'Contenu de démonstration (EXEMPLE) — prêt à recevoir votre texte définitif.'}
            </div>
          )}

          <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--accent-primary)]">
            {isAr && current.titleAr ? current.titleAr : current.titleFr}
          </h3>

          <div
            className={`space-y-4 text-[var(--text-primary)] ${textSizeClass} ${
              isAr && current.paragraphsAr.length > 0 ? 'font-arabic-script' : ''
            }`}
          >
            {(isAr && current.paragraphsAr.length > 0 ? current.paragraphsAr : current.paragraphsFr).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={selectedIdx === 0}
              onClick={() => setSelectedIdx((i) => Math.max(0, i - 1))}
              className="h-11 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold disabled:opacity-40"
            >
              {isAr ? '→ الفصل السابق' : '← Chapitre précédent'}
            </button>
            <button
              type="button"
              disabled={selectedIdx >= chapters.length - 1}
              onClick={() => setSelectedIdx((i) => Math.min(chapters.length - 1, i + 1))}
              className="h-11 px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] text-xs font-semibold disabled:opacity-40"
            >
              {isAr ? 'الفصل التالي ←' : 'Chapitre suivant →'}
            </button>
          </div>
        </article>
      )}
    </div>
  );
}
