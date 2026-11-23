'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';
import { getManagedZiyara } from '@/lib/ziyara/current';

interface M { id: string; full_name: string | null; phone_e164: string; role: string }

const inp = 'w-full px-3 rounded-xl border-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base focus:outline-none focus:border-[var(--accent-primary)]';

export default function RemindersPage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';
  const [ziyaraId, setZiyaraId] = useState<string | null>(null);
  const [members, setMembers] = useState<M[]>([]);
  const [lateIds, setLateIds] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [titleFr, setTitleFr] = useState('Rappel');
  const [bodyFr, setBodyFr] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const z = await getManagedZiyara<{ id: string }>(supabase, 'id');
    if (!z) return;
    setZiyaraId(z.id);
    const today = new Date().toISOString().slice(0, 10);
    const [m, g, e] = await Promise.all([
      supabase.from('group_members').select('id, full_name, phone_e164, role').eq('ziyara_id', z.id).order('created_at'),
      supabase.from('member_goals').select('member_id, zikr_id, target_date, initial_target, adjusted_delta').eq('ziyara_id', z.id).lt('target_date', today),
      supabase.from('zikr_entries').select('member_id, zikr_id, entry_date, quantity').eq('ziyara_id', z.id).eq('status', 'active').eq('source', 'personal'),
    ]);
    const mem = (m.data ?? []) as M[];
    setMembers(mem);
    const late = new Set<string>();
    for (const goal of g.data ?? []) {
      const target = Math.max(0, Number(goal.initial_target) + Number(goal.adjusted_delta));
      const done = (e.data ?? []).filter((x) => x.member_id === goal.member_id && x.zikr_id === goal.zikr_id && x.entry_date === goal.target_date).reduce((a, x) => a + Number(x.quantity), 0);
      if (target > done) late.add(goal.member_id);
    }
    setLateIds(late);
    setSel((p) => (p.size === 0 ? new Set(mem.filter((x) => x.role !== 'cheikh').map((x) => x.id)) : p));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const recipients = useMemo(() => members.filter((x) => x.role !== 'cheikh'), [members]);
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!ziyaraId || sel.size === 0) return;
    if (!window.confirm(isAr ? `إرسال التذكير إلى ${sel.size} شخصًا؟` : `Envoyer ce rappel à ${sel.size} personne(s) ?`)) return;
    setBusy(true);
    setFb(null);
    const supabase = createClient();
    const ids = Array.from(sel);
    const { data, error } = await supabase.rpc('send_reminder', {
      p_ziyara_id: ziyaraId, p_member_ids: ids,
      p_title_fr: titleFr, p_title_ar: null, p_body_fr: bodyFr, p_body_ar: bodyAr,
    });
    if (error) { setBusy(false); return setFb({ ok: false, msg: error.message }); }
    // Notification poussée sur les téléphones abonnés (si configurée)
    let pushed = 0;
    try {
      const res = await fetch('/api/admin/reminders/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ziyaraId, memberIds: ids, title: titleFr, body: bodyFr || bodyAr }),
      });
      if (res.ok) pushed = (await res.json()).sent ?? 0;
    } catch { /* push optionnel */ }
    setBusy(false);
    setBody('');
    setFb({ ok: true, msg: isAr ? `أُرسل التذكير إلى ${data} شخصًا (${pushed} إشعار على الهاتف).` : `Rappel envoyé à ${data} personne(s) dans l’app, ${pushed} notification(s) sur téléphone.` });
  }
  function setBody(v: string) { setBodyFr(v); setBodyAr(v); }

  const templates = isAr
    ? ['لا تنسوا ذكر اليوم 🤍', 'تذكير: أكملوا أهدافكم قبل نهاية اليوم']
    : ['N’oubliez pas votre zikr du jour 🤍', 'Rappel : terminez vos objectifs avant la fin de la journée'];

  return (
    <div className="space-y-5 max-w-3xl">
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
        <h2 className="text-xl font-semibold">{isAr ? 'التذكيرات' : 'Rappels'}</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{isAr ? 'أرسل رسالة إلى الأعضاء. تظهر في صفحة التنبيهات، وكإشعار على الهاتف لمن فعّله.' : 'Envoyez un message aux membres. Il apparaît dans leurs Alertes, et en notification sur le téléphone pour ceux qui l’ont activée.'}</p>
      </section>

      <form onSubmit={send} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">{isAr ? 'العنوان' : 'Titre'}</label>
          <input className={`${inp} h-12`} value={titleFr} onChange={(e) => setTitleFr(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">{isAr ? 'الرسالة' : 'Message'}</label>
          <textarea className={`${inp} py-3 min-h-28`} required value={bodyFr} onChange={(e) => setBody(e.target.value)} />
          <div className="flex flex-wrap gap-2 mt-2">
            {templates.map((t) => <button key={t} type="button" onClick={() => setBody(t)} className="px-3 h-9 rounded-full bg-[var(--bg-surface)] text-xs font-semibold">{t}</button>)}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">{isAr ? 'المستلمون' : 'Destinataires'} ({sel.size}/{recipients.length})</span>
            <span className="flex gap-3 text-sm font-semibold">
              <button type="button" className="text-[var(--accent-primary)]" onClick={() => setSel(new Set(recipients.map((x) => x.id)))}>{isAr ? 'الكل' : 'Tous'}</button>
              <button type="button" className="text-[var(--status-late)]" onClick={() => setSel(new Set(recipients.filter((x) => lateIds.has(x.id)).map((x) => x.id)))}>{isAr ? `المتأخرون (${recipients.filter((x) => lateIds.has(x.id)).length})` : `En retard (${recipients.filter((x) => lateIds.has(x.id)).length})`}</button>
              <button type="button" className="text-[var(--text-secondary)]" onClick={() => setSel(new Set())}>{isAr ? 'لا أحد' : 'Aucun'}</button>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
            {recipients.map((m) => (
              <label key={m.id} className="flex items-center gap-3 min-h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm">
                <input type="checkbox" className="h-5 w-5 accent-[var(--accent-primary)]" checked={sel.has(m.id)} onChange={() => toggle(m.id)} />
                <span className="flex-1">{m.full_name || m.phone_e164}</span>
                {lateIds.has(m.id) && <span className="text-xs font-semibold text-[var(--status-late)]">{isAr ? 'متأخر' : 'en retard'}</span>}
              </label>
            ))}
          </div>
        </div>

        {fb && <div role="status" className={`p-3.5 rounded-xl text-sm font-semibold ${fb.ok ? 'bg-[var(--status-ok-soft)] text-[var(--status-ok)]' : 'bg-[var(--status-late-soft)] text-[var(--status-late)]'}`}>{fb.msg}</div>}
        <button type="submit" disabled={busy || sel.size === 0 || !bodyFr.trim()} className="h-12 px-6 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold disabled:opacity-50">{busy ? '…' : isAr ? 'إرسال' : 'Envoyer le rappel'}</button>
      </form>
    </div>
  );
}
