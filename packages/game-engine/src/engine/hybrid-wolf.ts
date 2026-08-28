import type { PlayerId } from '@werewolf/shared';

import type { MatchState } from '../domain/match-state';

/**
 * Returns the Hybrid Wolf that will convert from the already-completed
 * Werewolf and Guard turns. Later Witch actions do not prevent conversion.
 */
export function getPendingHybridWolfConversionId(
  state: MatchState,
): PlayerId | undefined {
  const context = state.nightContext;
  const targetPlayerId = context?.werewolfAttackTargetId ?? undefined;
  if (!context || !targetPlayerId) return undefined;

  const target = state.players[targetPlayerId];
  const assignment = state.roleAssignments[targetPlayerId];
  const protectedByGuard = context.effects.some(
    (effect) =>
      effect.type === 'PROTECT' &&
      effect.targetPlayerIds.includes(targetPlayerId),
  );

  return target?.lifeState === 'ALIVE' &&
    assignment?.originalRoleId === 'HYBRID_WOLF' &&
    assignment.currentRoleId === 'HYBRID_WOLF' &&
    assignment.teamId === 'VILLAGE' &&
    assignment.converted !== true &&
    !protectedByGuard
    ? targetPlayerId
    : undefined;
}
