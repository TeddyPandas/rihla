'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { offlineDb } from '@/lib/offline/db';
import { getManagedZiyara, pickMemberRow } from '@/lib/ziyara/current';
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
  const [pushState, setPushState] = useState<'unsupported' | 'off' | 'on' | 'denied'>('off');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setPushState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') { setPushState('denied'); return; }
    void navigator.serviceWorker.getRegistration('/sw.js').then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setPushState(sub ? 'on' : 'off');
    });
  }, []);

  async function enablePush() {
    if (!memberId) return;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPushState(perm === 'denied' ? 'denied' : 'off'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string;
      const pad = '='.repeat((4 - (key.length % 4)) % 4);
      const raw = atob((key + pad).replace(/-/g, '+').replace(/_/g, '/'));
      const appKey = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      const j = sub.toJSON();
      const supabase = createClient();
      await supabase.from('push_subscriptions').delete().eq('endpoint', j.endpoint as string);
      const { error } = await supabase.from('push_subscriptions').insert({
        member_id: memberId, endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth,
      });
      if (!error) setPushState('on');
    } catch {
      setPushState('off');
    }
  }

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

      const { data: rows } = await supabase
        .from('group_members')
        .select('id, ziyara_id, reminder_prefs, ziyaras(is_active, start_date)')
        .eq('user_id', user.id);
      const member = pickMemberRow(rows);

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

  async function handleDownloadIcs() {
    const prof = await offlineDb.profile.toCollection().first();
    const icsContent = generateFesZikrRemindersIcs(prof?.startDate || '2026-12-19', prof?.endDate || '2026-12-27', prefs, lang);
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
      {pushState !== 'unsupported' && (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold">{isAr ? 'إشعارات الهاتف' : 'Notifications sur ce téléphone'}</div>
            <div className="text-xs text-[var(--text-secondary)]">
              {pushState === 'on' ? (isAr ? 'مفعّلة.' : 'Activées : vous recevrez les rappels du gestionnaire.')
                : pushState === 'denied' ? (isAr ? 'محظورة في إعدادات المتصفح.' : 'Bloquées dans les réglages du navigateur.')
                : (isAr ? 'فعّلها لتصلك تذكيرات المسؤول.' : 'Activez-les pour recevoir les rappels du gestionnaire (sur iPhone, l’app doit être installée sur l’écran d’accueil).')}
            </div>
          </div>
          {pushState === 'off' && <button type="button" onClick={enablePush} className="shrink-0 h-11 px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] text-sm font-semibold">{isAr ? 'تفعيل' : 'Activer'}</button>}
        </section>
      )}

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
