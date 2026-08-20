import type {
  ActionId,
  JsonObject,
  PhaseId,
  PlayerId,
  RoleId,
} from '@werewolf/shared';

import type { InvestigationValue } from './core-role-rules';

export interface GameAction {
  actorPlayerIds: PlayerId[];
  actorRoleId: RoleId;
  id: ActionId;
  payload?: JsonObject;
  phaseId: PhaseId;
  targetPlayerIds: PlayerId[];
  type: string;
}

interface EffectBase {
  sourcePlayerIds: PlayerId[];
  targetPlayerIds: PlayerId[];
  visibility: 'INTERNAL' | 'PRIVATE';
}

export interface InvestigationResultEffect extends EffectBase {
  payload: InvestigationValue;
  sourceRoleId: 'SEER';
  type: 'INVESTIGATION_RESULT';
  visibility: 'PRIVATE';
}

export interface ProtectEffect extends EffectBase {
  sourceRoleId: 'GUARD';
  type: 'PROTECT';
  visibility: 'INTERNAL';
}

export interface WerewolfAttackEffect extends EffectBase {
  sourceRoleId: 'WEREWOLF';
  type: 'WEREWOLF_ATTACK';
  visibility: 'INTERNAL';
}

export type GameEffect =
  InvestigationResultEffect | ProtectEffect | WerewolfAttackEffect;

export interface GameTrigger {
  payload?: JsonObject;
  playerId?: PlayerId;
  type: string;
}
