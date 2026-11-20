'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';
import {
  generateFesZikrRemindersIcs,
  type ReminderPreferences,
} from '@/lib/prayer/ics-generator';

interface NotificationRow {
  id: string;
  type: string;
  title_fr: string;
  title_ar: string;
  body_fr: string;
  body_ar: string;
  created_at: string;
}

const DEFAULT_PREFS: ReminderPreferences = {
  morning: true,
  fajr: true,
  dhuhr: true,
  asr: true,
  maghrib: true,
  isha: true,
  night: true,
  offset_minutes: 10,
};

export default function MemberNotificationsAndRemindersPage() {
  const { lang, t } = useAppShell();
  const isAr = lang === 'ar';

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [prefs, setPrefs] = useState<ReminderPreferences>(DEFAULT_PREFS);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const localPrefs = localStorage.getItem('ziyara_reminder_prefs');
    if (localPrefs) {
      try {
        setPrefs(JSON.parse(localPrefs));
      } catch {
        // Ignorer JSON corrompu
      }
    }

    async function loadNotifications() {
      if (!navigator.onLine) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('group_members')
        .select('id, ziyara_id, reminder_prefs')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (member) {
        setMemberId(member.id);
        if (member.reminder_prefs) {
          setPrefs(member.reminder_prefs as ReminderPreferences);
        }

        const { data: notifs } = await supabase
          .from('user_notifications')
          .select('id, type, title_fr, title_ar, body_fr, body_ar, created_at')
          .eq('ziyara_id', member.ziyara_id)
          .order('created_at', { ascending: false })
          .limit(30);

        if (notifs) {
          setNotifications(notifs);
          localStorage.setItem('ziyara_cached_notifs', JSON.stringify(notifs));
        }
      }
    }

    const cached = localStorage.getItem('ziyara_cached_notifs');
    if (cached) {
      try {
        setNotifications(JSON.parse(cached));
      } catch {
        // Ignorer
      }
    }

    void loadNotifications();
  }, []);

  async function handleSavePrefs(updated: ReminderPreferences) {
    setPrefs(updated);
    localStorage.setItem('ziyara_reminder_prefs', JSON.stringify(updated));
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);

    if (memberId && navigator.onLine) {
      const supabase = createClient();
      await supabase
        .from('group_members')
        .update({ reminder_prefs: updated })
        .eq('id', memberId);
    }
  }

  function handleDownloadIcs() {
    const icsContent = generateFesZikrRemindersIcs('2026-12-19', '2026-12-27', prefs, lang);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rappels-zikr-fes-2026.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 pb-6">
      <section className="space-y-2.5">
        <h2 className="font-display text-xl font-bold text-[var(--accent-primary)]">
          {isAr ? 'مركز الإشعارات' : 'Centre de notifications'}
        </h2>
        {notifications.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 text-sm text-[var(--text-secondary)]">
            {isAr ? 'لا توجد إشعارات جديدة.' : 'Aucune notification reçue pour le moment.'}
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <article
                key={n.id}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-[var(--accent-primary)]">
                    {isAr ? n.title_ar : n.title_fr}
                  </h3>
                  <span className="text-[11px] text-[var(--text-secondary)] tabular-nums shrink-0">
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-primary)] mt-1">
                  {isAr ? n.body_ar : n.body_fr}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold">
            {isAr ? 'تذكيرات الأذكار (بتوقيت فاس)' : 'Rappels quotidiens (Horaires de Fès)'}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {isAr
              ? 'لضمان عمل التنبيهات بدون إنترنت على هواتف آيفون وأندرويد، أضف التذكيرات إلى تقويم هاتفك بنقرة واحدة.'
              : 'Pour garantir des alarmes sonores 100 % hors-ligne sur iPhone et Android pendant le séjour, exportez vos créneaux dans l’agenda natif du téléphone.'}
          </p>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {(
            [
              ['morning', t.slots.morning],
              ['fajr', t.slots.fajr],
              ['dhuhr', t.slots.dhuhr],
              ['asr', t.slots.asr],
              ['maghrib', t.slots.maghrib],
              ['isha', t.slots.isha],
              ['night', t.slots.night],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="py-2.5 flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium">{label}</span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => void handleSavePrefs({ ...prefs, [key]: e.target.checked })}
                className="w-5 h-5 accent-[var(--accent-primary)]"
              />
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            {isAr ? 'التأخير بعد الأذان (بالدقائق):' : 'Délai après la prière (min) :'}
          </span>
          <select
            value={prefs.offset_minutes}
            onChange={(e) =>
              void handleSavePrefs({ ...prefs, offset_minutes: Number(e.target.value) })
            }
            className="h-10 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-xs font-bold tabular-nums"
          >
            <option value={0}>0 min</option>
            <option value={5}>+5 min</option>
            <option value={10}>+10 min</option>
            <option value={15}>+15 min</option>
            <option value={30}>+30 min</option>
          </select>
        </div>

        {savedNotice && (
          <div className="text-xs font-semibold text-[var(--accent-primary)]">
            {isAr ? 'تم حفظ الإعدادات' : 'Préférences enregistrées.'}
          </div>
        )}

        <button
          type="button"
          onClick={handleDownloadIcs}
          className="w-full h-12 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold text-sm"
        >
          {isAr
            ? '📅 إضافة تذكيرات فاس إلى تقويم الهاتف (.ics)'
            : '📅 Ajouter les rappels de Fès à mon agenda (.ics)'}
        </button>
      </section>
    </div>
  );
}
