'use client';

import React from 'react';

/** Petits graphiques SVG sans dépendance, colorés avec les variables du thème. */

const fmt = (n: number) => n.toLocaleString('fr-FR');
const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)));

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export interface Series {
  name: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
      {items.map((i) => (
        <span key={i.name} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.name}
        </span>
      ))}
    </div>
  );
}

/** Courbes (avec aire sous la première série). */
export function LineChart({ labels, series, height = 220 }: { labels: string[]; series: Series[]; height?: number }) {
  const W = 640, H = height, L = 44, R = 12, T = 12, B = 28;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const x = (i: number) => L + (labels.length <= 1 ? 0 : (i * (W - L - R)) / (labels.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const step = Math.max(1, Math.ceil(labels.length / 9));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border-subtle)" strokeWidth="1" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-secondary)">{short(t)}</text>
        </g>
      ))}
      {labels.map((l, i) => (i % step === 0 ? (
        <text key={l} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">{l}</text>
      ) : null))}
      {series[0] && series[0].values.length > 0 && (
        <path d={`M${x(0)},${y(0)} ${series[0].values.map((v, i) => `L${x(i)},${y(v)}`).join(' ')} L${x(series[0].values.length - 1)},${y(0)} Z`} fill={series[0].color} opacity="0.12" />
      )}
      {series.map((s) => (
        <g key={s.name}>
          <polyline fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '6 5' : undefined}
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
          {s.values.length <= 14 && s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={s.color}><title>{`${s.name} · ${labels[i]} : ${fmt(v)}`}</title></circle>)}
        </g>
      ))}
    </svg>
  );
}

/** Barres verticales groupées. */
export function BarChart({ labels, series, height = 220 }: { labels: string[]; series: Series[]; height?: number }) {
  const W = 640, H = height, L = 44, R = 8, T = 12, B = 28;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const band = (W - L - R) / Math.max(1, labels.length);
  const bw = Math.min(26, (band * 0.7) / series.length);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const step = Math.max(1, Math.ceil(labels.length / 12));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={y(f * max)} y2={y(f * max)} stroke="var(--border-subtle)" />
          <text x={L - 6} y={y(f * max) + 4} textAnchor="end" fontSize="11" fill="var(--text-secondary)">{short(f * max)}</text>
        </g>
      ))}
      {labels.map((l, i) => {
        const cx = L + band * i + band / 2;
        return (
          <g key={l}>
            {series.map((s, k) => (
              <rect key={s.name} x={cx - (bw * series.length) / 2 + k * bw} y={y(s.values[i] ?? 0)} width={bw - 2} height={Math.max(0, H - B - y(s.values[i] ?? 0))} rx="3" fill={s.color}>
                <title>{`${s.name} · ${l} : ${fmt(s.values[i] ?? 0)}`}</title>
              </rect>
            ))}
            {i % step === 0 && <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">{l}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Barres horizontales de progression (valeur / maximum). */
export function HBars({ rows }: { rows: { label: string; value: number; max: number; right?: string; color?: string }[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = r.max > 0 ? Math.min(100, (r.value / r.max) * 100) : 0;
        return (
          <div key={r.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium truncate">{r.label}</span>
              <span className="tabular-nums text-xs text-[var(--text-secondary)] shrink-0">{r.right ?? `${Math.round(pct)} %`}</span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color ?? 'var(--accent-primary)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Anneau de répartition. */
export function Donut({ parts, center }: { parts: { name: string; value: number; color: string }[]; center?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg viewBox="0 0 140 140" className="w-36 h-36 shrink-0" role="img">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--bg-surface)" strokeWidth="18" />
        {total > 0 && parts.map((p) => {
          const len = (p.value / total) * c;
          const el = <circle key={p.name} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)"><title>{`${p.name} : ${fmt(p.value)}`}</title></circle>;
          acc += len;
          return el;
        })}
        {center && <text x="70" y="75" textAnchor="middle" fontSize="20" fontWeight="600" fill="var(--text-primary)">{center}</text>}
      </svg>
      <div className="space-y-2 text-sm">
        {parts.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: p.color }} />
            <span>{p.name}</span>
            <span className="tabular-nums text-[var(--text-secondary)]">{fmt(p.value)}{total > 0 ? ` · ${Math.round((p.value / total) * 100)} %` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Carte de chaleur membres × jours (0..1, null = pas d'objectif). */
export function Heatmap({ rows, cols, value }: { rows: string[]; cols: string[]; value: (r: number, c: number) => number | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-[3px] text-[11px] tabular-nums">
        <thead>
          <tr>
            <th />
            {cols.map((c) => <th key={c} className="font-medium text-[var(--text-secondary)] px-0.5">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r + i}>
              <td className="pe-2 text-sm font-medium whitespace-nowrap">{r}</td>
              {cols.map((c, j) => {
                const v = value(i, j);
                return (
                  <td key={c} title={v === null ? '—' : `${Math.round(v * 100)} %`} className="h-7 min-w-7 rounded-md text-center"
                    style={{ background: v === null ? 'var(--bg-surface)' : `color-mix(in srgb, var(--accent-primary) ${Math.round(12 + Math.min(1, v) * 88)}%, transparent)`, color: v !== null && v > 0.55 ? 'var(--text-on-accent)' : 'var(--text-secondary)' }}>
                    {v === null ? '' : Math.round(v * 100)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'late' | 'gold' }) {
  const color = tone === 'ok' ? 'var(--status-ok)' : tone === 'late' ? 'var(--status-late)' : tone === 'gold' ? 'var(--accent-gold-text)' : 'var(--text-primary)';
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-[var(--text-secondary)] mt-0.5 tabular-nums">{sub}</div>}
    </div>
  );
}
