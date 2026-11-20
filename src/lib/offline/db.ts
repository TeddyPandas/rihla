import Dexie, { type Table } from 'dexie';

export type TimeSlot = 'morning' | 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'night' | 'anytime';

export interface LocalProfile {
  memberId: string;
  ziyaraId: string;
  ziyaraTitleFr: string;
  ziyaraTitleAr: string;
  startDate: string;
  endDate: string;
  fullName: string;
  role: 'cheikh' | 'member';
}

export interface LocalZikrDef {
  id: string;
  nameFr: string;
  nameAr: string;
  arabicText: string | null;
  scope: 'daily' | 'stay';
  defaultSlot: TimeSlot;
  sortOrder: number;
}

export interface LocalGoal {
  id: string;
  zikrId: string;
  targetDate: string | null;
  slot: TimeSlot;
  initialTarget: number;
  adjustedDelta: number;
}

export interface LocalEntry {
  clientMutationId: string;
  serverId?: string;
  zikrId: string;
  entryDate: string;
  source: 'personal' | 'pot';
  quantity: number;
  status: 'active' | 'cancelled';
  createdAtClient: string;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  synced: boolean;
}

export interface LocalGroupSummary {
  zikrId: string;
  totalInitialTarget: number;
  totalEffectivePersonalTarget: number;
  totalDonePersonal: number;
  totalDonePot: number;
  potAllocated: number;
  potRemaining: number;
}

export interface OutboxMutation {
  id?: number;
  clientMutationId: string;
  type: 'create_entry' | 'cancel_entry';
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
}

class ZiyaraOfflineDB extends Dexie {
  profile!: Table<LocalProfile, string>;
  zikrDefs!: Table<LocalZikrDef, string>;
  goals!: Table<LocalGoal, string>;
  entries!: Table<LocalEntry, string>;
  groupSummary!: Table<LocalGroupSummary, string>;
  outbox!: Table<OutboxMutation, number>;

  constructor() {
    super('ZiyaraFesDB');
    this.version(1).stores({
      profile: 'memberId',
      zikrDefs: 'id, sortOrder',
      goals: 'id, zikrId, targetDate',
      entries: 'clientMutationId, zikrId, entryDate, source, status, synced',
      groupSummary: 'zikrId',
      outbox: '++id, clientMutationId, createdAt',
    });
  }
}

export const offlineDb = new ZiyaraOfflineDB();
