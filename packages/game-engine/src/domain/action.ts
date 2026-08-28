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

export interface SilenceEffect extends EffectBase {
  sourceRoleId: 'SILENCER';
  type: 'SILENCE';
  visibility: 'INTERNAL';
}

export interface WerewolfAttackEffect extends EffectBase {
  sourceRoleId: 'WEREWOLF';
  type: 'WEREWOLF_ATTACK';
  visibility: 'INTERNAL';
}

export interface DemonWolfCurseIntentEffect extends EffectBase {
  sourceRoleId: 'DEMON_WOLF';
  type: 'DEMON_WOLF_CURSE_INTENT';
  visibility: 'PRIVATE';
}

export interface HealEffect extends EffectBase {
  sourceRoleId: 'WITCH';
  type: 'HEAL';
  visibility: 'INTERNAL';
}

export interface PoisonEffect extends EffectBase {
  sourceRoleId: 'WITCH';
  type: 'POISON';
  visibility: 'INTERNAL';
}

export interface DirectKillEffect extends EffectBase {
  payload: { cause: 'HUNTER_SHOT' };
  sourceRoleId: 'HUNTER';
  type: 'DIRECT_KILL';
  visibility: 'INTERNAL';
}

export type GameEffect =
  | DemonWolfCurseIntentEffect
  | DirectKillEffect
  | HealEffect
  | InvestigationResultEffect
  | PoisonEffect
  | ProtectEffect
  | SilenceEffect
  | WerewolfAttackEffect;

export type GameTrigger =
  | { playerId: PlayerId; type: 'HUNTER_MORNING_SHOT' }
  | { playerId: PlayerId; type: 'HUNTER_DAY_SHOT' };
