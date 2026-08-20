import type {
  ActionId,
  JsonObject,
  PhaseId,
  PlayerId,
  RoleId,
} from '@werewolf/shared';

export interface GameAction {
  actorPlayerIds: PlayerId[];
  actorRoleId: RoleId;
  id: ActionId;
  payload?: JsonObject;
  phaseId: PhaseId;
  targetPlayerIds: PlayerId[];
  type: string;
}

export interface GameEffect {
  payload?: JsonObject;
  sourcePlayerIds: PlayerId[];
  sourceRoleId?: RoleId;
  targetPlayerIds: PlayerId[];
  type: string;
}

export interface GameTrigger {
  payload?: JsonObject;
  playerId?: PlayerId;
  type: string;
}
