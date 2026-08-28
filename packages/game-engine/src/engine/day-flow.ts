import type { PhaseId } from '@werewolf/shared';

import type { MatchState } from '../domain/match-state';
import type { RoleCatalog } from '../domain/role-definition';
import type { DomainEvent } from '../events/domain-event';
import { buildNightQueue } from './night-queue';
import { domainError, type EngineResult } from './result';
import { SILENCED_FLAG } from './silencer';

export function announcePendingDeaths(state: MatchState): EngineResult {
  if (
    state.phase.type !== 'MORNING' &&
    state.phase.type !== 'DAY_DEATH_RESOLUTION'
  ) {
    return failed(
      state,
      'Death announcements are not available in this phase.',
    );
  }

  const unannouncedIds = Object.values(state.players)
    .filter((player) => player.death && !player.death.announced)
    .map((player) => player.playerId);
  if (unannouncedIds.length === 0) return { events: [], ok: true, state };

  const players = { ...state.players };
  for (const playerId of unannouncedIds) {
    const player = players[playerId];
    if (!player?.death) continue;
    players[playerId] = {
      ...player,
      death: { ...player.death, announced: true },
    };
  }
  const event: DomainEvent = {
    playerIds: unannouncedIds,
    type: 'DEATHS_ANNOUNCED',
  };
  return {
    events: [event],
    ok: true,
    state: { ...state, events: [...state.events, event], players },
  };
}

export function startNextNight(
  state: MatchState,
  phaseId: PhaseId,
  catalog: RoleCatalog,
): EngineResult {
  if (
    state.phase.type !== 'DAY_DEATH_RESOLUTION' ||
    state.pendingTriggers.length > 0 ||
    state.winner !== undefined
  ) {
    return failed(
      state,
      'The next night cannot start until daytime death triggers resolve.',
    );
  }

  const nightNumber = state.phase.dayNumber + 1;
  const nextPhase = {
    nightNumber,
    subphase: 'PREPARE_QUEUE',
    type: 'NIGHT',
  } as const;
  const event: DomainEvent = {
    phase: nextPhase,
    previousPhase: state.phase,
    type: 'PHASE_CHANGED',
  };
  const players = Object.fromEntries(
    Object.entries(state.players).map(([playerId, player]) => [
      playerId,
      {
        ...player,
        publicFlags: player.publicFlags.filter(
          (flag) => flag !== SILENCED_FLAG,
        ),
      },
    ]),
  );
  return {
    events: [event],
    ok: true,
    state: {
      ...state,
      cycle: nightNumber,
      events: [...state.events, event],
      nightContext: {
        actions: [],
        currentTurnIndex: 0,
        effects: [],
        nightNumber,
        queue: buildNightQueue(state, catalog),
      },
      pendingActions: [],
      pendingEffects: [],
      phase: nextPhase,
      phaseId,
      players,
      votingContext: undefined,
    },
  };
}

function failed(state: MatchState, message: string): EngineResult {
  return {
    error: domainError('INVALID_PHASE', message),
    ok: false,
    state,
  };
}
