'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getManagedZiyara, pickMemberRow } from '@/lib/ziyara/current';
import { useAppShell } from '@/components/providers/app-shell-provider';
import { listDays } from '@/lib/distribution';

interface MemberItem { id: string; full_name: string | null; phone_e164: string }
interface ZikrItem { id: string; name_fr: string; name_ar: string }
interface GoalItem { id: string; member_id: string; zikr_id: string; target_date: string | null; initial_target: number; adjusted_delta: number }
interface EntryItem { member_id: string; zikr_id: string; entry_date: string; source: 'personal' | 'pot'; quantity: number }
interface RedistItem {
  id: string; zikr_id: string; target_date: string | null;
  from_member_id: string; to_member_id: string | null; mode: 'pot' | 'targeted' | 'carryover';
  quantity: number; status: 'active' | 'cancelled'; created_at: string;
}
type Cell = { goal: GoalItem; target: number; done: number; remaining: number };

const box = 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5';
const STAY = 'stay';

export default function CheikhRedistributePage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';
  const nf = (n: number) => n.toLocaleString(isAr ? 'ar-u-nu-latn' : 'fr-FR');

  const [ziyara, setZiyara] = useState<{ id: string; start_date: string; end_date: string } | null>(null);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [zikrs, setZikrs] = useState<ZikrItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [history, setHistory] = useState<RedistItem[]>([]);

  const [zikrId, setZikrId] = useState('');
  const [fromMembers, setFromMembers] = useState<Set<string>>(new Set());
  const [cycles, setCycles] = useState<Set<string>>(new Set());
  const [toPotPct, setToPotPct] = useState('100');
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  const [destDay, setDestDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const zData = await getManagedZiyara(supabase);
    if (!zData) return;
    setZiyara(zData);
    const [mRes, zRes, gRes, eRes, hRes] = await Promise.all([
      supabase.from('group_members').select('id, full_name, phone_e164').eq('ziyara_id', zData.id).order('created_at'),
      supabase.from('zikr_definitions').select('id, name_fr, name_ar').eq('ziyara_id', zData.id).order('sort_order'),
      supabase.from('member_goals').select('id, member_id, zikr_id, target_date, initial_target, adjusted_delta').eq('ziyara_id', zData.id),
      supabase.from('zikr_entries').select('member_id, zikr_id, entry_date, source, quantity').eq('ziyara_id', zData.id).eq('status', 'active'),
      supabase.from('goal_redistributions')
        .select('id, zikr_id, target_date, from_member_id, to_member_id, mode, quantity, status, created_at')
        .eq('ziyara_id', zData.id).neq('mode', 'carryover').order('created_at', { ascending: false }).limit(40),
    ]);
    if (mRes.data) {
      setMembers(mRes.data);
      setFromMembers((p) => (p.size === 0 ? new Set(mRes.data.map((m) => m.id)) : p));
    }
    if (zRes.data) {
      setZikrs(zRes.data);
      setZikrId((p) => p || zRes.data[0]?.id || '');
    }
    if (gRes.data) setGoals(gRes.data.map((g) => ({ ...g, initial_target: Number(g.initial_target), adjusted_delta: Number(g.adjusted_delta) })));
    if (eRes.data) setEntries(eRes.data.map((e) => ({ ...e, quantity: Number(e.quantity) })));
    if (hRes.data) setHistory(hRes.data.map((h) => ({ ...h, quantity: Number(h.quantity) })) as RedistItem[]);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const days = useMemo(() => (ziyara ? listDays(ziyara.start_date, ziyara.end_date) : []), [ziyara]);
  const today = new Date().toISOString().slice(0, 10);
  const memberName = (id: string | null) => {
    const m = members.find((x) => x.id === id);
    return m ? m.full_name || m.phone_e164 : '—';
  };

  const cells = useMemo(() => {
    const map = new Map<string, Cell>();
    const zGoals = goals.filter((g) => g.zikr_id === zikrId);
    for (const g of zGoals) {
      const datedDays = new Set(zGoals.filter((x) => x.member_id === g.member_id && x.target_date).map((x) => x.target_date as string));
      const target = Math.max(0, g.initial_target + g.adjusted_delta);
      const done = entries
        .filter((e) => e.member_id === g.member_id && e.zikr_id === zikrId && e.source === 'personal' &&
          (g.target_date === null ? !datedDays.has(e.entry_date) : e.entry_date === g.target_date))
        .reduce((a, e) => a + e.quantity, 0);
      map.set(`${g.member_id}|${g.target_date ?? STAY}`, { goal: g, target, done, remaining: Math.max(0, target - done) });
    }
    return map;
  }, [goals, entries, zikrId]);

  const hasStay = useMemo(() => [...cells.values()].some((c) => c.goal.target_date === null), [cells]);
  const columns = useMemo(() => [...days, ...(hasStay ? [STAY] : [])], [days, hasStay]);
  const shownMembers = members.filter((m) => fromMembers.has(m.id));
  const colRemaining = (col: string) => shownMembers.reduce((a, m) => a + (cells.get(`${m.id}|${col}`)?.remaining ?? 0), 0);

  const selectedCells = useMemo(() => {
    const out: { member: MemberItem; col: string; cell: Cell }[] = [];
    for (const m of shownMembers) for (const c of cycles) {
      const cell = cells.get(`${m.id}|${c}`);
      if (cell && cell.remaining > 0) out.push({ member: m, col: c, cell });
    }
    return out;
  }, [shownMembers, cycles, cells]);

  const pct = Math.min(100, Math.max(0, parseInt(toPotPct, 10) || 0));
  const totalRemaining = selectedCells.reduce((a, x) => a + x.cell.remaining, 0);

  const plan = useMemo(() => selectedCells.map((x) => {
    const R = x.cell.remaining;
    const pot = pct >= 100 ? R : Math.round((R * pct) / 100);
    const rest = R - pot;
    const rec = [...recipients].filter((id) => id !== x.member.id);
    const allocs: { member_id: string; quantity: number }[] = [];
    if (rest > 0 && rec.length > 0) {
      const base = Math.floor(rest / rec.length);
      const extra = rest % rec.length;
      rec.forEach((id, i) => { const q = base + (i < extra ? 1 : 0); if (q > 0) allocs.push({ member_id: id, quantity: q }); });
    }
    const given = allocs.reduce((a, b) => a + b.quantity, 0);
    return { ...x, pot: pot + (rest - given), allocs };
  }), [selectedCells, pct, recipients]);

  const planPot = plan.reduce((a, p) => a + p.pot, 0);
  const needsRecipients = pct < 100 && recipients.size === 0;
  const colLabel = (c: string) => (c === STAY ? (isAr ? 'الزيارة' : 'Séjour') : c.slice(5).split('-').reverse().join('/'));

  function toggle<T>(set: Set<T>, v: T): Set<T> {
    const n = new Set(set);
    if (n.has(v)) n.delete(v); else n.add(v);
    return n;
  }

  async function run() {
    if (!ziyara || plan.length === 0 || needsRecipients) return;
    if (!window.confirm(isAr ? `إعادة توزيع ${nf(totalRemaining)} ؟` : `Redistribuer ${nf(totalRemaining)} (${plan.length} cycle(s)) ?`)) return;
    setBusy(true);
    setFb(null);
    const supabase = createClient();
    let done = 0;
    const errors: string[] = [];
    for (const p of plan) {
      const { error } = await supabase.rpc('redistribute_remaining', {
        p_ziyara_id: ziyara.id,
        p_zikr_id: zikrId,
        p_target_date: p.cell.goal.target_date,
        p_from_member_id: p.member.id,
        p_pot_qty: p.pot,
        p_targeted_allocations: p.allocs.map((a) => ({ ...a, ...(destDay ? { target_date: destDay } : {}) })),
      });
      if (error) errors.push(`${p.member.full_name || p.member.phone_e164} ${colLabel(p.col)} : ${error.message}`);
      else done++;
    }
    setBusy(false);
    setFb(errors.length === 0
      ? { type: 'ok', msg: isAr ? `تمت إعادة التوزيع (${done}).` : `Redistribution effectuée (${done} cycle(s)).` }
      : { type: 'err', msg: `${done} OK, ${errors.length} en erreur — ${errors.slice(0, 3).join(' | ')}` });
    setCycles(new Set());
    await loadData();
  }

  async function cancel(id: string) {
    if (!window.confirm(isAr ? 'إلغاء إعادة التوزيع هذه؟' : 'Annuler cette redistribution ?')) return;
    const { error } = await createClient().rpc('cancel_redistribution', { p_redistribution_id: id, p_reason: null });
    setFb(error ? { type: 'err', msg: error.message } : { type: 'ok', msg: isAr ? 'تم الإلغاء.' : 'Redistribution annulée.' });
    await loadData();
  }

  const cellStyle = (c: Cell | undefined, col: string) => {
    if (!c) return 'text-[var(--text-secondary)]/50';
    if (c.remaining === 0) return 'bg-[var(--status-ok-soft)] text-[var(--status-ok)]';
    if (col !== STAY && col < today) return 'bg-[var(--status-late-soft)] text-[var(--status-late)]';
    return c.done > 0 ? 'bg-[var(--status-offline-soft)] text-[var(--status-offline)]' : 'bg-[var(--bg-surface)] text-[var(--text-primary)]';
  };
  const chk = 'h-5 w-5 accent-[var(--accent-primary)]';
  const zname = (id: string) => { const z = zikrs.find((x) => x.id === id); return z ? (isAr ? z.name_ar : z.name_fr) : '—'; };
  const MemberList = ({ value, onChange }: { value: Set<string>; onChange: (s: Set<string>) => void }) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
      {members.map((m) => (
        <label key={m.id} className="flex items-center gap-3 min-h-11 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm">
          <input type="checkbox" className={chk} checked={value.has(m.id)} onChange={() => onChange(toggle(value, m.id))} />
          {m.full_name || m.phone_e164}
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {fb && (
        <div role="status" className={`p-3.5 rounded-xl text-sm font-semibold ${fb.type === 'ok' ? 'bg-[var(--status-ok-soft)] text-[var(--status-ok)]' : 'bg-[var(--status-late-soft)] text-[var(--status-late)]'}`}>{fb.msg}</div>
      )}

      <section className={`${box} space-y-4`}>
        <div>
          <h2 className="text-xl font-semibold">{isAr ? 'إعادة التوزيع حسب الدورة' : 'Redistribuer par cycle'}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{isAr ? 'اختر الذكر والأعضاء، راجع تقدم كل يوم، ثم اختر الأيام.' : 'Choisissez le zikr et les membres, regardez l’avancement de chaque jour (un cycle), puis cochez les jours à redistribuer.'}</p>
        </div>
        <div className="sm:w-1/2">
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">{isAr ? 'الذكر' : 'Zikr'}</label>
          <select value={zikrId} onChange={(e) => { setZikrId(e.target.value); setCycles(new Set()); }} className="w-full h-12 px-3 rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base">
            {zikrs.map((z) => <option key={z.id} value={z.id}>{isAr ? z.name_ar : z.name_fr}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">{isAr ? 'الأعضاء' : 'Membres concernés'} ({fromMembers.size}/{members.length})</span>
            <span className="flex gap-3 text-sm font-semibold">
              <button type="button" className="text-[var(--accent-primary)]" onClick={() => setFromMembers(new Set(members.map((m) => m.id)))}>{isAr ? 'الكل' : 'Tous'}</button>
              <button type="button" className="text-[var(--text-secondary)]" onClick={() => setFromMembers(new Set())}>{isAr ? 'لا أحد' : 'Aucun'}</button>
            </span>
          </div>
          <MemberList value={fromMembers} onChange={setFromMembers} />
        </div>
      </section>

      <section className={`${box} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{isAr ? 'التقدم حسب الدورة' : 'Avancement par cycle'}</h3>
          <span className="flex flex-wrap gap-2 text-sm font-semibold">
            <button type="button" className="h-10 px-3 rounded-lg border border-[var(--border-subtle)] text-[var(--status-late)]" onClick={() => setCycles(new Set(columns.filter((c) => c !== STAY && c < today && colRemaining(c) > 0)))}>{isAr ? 'الأيام المتأخرة' : 'Jours en retard'}</button>
            <button type="button" className="h-10 px-3 rounded-lg border border-[var(--border-subtle)]" onClick={() => setCycles(new Set(columns.filter((c) => colRemaining(c) > 0)))}>{isAr ? 'كل الأيام' : 'Tous les jours'}</button>
            <button type="button" className="h-10 px-3 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)]" onClick={() => setCycles(new Set())}>{isAr ? 'مسح' : 'Effacer'}</button>
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-[var(--status-ok-soft)] text-[var(--status-ok)]">{isAr ? 'مكتمل' : 'Terminé'}</span>
          <span className="px-2 py-1 rounded bg-[var(--status-offline-soft)] text-[var(--status-offline)]">{isAr ? 'جارٍ' : 'En cours'}</span>
          <span className="px-2 py-1 rounded bg-[var(--status-late-soft)] text-[var(--status-late)]">{isAr ? 'متأخر' : 'En retard'}</span>
          <span className="px-2 py-1 rounded bg-[var(--bg-surface)]">{isAr ? 'لم يبدأ' : 'À venir'}</span>
        </div>
        {shownMembers.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] py-4">{isAr ? 'اختر عضوًا.' : 'Sélectionnez au moins un membre.'}</p>
        ) : (
          <div className="overflow-x-auto pb-1">
            <table className="text-sm tabular-nums border-separate border-spacing-1 min-w-full">
              <thead>
                <tr>
                  <th className="text-start font-semibold text-[var(--text-secondary)] pe-3 min-w-32">{isAr ? 'العضو' : 'Membre'}</th>
                  {columns.map((c) => {
                    const rem = colRemaining(c);
                    return (
                      <th key={c} className="font-semibold min-w-20">
                        <label className={`flex flex-col items-center gap-1 rounded-lg py-1.5 ${rem > 0 ? 'cursor-pointer' : 'opacity-50'} ${cycles.has(c) ? 'bg-[var(--accent-primary-soft)]' : ''}`}>
                          <input type="checkbox" className={chk} disabled={rem === 0} checked={cycles.has(c)} onChange={() => setCycles(toggle(cycles, c))} />
                          <span>{colLabel(c)}</span>
                          <span className="text-[11px] font-normal text-[var(--text-secondary)]">{rem > 0 ? `${isAr ? 'متبقٍّ' : 'reste'} ${nf(rem)}` : '✓'}</span>
                        </label>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {shownMembers.map((m) => (
                  <tr key={m.id}>
                    <td className="pe-3 font-medium whitespace-nowrap">{m.full_name || m.phone_e164}</td>
                    {columns.map((c) => {
                      const cell = cells.get(`${m.id}|${c}`);
                      const sel = cycles.has(c) && cell && cell.remaining > 0;
                      return (
                        <td key={c} className={`text-center rounded-lg px-2 py-2 ${cellStyle(cell, c)} ${sel ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}>
                          {cell ? <>{nf(cell.done)}<span className="opacity-60">/{nf(cell.target)}</span></> : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${box} space-y-4`}>
        <h3 className="text-lg font-semibold">{isAr ? 'الوجهة' : 'Destination du reste'}</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">{isAr ? 'نسبة الاحتياطي (%)' : 'Part envoyée à la Réserve (%)'}</label>
            <input type="number" min={0} max={100} inputMode="numeric" value={toPotPct} onChange={(e) => setToPotPct(e.target.value)} className="w-full h-12 px-3 rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base font-bold tabular-nums" />
            <p className="text-xs text-[var(--text-secondary)] mt-1">{isAr ? '100 = كل المتبقي إلى الاحتياطي.' : '100 = tout à la Réserve. Moins = le reste est réparti à parts égales entre les destinataires.'}</p>
          </div>
          {pct < 100 && (
            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">{isAr ? 'يوم التطبيق (اختياري)' : 'Jour d’application (optionnel)'}</label>
              <input type="date" min={ziyara?.start_date} max={ziyara?.end_date} value={destDay} onChange={(e) => setDestDay(e.target.value)} className="w-full h-12 px-3 rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base tabular-nums" />
            </div>
          )}
        </div>
        {pct < 100 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[var(--text-secondary)]">{isAr ? 'المستلمون' : 'Destinataires'} ({recipients.size})</span>
              <span className="flex gap-3 text-sm font-semibold">
                <button type="button" className="text-[var(--accent-primary)]" onClick={() => setRecipients(new Set(members.map((m) => m.id)))}>{isAr ? 'الكل' : 'Tous'}</button>
                <button type="button" className="text-[var(--text-secondary)]" onClick={() => setRecipients(new Set())}>{isAr ? 'لا أحد' : 'Aucun'}</button>
              </span>
            </div>
            <MemberList value={recipients} onChange={setRecipients} />
          </div>
        )}
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 text-sm space-y-1.5 tabular-nums">
          <div className="font-semibold">{isAr ? 'معاينة' : 'Aperçu'}</div>
          {plan.length === 0 ? (
            <div className="text-[var(--text-secondary)]">{isAr ? 'اختر أيامًا بها متبقٍّ.' : 'Cochez des jours qui ont un reste.'}</div>
          ) : (
            <>
              <div>{isAr ? 'أهداف:' : 'Cycles :'} <b>{plan.length}</b> · {isAr ? 'المتبقي:' : 'Reste total :'} <b>{nf(totalRemaining)}</b></div>
              <div>{isAr ? 'إلى الاحتياطي:' : 'Vers la Réserve :'} <b>{nf(planPot)}</b> · {isAr ? 'إلى الأعضاء:' : 'Vers les membres :'} <b>{nf(totalRemaining - planPot)}</b></div>
              {needsRecipients && <div className="text-[var(--status-late)] font-semibold">{isAr ? 'اختر مستلمًا.' : 'Choisissez au moins un destinataire.'}</div>}
            </>
          )}
        </div>
        <button type="button" onClick={run} disabled={busy || plan.length === 0 || needsRecipients} className="h-12 px-6 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold disabled:opacity-50">
          {busy ? '…' : isAr ? 'تنفيذ' : 'Lancer la redistribution'}
        </button>
      </section>

      <section className={`${box} space-y-3`}>
        <h3 className="text-lg font-semibold">{isAr ? 'سجل إعادة التوزيع' : 'Historique des redistributions'}</h3>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">{isAr ? 'لا شيء بعد.' : 'Aucune redistribution.'}</p>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {history.map((h) => (
              <div key={h.id} className={`py-3 flex flex-wrap items-center justify-between gap-3 ${h.status === 'cancelled' ? 'opacity-50' : ''}`}>
                <div className="text-sm min-w-0">
                  <div className="font-semibold">{zname(h.zikr_id)} · <span className="tabular-nums">{nf(h.quantity)}</span></div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {memberName(h.from_member_id)} → {h.mode === 'pot' ? (isAr ? 'الاحتياطي' : 'Réserve') : memberName(h.to_member_id)}
                    {h.target_date ? ` · ${h.target_date}` : ''}{h.status === 'cancelled' ? (isAr ? ' · ملغى' : ' · annulée') : ''}
                  </div>
                </div>
                {h.status === 'active' && (
                  <button type="button" onClick={() => cancel(h.id)} className="h-10 px-4 rounded-xl border-[1.5px] border-[var(--status-late)] text-[var(--status-late)] text-sm font-semibold">{isAr ? 'إلغاء' : 'Annuler'}</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
