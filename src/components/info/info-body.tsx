import React from 'react';

/**
 * Rendu d'un bloc d'informations écrit en texte simple :
 *  - « 18h00 : texte »     -> ligne d'horaire (heure en évidence)
 *  - « - texte »            -> liste à puces
 *  - lignes avec « | »      -> tableau (la première ligne est l'en-tête)
 *  - **gras** et numéros +212… (appel en un toucher)
 */

const TIME_RE = /^(\d{1,2}[hH:]\d{2}(?:\s*[–-]\s*\d{1,2}[hH:]\d{2})?)\s*:\s*(.+)$/;
const PHONE_RE = /(\+\d[\d\s().-]{7,}\d)/g;

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      out.push(<strong key={`${keyPrefix}b${i}`}>{linkPhones(part.slice(2, -2), `${keyPrefix}b${i}`)}</strong>);
    } else if (part) {
      out.push(...linkPhones(part, `${keyPrefix}t${i}`));
    }
  });
  return out;
}

function linkPhones(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(PHONE_RE).map((chunk, i) => {
    if (i % 2 === 1) {
      const digits = chunk.replace(/[^\d+]/g, '');
      return (
        <a key={`${keyPrefix}p${i}`} href={`tel:${digits}`} dir="ltr" className="font-semibold text-[var(--accent-primary)] underline underline-offset-2 whitespace-nowrap">
          {chunk}
        </a>
      );
    }
    return <React.Fragment key={`${keyPrefix}s${i}`}>{chunk}</React.Fragment>;
  });
}

type Block =
  | { kind: 'table'; rows: string[][] }
  | { kind: 'list'; items: string[] }
  | { kind: 'times'; rows: { time: string; text: string }[] }
  | { kind: 'p'; text: string };

export function parseInfoBody(body: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const last = blocks[blocks.length - 1];
    if (line.includes(' | ')) {
      const cells = line.split('|').map((c) => c.trim());
      if (last?.kind === 'table') last.rows.push(cells); else blocks.push({ kind: 'table', rows: [cells] });
    } else if (line.startsWith('- ')) {
      const item = line.slice(2).trim();
      if (last?.kind === 'list') last.items.push(item); else blocks.push({ kind: 'list', items: [item] });
    } else {
      const m = TIME_RE.exec(line);
      if (m) {
        const row = { time: m[1].replace(/\s+/g, ' '), text: m[2] };
        if (last?.kind === 'times') last.rows.push(row); else blocks.push({ kind: 'times', rows: [row] });
      } else {
        blocks.push({ kind: 'p', text: line });
      }
    }
  }
  return blocks;
}

export function InfoBody({ body }: { body: string }) {
  const blocks = parseInfoBody(body);
  return (
    <div className="space-y-2.5 text-[15px] leading-6">
      {blocks.map((b, i) => {
        if (b.kind === 'table') {
          const [head, ...rows] = b.rows;
          return (
            <div key={i} className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-[13px] border-collapse tabular-nums">
                <thead>
                  <tr>{head.map((c, j) => <th key={j} className="text-start font-semibold bg-[var(--bg-surface)] px-2.5 py-2 border border-[var(--border-subtle)] whitespace-nowrap">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, j) => (
                    <tr key={j}>{r.map((c, k) => <td key={k} className={`px-2.5 py-2 border border-[var(--border-subtle)] align-top ${k === 0 ? 'font-semibold' : ''}`}>{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (b.kind === 'list') {
          return (
            <ul key={i} className="space-y-1 ps-5 list-disc marker:text-[var(--accent-gold)]">
              {b.items.map((it, j) => <li key={j}>{inline(it, `l${i}-${j}`)}</li>)}
            </ul>
          );
        }
        if (b.kind === 'times') {
          return (
            <div key={i} className="divide-y divide-[var(--border-subtle)]">
              {b.rows.map((r, j) => (
                <div key={j} className="flex gap-3 py-2">
                  <span className="shrink-0 w-[88px] font-bold tabular-nums text-[var(--accent-gold-text)]" dir="ltr">{r.time}</span>
                  <span className="min-w-0">{inline(r.text, `t${i}-${j}`)}</span>
                </div>
              ))}
            </div>
          );
        }
        return <p key={i}>{inline(b.text, `p${i}`)}</p>;
      })}
    </div>
  );
}
