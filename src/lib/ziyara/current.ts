import type { SupabaseClient } from '@supabase/supabase-js';

export const ADMIN_ZIYARA_KEY = 'ziyara_admin_current';

export function getSelectedZiyaraId(): string | null {
  try { return localStorage.getItem(ADMIN_ZIYARA_KEY); } catch { return null; }
}
export function setSelectedZiyaraId(id: string) {
  try { localStorage.setItem(ADMIN_ZIYARA_KEY, id); } catch { /* ignore */ }
}

/** Voyage que le gestionnaire est en train de gérer : sélection mémorisée, sinon voyage actif, sinon le plus récent. */
export async function getManagedZiyara<T = { id: string; start_date: string; end_date: string }>(
  supabase: SupabaseClient,
  columns = 'id, start_date, end_date'
): Promise<T | null> {
  const sel = getSelectedZiyaraId();
  if (sel) {
    const { data } = await supabase.from('ziyaras').select(columns).eq('id', sel).maybeSingle();
    if (data) return data as unknown as T;
  }
  const { data: active } = await supabase.from('ziyaras').select(columns).eq('is_active', true).limit(1).maybeSingle();
  if (active) return active as unknown as T;
  const { data: last } = await supabase.from('ziyaras').select(columns).order('start_date', { ascending: false }).limit(1).maybeSingle();
  return (last as unknown as T) ?? null;
}

/** Parmi les lignes « membre » d'un utilisateur (une par voyage), choisit celle du voyage actif, sinon du plus récent. */
export function pickMemberRow<T extends { ziyaras?: unknown }>(rows: T[] | null | undefined): T | null {
  if (!rows || rows.length === 0) return null;
  const z = (r: T) => (Array.isArray(r.ziyaras) ? r.ziyaras[0] : r.ziyaras) as { is_active?: boolean; start_date?: string } | null;
  const active = rows.find((r) => z(r)?.is_active);
  if (active) return active;
  return [...rows].sort((a, b) => (z(b)?.start_date ?? '').localeCompare(z(a)?.start_date ?? ''))[0];
}
