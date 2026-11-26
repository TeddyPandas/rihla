'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createClient } from '@/lib/supabase/client';
import { offlineDb } from '@/lib/offline/db';
import { useAppShell } from '@/components/providers/app-shell-provider';
import { InfoBody } from '@/components/info/info-body';

interface InfoRow {
  id: string; category: 'programme' | 'infos'; title_fr: string; title_ar: string | null;
  body_fr: string; body_ar: string | null; day_date: string | null; sort_order: number;
}

const cacheKey = (zid: string) => `ziyara_info_${zid}`;

export default function InformationsPage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';
  const profile = useLiveQuery(() => offlineDb.profile.toCollection().first(), []);
  const zid = profile?.ziyaraId;

  const [rows, setRows] = useState<InfoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [tab, setTab] = useState<'programme' | 'infos'>('programme');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!zid) return;
    let cancelled = false;
    (async () => {
      // Affiche tout de suite la dernière version connue (utile sans réseau), puis rafraîchit.
      try {
        const cached = localStorage.getItem(cacheKey(zid));
        if (cached && !cancelled) { setRows(JSON.parse(cached) as InfoRow[]); setFromCache(true); setLoading(false); }
      } catch { /* ignore */ }
      try {
        const { data, error } = await createClient().from('ziyara_info').select('*').eq('ziyara_id', zid).order('sort_order');
        if (error) throw error;
        if (!cancelled && data) {
          setRows(data as InfoRow[]);
          setFromCache(false);
          try { localStorage.setItem(cacheKey(zid), JSON.stringify(data)); } catch { /* ignore */ }
        }
      } catch { /* hors-ligne : on garde le cache */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [zid]);

  const list = useMemo(() => rows.filter((r) => r.category === tab).sort((a, b) => a.sort_order - b.sort_order), [rows, tab]);
  const hasProgramme = rows.some((r) => r.category === 'programme');
  const hasInfos = rows.some((r) => r.category === 'infos');

  // Le jour d'aujourd'hui est ouvert par défaut ; pour les infos pratiques tout est ouvert.
  useEffect(() => {
    const next = new Set<string>();
    for (const r of list) if (tab === 'infos' || r.day_date === today) next.add(r.id);
    if (next.size === 0 && list[0]) next.add(list[0].id);
    setOpen(next);
  }, [tab, list, today]);

  const toggle = (id: string) => setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const tabBtn = (active: boolean) => `flex-1 h-12 rounded-xl text-sm font-semibold border-[1.5px] ${active ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)] border-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'}`;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('programme')} className={tabBtn(tab === 'programme')}>{isAr ? 'برنامج الرحلة' : 'Programme du voyage'}</button>
        <button type="button" onClick={() => setTab('infos')} className={tabBtn(tab === 'infos')}>{isAr ? 'معلومات عملية' : 'Infos pratiques'}</button>
      </div>

      {fromCache && (
        <p className="text-xs text-[var(--text-secondary)] px-1">{isAr ? 'نسخة محفوظة على هاتفك (بدون إنترنت).' : 'Version enregistrée sur votre téléphone (hors connexion).'}</p>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)] px-1">…</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 text-center text-[var(--text-secondary)]">
          {(tab === 'programme' ? hasInfos : hasProgramme)
            ? (isAr ? 'لا شيء في هذا القسم بعد.' : 'Rien dans cette section pour le moment.')
            : (isAr ? 'لم ينشر المسؤول معلومات بعد.' : 'Le gestionnaire n’a pas encore publié d’informations.')}
        </div>
      ) : (
        list.map((r) => {
          const isOpen = open.has(r.id);
          const isToday = r.day_date === today;
          const title = (isAr && r.title_ar) || r.title_fr;
          const body = (isAr && r.body_ar) || r.body_fr;
          return (
            <section key={r.id} className={`rounded-2xl border-[1.5px] bg-[var(--bg-elevated)] ${isToday ? 'border-[var(--accent-gold)]' : 'border-[var(--border-subtle)]'}`}>
              <button type="button" onClick={() => toggle(r.id)} aria-expanded={isOpen} className="w-full text-start p-4 flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-semibold text-base">{title}</span>
                  {isToday && <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent-gold-soft)] text-[var(--accent-gold-text)]">{isAr ? 'اليوم' : 'Aujourd’hui'}</span>}
                </span>
                <span aria-hidden="true" className="text-[var(--text-secondary)] mt-0.5">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && <div className="px-4 pb-4 border-t border-[var(--border-subtle)] pt-3" dir={isAr && r.body_ar ? 'rtl' : undefined}><InfoBody body={body} /></div>}
            </section>
          );
        })
      )}
    </div>
  );
}
