'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';

interface MemberItem {
  id: string;
  full_name: string | null;
  phone_e164: string;
}

interface ZikrItem {
  id: string;
  name_fr: string;
  name_ar: string;
  scope: 'daily' | 'stay';
}

interface GoalItem {
  id: string;
  member_id: string;
  zikr_id: string;
  target_date: string | null;
  initial_target: number;
  adjusted_delta: number;
}

interface EntryItem {
  member_id: string;
  zikr_id: string;
  entry_date: string;
  source: 'personal' | 'pot';
  quantity: number;
  status: 'active' | 'cancelled';
}

export default function CheikhRedistributePage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';

  const [ziyaraId, setZiyaraId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [zikrs, setZikrs] = useState<ZikrItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [entries, setEntries] = useState<EntryItem[]>([]);

  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [potQtyInput, setPotQtyInput] = useState<string>('0');
  const [targetedMode, setTargetedMode] = useState<'equal' | 'custom'>('equal');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [equalPerMemberInput, setEqualPerMemberInput] = useState<string>('0');
  const [customAllocations, setCustomAllocations] = useState<Record<string, string>>({});
  const [allocDate, setAllocDate] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: zData } = await supabase
      .from('ziyaras')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!zData) return;
    setZiyaraId(zData.id);

    const [mRes, zRes, gRes, eRes] = await Promise.all([
      supabase.from('group_members').select('id, full_name, phone_e164').eq('ziyara_id', zData.id).order('created_at'),
      supabase.from('zikr_definitions').select('id, name_fr, name_ar, scope').eq('ziyara_id', zData.id).order('sort_order'),
      supabase.from('member_goals').select('id, member_id, zikr_id, target_date, initial_target, adjusted_delta').eq('ziyara_id', zData.id),
      supabase
        .from('zikr_entries')
        .select('member_id, zikr_id, entry_date, source, quantity, status')
        .eq('ziyara_id', zData.id)
        .eq('status', 'active'),
    ]);

    if (mRes.data) setMembers(mRes.data);
    if (zRes.data) setZikrs(zRes.data);
    if (gRes.data) {
      setGoals(
        gRes.data.map((g) => ({
          ...g,
          initial_target: Number(g.initial_target),
          adjusted_delta: Number(g.adjusted_delta),
        }))
      );
    }
    if (eRes.data) {
      setEntries(eRes.data.map((e) => ({ ...e, quantity: Number(e.quantity) })));
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const lateGoals = useMemo(() => {
    return goals
      .map((g) => {
        const effectiveTarget = Math.max(0, g.initial_target + g.adjusted_delta);
        const datedDays = new Set(
          goals
            .filter((x) => x.member_id === g.member_id && x.zikr_id === g.zikr_id && x.target_date !== null)
            .map((x) => x.target_date)
        );
        const done = entries
          .filter(
            (e) =>
              e.member_id === g.member_id &&
              e.zikr_id === g.zikr_id &&
              e.source === 'personal' &&
              (g.target_date === null ? !datedDays.has(e.entry_date) : e.entry_date === g.target_date)
          )
          .reduce((acc, e) => acc + e.quantity, 0);
        const remaining = Math.max(0, effectiveTarget - done);
        const member = members.find((m) => m.id === g.member_id);
        const zikr = zikrs.find((z) => z.id === g.zikr_id);
        return { goal: g, member, zikr, effectiveTarget, done, remaining };
      })
      .filter((item) => item.remaining > 0 && item.member && item.zikr)
      .sort((a, b) => b.remaining - a.remaining);
  }, [goals, entries, members, zikrs]);

  useEffect(() => {
    if (lateGoals.length > 0 && !lateGoals.some((l) => l.goal.id === selectedGoalId)) {
      setSelectedGoalId(lateGoals[0].goal.id);
    }
  }, [lateGoals, selectedGoalId]);

  const activeLateItem = useMemo(
    () => lateGoals.find((l) => l.goal.id === selectedGoalId) || null,
    [lateGoals, selectedGoalId]
  );

  const potQty = Math.max(0, parseInt(potQtyInput, 10) || 0);

  const targetedAllocationsList = useMemo(() => {
    if (selectedRecipientIds.length === 0) return [];
    if (targetedMode === 'equal') {
      const perMember = Math.max(0, parseInt(equalPerMemberInput, 10) || 0);
      return selectedRecipientIds
        .map((memberId) => ({ member_id: memberId, quantity: perMember, ...(allocDate ? { target_date: allocDate } : {}) }))
        .filter((a) => a.quantity > 0);
    }
    return selectedRecipientIds
      .map((memberId) => ({
        member_id: memberId,
        quantity: Math.max(0, parseInt(customAllocations[memberId] || '0', 10) || 0),
        ...(allocDate ? { target_date: allocDate } : {}),
      }))
      .filter((a) => a.quantity > 0);
  }, [selectedRecipientIds, targetedMode, equalPerMemberInput, customAllocations, allocDate]);

  const totalTargeted = targetedAllocationsList.reduce((acc, a) => acc + a.quantity, 0);
  const totalDistributed = potQty + totalTargeted;
  const available = activeLateItem?.remaining ?? 0;
  const unallocatedRemaining = available - totalDistributed;
  const isOverflow = totalDistributed > available;

  function toggleRecipient(memberId: string) {
    setSelectedRecipientIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  }

  async function handleValidateRedistribution(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!ziyaraId || !activeLateItem || totalDistributed <= 0 || isOverflow) return;

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('redistribute_remaining', {
        p_ziyara_id: ziyaraId,
        p_zikr_id: activeLateItem.goal.zikr_id,
        p_target_date: activeLateItem.goal.target_date,
        p_from_member_id: activeLateItem.goal.member_id,
        p_pot_qty: potQty,
        p_targeted_allocations: targetedAllocationsList,
      });

      if (error) {
        setFeedback({ type: 'err', msg: error.message });
        return;
      }

      setFeedback({
        type: 'ok',
        msg: isAr
          ? 'تمت إعادة التوزيع وإرسال الإشعارات بنجاح.'
          : 'Redistribution validée et notifications envoyées aux membres.',
      });
      setPotQtyInput('0');
      setEqualPerMemberInput('0');
      setSelectedRecipientIds([]);
      setCustomAllocations({});
      setAllocDate('');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-5">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--accent-primary)]">
            {isAr ? 'إعادة توزيع الأعداد المتبقية' : 'Redistribution des quantités restantes'}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {isAr
              ? 'يمكنك الجمع بين الإسناد المباشر لأعضاء محددين وإيداع جزء في الاحتياطي في عملية واحدة.'
              : 'Combinez en une seule validation une réattribution ciblée et une mise en Réserve.'}
          </p>
        </div>

        {lateGoals.length === 0 ? (
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] text-sm text-[var(--text-secondary)]">
            {isAr ? 'لا يوجد أي عضو متأخر حالياً.' : 'Aucun reste à redistribuer pour le moment.'}
          </div>
        ) : (
          <form onSubmit={handleValidateRedistribution} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                {isAr ? '١. اختر العضو المتأخر والذكر' : '1. Sélectionner le membre en retard & le Zikr'}
              </label>
              <select
                value={selectedGoalId}
                onChange={(e) => {
                  setSelectedGoalId(e.target.value);
                  setSelectedRecipientIds([]);
                }}
                className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm font-medium"
              >
                {lateGoals.map((item) => (
                  <option key={item.goal.id} value={item.goal.id}>
                    {(item.member?.full_name || item.member?.phone_e164) ?? ''} —{' '}
                    {isAr ? item.zikr?.name_ar : item.zikr?.name_fr} (
                    {item.goal.target_date ?? (isAr ? 'الزيارة' : 'Séjour')}) •{' '}
                    {isAr ? 'المتبقي:' : 'Reste :'} {item.remaining.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                {isAr ? 'يوم تطبيق الإسناد (اختياري)' : 'Jour d’application des attributions (optionnel)'}
              </label>
              <input
                type="date"
                value={allocDate}
                onChange={(e) => setAllocDate(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm tabular-nums"
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {isAr
                  ? 'اتركه فارغاً لإبقاء نفس يوم الهدف الأصلي.'
                  : 'Laissez vide pour garder le même jour que l’objectif d’origine.'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[var(--status-pot)]">
                  {isAr ? '٢. جزء يُودَع في الاحتياطي' : '2. Part vers la Réserve'}
                </label>
                {activeLateItem && (
                  <button
                    type="button"
                    onClick={() => setPotQtyInput(String(Math.max(0, available - totalTargeted)))}
                    className="text-xs font-semibold text-[var(--accent-primary)] underline"
                  >
                    {isAr ? 'وضع كل المتبقي' : 'Mettre tout le disponible'}
                  </button>
                )}
              </div>
              <input
                type="number"
                min={0}
                value={potQtyInput}
                onChange={(e) => setPotQtyInput(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base font-bold tabular-nums"
              />
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-[var(--accent-primary)]">
                  {isAr ? '٣. الإسناد المباشر لأعضاء محددين' : '3. Réattribution ciblée à des membres'}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTargetedMode('equal')}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold ${
                      targetedMode === 'equal'
                        ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
                        : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {isAr ? 'نفس العدد للجميع' : 'Même quantité pour tous'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetedMode('custom')}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold ${
                      targetedMode === 'custom'
                        ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]'
                        : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {isAr ? 'عدد مخصص لكل عضو' : 'Quantité différente par membre'}
                  </button>
                </div>
              </div>

              {targetedMode === 'equal' && selectedRecipientIds.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    {isAr
                      ? `العدد لكل عضو مختار (${selectedRecipientIds.length})`
                      : `Quantité ajoutée à chacun des ${selectedRecipientIds.length} membre(s)`}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={equalPerMemberInput}
                    onChange={(e) => setEqualPerMemberInput(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm font-bold tabular-nums"
                  />
                </div>
              )}

              <div className="max-h-56 overflow-y-auto divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
                {members
                  .filter((m) => m.id !== activeLateItem?.goal.member_id)
                  .map((m) => {
                    const checked = selectedRecipientIds.includes(m.id);
                    return (
                      <div key={m.id} className="p-2.5 flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRecipient(m.id)}
                            className="w-4 h-4 accent-[var(--accent-primary)]"
                          />
                          <span>{m.full_name || m.phone_e164}</span>
                        </label>

                        {checked && targetedMode === 'custom' && (
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={customAllocations[m.id] || ''}
                            onChange={(e) =>
                              setCustomAllocations((prev) => ({ ...prev, [m.id]: e.target.value }))
                            }
                            className="w-28 h-9 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm font-bold tabular-nums text-end"
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border tabular-nums ${
                isOverflow
                  ? 'border-[var(--status-late)] bg-[var(--status-late-soft)]'
                  : 'border-[var(--border-strong)] bg-[var(--bg-canvas)]'
              }`}
            >
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-[var(--text-secondary)]">
                    {isAr ? 'المتاح للتوزيع' : 'Disponible'}
                  </div>
                  <div className="text-base font-bold mt-0.5">{available.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[var(--text-secondary)]">
                    {isAr ? 'إجمالي الموزع' : 'Total attribué'}
                  </div>
                  <div
                    className={`text-base font-bold mt-0.5 ${
                      isOverflow ? 'text-[var(--status-late)]' : 'text-[var(--accent-primary)]'
                    }`}
                  >
                    {totalDistributed.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--text-secondary)]">
                    {isAr ? 'يبقى للعضو' : 'Reste au membre'}
                  </div>
                  <div className="text-base font-bold mt-0.5">
                    {isOverflow ? 'Dépassement !' : unallocatedRemaining.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-sm font-semibold ${
                  feedback.type === 'ok'
                    ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                    : 'bg-[var(--status-late-soft)] text-[var(--status-late)]'
                }`}
              >
                {feedback.msg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || totalDistributed <= 0 || isOverflow}
              className="w-full h-13 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--text-on-accent)] font-bold text-base disabled:opacity-40"
            >
              {submitting
                ? '...'
                : isAr
                ? 'تأكيد إعادة التوزيع وإرسال الإشعارات'
                : 'Valider la redistribution en une action'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
