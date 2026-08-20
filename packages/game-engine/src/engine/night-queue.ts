import type { PlayerId } from '@werewolf/shared';

import type { MatchState } from '../domain/match-state';
import type { NightTurn } from '../domain/context';
import type { RoleCatalog, RoleDefinition } from '../domain/role-definition';

export function buildNightQueue(
  state: MatchState,
  catalog: RoleCatalog,
): NightTurn[] {
  return Object.values(catalog)
    .filter(hasNightTurn)
    .filter((role) => {
      const holderIds = getCurrentHolderIds(state, role);
      return role.shouldNarrateTurn(state, holderIds);
    })
    .map((role) => {
      const holderIds = getCurrentHolderIds(state, role);

      return {
        mode: role.canPerformAction(state, holderIds) ? 'ACTIVE' : 'DECOY',
        order: role.night.order,
        roleId: role.id,
      } satisfies NightTurn;
    })
    .sort(compareNightTurns);
}

function getCurrentHolderIds(
  state: MatchState,
  role: RoleDefinition,
): PlayerId[] {
  return Object.entries(state.roleAssignments)
    .filter(([, assignment]) => assignment.currentRoleId === role.id)
    .map(([playerId]) => playerId);
}

function hasNightTurn(
  role: RoleDefinition,
): role is RoleDefinition & { night: NonNullable<RoleDefinition['night']> } {
  return role.night !== undefined;
}

function compareNightTurns(left: NightTurn, right: NightTurn): number {
  if (left.order !== right.order) return left.order - right.order;
  if (left.roleId < right.roleId) return -1;
  if (left.roleId > right.roleId) return 1;
  return 0;
}
