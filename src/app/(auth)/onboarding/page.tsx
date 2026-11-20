'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';

export default function OnboardingPage() {
  const router = useRouter();
  const { lang } = useAppShell();
  const isAr = lang === 'ar';

  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (fullName.trim().length < 2) {
      setErrorMsg(isAr ? 'يرجى إدخال الاسم الكامل.' : 'Veuillez saisir votre nom complet.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg(
        isAr
          ? 'يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل.'
          : 'Le nouveau mot de passe doit contenir au moins 8 caractères.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(
        isAr ? 'كلمتا المرور غير متطابقتين.' : 'Les deux mots de passe ne correspondent pas.'
      );
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const { error: pwdError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (pwdError) {
        setErrorMsg(pwdError.message);
        return;
      }

      const { data: updatedMember, error: profileError } = await supabase
        .from('group_members')
        .update({
          full_name: fullName.trim(),
          must_change_password: false,
          preferred_lang: lang,
        })
        .eq('user_id', user.id)
        .select('role')
        .single();

      if (profileError) {
        setErrorMsg(profileError.message);
        return;
      }

      router.replace(updatedMember?.role === 'cheikh' ? '/admin' : '/');
      router.refresh();
    } catch {
      setErrorMsg(isAr ? 'حدث خطأ غير متوقع.' : 'Erreur lors de la validation du compte.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-5 zellige-pattern">
      <section className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 shadow-sm">
        <div className="mb-6">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent-gold-soft)] text-[var(--accent-gold)] mb-2">
            {isAr ? 'تفعيل الحساب' : 'Première connexion'}
          </span>
          <h1 className="font-display text-2xl font-bold text-[var(--accent-primary)]">
            {isAr ? 'تأمين حسابك الشخصي' : 'Finalisez votre compte'}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {isAr
              ? 'أدخل اسمك الكامل واختر كلمة مرور خاصة بك للمتابعة.'
              : 'Saisissez votre nom complet et remplacez le mot de passe provisoire.'}
          </p>
        </div>

        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {isAr ? 'الاسم الكامل' : 'Nom complet'}
            </label>
            <input
              type="text"
              required
              placeholder={isAr ? 'مثال: مامادو لي' : 'Ex. Mamadou Ly'}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              {isAr ? 'كلمة المرور الجديدة (8 أحرف على الأقل)' : 'Nouveau mot de passe (8 car. min.)'}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              {isAr ? 'تأكيد كلمة المرور' : 'Confirmer le mot de passe'}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-[var(--status-late-soft)] text-[var(--status-late)] text-sm font-medium"
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-13 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--text-on-accent)] font-semibold text-base transition-colors disabled:opacity-60"
          >
            {loading
              ? isAr
                ? 'جاري الحفظ...'
                : 'Activation...'
              : isAr
              ? 'حفظ والدخول إلى التطبيق'
              : 'Valider et accéder au programme'}
          </button>
        </form>
      </section>
    </main>
  );
}
