'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';
import type { TimeSlot } from '@/lib/offline/db';

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
  const [targetAudience, setTargetAudience] = useState<'all' | string>('all');
  const [dateMode, setDateMode] = useState<'all_days' | 'single_day'>('all_days');
  const [singleDate, setSingleDate] = useState('2026-12-19');
  const [slot, setSlot] = useState<TimeSlot>('morning');
  const [targetQty, setTargetQty] = useState('1000');
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
      if (memRes.data) setMembers(memRes.data);
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

  async function handleAssignGoals(e: React.FormEvent) {
    e.preventDefault();
    if (!ziyara || !selectedZikrId) return;
    const qty = parseInt(targetQty, 10);
    if (Number.isNaN(qty) || qty < 0) return;

    const zikrDef = zikrs.find((z) => z.id === selectedZikrId);
    if (!zikrDef) return;

    const targetMembers =
      targetAudience === 'all' ? members.map((m) => m.id) : [targetAudience];

    const targetDates: (string | null)[] = [];
    if (zikrDef.scope === 'stay') {
      targetDates.push(null);
    } else if (dateMode === 'single_day') {
      targetDates.push(singleDate);
    } else {
      const cur = new Date(`${ziyara.start_date}T00:00:00Z`);
      const end = new Date(`${ziyara.end_date}T00:00:00Z`);
      while (cur <= end) {
        targetDates.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    const supabase = createClient();

    for (const memberId of targetMembers) {
      for (const d of targetDates) {
        let query = supabase
          .from('member_goals')
          .select('id')
          .eq('ziyara_id', ziyara.id)
          .eq('member_id', memberId)
          .eq('zikr_id', selectedZikrId);

        query = d === null ? query.is('target_date', null) : query.eq('target_date', d);
        const { data: existing } = await query.maybeSingle();

        if (existing) {
          await supabase
            .from('member_goals')
            .update({ initial_target: qty, slot, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await supabase.from('member_goals').insert({
            ziyara_id: ziyara.id,
            member_id: memberId,
            zikr_id: selectedZikrId,
            target_date: d,
            slot,
            initial_target: qty,
            adjusted_delta: 0,
          });
        }
      }
    }

    setMsg(
      isAr
        ? 'تم تحديث الأهداف بنجاح.'
        : `Objectifs enregistrés pour ${targetMembers.length} membre(s).`
    );
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
          {isAr ? '٢. توزيع الأهداف على الأعضاء' : '2. Attribuer ou modifier des objectifs'}
        </h2>

        <form onSubmit={handleAssignGoals} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isAr ? 'الذكر' : 'Zikr concerné'}
            </label>
            <select
              value={selectedZikrId}
              onChange={(e) => {
                setSelectedZikrId(e.target.value);
                const found = zikrs.find((z) => z.id === e.target.value);
                if (found) setSlot(found.default_slot);
              }}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
            >
              {zikrs.map((z) => (
                <option key={z.id} value={z.id}>
                  {isAr ? z.name_ar : z.name_fr} ({z.scope === 'daily' ? 'Jour' : 'Séjour'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isAr ? 'المستفيدون' : 'Destinataire(s)'}
            </label>
            <select
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
            >
              <option value="all">
                {isAr ? `جميع أعضاء المجموعة (${members.length})` : `Tout le groupe (${members.length})`}
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.phone_e164}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isAr ? 'العدد المستهدف' : 'Quantité cible'}
            </label>
            <input
              type="number"
              min={0}
              required
              value={targetQty}
              onChange={(e) => setTargetQty(e.target.value)}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base font-bold tabular-nums"
            />
          </div>

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

          {zikrs.find((z) => z.id === selectedZikrId)?.scope === 'daily' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  {isAr ? 'الأيام المعنية' : 'Application sur les jours'}
                </label>
                <select
                  value={dateMode}
                  onChange={(e) => setDateMode(e.target.value as 'all_days' | 'single_day')}
                  className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
                >
                  <option value="all_days">
                    {isAr ? 'كل أيام الزيارة (9 أيام)' : 'Tous les jours du séjour (9 jours)'}
                  </option>
                  <option value="single_day">{isAr ? 'يوم محدد' : 'Un jour précis'}</option>
                </select>
              </div>

              {dateMode === 'single_day' && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    {isAr ? 'التاريخ' : 'Date'}
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
              )}
            </>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="h-12 px-6 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold text-sm"
            >
              {isAr ? 'تطبيق الأهداف' : 'Enregistrer les objectifs'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
