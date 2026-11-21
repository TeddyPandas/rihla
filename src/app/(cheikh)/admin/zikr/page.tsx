'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';
import type { TimeSlot } from '@/lib/offline/db';
import { listDays, previewDistribution, type DistributionMode } from '@/lib/distribution';

interface ZikrDefRow {
  id: string;
  ziyara_id: string;
  name_fr: string;
  name_ar: string;
  arabic_text: string | null;
  scope: 'daily' | 'stay';
  default_slot: TimeSlot;
  sort_order: number;
}

interface MemberOption {
  id: string;
  full_name: string | null;
  phone_e164: string;
}

export default function CheikhZikrConfigPage() {
  const { lang, t } = useAppShell();
  const isAr = lang === 'ar';

  const [ziyara, setZiyara] = useState<{ id: string; start_date: string; end_date: string } | null>(null);
  const [zikrs, setZikrs] = useState<ZikrDefRow[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);

  const [nameFr, setNameFr] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [arabicText, setArabicText] = useState('');
  const [scope, setScope] = useState<'daily' | 'stay'>('daily');
  const [defaultSlot, setDefaultSlot] = useState<TimeSlot>('morning');

  const [selectedZikrId, setSelectedZikrId] = useState('');
  const [mode, setMode] = useState<DistributionMode>('daily');
  const [singleDate, setSingleDate] = useState('2026-12-19');
  const [slot, setSlot] = useState<TimeSlot>('morning');
  const [total, setTotal] = useState('124000');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [distributing, setDistributing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: zData } = await supabase
      .from('ziyaras')
      .select('id, start_date, end_date')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (zData) {
      setZiyara(zData);
      setSingleDate(zData.start_date);
      const [defsRes, memRes] = await Promise.all([
        supabase.from('zikr_definitions').select('*').eq('ziyara_id', zData.id).order('sort_order'),
        supabase
          .from('group_members')
          .select('id, full_name, phone_e164')
          .eq('ziyara_id', zData.id)
          .order('created_at'),
      ]);
      if (defsRes.data) {
        setZikrs(defsRes.data as ZikrDefRow[]);
        if (defsRes.data.length > 0 && !selectedZikrId) {
          setSelectedZikrId(defsRes.data[0].id);
        }
      }
      if (memRes.data) {
        setMembers(memRes.data);
        setSelectedMembers((prev) => (prev.size === 0 ? new Set(memRes.data.map((m) => m.id)) : prev));
      }
    }
  }, [selectedZikrId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleAddZikr(e: React.FormEvent) {
    e.preventDefault();
    if (!ziyara) return;
    const supabase = createClient();

    const { error } = await supabase.from('zikr_definitions').insert({
      ziyara_id: ziyara.id,
      name_fr: nameFr.trim(),
      name_ar: nameAr.trim(),
      arabic_text: arabicText.trim() || null,
      scope,
      default_slot: defaultSlot,
      sort_order: zikrs.length + 1,
    });

    if (!error) {
      setNameFr('');
      setNameAr('');
      setArabicText('');
      setMsg(isAr ? 'تمت إضافة الذكر بنجاح.' : 'Zikr ajouté au référentiel.');
      await loadData();
    }
  }

  const days = ziyara ? listDays(ziyara.start_date, ziyara.end_date) : [];
  const totalNum = parseInt(total, 10);
  const preview = previewDistribution({
    total: Number.isNaN(totalNum) ? 0 : totalNum,
    mode,
    days,
    day: singleDate,
    participants: selectedMembers.size,
  });

  function toggleMember(id: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDistribute(e: React.FormEvent) {
    e.preventDefault();
    if (!ziyara || !selectedZikrId || preview.rows.length === 0) return;
    setDistributing(true);
    setMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('distribute_zikr', {
      p_ziyara_id: ziyara.id,
      p_zikr_id: selectedZikrId,
      p_total: totalNum,
      p_mode: mode,
      p_day: mode === 'day' ? singleDate : null,
      p_member_ids: Array.from(selectedMembers),
      p_slot: slot,
    });
    setDistributing(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    const res = data as { participants: number; surplus_to_manager: number } | null;
    setMsg(
      isAr
        ? `تم التوزيع على ${res?.participants ?? selectedMembers.size} مشاركين. الباقي للمسؤول: ${res?.surplus_to_manager ?? 0}.`
        : `Réparti entre ${res?.participants ?? selectedMembers.size} participant(s). Surplus gardé par vous : ${(res?.surplus_to_manager ?? 0).toLocaleString('fr-FR')}.`
    );
    await loadData();
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className="p-3.5 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] text-sm font-semibold">
          {msg}
        </div>
      )}

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
        <h2 className="font-display text-xl font-bold text-[var(--accent-primary)] mb-4">
          {isAr ? '١. تعريف ذكر جديد' : '1. Configurer un Zikr'}
        </h2>
        <form onSubmit={handleAddZikr} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Nom en français
            </label>
            <input
              type="text"
              required
              placeholder="Ex. Istighfar"
              value={nameFr}
              onChange={(e) => setNameFr(e.target.value)}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              الاسم بالعربية
            </label>
            <input
              type="text"
              required
              dir="rtl"
              placeholder="مثال: أستغفر الله"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isAr ? 'الصيغة الكاملة (اختياري)' : 'Formule complète en arabe (optionnel)'}
            </label>
            <input
              type="text"
              dir="rtl"
              placeholder="أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ وَأَتُوبُ إِلَيْهِ"
              value={arabicText}
              onChange={(e) => setArabicText(e.target.value)}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] font-arabic-script text-base"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isAr ? 'نطاق الهدف' : 'Type d’objectif'}
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'daily' | 'stay')}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
            >
              <option value="daily">{isAr ? 'يومي (لكل يوم)' : 'Journalier (par jour)'}</option>
              <option value="stay">{isAr ? 'إجمالي على طول الزيارة' : 'Global sur tout le séjour'}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isAr ? 'الوقت المقترح' : 'Créneau indicatif'}
            </label>
            <select
              value={defaultSlot}
              onChange={(e) => setDefaultSlot(e.target.value as TimeSlot)}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
            >
              {Object.entries(t.slots).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="h-12 px-6 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold text-sm"
            >
              {isAr ? '+ إضافة الذكر' : '+ Ajouter ce Zikr'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
        <h2 className="font-display text-xl font-bold text-[var(--accent-primary)] mb-4">
          {isAr ? '٢. توزيع إجمالي على المشاركين' : '2. Répartir un total'}
        </h2>

        <form onSubmit={handleDistribute} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isAr ? 'الذكر' : 'Zikr concerné'}
            </label>
            <select
              value={selectedZikrId}
              onChange={(e) => {
                setSelectedZikrId(e.target.value);
                const found = zikrs.find((z) => z.id === e.target.value);
                if (found) {
                  setSlot(found.default_slot);
                  setMode(found.scope === 'stay' ? 'stay' : 'daily');
                }
              }}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
            >
              {zikrs.map((z) => (
                <option key={z.id} value={z.id}>
                  {isAr ? z.name_ar : z.name_fr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isAr ? 'العدد الإجمالي' : 'Total à répartir'}
            </label>
            <input
              type="number"
              min={1}
              required
              inputMode="numeric"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base font-bold tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isAr ? 'طريقة التوزيع' : 'Mode de répartition'}
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as DistributionMode)}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
            >
              <option value="daily">
                {isAr ? `يومي: مقسّم على ${days.length || 9} أيام` : `Journalier : réparti sur les ${days.length || 9} jours`}
              </option>
              <option value="stay">
                {isAr ? 'إجمالي الزيارة (بدون تقسيم يومي)' : 'Séjour global (sans découpage par jour)'}
              </option>
              <option value="day">{isAr ? 'يوم واحد' : 'Un seul jour'}</option>
            </select>
          </div>

          {mode === 'day' ? (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                {isAr ? 'التاريخ' : 'Jour'}
              </label>
              <input
                type="date"
                min={ziyara?.start_date}
                max={ziyara?.end_date}
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm tabular-nums"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                {isAr ? 'الوقت' : 'Créneau affiché'}
              </label>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value as TimeSlot)}
                className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
              >
                {Object.entries(t.slots).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {isAr ? `المشاركون (${selectedMembers.size}/${members.length})` : `Participants (${selectedMembers.size}/${members.length})`}
              </span>
              <span className="flex gap-3 text-xs font-semibold">
                <button type="button" className="text-[var(--accent-primary)]" onClick={() => setSelectedMembers(new Set(members.map((m) => m.id)))}>
                  {isAr ? 'الكل' : 'Tous'}
                </button>
                <button type="button" className="text-[var(--text-secondary)]" onClick={() => setSelectedMembers(new Set())}>
                  {isAr ? 'لا أحد' : 'Aucun'}
                </button>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-3 min-h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(m.id)}
                    onChange={() => toggleMember(m.id)}
                    className="w-5 h-5 accent-[var(--accent-primary)]"
                  />
                  <span>{m.full_name || m.phone_e164}</span>
                </label>
              ))}
            </div>
          </div>

          {preview.rows.length > 0 && (
            <div className="sm:col-span-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 text-sm space-y-2">
              <div className="font-semibold">{isAr ? 'معاينة قبل التأكيد' : 'Aperçu avant validation'}</div>
              <div className="tabular-nums">
                {isAr ? 'حصة كل مشارك:' : 'Part de chaque participant :'}{' '}
                <strong>{preview.sharePerParticipant.toLocaleString('fr-FR')}</strong>
                {mode === 'daily' && preview.rows[0] && (
                  <span className="text-[var(--text-secondary)]">
                    {' '}
                    ({isAr ? 'حوالي' : 'env.'} {preview.rows[0].share.toLocaleString('fr-FR')} {isAr ? 'يوميا' : 'par jour'})
                  </span>
                )}
              </div>
              <div className="tabular-nums">
                {isAr ? 'الباقي (يعود إليك):' : 'Surplus (pour vous) :'}{' '}
                <strong>{preview.surplusTotal.toLocaleString('fr-FR')}</strong>
              </div>
              {mode === 'daily' && (
                <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                  {isAr ? 'الكمية اليومية:' : 'Quantité par jour :'}{' '}
                  {preview.rows.map((r) => r.quantity.toLocaleString('fr-FR')).join(' · ')}
                </div>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={distributing || preview.rows.length === 0}
              className="h-12 px-6 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold text-sm disabled:opacity-50"
            >
              {distributing ? '…' : isAr ? 'تأكيد التوزيع' : 'Valider la répartition'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
