export type DistributionMode = 'daily' | 'stay' | 'day';

export interface DistributionRow {
  /** Jour concerné (null = objectif « séjour global »). */
  date: string | null;
  /** Quantité à répartir ce jour-là. */
  quantity: number;
  /** Part de chaque participant. */
  share: number;
  /** Reste de la division : revient au gestionnaire. */
  surplus: number;
}

export interface DistributionPreview {
  rows: DistributionRow[];
  /** Total reçu par chaque participant sur l'ensemble des lignes. */
  sharePerParticipant: number;
  surplusTotal: number;
}

export function listDays(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

/**
 * Même algorithme que la fonction SQL `distribute_zikr` :
 * - daily : total ÷ jours (les premiers jours reçoivent +1 pour le reste), puis ÷ participants ;
 * - stay  : total ÷ participants, sans jour ;
 * - day   : total ÷ participants sur un jour précis.
 * Le surplus de chaque division revient au gestionnaire.
 */
export function previewDistribution(params: {
  total: number;
  mode: DistributionMode;
  days: string[];
  day?: string;
  participants: number;
}): DistributionPreview {
  const { total, mode, days, day, participants } = params;
  if (!Number.isInteger(total) || total <= 0 || participants <= 0) {
    return { rows: [], sharePerParticipant: 0, surplusTotal: 0 };
  }

  let slots: { date: string | null; quantity: number }[];
  if (mode === 'daily') {
    const n = days.length;
    const per = Math.floor(total / n);
    const rem = total % n;
    slots = days.map((d, i) => ({ date: d, quantity: per + (i < rem ? 1 : 0) }));
  } else if (mode === 'stay') {
    slots = [{ date: null, quantity: total }];
  } else {
    slots = [{ date: day ?? days[0], quantity: total }];
  }

  const rows = slots.map(({ date, quantity }) => {
    const share = Math.floor(quantity / participants);
    return { date, quantity, share, surplus: quantity - share * participants };
  });

  return {
    rows,
    sharePerParticipant: rows.reduce((a, r) => a + r.share, 0),
    surplusTotal: rows.reduce((a, r) => a + r.surplus, 0),
  };
}
