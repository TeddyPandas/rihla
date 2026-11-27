'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getManagedZiyara } from '@/lib/ziyara/current';
import { useAppShell } from '@/components/providers/app-shell-provider';

interface Room { id: string; hotel: string; hotel_sort: number; room_label: string; capacity: number; notes: string | null }
interface RoomMember { id: string; room_id: string; member_id: string; hotel: string }
interface Member { id: string; full_name: string | null; phone_e164: string; role: string }

const sec = 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5';
const inp = 'w-full h-12 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-sm';
const lbl = 'block text-xs font-semibold text-[var(--text-secondary)] mb-1';

export default function AdminRoomsPage() {
  const { lang } = useAppShell();
  const isAr = lang === 'ar';
  const [ziyaraId, setZiyaraId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [rms, setRms] = useState<RoomMember[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [hotel, setHotel] = useState<string>('');
  const [hotelInput, setHotelInput] = useState('');
  const [label, setLabel] = useState('');
  const [capacity, setCapacity] = useState('2');
  const [count, setCount] = useState('1');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const z = await getManagedZiyara(supabase);
    if (!z) return;
    setZiyaraId(z.id);
    const [r, m, mem] = await Promise.all([
      supabase.from('rooms').select('*').eq('ziyara_id', z.id).order('hotel_sort').order('room_label'),
      supabase.from('room_members').select('*').eq('ziyara_id', z.id),
      supabase.from('group_members').select('id, full_name, phone_e164, role').eq('ziyara_id', z.id).order('created_at'),
    ]);
    setRooms((r.data ?? []) as Room[]);
    setRms((m.data ?? []) as RoomMember[]);
    setMembers((mem.data ?? []) as Member[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const hotels = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rooms) if (!seen.has(r.hotel)) seen.set(r.hotel, r.hotel_sort);
    return Array.from(seen.entries()).sort((a, b) => a[1] - b[1]).map(([h]) => h);
  }, [rooms]);
  useEffect(() => { if (!hotel && hotels[0]) setHotel(hotels[0]); }, [hotels, hotel]);
  useEffect(() => { if (hotel) setHotelInput(hotel); }, [hotel]);

  const name = (id: string) => { const m = members.find((x) => x.id === id); return m?.full_name || m?.phone_e164 || '?'; };
  const hotelRooms = rooms.filter((r) => r.hotel === hotel);
  const assignedIds = new Set(rms.filter((x) => x.hotel === hotel).map((x) => x.member_id));
  const unassigned = members.filter((m) => !assignedIds.has(m.id));
  const totalCap = hotelRooms.reduce((a, r) => a + r.capacity, 0);
  const fail = (text: string) => setMsg({ ok: false, text });

  async function addRooms(e: React.FormEvent) {
    e.preventDefault();
    if (!ziyaraId) return;
    const h = hotelInput.trim();
    if (!h || !label.trim()) return;
    setBusy(true);
    const n = Math.max(1, Math.min(60, parseInt(count, 10) || 1));
    const cap = Math.max(1, parseInt(capacity, 10) || 2);
    const sort = hotels.includes(h) ? rooms.find((r) => r.hotel === h)!.hotel_sort : (Math.max(0, ...rooms.map((r) => r.hotel_sort)) + 1);
    // « 201 » avec 3 chambres => 201, 202, 203 ; un libellé non numérique n'est répété qu'avec un numéro.
    const num = /^\d+$/.test(label.trim()) ? parseInt(label.trim(), 10) : null;
    const rows = Array.from({ length: n }, (_, i) => ({
      ziyara_id: ziyaraId, hotel: h, hotel_sort: sort, capacity: cap,
      room_label: num !== null ? String(num + i) : n === 1 ? label.trim() : `${label.trim()} ${i + 1}`,
    }));
    const { error } = await createClient().from('rooms').insert(rows);
    setBusy(false);
    if (error) return fail(error.message);
    setHotel(h); setLabel('');
    setMsg({ ok: true, text: isAr ? '✔ تمت إضافة الغرف.' : `✔ ${n} chambre(s) ajoutée(s).` });
    await load();
  }

  async function assign(roomId: string, memberId: string) {
    if (!ziyaraId || !memberId) return;
    const { error } = await createClient().from('room_members').insert({ ziyara_id: ziyaraId, room_id: roomId, member_id: memberId, hotel });
    if (error) return fail(error.message);
    await load();
  }
  async function unassign(id: string) {
    const { error } = await createClient().from('room_members').delete().eq('id', id);
    if (error) return fail(error.message);
    await load();
  }
  async function removeRoom(r: Room) {
    if (!window.confirm(isAr ? `حذف الغرفة ${r.room_label} ؟` : `Supprimer la chambre ${r.room_label} ? Ses occupants redeviennent non affectés.`)) return;
    const { error } = await createClient().from('rooms').delete().eq('id', r.id);
    if (error) return fail(error.message);
    await load();
  }
  async function removeHotel() {
    if (!ziyaraId || !hotel) return;
    if (!window.confirm(isAr ? `حذف كل غرف «${hotel}» ؟` : `Supprimer toutes les chambres de « ${hotel} » ?`)) return;
    const { error } = await createClient().from('rooms').delete().eq('ziyara_id', ziyaraId).eq('hotel', hotel);
    if (error) return fail(error.message);
    setHotel('');
    await load();
  }

  async function autoFill() {
    if (!ziyaraId || unassigned.length === 0) return;
    const free = hotelRooms.map((r) => ({ id: r.id, left: r.capacity - rms.filter((x) => x.room_id === r.id).length })).filter((r) => r.left > 0);
    const rows: { ziyara_id: string; room_id: string; member_id: string; hotel: string }[] = [];
    let i = 0;
    for (const m of unassigned) {
      while (i < free.length && free[i].left === 0) i++;
      if (i >= free.length) break;
      rows.push({ ziyara_id: ziyaraId, room_id: free[i].id, member_id: m.id, hotel });
      free[i].left--;
    }
    if (rows.length === 0) return fail(isAr ? 'لا توجد أماكن شاغرة.' : 'Aucune place libre dans les chambres.');
    setBusy(true);
    const { error } = await createClient().from('room_members').insert(rows);
    setBusy(false);
    if (error) return fail(error.message);
    setMsg({ ok: true, text: isAr ? `✔ تم توزيع ${rows.length}.` : `✔ ${rows.length} personne(s) répartie(s). Vérifiez et ajustez à la main si besoin.` });
    await load();
  }

  const pill = (on: boolean) => `h-11 px-4 rounded-xl text-sm font-semibold border-[1.5px] ${on ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)] border-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'}`;

  return (
    <div className="space-y-6">
      {msg && <div role="status" className={`p-3.5 rounded-xl text-sm font-semibold ${msg.ok ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]' : 'bg-[var(--status-late-soft)] text-[var(--status-late)]'}`}>{msg.text}</div>}

      <section className={sec}>
        <h2 className="text-xl font-bold text-[var(--accent-primary)] mb-1">{isAr ? 'الفنادق' : 'Hôtels'}</h2>
        <p className="text-xs text-[var(--text-secondary)] mb-3">{isAr ? 'كل مشارك له غرفة واحدة في كل فندق.' : 'Chaque participant a une chambre par hôtel. Chaque membre voit sa chambre et ses colocataires dans Infos.'}</p>
        <div className="flex flex-wrap gap-2">
          {hotels.map((h) => <button key={h} type="button" onClick={() => setHotel(h)} className={pill(h === hotel)}>{h}</button>)}
          {hotels.length === 0 && <span className="text-sm text-[var(--text-secondary)]">{isAr ? 'لا فنادق بعد، أضف أول غرفة أدناه.' : 'Aucun hôtel pour le moment : créez la première chambre ci-dessous.'}</span>}
        </div>
      </section>

      <section className={sec}>
        <h2 className="text-xl font-bold text-[var(--accent-primary)] mb-3">{isAr ? 'إضافة غرف' : 'Ajouter des chambres'}</h2>
        <form onSubmit={addRooms} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className={lbl}>{isAr ? 'الفندق' : 'Hôtel'}</label>
            <input list="hotel-list" value={hotelInput} onChange={(e) => setHotelInput(e.target.value)} placeholder="Hôtel Les Saisons" className={inp} required />
            <datalist id="hotel-list">{hotels.map((h) => <option key={h} value={h} />)}</datalist>
          </div>
          <div><label className={lbl}>{isAr ? 'رقم الغرفة' : 'Numéro / nom'}</label><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="201" className={inp} required /></div>
          <div><label className={lbl}>{isAr ? 'عدد الغرف' : 'Nb de chambres'}</label><input type="number" min={1} max={60} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>{isAr ? 'الأسرّة' : 'Places par chambre'}</label><input type="number" min={1} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inp} /></div>
          <div className="col-span-2 sm:col-span-3 self-end text-xs text-[var(--text-secondary)]">{isAr ? 'مثال: 201 و٣ غرف تنشئ 201 و202 و203.' : 'Ex. « 201 » avec 3 chambres crée 201, 202 et 203.'}</div>
          <div className="self-end"><button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold text-sm disabled:opacity-50">{isAr ? '+ إضافة' : '+ Ajouter'}</button></div>
        </form>
      </section>

      {hotel && (
        <section className={sec}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-xl font-bold text-[var(--accent-primary)]">{hotel}</h2>
              <p className="text-xs text-[var(--text-secondary)] tabular-nums">
                {hotelRooms.length} {isAr ? 'غرفة' : 'chambre(s)'} · {assignedIds.size}/{members.length} {isAr ? 'موزَّعون' : 'affectés'} · {isAr ? 'الأماكن' : 'places'} {totalCap}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={autoFill} disabled={busy || unassigned.length === 0} className="h-11 px-4 rounded-xl border-[1.5px] border-[var(--border-subtle)] text-sm font-semibold disabled:opacity-40">{isAr ? 'توزيع تلقائي' : 'Répartir automatiquement'}</button>
              <button type="button" onClick={removeHotel} className="h-11 px-4 rounded-xl border-[1.5px] border-[var(--status-late)] text-[var(--status-late)] text-sm font-semibold">{isAr ? 'حذف الفندق' : 'Supprimer l’hôtel'}</button>
            </div>
          </div>

          {unassigned.length > 0 && (
            <div className="mb-4 rounded-xl bg-[var(--status-late-soft)] text-[var(--status-late)] p-3 text-sm">
              <b>{unassigned.length} {isAr ? 'بلا غرفة:' : 'sans chambre :'}</b> {unassigned.map((m) => m.full_name || m.phone_e164).join(', ')}
            </div>
          )}
          {members.length > 0 && unassigned.length === 0 && hotelRooms.length > 0 && (
            <div className="mb-4 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] p-3 text-sm font-semibold">{isAr ? '✔ الجميع لديهم غرفة.' : '✔ Tout le monde a une chambre dans cet hôtel.'}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hotelRooms.map((r) => {
              const occ = rms.filter((x) => x.room_id === r.id);
              const full = occ.length >= r.capacity;
              return (
                <div key={r.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-lg tabular-nums">{isAr ? 'غرفة' : 'Chambre'} {r.room_label}</div>
                    <div className={`text-xs font-semibold tabular-nums ${occ.length > r.capacity ? 'text-[var(--status-late)]' : 'text-[var(--text-secondary)]'}`}>{occ.length}/{r.capacity}</div>
                  </div>
                  <ul className="space-y-1.5">
                    {occ.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2 text-sm bg-[var(--bg-surface)] rounded-lg px-3 py-2">
                        <span className="min-w-0 truncate">{name(o.member_id)}</span>
                        <button type="button" onClick={() => unassign(o.id)} aria-label={isAr ? 'إزالة' : 'Retirer'} className="h-8 w-8 shrink-0 rounded-lg text-[var(--status-late)] font-bold">✕</button>
                      </li>
                    ))}
                  </ul>
                  <select value="" onChange={(e) => assign(r.id, e.target.value)} disabled={unassigned.length === 0} className={inp}>
                    <option value="">{full ? (isAr ? '+ إضافة (الغرفة ممتلئة)' : '+ Ajouter (chambre pleine)') : (isAr ? '+ إضافة شخص' : '+ Ajouter une personne')}</option>
                    {unassigned.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.phone_e164}</option>)}
                  </select>
                  <button type="button" onClick={() => removeRoom(r)} className="text-xs font-semibold text-[var(--status-late)]">{isAr ? 'حذف الغرفة' : 'Supprimer la chambre'}</button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
