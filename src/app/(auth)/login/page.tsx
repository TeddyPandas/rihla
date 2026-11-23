'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { normalizePhoneToE164, e164ToInternalEmail, sanitizePhoneDigits } from '@/lib/auth/phone';
import { useAppShell } from '@/components/providers/app-shell-provider';
import type { CountryCode } from 'libphonenumber-js';

export default function LoginPage() {
  const router = useRouter();
  const { lang, setLang, theme, toggleTheme } = useAppShell();
  const [country, setCountry] = useState<CountryCode>('SN');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAr = lang === 'ar';

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!normalizePhoneToE164(phone, country)) {
      setErrorMsg(
        isAr
          ? 'يبدو أن الرقم غير مكتمل. تحقق وحاول مجددًا.'
          : 'Ce numéro semble incomplet. Vérifiez l’indicatif et les chiffres.'
      );
      return;
    }
    setStep(2);
  }

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

      const { data: memberRows } = await supabase
        .from('group_members')
        .select('role, must_change_password')
        .eq('user_id', data.user.id);
      const member = memberRows && memberRows.length > 0
        ? { role: memberRows.some((r) => r.role === 'cheikh') ? 'cheikh' : memberRows[0].role,
            must_change_password: memberRows.some((r) => r.must_change_password) }
        : null;

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

  const dialCode = country === 'SN' ? '+221' : country === 'MA' ? '+212' : '+33';
  const inputBox =
    'flex items-center h-14 rounded-xl border-[1.5px] bg-[var(--bg-elevated)] overflow-hidden focus-within:border-[var(--accent-primary)]';

  return (
    <main className="min-h-dvh flex flex-col p-6 gap-7 max-w-md w-full mx-auto safe-top">
      <header className="flex items-center justify-between">
        {step === 2 ? (
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setErrorMsg(null);
              setPassword('');
            }}
            aria-label={isAr ? 'رجوع' : 'Retour'}
            className="h-12 w-12 rounded-full border-[1.5px] border-[var(--border-subtle)] flex items-center justify-center flip"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isAr ? 'تغيير المظهر' : 'Changer de thème'}
            className="h-12 w-12 rounded-xl border-[1.5px] border-[var(--border-subtle)] text-lg"
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
          <button
            type="button"
            onClick={() => setLang(isAr ? 'fr' : 'ar')}
            lang={isAr ? 'fr' : 'ar'}
            className="h-12 px-4 rounded-xl border-[1.5px] border-[var(--border-subtle)] text-base font-medium"
          >
            {isAr ? 'Français' : 'العربية'}
          </button>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <svg width="48" height="48" viewBox="0 0 44 44" fill="none" aria-hidden="true">
          <circle cx="22" cy="22" r="16" stroke="var(--accent-primary)" strokeWidth="2" />
          <circle cx="22" cy="6" r="4.5" fill="var(--accent-gold)" />
        </svg>
        <div>
          <div className="text-2xl font-semibold leading-tight">{isAr ? 'زيارة فاس' : 'Ziyara Fès'}</div>
          <div className="text-sm text-[var(--text-secondary)]">{isAr ? '١٩ – ٢٧ دجنبر ٢٠٢٦' : '19 – 27 décembre 2026'}</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-[var(--accent-gold-text)]">
          {step === 1 ? (isAr ? 'الخطوة 1 من 2' : 'Étape 1 sur 2') : isAr ? 'الخطوة 2 من 2' : 'Étape 2 sur 2'}
        </span>
        <h1 className="text-3xl font-semibold">
          {step === 1 ? (isAr ? 'تسجيل الدخول' : 'Connexion') : isAr ? 'أدخل كلمة المرور' : 'Saisir mon mot de passe'}
        </h1>
        {step === 1 && (
          <p className="text-base leading-relaxed text-[var(--text-secondary)]">
            {isAr
              ? 'أدخل رقم الهاتف الذي أعطيته للمسؤول.'
              : 'Entrez le numéro de téléphone que vous avez communiqué au gestionnaire.'}
          </p>
        )}
      </div>

      {step === 1 ? (
        <form onSubmit={handleNext} className="flex flex-col gap-5 flex-1">
          <label className="flex flex-col gap-2 text-[15px] font-medium">
            {isAr ? 'رقم الهاتف' : 'Numéro de téléphone'}
            <div className={`${inputBox} ${errorMsg ? 'border-[var(--status-late)]' : 'border-[var(--border-subtle)]'}`} dir="ltr">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as CountryCode)}
                aria-label="Indicatif pays"
                className="h-full pl-3 pr-1 bg-transparent text-base font-medium tabular-nums border-r border-[var(--border-subtle)]"
              >
                <option value="SN">🇸🇳 +221</option>
                <option value="MA">🇲🇦 +212</option>
                <option value="FR">🇫🇷 +33</option>
              </select>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                autoComplete="tel"
                required
                autoFocus
                placeholder={country === 'SN' ? '77 123 45 67' : '6 12 34 56 78'}
                value={phone}
                onChange={(e) => setPhone(sanitizePhoneDigits(e.target.value))}
                className="flex-1 min-w-0 w-full h-full px-4 bg-transparent text-lg tabular-nums focus:outline-none"
              />
            </div>
          </label>
          {errorMsg && (
            <div role="alert" className="p-3.5 rounded-xl bg-[var(--status-late-soft)] text-[var(--status-late)] text-[15px] font-medium">
              {errorMsg}
            </div>
          )}
          <button type="submit" className="w-full h-14 rounded-[14px] bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold text-[17px]">
            {isAr ? 'متابعة' : 'Continuer'}
          </button>
          <p className="mt-auto text-center text-sm leading-relaxed text-[var(--text-secondary)]">
            {isAr ? 'الحسابات ينشئها المسؤول.' : 'Pas encore de compte ? Les comptes sont créés par le gestionnaire.'}
          </p>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1">
          <div className="flex items-center justify-between rounded-xl bg-[var(--bg-surface)] px-4 py-3">
            <span className="text-[17px] font-medium tabular-nums" dir="ltr">
              {dialCode} {phone}
            </span>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setErrorMsg(null);
              }}
              className="text-[15px] font-semibold text-[var(--accent-gold-text)]"
            >
              {isAr ? 'تعديل' : 'Modifier'}
            </button>
          </div>
          <label className="flex flex-col gap-2 text-[15px] font-medium">
            {isAr ? 'كلمة المرور' : 'Mot de passe'}
            <div className={`${inputBox} ${errorMsg ? 'border-[var(--status-late)]' : 'border-[var(--border-subtle)]'}`}>
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 min-w-0 w-full h-full px-4 bg-transparent text-lg focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={isAr ? 'إظهار كلمة المرور' : 'Afficher le mot de passe'}
                aria-pressed={showPw}
                className="h-full px-4 text-[var(--text-secondary)]"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
              </button>
            </div>
          </label>
          {errorMsg && (
            <div role="alert" className="p-3.5 rounded-xl bg-[var(--status-late-soft)] text-[var(--status-late)] text-[15px] font-medium">
              {errorMsg}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-[14px] bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold text-[17px] disabled:opacity-60"
          >
            {loading ? (isAr ? 'جاري الدخول...' : 'Connexion en cours...') : isAr ? 'دخول' : 'Se connecter'}
          </button>
          <p className="mt-auto text-center text-sm leading-relaxed text-[var(--text-secondary)]">
            {isAr ? 'نسيت كلمة المرور؟ يستطيع المسؤول إعادة تعيينها لك.' : 'Mot de passe oublié ? Le gestionnaire peut le réinitialiser pour vous.'}
          </p>
        </form>
      )}
    </main>
  );
}
