'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';
import type { CountryCode } from 'libphonenumber-js';

interface MemberRow {
  id: string;
  ziyara_id: string;
  phone_e164: string;
  full_name: string | null;
  role: 'cheikh' | 'member';
  must_change_password: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export default function CheikhMembersPage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [country, setCountry] = useState<CountryCode>('SN');
  const [phone, setPhone] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('Ziyara2026');
  const [fullName, setFullName] = useState('');
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const loadMembers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('group_members')
      .select('id, ziyara_id, phone_e164, full_name, role, must_change_password, last_synced_at, created_at')
      .order('created_at', { ascending: true });
    if (data) setMembers(data as MemberRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function toggleManager(m: MemberRow) {
    const next = m.role === 'cheikh' ? 'member' : 'cheikh';
    const supabase = createClient();
    const { error } = await supabase.rpc('set_member_role', {
      p_ziyara_id: m.ziyara_id,
      p_member_id: m.id,
      p_role: next,
    });
    if (error) {
      setFeedback({ type: 'err', msg: error.message });
      return;
    }
    setFeedback({
      type: 'ok',
      msg:
        next === 'cheikh'
          ? isAr ? 'تم تعيين مسؤول جديد.' : 'Nouveau gestionnaire nommé.'
          : isAr ? 'تم سحب صفة المسؤول.' : 'Rôle de gestionnaire retiré.',
    });
    await loadMembers();
  }

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setCreating(true);

    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          phone,
          defaultPassword,
          fullName: fullName.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', msg: json.error || 'Erreur lors de la création' });
        return;
      }

      setFeedback({
        type: 'ok',
        msg: isAr
          ? `تم إنشاء الحساب بنجاح (${json.member.phone_e164})`
          : `Compte créé avec succès (${json.member.phone_e164})`,
      });
      setPhone('');
      setFullName('');
      await loadMembers();
    } catch {
      setFeedback({ type: 'err', msg: 'Erreur réseau' });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
        <h2 className="font-display text-xl font-bold text-[var(--accent-primary)] mb-4">
          {isAr ? 'إضافة عضو جديد للمجموعة' : 'Ajouter un membre au groupe'}
        </h2>

        <form onSubmit={handleCreateMember} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isAr ? 'رقم الهاتف (معرف الدخول)' : 'Numéro de téléphone (identifiant)'}
            </label>
            <div className="flex gap-2" dir="ltr">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as CountryCode)}
                className="h-12 px-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm font-medium"
              >
                <option value="SN">🇸🇳 +221</option>
                <option value="MA">🇲🇦 +212</option>
                <option value="FR">🇫🇷 +33</option>
              </select>
              <input
                type="tel"
                required
                placeholder="77 123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isAr ? 'كلمة المرور المؤقتة' : 'Mot de passe par défaut'}
            </label>
            <input
              type="text"
              required
              minLength={6}
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {isAr
                ? 'الاسم الكامل (اختياري — سيُطلب عند أول دخول)'
                : 'Nom indicatif (optionnel — le membre saisira son nom à la 1re connexion)'}
            </label>
            <input
              type="text"
              placeholder={isAr ? 'مثال: عمر تال' : 'Ex. Oumar Tall'}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm"
            />
          </div>

          {feedback && (
            <div
              className={`sm:col-span-2 p-3 rounded-xl text-sm font-medium ${
                feedback.type === 'ok'
                  ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'bg-[var(--status-late-soft)] text-[var(--status-late)]'
              }`}
            >
              {feedback.msg}
            </div>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="w-full sm:w-auto h-12 px-6 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--text-on-accent)] font-semibold text-sm disabled:opacity-50"
            >
              {creating
                ? isAr
                  ? 'جاري الإنشاء...'
                  : 'Création...'
                : isAr
                ? '+ إنشاء الحساب'
                : '+ Créer le compte membre'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">
            {isAr ? `أعضاء المجموعة (${members.length})` : `Membres du groupe (${members.length})`}
          </h2>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-[var(--text-secondary)]">Chargement...</div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {members.map((m) => (
              <div key={m.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <span>{m.full_name || (isAr ? 'بدون اسم بعد' : 'Nom non renseigné')}</span>
                    {m.role === 'cheikh' && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--accent-gold-soft)] text-[var(--accent-gold-text)] font-bold">
                        Gestionnaire
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] tabular-nums mt-0.5" dir="ltr">
                    {m.phone_e164}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`px-2.5 py-1 rounded-full font-semibold ${
                      m.must_change_password
                        ? 'bg-[var(--status-offline-soft)] text-[var(--status-offline)]'
                        : 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                    }`}
                  >
                    {m.must_change_password
                      ? isAr
                        ? 'في انتظار التفعيل'
                        : '1re connexion en attente'
                      : isAr
                      ? 'مُفعّل'
                      : 'Activé'}
                  </span>

                  <button
                    type="button"
                    onClick={() => void toggleManager(m)}
                    className="h-9 px-3 rounded-lg border border-[var(--border-strong)] text-[var(--text-primary)] font-semibold"
                  >
                    {m.role === 'cheikh'
                      ? isAr ? 'سحب صفة المسؤول' : 'Retirer gestionnaire'
                      : isAr ? 'تعيين مسؤولاً' : 'Nommer gestionnaire'}
                  </button>

                  <span className="text-[var(--text-secondary)] tabular-nums">
                    {m.last_synced_at
                      ? `${isAr ? 'آخر مزامنة:' : 'Sync:'} ${new Date(
                          m.last_synced_at
                        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : isAr
                      ? 'لم يتصل بعد'
                      : 'Jamais synchronisé'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
