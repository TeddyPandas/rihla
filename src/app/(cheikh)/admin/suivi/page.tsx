'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';
import { HBars, Kpi } from '@/components/admin/charts';

interface Row {
  ziyara_id: string; ziyara_title_fr: string; start_date: string;
  member_id: string; user_id: string; phone_e164: string; full_name: string | null;
  target: number; done: number;
}

export default function GlobalProgressPage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';
  const nf = (n: number) => Math.round(n).toLocaleString(isAr ? 'ar-u-nu-latn' : 'fr-FR');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    void (async () => {
      const { data, error } = await createClient().rpc('global_progress');
      if (error) setErr(error.message);
      setRows(((data ?? []) as Row[]).map((r) => ({ ...r, target: Number(r.target), done: Number(r.done) })));
    })();
  }, []);

  const model = useMemo(() => {
    const r = rows ?? [];
    const voyages = [...new Map(r.map((x) => [x.ziyara_id, { id: x.ziyara_id, title: x.ziyara_title_fr, start: x.start_date }])).values()].sort((a, b) => a.start.localeCompare(b.start));
    const people = new Map<string, { key: string; name: string; phone: string; per: Map<string, { target: number; done: number }>; target: number; done: number }>();
    for (const x of r) {
      const key = x.user_id;
      const p = people.get(key) ?? { key, name: x.full_name || x.phone_e164, phone: x.phone_e164, per: new Map(), target: 0, done: 0 };
      p.per.set(x.ziyara_id, { target: x.target, done: x.done });
      p.target += x.target; p.done += x.done;
      if (x.full_name) p.name = x.full_name;
      people.set(key, p);
    }
    const list = [...people.values()].sort((a, b) => b.done - a.done);
    const perVoyage = voyages.map((v) => {
      const mine = r.filter((x) => x.ziyara_id === v.id);
      return { ...v, target: mine.reduce((a, x) => a + x.target, 0), done: mine.reduce((a, x) => a + x.done, 0), n: mine.length };
    });
    return { voyages, list, perVoyage, totalDone: r.reduce((a, x) => a + x.done, 0), totalTarget: r.reduce((a, x) => a + x.target, 0) };
  }, [rows]);

  if (rows === null) return <div className="py-10 text-center text-[var(--text-secondary)]">{isAr ? 'جاري التحميل…' : 'Chargement…'}</div>;
  const shown = model.list.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.phone.includes(q));
  const card = 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-3';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{isAr ? 'المتابعة العامة' : 'Suivi global'}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{isAr ? 'تقدم كل شخص عبر جميع الرحلات.' : 'Progression de chaque personne sur l’ensemble de vos voyages.'}</p>
      </div>
      {err && <div className="p-3 rounded-xl bg-[var(--status-late-soft)] text-[var(--status-late)] text-sm">{err}</div>}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={isAr ? 'الأشخاص' : 'Personnes'} value={nf(model.list.length)} />
        <Kpi label={isAr ? 'الرحلات' : 'Voyages'} value={nf(model.voyages.length)} />
        <Kpi label={isAr ? 'المنجز (الكل)' : 'Total fait'} value={nf(model.totalDone)} tone="ok" />
        <Kpi label={isAr ? 'الأهداف (الكل)' : 'Total objectifs'} value={nf(model.totalTarget)} sub={model.totalTarget > 0 ? `${Math.round((model.totalDone / model.totalTarget) * 100)} %` : undefined} />
      </section>

      <section className={card}>
        <h3 className="text-lg font-semibold">{isAr ? 'حسب الرحلة' : 'Par voyage'}</h3>
        <HBars rows={model.perVoyage.map((v) => ({ label: `${v.title} (${v.n})`, value: v.done, max: Math.max(1, v.target), right: `${nf(v.done)} / ${nf(v.target)}` }))} />
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{isAr ? 'حسب الشخص' : 'Par personne'}</h3>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={isAr ? 'بحث…' : 'Rechercher…'} className="h-11 px-3 rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums border-separate border-spacing-y-1">
            <thead>
              <tr className="text-xs text-[var(--text-secondary)]">
                <th className="text-start font-semibold pe-3">{isAr ? 'الشخص' : 'Personne'}</th>
                {model.voyages.map((v) => <th key={v.id} className="font-semibold px-2 whitespace-nowrap">{v.title}</th>)}
                <th className="font-semibold px-2">{isAr ? 'المجموع' : 'Total'}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.key} className="bg-[var(--bg-surface)]">
                  <td className="py-2 ps-3 pe-3 rounded-s-lg font-medium whitespace-nowrap">{p.name}</td>
                  {model.voyages.map((v) => {
                    const c = p.per.get(v.id);
                    const pct = c && c.target > 0 ? Math.min(100, Math.round((c.done / c.target) * 100)) : null;
                    return (
                      <td key={v.id} className="px-2 text-center">
                        {c ? (<><div>{nf(c.done)}<span className="opacity-60"> / {nf(c.target)}</span></div>{pct !== null && <div className="h-1.5 rounded-full bg-[var(--border-subtle)] mt-1 overflow-hidden"><div className="h-full bg-[var(--accent-primary)]" style={{ width: `${pct}%` }} /></div>}</>) : <span className="opacity-40">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-2 text-center font-semibold rounded-e-lg">{nf(p.done)}<span className="opacity-60 font-normal"> / {nf(p.target)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="text-sm text-[var(--text-secondary)] py-3">—</p>}
        </div>
      </section>
    </div>
  );
}
