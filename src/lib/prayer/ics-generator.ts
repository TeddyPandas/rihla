import { getFesPrayerTimes } from './fes-schedule';

export interface ReminderPreferences {
  morning: boolean;
  fajr: boolean;
  dhuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
  night: boolean;
  offset_minutes: number;
}

function addMinutesToTime(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor((((total % 1440) + 1440) % 1440) / 60);
  const nm = (((total % 1440) + 1440) % 1440) % 60;
  return `${String(nh).padStart(2, '0')}${String(nm).padStart(2, '0')}00`;
}

export function generateFesZikrRemindersIcs(
  startDate: string,
  endDate: string,
  prefs: ReminderPreferences,
  lang: 'fr' | 'ar'
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ziyara Fes 2026//Rappels Zikr//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const cur = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    const compactDate = dateStr.replace(/-/g, '');
    const pt = getFesPrayerTimes(dateStr);

    const slots: { enabled: boolean; key: string; baseTime: string; titleFr: string; titleAr: string }[] = [
      { enabled: prefs.morning, key: 'morning', baseTime: pt.sunrise, titleFr: 'Zikr du Matin (Fès)', titleAr: 'أذكار الصباح (فاس)' },
      { enabled: prefs.fajr, key: 'fajr', baseTime: pt.fajr, titleFr: 'Zikr après Fajr (Fès)', titleAr: 'أذكار بعد الفجر (فاس)' },
      { enabled: prefs.dhuhr, key: 'dhuhr', baseTime: pt.dhuhr, titleFr: 'Zikr après Dhuhr (Fès)', titleAr: 'أذكار بعد الظهر (فاس)' },
      { enabled: prefs.asr, key: 'asr', baseTime: pt.asr, titleFr: 'Zikr après Asr (Fès)', titleAr: 'أذكار بعد العصر (فاس)' },
      { enabled: prefs.maghrib, key: 'maghrib', baseTime: pt.maghrib, titleFr: 'Zikr après Maghrib (Fès)', titleAr: 'أذكار بعد المغرب (فاس)' },
      { enabled: prefs.isha, key: 'isha', baseTime: pt.isha, titleFr: 'Zikr après Isha (Fès)', titleAr: 'أذكار بعد العشاء (فاس)' },
      { enabled: prefs.night, key: 'night', baseTime: '22:30', titleFr: 'Zikr de la Nuit (Fès)', titleAr: 'أذكار الليل (فاس)' },
    ];

    for (const s of slots) {
      if (!s.enabled) continue;
      const startTimeCompact = addMinutesToTime(s.baseTime, prefs.offset_minutes);
      const endTimeCompact = addMinutesToTime(s.baseTime, prefs.offset_minutes + 15);
      const summary = lang === 'ar' ? s.titleAr : s.titleFr;

      lines.push(
        'BEGIN:VEVENT',
        `UID:ziyara-fes-${compactDate}-${s.key}@ziyara.local`,
        `DTSTAMP:${compactDate}T000000Z`,
        `DTSTART;TZID=Africa/Casablanca:${compactDate}T${startTimeCompact}`,
        `DTEND;TZID=Africa/Casablanca:${compactDate}T${endTimeCompact}`,
        `SUMMARY:${summary}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT0M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${summary}`,
        'END:VALARM',
        'END:VEVENT'
      );
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
