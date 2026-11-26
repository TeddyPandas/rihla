'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getManagedZiyara } from '@/lib/ziyara/current';
import { useAppShell } from '@/components/providers/app-shell-provider';
import { InfoBody } from '@/components/info/info-body';

interface InfoRow {
  id: string; ziyara_id: string; category: 'programme' | 'infos'; title_fr: string; title_ar: string | null;
  body_fr: string; body_ar: string | null; day_date: string | null; sort_order: number;
}

const sec = 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5';
const inp = 'w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm';
const area = 'w-full min-h-40 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm font-mono leading-6';
const lbl = 'block text-xs font-semibold text-[var(--text-secondary)] mb-1';

export default function AdminInformationsPage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';
  const [ziyaraId, setZiyaraId] = useState<string | null>(null);
  const [rows, setRows] = useState<InfoRow[]>([]);
  const [tab, setTab] = useState<'programme' | 'infos'>('programme');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [titleFr, setTitleFr] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [bodyFr, setBodyFr] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [dayDate, setDayDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const z = await getManagedZiyara(supabase);
    if (!z) return;
    setZiyaraId(z.id);
    const { data } = await supabase.from('ziyara_info').select('*').eq('ziyara_id', z.id).order('sort_order');
    setRows((data ?? []) as InfoRow[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const list = rows.filter((r) => r.category === tab).sort((a, b) => a.sort_order - b.sort_order);

  function openNew() {
    setEditId(null); setTitleFr(''); setTitleAr(''); setBodyFr(''); setBodyAr(''); setDayDate(''); setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function openEdit(r: InfoRow) {
    setEditId(r.id); setTitleFr(r.title_fr); setTitleAr(r.title_ar ?? ''); setBodyFr(r.body_fr); setBodyAr(r.body_ar ?? '');
    setDayDate(r.day_date ?? ''); setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function closeForm() { setFormOpen(false); setEditId(null); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ziyaraId) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      title_fr: titleFr.trim(), title_ar: titleAr.trim() || null,
      body_fr: bodyFr.trim(), body_ar: bodyAr.trim() || null,
      day_date: tab === 'programme' && dayDate ? dayDate : null,
    };
    const { error } = editId
      ? await supabase.from('ziyara_info').update(payload).eq('id', editId)
      : await supabase.from('ziyara_info').insert({ ...payload, ziyara_id: ziyaraId, category: tab, sort_order: (list[list.length - 1]?.sort_order ?? 0) + 1 });
    setSaving(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: isAr ? '✔ تم الحفظ. يراه المشاركون فورًا.' : '✔ Enregistré. Les participants le voient dès leur prochaine ouverture.' });
    closeForm();
    await load();
  }

  async function remove(r: InfoRow) {
    if (!window.confirm(isAr ? `حذف «${r.title_fr}» ؟` : `Supprimer « ${r.title_fr} » ?`)) return;
    const { error } = await createClient().from('ziyara_info').delete().eq('id', r.id);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: isAr ? 'تم الحذف.' : 'Bloc supprimé.' });
    await load();
  }

  async function move(r: InfoRow, dir: -1 | 1) {
    const i = list.findIndex((x) => x.id === r.id);
    const other = list[i + dir];
    if (!other) return;
    const supabase = createClient();
    const a = await supabase.from('ziyara_info').update({ sort_order: other.sort_order }).eq('id', r.id);
    const b = await supabase.from('ziyara_info').update({ sort_order: r.sort_order }).eq('id', other.id);
    if (a.error || b.error) setMsg({ ok: false, text: (a.error ?? b.error)!.message });
    await load();
  }

  const tabBtn = (active: boolean) => `flex-1 h-12 rounded-xl text-sm font-semibold border-[1.5px] ${active ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)] border-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'}`;

  return (
    <div className="space-y-6">
      {msg && <div role="status" className={`p-3.5 rounded-xl text-sm font-semibold ${msg.ok ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]' : 'bg-[var(--status-late-soft)] text-[var(--status-late)]'}`}>{msg.text}</div>}

      <div className="flex gap-2">
        <button type="button" onClick={() => { setTab('programme'); closeForm(); }} className={tabBtn(tab === 'programme')}>{isAr ? 'برنامج الرحلة' : 'Programme du voyage'}</button>
        <button type="button" onClick={() => { setTab('infos'); closeForm(); }} className={tabBtn(tab === 'infos')}>{isAr ? 'معلومات عملية' : 'Infos pratiques'}</button>
      </div>

      {formOpen && (
        <section className={sec}>
          <h2 className="text-xl font-bold text-[var(--accent-primary)] mb-4">{editId ? (isAr ? 'تعديل الكتلة' : 'Modifier le bloc') : (isAr ? 'كتلة جديدة' : 'Nouveau bloc')}</h2>
          <form onSubmit={save} className="space-y-4">
            <div><label className={lbl}>{isAr ? 'العنوان (بالفرنسية)' : 'Titre'}</label><input required value={titleFr} onChange={(e) => setTitleFr(e.target.value)} className={inp} placeholder={tab === 'programme' ? 'Jour 3 · dimanche 20 décembre 2026 · Marrakech' : 'Hôtels'} /></div>
            {tab === 'programme' && (
              <div><label className={lbl}>{isAr ? 'تاريخ اليوم (يُبرز في يومه)' : 'Date du jour (le bloc est mis en avant ce jour-là)'}</label><input type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} className={`${inp} tabular-nums`} /></div>
            )}
            <div>
              <label className={lbl}>{isAr ? 'المحتوى' : 'Contenu'}</label>
              <textarea required value={bodyFr} onChange={(e) => setBodyFr(e.target.value)} className={area} placeholder={'07h05 : Prière de Sobh\n07h30 : Départ pour Marrakech'} />
              <details className="mt-2 text-xs text-[var(--text-secondary)]">
                <summary className="cursor-pointer font-semibold">{isAr ? 'كيفية الكتابة' : 'Comment écrire ?'}</summary>
                <ul className="mt-1.5 space-y-1 ps-4 list-disc">
                  <li><code>07h05 : texte</code> : une ligne d’horaire (l’heure est mise en évidence)</li>
                  <li><code>- texte</code> : une puce</li>
                  <li><code>Ville | Jour | Nuit</code> : un tableau, une ligne par rangée (la première est l’en-tête)</li>
                  <li><code>**Fès**</code> : gras ; un numéro <code>+212 690-701070</code> devient un lien d’appel</li>
                  <li>Toute autre ligne est un paragraphe</li>
                </ul>
              </details>
            </div>
            <details className="rounded-xl border border-[var(--border-subtle)] p-3">
              <summary className="cursor-pointer text-sm font-semibold">{isAr ? 'النسخة العربية (اختياري)' : 'Version arabe (optionnelle)'}</summary>
              <div className="space-y-3 mt-3">
                <div><label className={lbl}>العنوان</label><input dir="rtl" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} className={inp} /></div>
                <div><label className={lbl}>المحتوى</label><textarea dir="rtl" value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} className={area} /></div>
              </div>
            </details>
            {bodyFr.trim() && (
              <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">{isAr ? 'معاينة' : 'Aperçu'}</div>
                <InfoBody body={bodyFr} />
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="h-12 px-6 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold text-sm disabled:opacity-50">{saving ? '…' : (isAr ? 'حفظ' : 'Enregistrer')}</button>
              <button type="button" onClick={closeForm} className="h-12 px-6 rounded-xl border-[1.5px] border-[var(--border-subtle)] text-sm font-semibold">{isAr ? 'إلغاء' : 'Annuler'}</button>
            </div>
          </form>
        </section>
      )}

      <section className={sec}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-bold text-[var(--accent-primary)]">{tab === 'programme' ? (isAr ? 'أيام الرحلة' : 'Jours du programme') : (isAr ? 'المعلومات العملية' : 'Informations pratiques')}</h2>
          {!formOpen && <button type="button" onClick={openNew} className="h-11 px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] text-sm font-semibold">{isAr ? '+ إضافة' : '+ Ajouter'}</button>}
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">{isAr ? 'لا شيء بعد.' : 'Rien pour le moment. Ajoutez un premier bloc.'}</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {list.map((r, i) => (
              <li key={r.id} className="py-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={() => setPreview(preview === r.id ? null : r.id)} className="text-start min-w-0 font-semibold">
                    {r.title_fr} <span className="text-xs text-[var(--text-secondary)]">{preview === r.id ? '▲' : '▼'}</span>
                  </button>
                  <div className="flex gap-2">
                    <button type="button" disabled={i === 0} onClick={() => move(r, -1)} aria-label={isAr ? 'أعلى' : 'Monter'} className="h-10 w-10 rounded-xl border-[1.5px] border-[var(--border-subtle)] disabled:opacity-40">↑</button>
                    <button type="button" disabled={i === list.length - 1} onClick={() => move(r, 1)} aria-label={isAr ? 'أسفل' : 'Descendre'} className="h-10 w-10 rounded-xl border-[1.5px] border-[var(--border-subtle)] disabled:opacity-40">↓</button>
                    <button type="button" onClick={() => openEdit(r)} className="h-10 px-4 rounded-xl border-[1.5px] border-[var(--border-subtle)] text-sm font-semibold">{isAr ? 'تعديل' : 'Modifier'}</button>
                    <button type="button" onClick={() => remove(r)} className="h-10 px-4 rounded-xl border-[1.5px] border-[var(--status-late)] text-[var(--status-late)] text-sm font-semibold">{isAr ? 'حذف' : 'Supprimer'}</button>
                  </div>
                </div>
                {preview === r.id && <div className="rounded-xl bg-[var(--bg-surface)] p-3"><InfoBody body={r.body_fr} /></div>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
