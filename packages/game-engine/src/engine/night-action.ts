import type { PlayerId, RoleId } from '@werewolf/shared';

import type { GameAction, GameEffect } from '../domain/action';
import type { NightContext } from '../domain/context';
import type { MatchState } from '../domain/match-state';
import type { RoleRuntimeState } from '../domain/role';
import type { DomainEvent } from '../events/domain-event';
import { domainError, type DomainError, type EngineResult } from './result';
import { isPlayerCursed } from './curse';

interface NightActionUpdates {
  nightContext?: Partial<NightContext>;
  roleState?: Record<string, RoleRuntimeState>;
}

export function validateActiveNightTurn(
  state: MatchState,
  roleId: RoleId,
  actionType: string,
): DomainError | null {
  if (state.status === 'COMPLETED' || state.phase.type === 'GAME_OVER') {
    return domainError(
      'MATCH_ALREADY_COMPLETED',
      'A completed match cannot accept actions.',
    );
  }

  if (state.phase.type !== 'NIGHT' || state.phase.subphase !== 'ROLE_TURN') {
    return domainError(
      'INVALID_PHASE',
      'Night actions are only accepted during a role turn.',
    );
  }

  const context = state.nightContext;
  const turn = context?.queue[context.currentTurnIndex];
  if (!context || !turn || turn.roleId !== roleId || turn.mode !== 'ACTIVE') {
    return domainError(
      'ACTION_NOT_AVAILABLE',
      'This role does not have an active turn.',
    );
  }

  if (context.actions.some((action) => action.type === actionType)) {
    return domainError(
      'ALREADY_SUBMITTED',
      'This action has already been submitted for the current night.',
    );
  }

  return null;
}

export function getLivingRoleHolderIds(
  state: MatchState,
  roleId: RoleId,
): PlayerId[] {
  return Object.entries(state.roleAssignments)
    .filter(
      ([playerId, assignment]) =>
        assignment.currentRoleId === roleId &&
        state.players[playerId]?.lifeState === 'ALIVE' &&
        !isPlayerCursed(state, playerId),
    )
    .map(([playerId]) => playerId);
}

export function recordNightAction(
  state: MatchState,
  action: GameAction,
  effects: GameEffect[],
  updates: NightActionUpdates = {},
): EngineResult {
  const context = state.nightContext;
  if (!context) {
    return {
      error: domainError(
        'INVALID_PHASE',
        'A night context is required to record an action.',
      ),
      ok: false,
      state,
    };
  }

  const event: DomainEvent = { action, type: 'ACTION_SUBMITTED' };
  const nextState: MatchState = {
    ...state,
    events: [...state.events, event],
    nightContext: {
      ...context,
      ...updates.nightContext,
      actions: [...context.actions, action],
      effects: [...context.effects, ...effects],
    },
    pendingActions: [...state.pendingActions, action],
    pendingEffects: [...state.pendingEffects, ...effects],
    roleState: updates.roleState ?? state.roleState,
  };

  return { events: [event], ok: true, state: nextState };
}

export function rejectedAction(
  state: MatchState,
  error: DomainError,
): EngineResult {
  return { error, ok: false, state };
}
