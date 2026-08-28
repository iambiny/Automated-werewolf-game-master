import type { ActionId, PlayerId } from '@werewolf/shared';

import type { GameAction, GameEffect } from '../domain/action';
import type { DemonWolfCurseDecision } from '../domain/core-role-rules';
import type { MatchState } from '../domain/match-state';
import type { EngineResult } from './result';
import { getPendingHybridWolfConversionId } from './hybrid-wolf';
import { domainError } from './result';
import {
  getLivingRoleHolderIds,
  recordNightAction,
  rejectedAction,
  validateActiveNightTurn,
} from './night-action';

export interface SubmitDemonWolfCurseInput {
  actionId: ActionId;
  decision: DemonWolfCurseDecision;
}

export interface DemonWolfCurseEvaluation {
  outcome: 'FAILED' | 'SUCCEEDED' | 'CONSUMED';
  targetPlayerId: PlayerId;
}

/**
 * Evaluates the curse from information already known during the Demon Wolf
 * turn. Witch actions deliberately do not participate because their turn is
 * later in the queue and cannot change the private handoff result.
 */
export function evaluateDemonWolfCurse(
  state: MatchState,
): DemonWolfCurseEvaluation | null {
  const context = state.nightContext;
  const curse = context?.effects.find(
    (effect) => effect.type === 'DEMON_WOLF_CURSE_INTENT',
  );
  const targetPlayerId = curse?.targetPlayerIds[0];
  if (!context || !curse || !targetPlayerId) return null;

  const matchesAttack = context.werewolfAttackTargetId === targetPlayerId;
  const protectedByGuard = context.effects.some(
    (effect) =>
      effect.type === 'PROTECT' &&
      effect.targetPlayerIds.includes(targetPlayerId),
  );
  if (!matchesAttack || protectedByGuard) {
    return { outcome: 'FAILED', targetPlayerId };
  }

  const isUnconvertedHybridWolf =
    getPendingHybridWolfConversionId(state) === targetPlayerId;

  return {
    outcome: isUnconvertedHybridWolf ? 'CONSUMED' : 'SUCCEEDED',
    targetPlayerId,
  };
}

export function submitDemonWolfCurseDecision(
  state: MatchState,
  input: SubmitDemonWolfCurseInput,
): EngineResult {
  const turnError = validateActiveNightTurn(
    state,
    'DEMON_WOLF',
    'DEMON_WOLF_CURSE_DECISION',
  );
  if (turnError) return rejectedAction(state, turnError);

  const actorPlayerIds = getLivingRoleHolderIds(state, 'DEMON_WOLF').filter(
    (playerId) => state.roleState[playerId]?.data.curseAvailable === true,
  );
  if (actorPlayerIds.length === 0) {
    return rejectedAction(
      state,
      domainError(
        'RESOURCE_EXHAUSTED',
        'No living Demon Wolf has an available curse.',
      ),
    );
  }

  const targetPlayerId = state.nightContext?.werewolfAttackTargetId;
  if (input.decision === 'CURSE' && !targetPlayerId) {
    return rejectedAction(
      state,
      domainError(
        'ACTION_NOT_AVAILABLE',
        'A curse requires a Werewolf attack target.',
      ),
    );
  }

  const targetPlayerIds = targetPlayerId ? [targetPlayerId] : [];
  const action: GameAction = {
    actorPlayerIds,
    actorRoleId: 'DEMON_WOLF',
    id: input.actionId,
    payload: { decision: input.decision },
    phaseId: state.phaseId,
    targetPlayerIds,
    type: 'DEMON_WOLF_CURSE_DECISION',
  };
  const effects: GameEffect[] =
    input.decision === 'CURSE' && targetPlayerId
      ? [
          {
            sourcePlayerIds: actorPlayerIds,
            sourceRoleId: 'DEMON_WOLF',
            targetPlayerIds: [targetPlayerId],
            type: 'DEMON_WOLF_CURSE_INTENT',
            visibility: 'PRIVATE',
          },
        ]
      : [];

  return recordNightAction(state, action, effects, {
    nightContext: { demonWolfCurseIntent: input.decision === 'CURSE' },
  });
}
