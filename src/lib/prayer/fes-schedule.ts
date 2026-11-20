import { Coordinates, CalculationParameters, PrayerTimes, Madhab } from 'adhan';
import staticTable from '@/content/fes-prayer-times-2026.json';

export interface DailyPrayerSchedule {
  date: string;
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  isFallbackCalculated: boolean;
}

const FES_TZ = 'Africa/Casablanca';
const FES_COORDS = new Coordinates(34.0181, -5.0078);

export function getFesTodayDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FES_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export function getFesCurrentTime(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: FES_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

function formatInFesTz(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: FES_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function getFesPrayerTimes(dateStr: string): DailyPrayerSchedule {
  const table = staticTable as Record<string, Omit<DailyPrayerSchedule, 'date' | 'isFallbackCalculated'>>;
  if (table[dateStr]) {
    return {
      date: dateStr,
      ...table[dateStr],
      isFallbackCalculated: false,
    };
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const params = new CalculationParameters('Other', 19, 17);
  params.madhab = Madhab.Shafi;
  params.adjustments.dhuhr = 5;
  params.adjustments.maghrib = 5;

  const pt = new PrayerTimes(FES_COORDS, utcDate, params);

  return {
    date: dateStr,
    fajr: formatInFesTz(pt.fajr),
    sunrise: formatInFesTz(pt.sunrise),
    dhuhr: formatInFesTz(pt.dhuhr),
    asr: formatInFesTz(pt.asr),
    maghrib: formatInFesTz(pt.maghrib),
    isha: formatInFesTz(pt.isha),
    isFallbackCalculated: true,
  };
}
