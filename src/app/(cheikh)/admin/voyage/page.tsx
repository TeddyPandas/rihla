'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { offlineDb } from '@/lib/offline/db';
import { useAppShell } from '@/components/providers/app-shell-provider';

interface Ziyara {
  id: string;
  title_fr: string;
  title_ar: string;
  city: string;
  timezone: string;
  start_date: string;
  end_date: string;
}

const TIMEZONES = ['Africa/Casablanca', 'Africa/Dakar', 'Europe/Paris', 'Asia/Riyadh', 'Africa/Algiers', 'Africa/Tunis'];

function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}
function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function VoyagePage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';
  const [orig, setOrig] = useState<Ziyara | null>(null);
  const [f, setF] = useState<Ziyara | null>(null);
  const [shift, setShift] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from('ziyaras').select('*').eq('is_active', true).order('start_date').limit(1).maybeSingle();
    if (data) {
      setOrig(data as Ziyara);
      setF(data as Ziyara);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!f || !orig) {
    return <div className="text-[var(--text-secondary)] py-10 text-center">{isAr ? 'جاري التحميل…' : 'Chargement…'}</div>;
  }

  const delta = daysBetween(orig.start_date, f.start_date);
  const duration = daysBetween(f.start_date, f.end_date) + 1;
  const origDuration = daysBetween(orig.start_date, orig.end_date) + 1;
  const dirty = JSON.stringify(f) !== JSON.stringify(orig);

  function setStart(v: string) {
    if (!f || !orig) return;
    // Garde la durée d'origine : décaler la date de début décale la date de fin.
    setF({ ...f, start_date: v, end_date: v ? addDays(v, origDuration - 1) : f.end_date });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    setBusy(true);
    setFb(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('update_ziyara', {
        p_ziyara_id: f.id,
        p_title_fr: f.title_fr,
        p_title_ar: f.title_ar,
        p_city: f.city,
        p_timezone: f.timezone,
        p_start: f.start_date,
        p_end: f.end_date,
        p_shift: shift,
      });
      if (error) throw error;
      // Le profil hors ligne (dates, titres) est rafraîchi à la prochaine synchro ; on le met à jour tout de suite.
      const prof = await offlineDb.profile.toCollection().first();
      if (prof) {
        await offlineDb.profile.put({
          ...prof,
          ziyaraTitleFr: f.title_fr,
          ziyaraTitleAr: f.title_ar,
          startDate: f.start_date,
          endDate: f.end_date,
        });
      }
      const shifted = (data as { shifted_days?: number } | null)?.shifted_days ?? 0;
      setFb({
        type: 'ok',
        msg: isAr
          ? shifted !== 0
            ? `تم الحفظ. أُزيحت الأهداف والتسجيلات ${shifted} يومًا.`
            : 'تم الحفظ.'
          : shifted !== 0
          ? `Voyage enregistré. Objectifs et saisies décalés de ${shifted} jour(s).`
          : 'Voyage enregistré.',
      });
      await load();
    } catch (err) {
      const m = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Erreur';
      setFb({ type: 'err', msg: m });
    } finally {
      setBusy(false);
    }
  }

  const input =
    'w-full h-12 px-3 rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base focus:outline-none focus:border-[var(--accent-primary)]';
  const label = 'block text-sm font-semibold text-[var(--text-secondary)] mb-1.5';

  return (
    <div className="space-y-5 max-w-2xl">
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-1">
        <h2 className="text-xl font-semibold">{isAr ? 'الرحلة' : 'Voyage'}</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {isAr
            ? 'عدّل الاسم والمكان والتواريخ. لاختبار التطبيق قبل الموعد، أزح التواريخ إلى اليوم.'
            : 'Modifiez le nom, le lieu et les dates. Pour tester avant le départ, décalez les dates à aujourd’hui.'}
        </p>
      </section>

      <form onSubmit={save} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>{isAr ? 'الاسم (فرنسية)' : 'Nom (français)'}</label>
          <input className={input} required value={f.title_fr} onChange={(e) => setF({ ...f, title_fr: e.target.value })} />
        </div>
        <div>
          <label className={label}>{isAr ? 'الاسم (عربية)' : 'Nom (arabe)'}</label>
          <input className={input} dir="rtl" lang="ar" required value={f.title_ar} onChange={(e) => setF({ ...f, title_ar: e.target.value })} />
        </div>
        <div>
          <label className={label}>{isAr ? 'المدينة' : 'Lieu'}</label>
          <input className={input} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        </div>
        <div>
          <label className={label}>{isAr ? 'المنطقة الزمنية' : 'Fuseau horaire'}</label>
          <select className={input} value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>
            {[...new Set([f.timezone, ...TIMEZONES])].map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{isAr ? 'تاريخ البداية' : 'Date de début'}</label>
          <input type="date" className={input} required value={f.start_date} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className={label}>{isAr ? 'تاريخ النهاية' : 'Date de fin'}</label>
          <input type="date" className={input} required min={f.start_date} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
        </div>

        <div className="sm:col-span-2 rounded-xl bg-[var(--bg-surface)] p-4 space-y-3 text-sm">
          <div className="tabular-nums">
            {isAr ? 'المدة' : 'Durée'} : <b>{duration}</b> {isAr ? 'يوم' : 'jours'}
            {delta !== 0 && (
              <span className="ms-2 text-[var(--accent-gold-text)] font-semibold">
                {isAr ? `إزاحة ${delta > 0 ? '+' : ''}${delta} يوم` : `Décalage de ${delta > 0 ? '+' : ''}${delta} jour(s)`}
              </span>
            )}
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={shift} onChange={(e) => setShift(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--accent-primary)]" />
            <span>
              <b>{isAr ? 'إزاحة الأهداف والتسجيلات مع التواريخ' : 'Décaler les objectifs et les saisies avec les dates'}</b>
              <br />
              <span className="text-[var(--text-secondary)]">
                {isAr
                  ? 'يتطلب بقاء المدة نفسها. بدون الإزاحة، يُرفض التغيير إذا كانت هناك أهداف خارج الفترة الجديدة.'
                  : 'Demande que la durée reste identique. Sans décalage, le changement est refusé si des objectifs sortent de la nouvelle période.'}
              </span>
            </span>
          </label>
        </div>

        {fb && (
          <div
            role="alert"
            className={`sm:col-span-2 p-3.5 rounded-xl text-sm font-medium ${
              fb.type === 'ok' ? 'bg-[var(--status-ok-soft)] text-[var(--status-ok)]' : 'bg-[var(--status-late-soft)] text-[var(--status-late)]'
            }`}
          >
            {fb.msg}
          </div>
        )}

        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={busy || !dirty}
            className="h-12 px-6 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold disabled:opacity-50"
          >
            {busy ? '…' : isAr ? 'حفظ' : 'Enregistrer'}
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => setF(orig)}
            className="h-12 px-5 rounded-xl border-[1.5px] border-[var(--border-subtle)] font-semibold disabled:opacity-40"
          >
            {isAr ? 'إلغاء' : 'Annuler'}
          </button>
        </div>
      </form>
    </div>
  );
}
