'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppShell } from '@/components/providers/app-shell-provider';

interface ZikrDef {
  id: string;
  name_fr: string;
  name_ar: string;
}

interface EntryRow {
  zikr_id: string;
  entry_date: string;
  source: 'personal' | 'pot';
  quantity: number;
  member_id: string;
}

interface MemberRow {
  id: string;
  full_name: string | null;
  phone_e164: string;
}

export default function CheikhAnalyticsPage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [dates, setDates] = useState<string[]>([]);
  const [zikrs, setZikrs] = useState<ZikrDef[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [selectedZikr, setSelectedZikr] = useState<string>('ALL');

  const loadAnalytics = useCallback(async () => {
    const supabase = createClient();
    const { data: zData } = await supabase
      .from('ziyaras')
      .select('id, start_date, end_date')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!zData) return;

    const days: string[] = [];
    const cur = new Date(`${zData.start_date}T00:00:00Z`);
    const end = new Date(`${zData.end_date}T00:00:00Z`);
    while (cur <= end) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    setDates(days);

    const [defsRes, entriesRes, membersRes] = await Promise.all([
      supabase.from('zikr_definitions').select('id, name_fr, name_ar').eq('ziyara_id', zData.id).order('sort_order'),
      supabase
        .from('zikr_entries')
        .select('zikr_id, entry_date, source, quantity, member_id')
        .eq('ziyara_id', zData.id)
        .eq('status', 'active'),
      supabase.from('group_members').select('id, full_name, phone_e164').eq('ziyara_id', zData.id),
    ]);

    if (defsRes.data) setZikrs(defsRes.data);
    if (entriesRes.data) setEntries(entriesRes.data.map((e) => ({ ...e, quantity: Number(e.quantity) })));
    if (membersRes.data) setMembers(membersRes.data);
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const dailySeries = useMemo(() => {
    return dates.map((d) => {
      const dayEntries = entries.filter(
        (e) => e.entry_date === d && (selectedZikr === 'ALL' || e.zikr_id === selectedZikr)
      );
      const personal = dayEntries
        .filter((e) => e.source === 'personal')
        .reduce((a, e) => a + e.quantity, 0);
      const pot = dayEntries
        .filter((e) => e.source === 'pot')
        .reduce((a, e) => a + e.quantity, 0);
      return { date: d, personal, pot, total: personal + pot };
    });
  }, [dates, entries, selectedZikr]);

  const maxVal = useMemo(
    () => Math.max(100, ...dailySeries.map((d) => d.total)),
    [dailySeries]
  );

  function handleExportCsv() {
    const header = ['Date', 'Membre', 'Telephone', 'Zikr_FR', 'Zikr_AR', 'Type', 'Quantite'];
    const rows = entries
      .filter((e) => selectedZikr === 'ALL' || e.zikr_id === selectedZikr)
      .map((e) => {
        const m = members.find((x) => x.id === e.member_id);
        const z = zikrs.find((x) => x.id === e.zikr_id);
        return [
          e.entry_date,
          `"${(m?.full_name || 'Non renseigne').replace(/"/g, '""')}"`,
          m?.phone_e164 || '',
          `"${(z?.name_fr || '').replace(/"/g, '""')}"`,
          `"${(z?.name_ar || '').replace(/"/g, '""')}"`,
          e.source === 'pot' ? 'Pot commun' : 'Personnel',
          e.quantity,
        ].join(';');
      });

    const csvContent = '\uFEFF' + [header.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ziyara-fes-zikr-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportPng() {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 760;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FAF7F0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `evolution-zikr-fes-${new Date().toISOString().slice(0, 10)}.png`;
        link.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--accent-primary)]">
              {isAr ? 'تطور الأذكار يوماً بيوم' : 'Évolution jour par jour'}
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {isAr ? 'مجموع الإنجازات اليومية للمجموعة' : 'Cumul quotidien des saisies actives du groupe'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedZikr}
              onChange={(e) => setSelectedZikr(e.target.value)}
              className="h-10 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-xs font-semibold"
            >
              <option value="ALL">{isAr ? 'جميع الأذكار' : 'Tous les zikr'}</option>
              {zikrs.map((z) => (
                <option key={z.id} value={z.id}>
                  {isAr ? z.name_ar : z.name_fr}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportPng}
              className="h-10 px-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold"
            >
              {isAr ? 'تصدير صورة PNG' : 'Exporter PNG'}
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="h-10 px-3.5 rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] text-xs font-semibold"
            >
              {isAr ? 'تصدير ملف CSV' : 'Exporter CSV'}
            </button>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            ref={svgRef}
            viewBox="0 0 700 380"
            className="w-full min-w-[540px] h-auto rounded-xl bg-[#FAF7F0] p-2 border border-[#E2D9C8]"
          >
            <text x="24" y="30" fill="#0E4D3E" fontSize="16" fontWeight="bold">
              Ziyara Fès 2026 — Progression quotidienne du groupe
            </text>

            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = 310 - ratio * 230;
              const val = Math.round(maxVal * ratio);
              return (
                <g key={ratio}>
                  <line x1="70" y1={y} x2="670" y2={y} stroke="#E2D9C8" strokeDasharray="4 4" />
                  <text x="62" y={y + 4} textAnchor="end" fill="#5A625E" fontSize="11">
                    {val.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {dailySeries.map((day, idx) => {
              const colWidth = 600 / Math.max(1, dailySeries.length);
              const barWidth = Math.min(36, colWidth * 0.55);
              const x = 70 + idx * colWidth + (colWidth - barWidth) / 2;

              const personalHeight = (day.personal / maxVal) * 230;
              const potHeight = (day.pot / maxVal) * 230;

              const yPersonal = 310 - personalHeight;
              const yPot = yPersonal - potHeight;

              return (
                <g key={day.date}>
                  <rect
                    x={x}
                    y={yPersonal}
                    width={barWidth}
                    height={Math.max(0, personalHeight)}
                    rx="4"
                    fill="#0E4D3E"
                  />
                  {potHeight > 0 && (
                    <rect
                      x={x}
                      y={yPot}
                      width={barWidth}
                      height={potHeight}
                      rx="4"
                      fill="#B8862D"
                    />
                  )}
                  {day.total > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={yPot - 6}
                      textAnchor="middle"
                      fill="#1A1D1B"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {day.total.toLocaleString()}
                    </text>
                  )}
                  <text
                    x={x + barWidth / 2}
                    y="332"
                    textAnchor="middle"
                    fill="#5A625E"
                    fontSize="11"
                  >
                    {day.date.slice(5)}
                  </text>
                </g>
              );
            })}

            <rect x="70" y="352" width="12" height="12" rx="2" fill="#0E4D3E" />
            <text x="88" y="362" fill="#1A1D1B" fontSize="11">
              Objectifs personnels
            </text>
            <rect x="230" y="352" width="12" height="12" rx="2" fill="#B8862D" />
            <text x="248" y="362" fill="#1A1D1B" fontSize="11">
              Pot commun volontaire
            </text>
          </svg>
        </div>
      </section>
    </div>
  );
}
