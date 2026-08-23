import type { MatchState } from '../domain/match-state';
import type { WinnerResult } from '../domain/context';
import type { WinRules } from '../domain/core-role-rules';
import type { DomainEvent } from '../events/domain-event';
import { domainError, type EngineResult } from './result';

export function evaluateWinner(
  state: MatchState,
  rules: WinRules,
): WinnerResult | null {
  if (state.winner) return state.winner;

  if (state.pendingTriggers.length > 0 || !isStableWinCheckpoint(state)) {
    return null;
  }

  const livingAssignments = Object.entries(state.roleAssignments)
    .filter(([playerId]) => state.players[playerId]?.lifeState === 'ALIVE')
    .map(([, assignment]) => assignment);
  const livingWerewolves = livingAssignments.filter(
    (assignment) => assignment.teamId === 'WEREWOLF',
  ).length;
  const livingVillagers = livingAssignments.filter(
    (assignment) => assignment.teamId === 'VILLAGE',
  ).length;

  if (livingWerewolves === 0) {
    return {
      reason: 'No living Werewolf-aligned players remain.',
      teamId: 'VILLAGE',
    };
  }

  if (
    rules.werewolfCondition === 'PARITY' &&
    livingWerewolves >= livingVillagers
  ) {
    return {
      reason: 'Werewolf-aligned players reached parity with the opposition.',
      teamId: 'WEREWOLF',
    };
  }

  return null;
}

export function declareWinner(
  state: MatchState,
  rules: WinRules,
): EngineResult {
  if (state.winner) return { events: [], ok: true, state };

  const winner = evaluateWinner(state, rules);
  if (!winner) {
    return {
      error: domainError(
        'ACTION_NOT_AVAILABLE',
        'No winner can be declared at this checkpoint.',
      ),
      ok: false,
      state,
    };
  }

  const event: DomainEvent = { type: 'WINNER_DECLARED', winner };
  const nextState: MatchState = {
    ...state,
    events: [...state.events, event],
    winner,
  };

  return { events: [event], ok: true, state: nextState };
}

function isStableWinCheckpoint(state: MatchState): boolean {
  if (state.phase.type === 'DAY_DEATH_RESOLUTION') return true;
  if (state.phase.type !== 'MORNING') return false;

  return (
    state.phase.subphase === 'MORNING_TRIGGERS' ||
    state.phase.subphase === 'READY_FOR_DISCUSSION'
  );
}
