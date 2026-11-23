'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { offlineDb } from '@/lib/offline/db';
import { useAppShell } from '@/components/providers/app-shell-provider';
import { getManagedZiyara, setSelectedZiyaraId } from '@/lib/ziyara/current';

interface Ziyara {
  id: string;
  title_fr: string;
  title_ar: string;
  city: string;
  timezone: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
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
  const [allZ, setAllZ] = useState<Ziyara[]>([]);
  const [nz, setNz] = useState({ title_fr: '', title_ar: '', city: 'Fès', start_date: '', end_date: '', copyFrom: '', copyMembers: false });
  const [fb, setFb] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const data = await getManagedZiyara<Ziyara>(supabase, '*');
    if (data) {
      setOrig(data);
      setF(data);
    }
    const { data: all } = await supabase.from('ziyaras').select('*').order('start_date', { ascending: false });
    setAllZ((all ?? []) as Ziyara[]);
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
      if (prof && prof.ziyaraId === f.id) {
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

  function manage(id: string) {
    setSelectedZiyaraId(id);
    setFb(null);
    void load();
  }

  async function makeActive(id: string) {
    const { error } = await createClient().rpc('set_active_ziyara', { p_ziyara_id: id });
    setFb(error ? { type: 'err', msg: error.message } : { type: 'ok', msg: isAr ? 'أصبحت هذه الرحلة هي الظاهرة للأعضاء.' : 'Ce voyage est maintenant celui que voient les membres.' });
    await load();
  }

  async function createVoyage(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFb(null);
    const { data, error } = await createClient().rpc('create_ziyara', {
      p_title_fr: nz.title_fr.trim(),
      p_title_ar: nz.title_ar.trim() || nz.title_fr.trim(),
      p_city: nz.city.trim(),
      p_timezone: 'Africa/Casablanca',
      p_start: nz.start_date,
      p_end: nz.end_date,
      p_copy_from: nz.copyFrom || null,
      p_copy_members: !!nz.copyFrom && nz.copyMembers,
    });
    setBusy(false);
    if (error) return setFb({ type: 'err', msg: error.message });
    setSelectedZiyaraId(data as string);
    setNz({ title_fr: '', title_ar: '', city: 'Fès', start_date: '', end_date: '', copyFrom: '', copyMembers: false });
    setFb({ type: 'ok', msg: isAr ? 'تم إنشاء الرحلة.' : 'Voyage créé. Vous le gérez maintenant ; utilisez « Rendre actif » pour que les membres le voient.' });
    await load();
  }

  const input =
    'w-full h-12 px-3 rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base focus:outline-none focus:border-[var(--accent-primary)]';
  const label = 'block text-sm font-semibold text-[var(--text-secondary)] mb-1.5';

  return (
    <div className="space-y-5 max-w-3xl">
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-1">
        <h2 className="text-xl font-semibold">{isAr ? 'الرحلة' : 'Voyage'}</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {isAr
            ? 'عدّل الاسم والمكان والتواريخ. لاختبار التطبيق قبل الموعد، أزح التواريخ إلى اليوم.'
            : 'Modifiez le nom, le lieu et les dates. Pour tester avant le départ, décalez les dates à aujourd’hui.'}
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-3">
        <h3 className="text-lg font-semibold">{isAr ? 'رحلاتي' : 'Mes voyages'}</h3>
        <div className="divide-y divide-[var(--border-subtle)]">
          {allZ.map((z) => (
            <div key={z.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{isAr ? z.title_ar : z.title_fr}</div>
                <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                  {z.start_date} → {z.end_date}
                  {z.id === orig.id && <span className="ms-2 px-2 py-0.5 rounded-full bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold">{isAr ? 'قيد الإدارة' : 'En gestion'}</span>}
                  {z.is_active && <span className="ms-2 px-2 py-0.5 rounded-full bg-[var(--status-ok-soft)] text-[var(--status-ok)] font-semibold">{isAr ? 'ظاهر للأعضاء' : 'Vu par les membres'}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {z.id !== orig.id && <button type="button" onClick={() => manage(z.id)} className="h-10 px-4 rounded-xl border-[1.5px] border-[var(--border-subtle)] text-sm font-semibold">{isAr ? 'إدارة' : 'Gérer'}</button>}
                {!z.is_active && <button type="button" onClick={() => makeActive(z.id)} className="h-10 px-4 rounded-xl border-[1.5px] border-[var(--accent-primary)] text-[var(--accent-primary)] text-sm font-semibold">{isAr ? 'تفعيل' : 'Rendre actif'}</button>}
              </div>
            </div>
          ))}
        </div>
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

      <form onSubmit={createVoyage} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <h3 className="sm:col-span-2 text-lg font-semibold">{isAr ? 'رحلة جديدة' : 'Nouveau voyage'}</h3>
        <div><label className={label}>{isAr ? 'الاسم (فرنسية)' : 'Nom (français)'}</label><input className={input} required value={nz.title_fr} onChange={(e) => setNz({ ...nz, title_fr: e.target.value })} /></div>
        <div><label className={label}>{isAr ? 'الاسم (عربية)' : 'Nom (arabe)'}</label><input className={input} dir="rtl" lang="ar" value={nz.title_ar} onChange={(e) => setNz({ ...nz, title_ar: e.target.value })} /></div>
        <div><label className={label}>{isAr ? 'المدينة' : 'Lieu'}</label><input className={input} value={nz.city} onChange={(e) => setNz({ ...nz, city: e.target.value })} /></div>
        <div />
        <div><label className={label}>{isAr ? 'تاريخ البداية' : 'Date de début'}</label><input type="date" className={input} required value={nz.start_date} onChange={(e) => setNz({ ...nz, start_date: e.target.value, end_date: nz.end_date < e.target.value ? e.target.value : nz.end_date })} /></div>
        <div><label className={label}>{isAr ? 'تاريخ النهاية' : 'Date de fin'}</label><input type="date" className={input} required min={nz.start_date} value={nz.end_date} onChange={(e) => setNz({ ...nz, end_date: e.target.value })} /></div>
        <div className="sm:col-span-2">
          <label className={label}>{isAr ? 'نسخ الأذكار من رحلة' : 'Copier les zikr d’un voyage'}</label>
          <select className={input} value={nz.copyFrom} onChange={(e) => setNz({ ...nz, copyFrom: e.target.value })}>
            <option value="">{isAr ? 'لا شيء (رحلة فارغة)' : 'Aucun (voyage vide)'}</option>
            {allZ.map((z) => <option key={z.id} value={z.id}>{isAr ? z.title_ar : z.title_fr}</option>)}
          </select>
          {nz.copyFrom && (
            <label className="flex items-center gap-3 mt-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--accent-primary)]" checked={nz.copyMembers} onChange={(e) => setNz({ ...nz, copyMembers: e.target.checked })} />
              {isAr ? 'إضافة نفس الأعضاء أيضًا' : 'Ajouter aussi les mêmes membres (même compte, aucun nouveau mot de passe)'}
            </label>
          )}
          <p className="text-xs text-[var(--text-secondary)] mt-2">{isAr ? 'تُنسخ الأذكار وخطط الصلوات دون الأهداف.' : 'Les zikr et leurs plans par prière sont copiés, sans les objectifs ni les saisies.'}</p>
        </div>
        <div className="sm:col-span-2"><button type="submit" disabled={busy} className="h-12 px-6 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold disabled:opacity-50">{busy ? '…' : isAr ? 'إنشاء' : 'Créer le voyage'}</button></div>
      </form>
    </div>
  );
}
