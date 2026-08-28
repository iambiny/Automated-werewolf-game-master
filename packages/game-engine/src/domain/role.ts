import type { JsonObject, PlayerId, RoleId } from '@werewolf/shared';

export type TeamId = string;

export interface RoleAssignment {
  converted?: boolean;
  currentRoleId: RoleId;
  originalRoleId: RoleId;
  teamId: TeamId;
}

export interface RoleCompositionEntry {
  count: number;
  roleId: RoleId;
}

export interface RoleRuntimeState {
  data: JsonObject;
  playerId: PlayerId;
  roleId: RoleId;
}
