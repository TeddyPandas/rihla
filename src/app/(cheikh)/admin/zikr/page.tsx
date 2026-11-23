'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getManagedZiyara, pickMemberRow } from '@/lib/ziyara/current';
import { useAppShell } from '@/components/providers/app-shell-provider';
import type { TimeSlot } from '@/lib/offline/db';
import { listDays, previewDistribution, type DistributionMode } from '@/lib/distribution';
import { SlotPlanEditor, type SlotPlan } from '@/components/admin/slot-plan-editor';

interface ZikrDefRow {
  id: string; ziyara_id: string; name_fr: string; name_ar: string; arabic_text: string | null;
  scope: 'daily' | 'stay'; default_slot: TimeSlot; sort_order: number;
  distribution_mode: 'split' | 'per_person' | null; slot_plan: SlotPlan | null; carry_over: boolean | null;
}
interface MemberOption { id: string; full_name: string | null; phone_e164: string }

const sec = 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5';
const inp = 'w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm';
const lbl = 'block text-xs font-semibold text-[var(--text-secondary)] mb-1';

export default function CheikhZikrConfigPage() {
  const { lang, t } = useAppShell();
  const isAr = lang === 'ar';
  const nf = (n: number) => n.toLocaleString(isAr ? 'ar-u-nu-latn' : 'fr-FR');

  const [ziyara, setZiyara] = useState<{ id: string; start_date: string; end_date: string } | null>(null);
  const [zikrs, setZikrs] = useState<ZikrDefRow[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);

  // Formulaire de définition (création / modification)
  const [editId, setEditId] = useState<string | null>(null);
  const [nameFr, setNameFr] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [arabicText, setArabicText] = useState('');
  const [scope, setScope] = useState<'daily' | 'stay'>('daily');
  const [defaultSlot, setDefaultSlot] = useState<TimeSlot>('morning');
  const [defCarry, setDefCarry] = useState(true);
  const [defPlan, setDefPlan] = useState<SlotPlan>([]);

  // Attribution
  const [selectedZikrId, setSelectedZikrId] = useState('');
  const [kind, setKind] = useState<'split' | 'per_person'>('split');
  const [mode, setMode] = useState<DistributionMode>('daily');
  const [singleDate, setSingleDate] = useState('');
  const [slot, setSlot] = useState<TimeSlot>('morning');
  const [total, setTotal] = useState('124000');
  const [asgPlan, setAsgPlan] = useState<SlotPlan>([]);
  const [asgCarry, setAsgCarry] = useState(true);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [distributing, setDistributing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const zData = await getManagedZiyara(supabase);
    if (!zData) return;
    setZiyara(zData);
    setSingleDate((p) => p || zData.start_date);
    const [defsRes, memRes] = await Promise.all([
      supabase.from('zikr_definitions').select('*').eq('ziyara_id', zData.id).order('sort_order'),
      supabase.from('group_members').select('id, full_name, phone_e164').eq('ziyara_id', zData.id).order('created_at'),
    ]);
    if (defsRes.data) {
      setZikrs(defsRes.data as ZikrDefRow[]);
      setSelectedZikrId((p) => p || defsRes.data[0]?.id || '');
    }
    if (memRes.data) {
      setMembers(memRes.data);
      setSelectedMembers((prev) => (prev.size === 0 ? new Set(memRes.data.map((m) => m.id)) : prev));
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Quand on change de zikr à attribuer, on reprend sa configuration.
  useEffect(() => {
    const z = zikrs.find((x) => x.id === selectedZikrId);
    if (!z) return;
    setSlot(z.default_slot);
    setMode(z.scope === 'stay' ? 'stay' : 'daily');
    setAsgPlan(z.slot_plan ?? []);
    setAsgCarry(z.carry_over ?? true);
    setKind(z.distribution_mode ?? 'split');
  }, [selectedZikrId, zikrs]);

  function resetForm() {
    setEditId(null); setNameFr(''); setNameAr(''); setArabicText('');
    setScope('daily'); setDefaultSlot('morning'); setDefCarry(true); setDefPlan([]);
  }
  function startEdit(z: ZikrDefRow) {
    setEditId(z.id); setNameFr(z.name_fr); setNameAr(z.name_ar); setArabicText(z.arabic_text ?? '');
    setScope(z.scope); setDefaultSlot(z.default_slot); setDefCarry(z.carry_over ?? true); setDefPlan(z.slot_plan ?? []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSaveZikr(e: React.FormEvent) {
    e.preventDefault();
    if (!ziyara) return;
    const supabase = createClient();
    if (editId) {
      const { error } = await supabase.rpc('update_zikr', {
        p_zikr_id: editId, p_name_fr: nameFr.trim(), p_name_ar: nameAr.trim(),
        p_arabic_text: arabicText.trim() || null, p_default_slot: defaultSlot,
        p_slot_plan: defPlan.length ? defPlan : null, p_carry_over: defCarry,
      });
      if (error) return setMsg({ ok: false, text: error.message });
      setMsg({ ok: true, text: isAr ? 'تم تعديل الذكر.' : 'Zikr modifié.' });
    } else {
      const { error } = await supabase.from('zikr_definitions').insert({
        ziyara_id: ziyara.id, name_fr: nameFr.trim(), name_ar: nameAr.trim(),
        arabic_text: arabicText.trim() || null, scope, default_slot: defaultSlot,
        sort_order: zikrs.length + 1, slot_plan: defPlan.length ? defPlan : null, carry_over: defCarry,
      });
      if (error) return setMsg({ ok: false, text: error.message });
      setMsg({ ok: true, text: isAr ? 'تمت إضافة الذكر.' : 'Zikr ajouté.' });
    }
    resetForm();
    await loadData();
  }

  async function handleClear(z: ZikrDefRow) {
    const ok = window.confirm(isAr
      ? `حذف كل أهداف «${z.name_ar}» وإعادة توزيعاتها؟ تبقى التسجيلات.`
      : `Remettre « ${z.name_fr} » à zéro ? Les objectifs et redistributions sont supprimés, les saisies déjà faites sont conservées.`);
    if (!ok) return;
    const { error } = await createClient().rpc('clear_zikr_goals', { p_zikr_id: z.id });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: isAr ? 'تمت إعادة التعيين.' : 'Objectifs remis à zéro. Vous pouvez les attribuer à nouveau.' });
    await loadData();
  }

  const days = ziyara ? listDays(ziyara.start_date, ziyara.end_date) : [];
  const totalNum = parseInt(total, 10);
  const preview = previewDistribution({ total: Number.isNaN(totalNum) ? 0 : totalNum, mode, days, day: singleDate, participants: selectedMembers.size });
  const planDaily = asgPlan.reduce((a, p) => a + p.qty, 0);

  function toggleMember(id: string) {
    setSelectedMembers((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function handleDistribute(e: React.FormEvent) {
    e.preventDefault();
    if (!ziyara || !selectedZikrId || Number.isNaN(totalNum) || totalNum <= 0 || selectedMembers.size === 0) return;
    setDistributing(true);
    setMsg(null);
    const supabase = createClient();
    const up = await supabase.rpc('update_zikr', {
      p_zikr_id: selectedZikrId,
      p_name_fr: zikrs.find((z) => z.id === selectedZikrId)!.name_fr,
      p_name_ar: zikrs.find((z) => z.id === selectedZikrId)!.name_ar,
      p_arabic_text: zikrs.find((z) => z.id === selectedZikrId)!.arabic_text,
      p_default_slot: slot, p_slot_plan: asgPlan.length ? asgPlan : null, p_carry_over: kind === 'per_person' ? false : asgCarry,
    });
    if (up.error) { setDistributing(false); return setMsg({ ok: false, text: up.error.message }); }

    if (kind === 'per_person') {
      const { data, error } = await supabase.rpc('assign_per_person', {
        p_ziyara_id: ziyara.id, p_zikr_id: selectedZikrId, p_quantity: totalNum, p_mode: mode,
        p_day: mode === 'day' ? singleDate : null, p_member_ids: Array.from(selectedMembers),
        p_slot_plan: asgPlan.length ? asgPlan : null, p_slot: slot,
      });
      setDistributing(false);
      if (error) return setMsg({ ok: false, text: error.message });
      const r = data as { participants: number; per_person_per_cycle: number; cycles: number } | null;
      setMsg({ ok: true, text: isAr
        ? `كل مشارك (${r?.participants}) يؤدي ${r?.per_person_per_cycle} في كل دورة (${r?.cycles}).`
        : `Chacun des ${r?.participants} participant(s) fait ${nf(r?.per_person_per_cycle ?? 0)} par cycle (${r?.cycles} cycle(s)).` });
    } else {
      const { data, error } = await supabase.rpc('distribute_zikr', {
        p_ziyara_id: ziyara.id, p_zikr_id: selectedZikrId, p_total: totalNum, p_mode: mode,
        p_day: mode === 'day' ? singleDate : null, p_member_ids: Array.from(selectedMembers), p_slot: slot,
      });
      setDistributing(false);
      if (error) return setMsg({ ok: false, text: error.message });
      const r = data as { participants: number; surplus_to_manager: number } | null;
      setMsg({ ok: true, text: isAr
        ? `تم التوزيع على ${r?.participants ?? selectedMembers.size}. الباقي: ${r?.surplus_to_manager ?? 0}.`
        : `Réparti entre ${r?.participants ?? selectedMembers.size} participant(s). Surplus gardé par vous : ${nf(r?.surplus_to_manager ?? 0)}.` });
    }
    await loadData();
  }

  const slotSelect = (v: TimeSlot, on: (s: TimeSlot) => void) => (
    <select value={v} onChange={(e) => on(e.target.value as TimeSlot)} className={inp}>
      {Object.entries(t.slots).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );

  return (
    <div className="space-y-6">
      {msg && (
        <div role="status" className={`p-3.5 rounded-xl text-sm font-semibold ${msg.ok ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]' : 'bg-[var(--status-late-soft)] text-[var(--status-late)]'}`}>{msg.text}</div>
      )}

      <section className={sec}>
        <h2 className="text-xl font-bold text-[var(--accent-primary)] mb-3">{isAr ? 'الأذكار' : 'Zikr du voyage'}</h2>
        <div className="divide-y divide-[var(--border-subtle)]">
          {zikrs.map((z) => (
            <div key={z.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{isAr ? z.name_ar : z.name_fr}</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {z.distribution_mode === 'per_person' ? (isAr ? 'لكل شخص' : 'Par personne') : (isAr ? 'مقسَّم' : 'Réparti')}
                  {z.slot_plan?.length ? ` · ${isAr ? 'بعد' : 'après'} ${z.slot_plan.length} ${isAr ? 'أوقات' : 'créneaux'}` : ''}
                  {z.carry_over === false ? (isAr ? ' · بدون ترحيل' : ' · sans report') : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => startEdit(z)} className="h-10 px-4 rounded-xl border-[1.5px] border-[var(--border-subtle)] text-sm font-semibold">{isAr ? 'تعديل' : 'Modifier'}</button>
                <button type="button" onClick={() => handleClear(z)} className="h-10 px-4 rounded-xl border-[1.5px] border-[var(--status-late)] text-[var(--status-late)] text-sm font-semibold">{isAr ? 'تصفير' : 'Remettre à zéro'}</button>
              </div>
            </div>
          ))}
          {zikrs.length === 0 && <p className="text-sm text-[var(--text-secondary)] py-2">{isAr ? 'لا أذكار بعد.' : 'Aucun zikr pour le moment.'}</p>}
        </div>
      </section>

      <section className={sec}>
        <h2 className="text-xl font-bold text-[var(--accent-primary)] mb-4">
          {editId ? (isAr ? 'تعديل الذكر' : 'Modifier le zikr') : (isAr ? 'ذكر جديد' : 'Nouveau zikr')}
        </h2>
        <form onSubmit={handleSaveZikr} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Nom en français</label><input type="text" required value={nameFr} onChange={(e) => setNameFr(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>الاسم بالعربية</label><input type="text" required dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} className={inp} /></div>
          <div className="sm:col-span-2"><label className={lbl}>{isAr ? 'الصيغة الكاملة (اختياري)' : 'Formule complète en arabe (optionnel)'}</label><input type="text" dir="rtl" value={arabicText} onChange={(e) => setArabicText(e.target.value)} className={`${inp} text-base`} /></div>
          {!editId && (
            <div>
              <label className={lbl}>{isAr ? 'نطاق الهدف' : 'Type d’objectif'}</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as 'daily' | 'stay')} className={inp}>
                <option value="daily">{isAr ? 'يومي' : 'Journalier (par jour)'}</option>
                <option value="stay">{isAr ? 'إجمالي الزيارة' : 'Global sur tout le séjour'}</option>
              </select>
            </div>
          )}
          <div><label className={lbl}>{isAr ? 'الوقت المقترح' : 'Créneau indicatif'}</label>{slotSelect(defaultSlot, setDefaultSlot)}</div>
          <label className="sm:col-span-2 flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-[var(--accent-primary)]" checked={defCarry} onChange={(e) => setDefCarry(e.target.checked)} />
            {isAr ? 'ترحيل غير المنجز إلى اليوم التالي' : 'Reporter automatiquement le non-fait au jour suivant'}
          </label>
          <div className="sm:col-span-2">
            <SlotPlanEditor value={defPlan} onChange={setDefPlan} hint={isAr ? 'اختياري: كمية بعد كل صلاة.' : 'Optionnel : « X fois après chaque prière ». Laisser vide pour un compteur libre.'} />
          </div>
          <div className="sm:col-span-2 flex gap-3">
            <button type="submit" className="h-12 px-6 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold text-sm">{editId ? (isAr ? 'حفظ' : 'Enregistrer') : (isAr ? '+ إضافة' : '+ Ajouter ce zikr')}</button>
            {editId && <button type="button" onClick={resetForm} className="h-12 px-6 rounded-xl border-[1.5px] border-[var(--border-subtle)] text-sm font-semibold">{isAr ? 'إلغاء' : 'Annuler'}</button>}
          </div>
        </form>
      </section>

      <section className={sec}>
        <h2 className="text-xl font-bold text-[var(--accent-primary)] mb-4">{isAr ? 'تعيين ذكر' : 'Attribuer un zikr'}</h2>
        <form onSubmit={handleDistribute} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>{isAr ? 'الذكر' : 'Zikr concerné'}</label>
            <select value={selectedZikrId} onChange={(e) => setSelectedZikrId(e.target.value)} className={inp}>
              {zikrs.map((z) => <option key={z.id} value={z.id}>{isAr ? z.name_ar : z.name_fr}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>{isAr ? 'نوع التوزيع' : 'Type d’attribution'}</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as 'split' | 'per_person')} className={inp}>
              <option value="split">{isAr ? 'إجمالي يُقسَّم بين المشاركين' : 'Un total réparti entre les participants'}</option>
              <option value="per_person">{isAr ? 'نفس العدد لكل شخص' : 'Même quantité pour chaque personne'}</option>
            </select>
          </div>
          <div>
            <label className={lbl}>{kind === 'per_person' ? (isAr ? 'العدد لكل شخص في كل دورة' : 'Quantité par personne et par cycle') : (isAr ? 'العدد الإجمالي' : 'Total à répartir')}</label>
            <input type="number" min={1} required inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} className={`${inp} text-base font-bold tabular-nums`} />
          </div>
          <div>
            <label className={lbl}>{isAr ? 'الدورة' : 'Cycle'}</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as DistributionMode)} className={inp}>
              <option value="daily">{kind === 'per_person' ? (isAr ? 'كل يوم' : `Chaque jour (${days.length} jours)`) : (isAr ? 'يومي' : `Journalier : réparti sur ${days.length} jours`)}</option>
              <option value="stay">{kind === 'per_person' ? (isAr ? 'مرة طوال الزيارة' : 'Une fois pour tout le séjour') : (isAr ? 'إجمالي الزيارة' : 'Séjour global')}</option>
              <option value="day">{isAr ? 'يوم واحد' : 'Un seul jour'}</option>
            </select>
          </div>
          {mode === 'day' ? (
            <div><label className={lbl}>{isAr ? 'التاريخ' : 'Jour'}</label><input type="date" min={ziyara?.start_date} max={ziyara?.end_date} value={singleDate} onChange={(e) => setSingleDate(e.target.value)} className={`${inp} tabular-nums`} /></div>
          ) : (
            <div><label className={lbl}>{isAr ? 'الوقت' : 'Créneau affiché'}</label>{slotSelect(slot, setSlot)}</div>
          )}
          {kind === 'split' && (
            <label className="flex items-center gap-3 text-sm self-end min-h-12">
              <input type="checkbox" className="h-5 w-5 accent-[var(--accent-primary)]" checked={asgCarry} onChange={(e) => setAsgCarry(e.target.checked)} />
              {isAr ? 'ترحيل غير المنجز' : 'Reporter le non-fait au jour suivant'}
            </label>
          )}
          <div className="sm:col-span-2">
            <SlotPlanEditor value={asgPlan} onChange={setAsgPlan} hint={isAr ? 'اختياري: توزيع العدد اليومي على الصلوات.' : 'Optionnel : découpe l’objectif du jour par prière (la même quantité partout, ou différente).'} />
            {asgPlan.length > 0 && kind === 'per_person' && mode === 'daily' && planDaily !== totalNum && (
              <p className="text-xs text-[var(--status-offline)] mt-1">{isAr ? 'مجموع الصلوات يختلف عن العدد اليومي؛ تُستعمل النسب.' : `Le plan fait ${nf(planDaily)} par jour, la quantité saisie est ${nf(totalNum || 0)} : les proportions du plan sont utilisées.`}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">{isAr ? 'المشاركون' : 'Participants'} ({selectedMembers.size}/{members.length})</span>
              <span className="flex gap-3 text-xs font-semibold">
                <button type="button" className="text-[var(--accent-primary)]" onClick={() => setSelectedMembers(new Set(members.map((m) => m.id)))}>{isAr ? 'الكل' : 'Tous'}</button>
                <button type="button" className="text-[var(--text-secondary)]" onClick={() => setSelectedMembers(new Set())}>{isAr ? 'لا أحد' : 'Aucun'}</button>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-3 min-h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm">
                  <input type="checkbox" checked={selectedMembers.has(m.id)} onChange={() => toggleMember(m.id)} className="w-5 h-5 accent-[var(--accent-primary)]" />
                  <span>{m.full_name || m.phone_e164}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 text-sm space-y-1.5 tabular-nums">
            <div className="font-semibold">{isAr ? 'معاينة' : 'Aperçu avant validation'}</div>
            {kind === 'per_person' ? (
              <>
                <div>{isAr ? 'كل مشارك:' : 'Chaque participant :'} <b>{nf(totalNum || 0)}</b> {mode === 'daily' ? (isAr ? 'يوميًا' : 'par jour') : mode === 'day' ? (isAr ? 'في ذلك اليوم' : 'ce jour-là') : (isAr ? 'للزيارة' : 'sur le séjour')}</div>
                <div>{isAr ? 'المجموع:' : 'Total du groupe :'} <b>{nf((totalNum || 0) * selectedMembers.size * (mode === 'daily' ? days.length : 1))}</b></div>
              </>
            ) : preview.rows.length > 0 ? (
              <>
                <div>{isAr ? 'حصة كل مشارك:' : 'Part de chaque participant :'} <b>{nf(preview.sharePerParticipant)}</b></div>
                <div>{isAr ? 'الباقي (لك):' : 'Surplus (pour vous) :'} <b>{nf(preview.surplusTotal)}</b></div>
              </>
            ) : <div className="text-[var(--text-secondary)]">—</div>}
          </div>

          <div className="sm:col-span-2">
            <button type="submit" disabled={distributing || selectedMembers.size === 0 || !(totalNum > 0)} className="h-12 px-6 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold text-sm disabled:opacity-50">
              {distributing ? '…' : isAr ? 'تأكيد' : 'Valider l’attribution'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
