import { offlineDb, type LocalEntry } from './db';
import { createClient } from '@/lib/supabase/client';

export async function recordZikrEntryOfflineFirst(params: {
  ziyaraId: string;
  zikrId: string;
  entryDate: string;
  quantity: number;
  source?: 'personal' | 'pot';
}): Promise<LocalEntry> {
  if (params.quantity <= 0 || !Number.isInteger(params.quantity)) {
    throw new Error('La quantité doit être un entier positif.');
  }

  const clientMutationId = crypto.randomUUID();
  const createdAtClient = new Date().toISOString();
  const source = params.source ?? 'personal';

  const entry: LocalEntry = {
    clientMutationId,
    zikrId: params.zikrId,
    entryDate: params.entryDate,
    source,
    quantity: params.quantity,
    status: 'active',
    createdAtClient,
    synced: false,
  };

  await offlineDb.transaction('rw', offlineDb.entries, offlineDb.outbox, async () => {
    await offlineDb.entries.put(entry);
    await offlineDb.outbox.add({
      clientMutationId,
      type: 'create_entry',
      payload: {
        client_mutation_id: clientMutationId,
        type: 'create_entry',
        zikr_id: params.zikrId,
        entry_date: params.entryDate,
        source,
        quantity: params.quantity,
        created_at_client: createdAtClient,
      },
      createdAt: createdAtClient,
      attempts: 0,
    });
  });

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    void flushOutboxAndPull(params.ziyaraId);
  }

  return entry;
}

export async function cancelZikrEntryOfflineFirst(params: {
  ziyaraId: string;
  targetClientMutationId: string;
  reason?: string;
}): Promise<void> {
  const cancelMutationId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  await offlineDb.transaction('rw', offlineDb.entries, offlineDb.outbox, async () => {
    const existing = await offlineDb.entries.get(params.targetClientMutationId);
    if (!existing || existing.status !== 'active') return;

    await offlineDb.entries.update(params.targetClientMutationId, {
      status: 'cancelled',
      cancelledAt: nowIso,
      cancelReason: params.reason ?? 'Annulé par le membre',
      synced: false,
    });

    await offlineDb.outbox.add({
      clientMutationId: cancelMutationId,
      type: 'cancel_entry',
      payload: {
        client_mutation_id: cancelMutationId,
        type: 'cancel_entry',
        target_client_mutation_id: params.targetClientMutationId,
        reason: params.reason ?? 'Annulé par le membre',
      },
      createdAt: nowIso,
      attempts: 0,
    });
  });

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    void flushOutboxAndPull(params.ziyaraId);
  }
}

let isSyncRunning = false;

export async function flushOutboxAndPull(ziyaraId: string): Promise<boolean> {
  if (isSyncRunning || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return false;
  }

  isSyncRunning = true;
  try {
    const supabase = createClient();
    const pending = await offlineDb.outbox.orderBy('id').toArray();

    if (pending.length > 0) {
      const mutationsPayload = pending.map((m) => m.payload);
      const { data: syncData, error: syncError } = await supabase.rpc('sync_member_batch', {
        p_ziyara_id: ziyaraId,
        p_mutations: mutationsPayload,
      });

      if (syncError) {
        return false;
      }

      // Le serveur renvoie les mutations traitées (réussies OU rejetées définitivement).
      // Une mutation rejetée est retirée de la file pour ne pas bloquer les suivantes.
      const processed = new Set<string>(
        ((syncData as { processed_ids?: string[] } | null)?.processed_ids ?? []).map(String)
      );
      const failed = (syncData as { failed?: unknown[] } | null)?.failed ?? [];
      if (failed.length > 0) console.warn('[sync] mutations rejetées par le serveur', failed);

      const idsToDelete = pending
        .filter((p) => processed.has(p.clientMutationId))
        .map((p) => p.id!)
        .filter(Boolean);
      await offlineDb.outbox.bulkDelete(idsToDelete);
    }

    const [defsRes, goalsRes, entriesRes, summaryRes] = await Promise.all([
      supabase.from('zikr_definitions').select('*').eq('ziyara_id', ziyaraId).order('sort_order'),
      supabase.from('member_goals').select('*').eq('ziyara_id', ziyaraId),
      supabase.from('zikr_entries').select('*').eq('ziyara_id', ziyaraId),
      supabase.rpc('get_group_zikr_summary', { p_ziyara_id: ziyaraId }),
    ]);

    await offlineDb.transaction(
      'rw',
      [offlineDb.zikrDefs, offlineDb.goals, offlineDb.entries, offlineDb.groupSummary, offlineDb.outbox],
      async () => {
        if (defsRes.data) {
          await offlineDb.zikrDefs.clear();
          await offlineDb.zikrDefs.bulkPut(
            defsRes.data.map((d) => ({
              id: d.id,
              nameFr: d.name_fr,
              nameAr: d.name_ar,
              arabicText: d.arabic_text,
              scope: d.scope,
              defaultSlot: d.default_slot,
              sortOrder: d.sort_order,
              slotPlan: d.slot_plan ?? null,
              distributionMode: d.distribution_mode ?? 'split',
            }))
          );
        }

        if (goalsRes.data) {
          await offlineDb.goals.clear();
          await offlineDb.goals.bulkPut(
            goalsRes.data.map((g) => ({
              id: g.id,
              zikrId: g.zikr_id,
              targetDate: g.target_date,
              slot: g.slot,
              initialTarget: Number(g.initial_target),
              adjustedDelta: Number(g.adjusted_delta),
            }))
          );
        }

        if (entriesRes.data) {
          const stillQueued = new Set(
            (await offlineDb.outbox.toArray()).map((o) => o.clientMutationId)
          );
          for (const e of entriesRes.data) {
            if (!stillQueued.has(e.client_mutation_id)) {
              await offlineDb.entries.put({
                clientMutationId: e.client_mutation_id,
                serverId: e.id,
                zikrId: e.zikr_id,
                entryDate: e.entry_date,
                source: e.source,
                quantity: Number(e.quantity),
                status: e.status,
                createdAtClient: e.created_at_client,
                cancelledAt: e.cancelled_at,
                cancelReason: e.cancel_reason,
                synced: true,
              });
            }
          }
        }

        if (summaryRes.data) {
          await offlineDb.groupSummary.clear();
          await offlineDb.groupSummary.bulkPut(
            summaryRes.data.map((s: Record<string, unknown>) => ({
              zikrId: String(s.zikr_id),
              totalInitialTarget: Number(s.total_initial_target),
              totalEffectivePersonalTarget: Number(s.total_effective_personal_target),
              totalDonePersonal: Number(s.total_done_personal),
              totalDonePot: Number(s.total_done_pot),
              potAllocated: Number(s.pot_allocated),
              potRemaining: Number(s.pot_remaining),
            }))
          );
        }
      }
    );

    return true;
  } finally {
    isSyncRunning = false;
  }
}
