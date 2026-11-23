'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';
import { listDays } from '@/lib/distribution';
import { BarChart, Donut, HBars, Heatmap, Kpi, Legend, LineChart } from '@/components/admin/charts';

interface ZikrDef { id: string; name_fr: string; name_ar: string }
interface MemberRow { id: string; full_name: string | null; phone_e164: string }
interface GoalRow { member_id: string; zikr_id: string; target_date: string | null; initial_target: number; adjusted_delta: number }
interface EntryRow { zikr_id: string; entry_date: string; source: 'personal' | 'pot'; quantity: number; member_id: string }
interface PotRow { zikr_id: string; allocated_quantity: number }

const card = 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-3';

export default function CheikhAnalyticsPage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';
  const loc = isAr ? 'ar-u-nu-latn' : 'fr-FR';
  const nf = (n: number) => Math.round(n).toLocaleString(loc);
  const pctTxt = (n: number) => `${Math.round(n)}${isAr ? '٪' : ' %'}`;

  const [days, setDays] = useState<string[]>([]);
  const [zikrs, setZikrs] = useState<ZikrDef[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [pots, setPots] = useState<PotRow[]>([]);
  const [zikrFilter, setZikrFilter] = useState('ALL');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: z } = await supabase.from('ziyaras').select('id, start_date, end_date').eq('is_active', true).limit(1).single();
    if (!z) return;
    setDays(listDays(z.start_date, z.end_date));
    const [d, m, g, e, p] = await Promise.all([
      supabase.from('zikr_definitions').select('id, name_fr, name_ar').eq('ziyara_id', z.id).order('sort_order'),
      supabase.from('group_members').select('id, full_name, phone_e164').eq('ziyara_id', z.id),
      supabase.from('member_goals').select('member_id, zikr_id, target_date, initial_target, adjusted_delta').eq('ziyara_id', z.id),
      supabase.from('zikr_entries').select('zikr_id, entry_date, source, quantity, member_id').eq('ziyara_id', z.id).eq('status', 'active'),
      supabase.from('common_pots').select('zikr_id, allocated_quantity').eq('ziyara_id', z.id),
    ]);
    setZikrs((d.data ?? []) as ZikrDef[]);
    setMembers((m.data ?? []) as MemberRow[]);
    setGoals((g.data ?? []).map((x) => ({ ...x, initial_target: Number(x.initial_target), adjusted_delta: Number(x.adjusted_delta) })));
    setEntries((e.data ?? []).map((x) => ({ ...x, quantity: Number(x.quantity) })) as EntryRow[]);
    setPots((p.data ?? []).map((x) => ({ ...x, allocated_quantity: Number(x.allocated_quantity) })));
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const ch = supabase.channel('analytics-live').on('postgres_changes', { event: '*', schema: 'public', table: 'zikr_entries' }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const eff = (g: GoalRow) => Math.max(0, g.initial_target + g.adjusted_delta);

  const m = useMemo(() => {
    const inF = (id: string) => zikrFilter === 'ALL' || id === zikrFilter;
    const G = goals.filter((g) => inF(g.zikr_id));
    const E = entries.filter((e) => inF(e.zikr_id));
    const P = pots.filter((p) => inF(p.zikr_id));
    const targetGoals = G.reduce((a, g) => a + eff(g), 0);
    const potAllocated = P.reduce((a, p) => a + p.allocated_quantity, 0);
    const donePersonal = E.filter((e) => e.source === 'personal').reduce((a, e) => a + e.quantity, 0);
    const donePot = E.filter((e) => e.source === 'pot').reduce((a, e) => a + e.quantity, 0);
    const groupTarget = targetGoals + potAllocated;
    const groupDone = Math.min(groupTarget, donePersonal + donePot);

    const dayTarget = days.map((d) => G.filter((g) => g.target_date === d).reduce((a, g) => a + eff(g), 0));
    const dayDone = days.map((d) => E.filter((e) => e.entry_date === d).reduce((a, e) => a + e.quantity, 0));
    const cumT: number[] = []; const cumD: number[] = [];
    let a1 = 0, a2 = 0;
    dayTarget.forEach((v, i) => { a1 += v; cumT[i] = a1; });
    dayDone.forEach((v, i) => { a2 += v; cumD[i] = days[i] <= today ? a2 : 0; });

    const perMember = members.map((mb) => {
      const mg = G.filter((g) => g.member_id === mb.id);
      const target = mg.reduce((a, g) => a + eff(g), 0);
      const done = E.filter((e) => e.member_id === mb.id && e.source === 'personal').reduce((a, e) => a + e.quantity, 0);
      let late = 0;
      for (const g of mg) {
        if (g.target_date && g.target_date < today) {
          const dd = E.filter((e) => e.member_id === mb.id && e.zikr_id === g.zikr_id && e.source === 'personal' && e.entry_date === g.target_date).reduce((a, e) => a + e.quantity, 0);
          late += Math.max(0, eff(g) - dd);
        }
      }
      const activeToday = E.some((e) => e.member_id === mb.id && e.entry_date === today);
      return { mb, target, done, late, activeToday, name: mb.full_name || mb.phone_e164 };
    });

    const perZikr = zikrs.map((z) => {
      const t = goals.filter((g) => g.zikr_id === z.id).reduce((a, g) => a + eff(g), 0);
      const d = entries.filter((e) => e.zikr_id === z.id && e.source === 'personal').reduce((a, e) => a + e.quantity, 0);
      return { z, t, d };
    });

    const heat = (i: number, j: number) => {
      const mb = members[i]; const d = days[j];
      const t = G.filter((g) => g.member_id === mb.id && g.target_date === d).reduce((a, g) => a + eff(g), 0);
      if (t <= 0) return null;
      const dn = E.filter((e) => e.member_id === mb.id && e.entry_date === d && e.source === 'personal').reduce((a, e) => a + e.quantity, 0);
      return Math.min(1, dn / t);
    };

    const elapsed = days.filter((d) => d <= today).length;
    return { targetGoals, potAllocated, donePersonal, donePot, groupTarget, groupDone, dayTarget, dayDone, cumT, cumD, perMember, perZikr, heat, elapsed };
  }, [goals, entries, pots, members, zikrs, days, zikrFilter, today]);

  const reserveLeft = Math.max(0, m.potAllocated - m.donePot);
  const activeNow = m.perMember.filter((x) => x.activeToday).length;
  const lateMembers = m.perMember.filter((x) => x.late > 0);
  const groupPct = m.groupTarget > 0 ? (m.groupDone / m.groupTarget) * 100 : 0;
  const dayLabels = days.map((d) => d.slice(8) + '/' + d.slice(5, 7));
  const sortedMembers = [...m.perMember].sort((a, b) => b.done - a.done);
  const C = { pri: 'var(--accent-primary)', gold: 'var(--accent-gold)', ok: 'var(--status-ok)', late: 'var(--status-late)', mute: 'var(--border-strong)' };

  if (!loaded) return <div className="py-10 text-center text-[var(--text-secondary)]">{isAr ? 'جاري التحميل…' : 'Chargement…'}</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{isAr ? 'الإحصائيات' : 'Statistiques'}</h2>
        <select value={zikrFilter} onChange={(e) => setZikrFilter(e.target.value)} className="h-11 px-3 rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-sm font-medium">
          <option value="ALL">{isAr ? 'كل الأذكار' : 'Tous les zikr'}</option>
          {zikrs.map((z) => <option key={z.id} value={z.id}>{isAr ? z.name_ar : z.name_fr}</option>)}
        </select>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={isAr ? 'تقدم المجموعة' : 'Avancement du groupe'} value={pctTxt(groupPct)} sub={`${nf(m.groupDone)} / ${nf(m.groupTarget)}`} tone="ok" />
        <Kpi label={isAr ? 'المتبقي' : 'Reste à faire'} value={nf(Math.max(0, m.groupTarget - m.groupDone))} sub={isAr ? 'شخصي + احتياطي' : 'perso + Réserve'} tone="gold" />
        <Kpi label={isAr ? 'الاحتياطي المتبقي' : 'Réserve restante'} value={nf(reserveLeft)} sub={`${nf(m.donePot)} ${isAr ? 'مأخوذ' : 'puisés'}`} />
        <Kpi label={isAr ? 'نشطون اليوم' : 'Actifs aujourd’hui'} value={`${activeNow} / ${members.length}`} sub={`${isAr ? 'اليوم' : 'Jour'} ${Math.min(m.elapsed, days.length)} / ${days.length}`} />
        <Kpi label={isAr ? 'المتأخرون' : 'Membres en retard'} value={String(lateMembers.length)} sub={`${nf(lateMembers.reduce((a, x) => a + x.late, 0))} ${isAr ? 'متبقٍّ' : 'à rattraper'}`} tone={lateMembers.length > 0 ? 'late' : 'ok'} />
        <Kpi label={isAr ? 'متوسط لكل عضو' : 'Moyenne par membre'} value={nf(members.length ? m.donePersonal / members.length : 0)} sub={isAr ? 'تسجيل شخصي' : 'saisies personnelles'} />
        <Kpi label={isAr ? 'الهدف الفردي' : 'Objectifs individuels'} value={nf(m.targetGoals)} sub={`${nf(m.donePersonal)} ${isAr ? 'منجز' : 'faits'}`} />
        <Kpi label={isAr ? 'الاحتياطي الكلي' : 'Réserve alimentée'} value={nf(m.potAllocated)} />
      </section>

      <section className={card}>
        <h3 className="text-lg font-semibold">{isAr ? 'التقدم التراكمي' : 'Progression cumulée'}</h3>
        <Legend items={[{ name: isAr ? 'المنجز' : 'Fait', color: C.pri }, { name: isAr ? 'المخطط' : 'Objectif prévu', color: C.gold }]} />
        <LineChart labels={dayLabels} series={[{ name: isAr ? 'المنجز' : 'Fait', color: C.pri, values: m.cumD }, { name: isAr ? 'المخطط' : 'Objectif prévu', color: C.gold, dashed: true, values: m.cumT }]} />
      </section>

      <section className="grid lg:grid-cols-2 gap-5">
        <div className={card}>
          <h3 className="text-lg font-semibold">{isAr ? 'حسب اليوم' : 'Par jour'}</h3>
          <Legend items={[{ name: isAr ? 'الهدف' : 'Objectif', color: C.mute }, { name: isAr ? 'المنجز' : 'Fait', color: C.pri }]} />
          <BarChart labels={dayLabels} series={[{ name: isAr ? 'الهدف' : 'Objectif', color: C.mute, values: m.dayTarget }, { name: isAr ? 'المنجز' : 'Fait', color: C.pri, values: m.dayDone }]} />
        </div>
        <div className={card}>
          <h3 className="text-lg font-semibold">{isAr ? 'المصدر' : 'Origine des récitations'}</h3>
          <Donut center={pctTxt(groupPct)} parts={[{ name: isAr ? 'شخصي' : 'Personnel', value: m.donePersonal, color: C.pri }, { name: isAr ? 'من الاحتياطي' : 'Depuis la Réserve', value: m.donePot, color: C.gold }, { name: isAr ? 'متبقٍّ' : 'Reste', value: Math.max(0, m.groupTarget - m.groupDone), color: C.mute }]} />
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-5">
        <div className={card}>
          <h3 className="text-lg font-semibold">{isAr ? 'حسب الذكر' : 'Par zikr'}</h3>
          <HBars rows={m.perZikr.map(({ z, t, d }) => ({ label: isAr ? z.name_ar : z.name_fr, value: d, max: t, right: `${nf(d)} / ${nf(t)}`, color: d >= t && t > 0 ? C.ok : C.pri }))} />
        </div>
        <div className={card}>
          <h3 className="text-lg font-semibold">{isAr ? 'ترتيب الأعضاء' : 'Classement des membres'}</h3>
          <HBars rows={sortedMembers.slice(0, 12).map((x) => ({ label: x.name, value: x.done, max: Math.max(1, x.target), right: `${nf(x.done)} / ${nf(x.target)}`, color: x.late > 0 ? C.late : C.pri }))} />
        </div>
      </section>

      <section className={card}>
        <h3 className="text-lg font-semibold">{isAr ? 'خريطة الإنجاز (عضو × يوم)' : 'Carte d’achèvement (membre × jour, en %)'}</h3>
        {members.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">—</p> : (
          <Heatmap rows={members.map((x) => x.full_name || x.phone_e164)} cols={days.map((d) => d.slice(8))} value={m.heat} />
        )}
      </section>

      {lateMembers.length > 0 && (
        <section className={card}>
          <h3 className="text-lg font-semibold">{isAr ? 'المتأخرون' : 'Membres en retard'}</h3>
          <HBars rows={[...lateMembers].sort((a, b) => b.late - a.late).map((x) => ({ label: x.name, value: x.late, max: Math.max(...lateMembers.map((y) => y.late)), right: nf(x.late), color: C.late }))} />
        </section>
      )}
    </div>
  );
}
