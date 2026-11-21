'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { normalizePhoneToE164, e164ToInternalEmail } from '@/lib/auth/phone';
import { useAppShell } from '@/components/providers/app-shell-provider';
import type { CountryCode } from 'libphonenumber-js';

export default function LoginPage() {
  const router = useRouter();
  const { lang, setLang, theme, toggleTheme } = useAppShell();
  const [country, setCountry] = useState<CountryCode>('SN');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAr = lang === 'ar';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const e164 = normalizePhoneToE164(phone, country);
    if (!e164) {
      setErrorMsg(
        isAr
          ? 'رقم الهاتف غير صالح. يرجى التحقق من الرقم.'
          : 'Numéro de téléphone invalide. Vérifiez l’indicatif et les chiffres.'
      );
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const internalEmail = e164ToInternalEmail(e164);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password,
      });

      if (error || !data.user) {
        setErrorMsg(
          isAr
            ? 'رقم الهاتف أو كلمة المرور غير صحيحة.'
            : 'Numéro de téléphone ou mot de passe incorrect.'
        );
        return;
      }

      const { data: member } = await supabase
        .from('group_members')
        .select('role, must_change_password')
        .eq('user_id', data.user.id)
        .limit(1)
        .maybeSingle();

      if (member?.must_change_password) {
        router.replace('/onboarding');
      } else if (member?.role === 'cheikh') {
        router.replace('/admin');
      } else {
        router.replace('/');
      }
      router.refresh();
    } catch {
      setErrorMsg(isAr ? 'حدث خطأ أثناء الاتصال.' : 'Erreur de connexion au serveur.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col justify-between p-5 zellige-pattern">
      <header className="flex items-center justify-between max-w-md w-full mx-auto pt-2">
        <button
          type="button"
          onClick={() => setLang(isAr ? 'fr' : 'ar')}
          className="h-11 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-sm font-medium"
        >
          {isAr ? 'Français' : 'العربية'}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="h-11 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-sm font-medium"
        >
          {theme === 'light' ? (isAr ? 'الوضع الليلي' : 'Mode Nuit') : isAr ? 'الوضع النهاري' : 'Mode Jour'}
        </button>
      </header>

      <section className="w-full max-w-md mx-auto my-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 shadow-sm">
        <div className="text-center mb-6">
          <p className="font-arabic-script text-2xl text-[var(--accent-gold)] mb-1">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>
          <h1 className="font-display text-2xl font-bold text-[var(--accent-primary)]">
            {isAr ? 'زيارة فاس ٢٠٢٦' : 'Ziyara Fès 2026'}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {isAr
              ? 'تسجيل الدخول برقم الهاتف المقدم من المسؤول'
              : 'Connexion avec votre numéro de téléphone'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {isAr ? 'رقم الهاتف' : 'Numéro de téléphone'}
            </label>
            <div className="flex gap-2" dir="ltr">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as CountryCode)}
                aria-label="Indicatif pays"
                className="h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm font-medium tabular-nums"
              >
                <option value="SN">🇸🇳 +221</option>
                <option value="MA">🇲🇦 +212</option>
                <option value="FR">🇫🇷 +33</option>
              </select>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder={country === 'SN' ? '77 123 45 67' : '6 12 34 56 78'}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 min-w-0 w-full h-12 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-base tabular-nums focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              {isAr ? 'كلمة المرور' : 'Mot de passe'}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
                ? 'جاري الدخول...'
                : 'Connexion en cours...'
              : isAr
              ? 'دخول'
              : 'Se connecter'}
          </button>
        </form>
      </section>

      <footer className="text-center text-xs text-[var(--text-secondary)] pb-2">
        {isAr ? 'فاس • ١٩ – ٢٧ دجنبر ٢٠٢٦' : 'Fès • 19 – 27 Décembre 2026'}
      </footer>
    </main>
  );
}
