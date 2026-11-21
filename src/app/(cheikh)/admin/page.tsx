'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';

type DashboardView = 'overview' | 'by_zikr' | 'by_member' | 'by_day' | 'stay_total';

interface MemberItem {
  id: string;
  full_name: string | null;
  phone_e164: string;
  last_synced_at: string | null;
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
  id: string;
  member_id: string;
  zikr_id: string;
  entry_date: string;
  source: 'personal' | 'pot';
  quantity: number;
  status: 'active' | 'cancelled';
  created_at_client: string;
  cancel_reason: string | null;
}

interface PotItem {
  id: string;
  zikr_id: string;
  target_date: string | null;
  allocated_quantity: number;
}

export default function CheikhRealtimeDashboard() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [zikrs, setZikrs] = useState<ZikrItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [pots, setPots] = useState<PotItem[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const [view, setView] = useState<DashboardView>('overview');
  const [filterDay, setFilterDay] = useState<string>('ALL');
  const [filterZikr, setFilterZikr] = useState<string>('ALL');
  const [filterMember, setFilterMember] = useState<string>('ALL');

  const [editingEntry, setEditingEntry] = useState<EntryItem | null>(null);
  const [newQty, setNewQty] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [savingCorrection, setSavingCorrection] = useState(false);

  const fetchSnapshot = useCallback(async () => {
    const supabase = createClient();
    const { data: zData } = await supabase
      .from('ziyaras')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!zData) return;

    const [mRes, zRes, gRes, eRes, pRes] = await Promise.all([
      supabase
        .from('group_members')
        .select('id, full_name, phone_e164, last_synced_at')
        .eq('ziyara_id', zData.id)
        .order('created_at'),
      supabase.from('zikr_definitions').select('id, name_fr, name_ar, scope').eq('ziyara_id', zData.id).order('sort_order'),
      supabase.from('member_goals').select('id, member_id, zikr_id, target_date, initial_target, adjusted_delta').eq('ziyara_id', zData.id),
      supabase
        .from('zikr_entries')
        .select('id, member_id, zikr_id, entry_date, source, quantity, status, created_at_client, cancel_reason')
        .eq('ziyara_id', zData.id)
        .order('created_at_client', { ascending: false }),
      supabase.from('common_pots').select('id, zikr_id, target_date, allocated_quantity').eq('ziyara_id', zData.id),
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
    if (pRes.data) {
      setPots(pRes.data.map((p) => ({ ...p, allocated_quantity: Number(p.allocated_quantity) })));
    }
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    void fetchSnapshot();
    const supabase = createClient();

    const channel = supabase
      .channel('cheikh-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zikr_entries' }, () => void fetchSnapshot())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_goals' }, () => void fetchSnapshot())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'common_pots' }, () => void fetchSnapshot())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_members' }, () => void fetchSnapshot())
      .subscribe();

    const interval = setInterval(() => void fetchSnapshot(), 30_000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchSnapshot]);

  const availableDays = useMemo(() => {
    const set = new Set<string>();
    goals.forEach((g) => {
      if (g.target_date) set.add(g.target_date);
    });
    return Array.from(set).sort();
  }, [goals]);

  const filteredMetrics = useMemo(() => {
    const matchingGoals = goals.filter((g) => {
      if (filterZikr !== 'ALL' && g.zikr_id !== filterZikr) return false;
      if (filterMember !== 'ALL' && g.member_id !== filterMember) return false;
      if (filterDay !== 'ALL' && g.target_date !== null && g.target_date !== filterDay) return false;
      return true;
    });

    const matchingEntries = entries.filter((e) => {
      if (e.status !== 'active') return false;
      if (filterZikr !== 'ALL' && e.zikr_id !== filterZikr) return false;
      if (filterMember !== 'ALL' && e.member_id !== filterMember) return false;
      if (filterDay !== 'ALL' && e.entry_date !== filterDay) return false;
      return true;
    });

    const targetSum = matchingGoals.reduce(
      (acc, g) => acc + Math.max(0, g.initial_target + g.adjusted_delta),
      0
    );
    const donePersonal = matchingEntries
      .filter((e) => e.source === 'personal')
      .reduce((acc, e) => acc + e.quantity, 0);
    const donePot = matchingEntries
      .filter((e) => e.source === 'pot')
      .reduce((acc, e) => acc + e.quantity, 0);

    const potAllocated = pots
      .filter(
        (p) =>
          (filterZikr === 'ALL' || p.zikr_id === filterZikr) &&
          (filterDay === 'ALL' || p.target_date === null || p.target_date === filterDay)
      )
      .reduce((acc, p) => acc + p.allocated_quantity, 0);

    const remaining = Math.max(0, targetSum - donePersonal);

    return {
      targetSum,
      donePersonal,
      donePot,
      potAllocated,
      potRemaining: Math.max(0, potAllocated - donePot),
      remaining,
    };
  }, [goals, entries, pots, filterDay, filterZikr, filterMember]);

  const lateList = useMemo(() => {
    const rows: {
      member: MemberItem;
      zikr: ZikrItem;
      target: number;
      done: number;
      remaining: number;
    }[] = [];

    for (const m of members) {
      for (const z of zikrs) {
        if (filterZikr !== 'ALL' && z.id !== filterZikr) continue;
        if (filterMember !== 'ALL' && m.id !== filterMember) continue;

        const mGoals = goals.filter(
          (g) =>
            g.member_id === m.id &&
            g.zikr_id === z.id &&
            (filterDay === 'ALL' || g.target_date === null || g.target_date === filterDay)
        );
        const target = mGoals.reduce((a, g) => a + Math.max(0, g.initial_target + g.adjusted_delta), 0);
        if (target === 0) continue;

        const done = entries
          .filter(
            (e) =>
              e.member_id === m.id &&
              e.zikr_id === z.id &&
              e.source === 'personal' &&
              e.status === 'active' &&
              (filterDay === 'ALL' || z.scope === 'stay' || e.entry_date === filterDay)
          )
          .reduce((a, e) => a + e.quantity, 0);

        const remaining = Math.max(0, target - done);
        if (remaining > 0) {
          rows.push({ member: m, zikr: z, target, done, remaining });
        }
      }
    }
    return rows.sort((a, b) => b.remaining - a.remaining);
  }, [members, zikrs, goals, entries, filterDay, filterZikr, filterMember]);

  async function handleSubmitCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEntry) return;
    const parsedQty = parseInt(newQty, 10);
    if (Number.isNaN(parsedQty) || parsedQty < 0) return;

    setSavingCorrection(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('cheikh_correct_entry', {
        p_entry_id: editingEntry.id,
        p_new_quantity: parsedQty,
        p_reason: reason.trim() || 'Correction par le gestionnaire',
      });
      if (!error) {
        setEditingEntry(null);
        await fetchSnapshot();
      }
    } finally {
      setSavingCorrection(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-primary)]">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
            <span>
              {isAr ? 'مباشر • آخر تحديث:' : 'Temps réel actif • Mis à jour :'}{' '}
              <span className="tabular-nums">
                {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => void fetchSnapshot()}
            className="h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold"
          >
            {isAr ? 'تحديث يدوي' : 'Actualiser'}
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'overview', label: isAr ? 'نظرة عامة' : 'Vue d’ensemble' },
            { id: 'by_zikr', label: isAr ? 'حسب الذكر' : 'Par zikr' },
            { id: 'by_member', label: isAr ? 'حسب العضو' : 'Par personne' },
            { id: 'by_day', label: isAr ? 'حسب اليوم' : 'Par jour' },
            { id: 'stay_total', label: isAr ? 'إجمالي الزيارة' : 'Totalité séjour' },
          ].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setView(v.id as DashboardView);
                if (v.id === 'stay_total') setFilterDay('ALL');
              }}
              className={`shrink-0 h-10 px-3.5 rounded-xl text-xs font-semibold transition-colors ${
                view === v.id
                  ? 'bg-[var(--accent-gold)] text-[var(--text-on-accent)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="h-11 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-xs font-medium"
          >
            <option value="ALL">{isAr ? 'كل الأيام (الزيارة كاملة)' : 'Tous les jours (Séjour)'}</option>
            {availableDays.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={filterZikr}
            onChange={(e) => setFilterZikr(e.target.value)}
            className="h-11 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-xs font-medium"
          >
            <option value="ALL">{isAr ? 'جميع الأذكار' : 'Tous les zikr'}</option>
            {zikrs.map((z) => (
              <option key={z.id} value={z.id}>
                {isAr ? z.name_ar : z.name_fr}
              </option>
            ))}
          </select>

          <select
            value={filterMember}
            onChange={(e) => setFilterMember(e.target.value)}
            className="h-11 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-xs font-medium"
          >
            <option value="ALL">{isAr ? 'جميع الأعضاء' : 'Tous les membres'}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name || m.phone_e164}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
          <div className="text-xs text-[var(--text-secondary)]">{isAr ? 'الهدف' : 'Objectif'}</div>
          <div className="text-xl font-bold mt-1">{filteredMetrics.targetSum.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
          <div className="text-xs text-[var(--text-secondary)]">{isAr ? 'المُنجز' : 'Fait (Perso + Réserve)'}</div>
          <div className="text-xl font-bold text-[var(--accent-primary)] mt-1">
            {(filteredMetrics.donePersonal + filteredMetrics.donePot).toLocaleString()}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
          <div className="text-xs text-[var(--text-secondary)]">{isAr ? 'المتبقي' : 'Reste à faire'}</div>
          <div className="text-xl font-bold text-[var(--status-late)] mt-1">
            {filteredMetrics.remaining.toLocaleString()}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
          <div className="text-xs text-[var(--text-secondary)]">{isAr ? 'الاحتياطي' : 'Réserve (reste)'}</div>
          <div className="text-xl font-bold text-[var(--status-pot)] mt-1">
            {filteredMetrics.potRemaining.toLocaleString()} / {filteredMetrics.potAllocated.toLocaleString()}
          </div>
        </div>
      </section>

      {(view === 'by_zikr' || view === 'overview' || view === 'stay_total') && (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
          <h2 className="font-display text-lg font-bold">
            {isAr ? 'التقدم حسب الذكر' : 'Avancement par Zikr'}
          </h2>
          <div className="space-y-3">
            {zikrs
              .filter((z) => filterZikr === 'ALL' || z.id === filterZikr)
              .map((z) => {
                const zGoals = goals.filter(
                  (g) =>
                    g.zikr_id === z.id &&
                    (filterMember === 'ALL' || g.member_id === filterMember) &&
                    (filterDay === 'ALL' || g.target_date === null || g.target_date === filterDay)
                );
                const target = zGoals.reduce((a, g) => a + Math.max(0, g.initial_target + g.adjusted_delta), 0);
                const done = entries
                  .filter(
                    (e) =>
                      e.zikr_id === z.id &&
                      e.status === 'active' &&
                      (filterMember === 'ALL' || e.member_id === filterMember) &&
                      (filterDay === 'ALL' || z.scope === 'stay' || e.entry_date === filterDay)
                  )
                  .reduce((a, e) => a + e.quantity, 0);
                const rem = Math.max(0, target - done);
                const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 100;

                return (
                  <div key={z.id} className="p-3.5 rounded-xl bg-[var(--bg-surface)] space-y-2 tabular-nums">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{isAr ? z.name_ar : z.name_fr}</span>
                      <span className="text-xs font-bold text-[var(--accent-primary)]">
                        {done.toLocaleString()} / {target.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-canvas)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent-primary)] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                      <span>{rem === 0 ? 'Terminé' : `Reste : ${rem.toLocaleString()}`}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {(view === 'by_member' || view === 'by_day') && (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
          <h2 className="font-display text-lg font-bold">
            {isAr ? 'التقدم الفردي للأعضاء وحالة المزامنة' : 'Progression individuelle & dernière synchronisation'}
          </h2>
          <div className="divide-y divide-[var(--border-subtle)]">
            {members
              .filter((m) => filterMember === 'ALL' || m.id === filterMember)
              .map((m) => {
                const mGoals = goals.filter(
                  (g) =>
                    g.member_id === m.id &&
                    (filterZikr === 'ALL' || g.zikr_id === filterZikr) &&
                    (filterDay === 'ALL' || g.target_date === null || g.target_date === filterDay)
                );
                const target = mGoals.reduce((a, g) => a + Math.max(0, g.initial_target + g.adjusted_delta), 0);
                const done = entries
                  .filter(
                    (e) =>
                      e.member_id === m.id &&
                      e.source === 'personal' &&
                      e.status === 'active' &&
                      (filterZikr === 'ALL' || e.zikr_id === filterZikr) &&
                      (filterDay === 'ALL' || e.entry_date === filterDay)
                  )
                  .reduce((a, e) => a + e.quantity, 0);
                const rem = Math.max(0, target - done);
                const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 100;

                return (
                  <div key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-2 tabular-nums">
                    <div>
                      <div className="font-semibold text-sm">{m.full_name || m.phone_e164}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {m.last_synced_at
                          ? `Sync : ${new Date(m.last_synced_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : 'Hors-ligne / Jamais synchronisé'}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-sm font-bold">
                        {done.toLocaleString()} / {target.toLocaleString()} ({pct}%)
                      </div>
                      <div
                        className={`text-xs font-semibold ${
                          rem === 0 ? 'text-[var(--accent-gold)]' : 'text-[var(--status-late)]'
                        }`}
                      >
                        {rem === 0 ? 'Terminé' : `Reste : ${rem.toLocaleString()}`}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[var(--status-late)]">
            {isAr ? `المتأخرون (${lateList.length})` : `Membres n'ayant pas terminé (${lateList.length})`}
          </h2>
          {lateList.length > 0 && (
            <Link
              href="/admin/redistribute"
              className="h-9 px-3 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] text-xs font-semibold flex items-center"
            >
              {isAr ? 'إعادة التوزيع ←' : 'Redistribuer →'}
            </Link>
          )}
        </div>

        {lateList.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            {isAr ? 'جميع الأعضاء أتموا أهدافهم.' : 'Tous les objectifs filtrés sont terminés.'}
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {lateList.slice(0, 15).map((row) => (
              <div
                key={`${row.member.id}-${row.zikr.id}`}
                className="py-2.5 flex items-center justify-between gap-2 text-sm tabular-nums"
              >
                <div>
                  <span className="font-semibold">{row.member.full_name || row.member.phone_e164}</span>
                  <span className="text-xs text-[var(--text-secondary)] mx-2">•</span>
                  <span className="text-xs font-medium">{isAr ? row.zikr.name_ar : row.zikr.name_fr}</span>
                </div>
                <span className="font-bold text-[var(--status-late)]">
                  -{row.remaining.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
        <h2 className="font-display text-lg font-bold">
          {isAr ? 'سجل الإدخالات الأخيرة (تصحيح / إلغاء)' : 'Dernières saisies (Audit & Correction)'}
        </h2>
        <div className="divide-y divide-[var(--border-subtle)]">
          {entries.slice(0, 20).map((entry) => {
            const m = members.find((x) => x.id === entry.member_id);
            const z = zikrs.find((x) => x.id === entry.zikr_id);
            const cancelled = entry.status === 'cancelled';

            return (
              <div key={entry.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className={cancelled ? 'opacity-50 line-through' : ''}>
                  <span className="font-semibold">{m?.full_name || m?.phone_e164}</span>
                  <span className="mx-1.5 text-[var(--text-secondary)]">•</span>
                  <span>{z ? (isAr ? z.name_ar : z.name_fr) : 'Zikr'}</span>
                  <span className="mx-1.5 font-bold tabular-nums">+{entry.quantity.toLocaleString()}</span>
                  {entry.source === 'pot' && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--status-pot-soft)] text-[var(--status-pot)] font-bold">
                      Réserve
                    </span>
                  )}
                  <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                    {entry.entry_date} •{' '}
                    {new Date(entry.created_at_client).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {cancelled && entry.cancel_reason ? ` • ${entry.cancel_reason}` : ''}
                  </div>
                </div>

                {!cancelled && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEntry(entry);
                      setNewQty(String(entry.quantity));
                      setReason('');
                    }}
                    className="h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold"
                  >
                    {isAr ? 'تصحيح / إلغاء' : 'Corriger / Annuler'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitCorrection}
            className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-[var(--accent-primary)]">
              {isAr ? 'تصحيح أو إلغاء الإدخال' : 'Corriger ou annuler la saisie'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {isAr
                ? 'أدخل 0 لإلغاء الإدخال بالكامل، أو أدخل العدد المصحح. سيتم حفظ السجل الأصلي.'
                : 'Saisissez 0 pour annuler complètement cette saisie, ou indiquez la nouvelle quantité exacte. L’historique original est conservé.'}
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1">
                {isAr ? 'العدد الجديد (0 = إلغاء)' : 'Nouvelle quantité (0 = annulation)'}
              </label>
              <input
                type="number"
                min={0}
                required
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base font-bold tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                {isAr ? 'سبب التصحيح' : 'Motif de la correction (traçabilité)'}
              </label>
              <input
                type="text"
                required
                placeholder={isAr ? 'مثال: خطأ في كتابة الرقم' : 'Ex. Erreur de frappe signalée'}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="h-11 px-4 rounded-xl bg-[var(--bg-surface)] text-sm font-semibold"
              >
                {isAr ? 'إلغاء' : 'Fermer'}
              </button>
              <button
                type="submit"
                disabled={savingCorrection}
                className="h-11 px-5 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] text-sm font-semibold"
              >
                {savingCorrection ? '...' : isAr ? 'حفظ' : 'Appliquer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
