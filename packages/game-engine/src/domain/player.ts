import type { PhaseId, PlayerId } from '@werewolf/shared';

export type LifeState = 'ALIVE' | 'DEAD';

export type DeathCause =
  | 'WEREWOLF_ATTACK'
  | 'WITCH_POISON'
  | 'HUNTER_SHOT'
  | 'DAY_EXECUTION'
  | 'OTHER';

export interface DeathRecord {
  announced: boolean;
  causes: DeathCause[];
  phaseId: PhaseId;
}

export interface PlayerRuntimeState {
  death?: DeathRecord;
  displayName: string;
  lifeState: LifeState;
  playerId: PlayerId;
  seatIndex: number;
}
