import type { PhaseId, PlayerId, RoleId } from '@werewolf/shared';

import type { NightContext } from '../domain/context';
import type { MatchState } from '../domain/match-state';
import type { RoleRuntimeState } from '../domain/role';
import type { RoleCatalog } from '../domain/role-definition';
import type { DomainEvent } from '../events/domain-event';
import { buildNightQueue } from './night-queue';
import { domainError, type EngineResult } from './result';

export interface RegisterRoleInput {
  playerId: PlayerId;
  roleId: RoleId;
  roleState: RoleRuntimeState;
}

export function registerRole(
  state: MatchState,
  input: RegisterRoleInput,
  catalog: RoleCatalog,
): EngineResult {
  if (state.phase.type !== 'ROLE_REGISTRATION') {
    return rejected(
      state,
      'INVALID_PHASE',
      'Roles can only be registered during role registration.',
    );
  }

  const player = state.players[input.playerId];
  const role = catalog[input.roleId];
  if (
    !player ||
    !role ||
    input.roleState.playerId !== input.playerId ||
    input.roleState.roleId !== input.roleId
  ) {
    return rejected(
      state,
      'INVALID_MATCH_INPUT',
      'The role registration could not be accepted.',
    );
  }

  if (state.roleAssignments[input.playerId]) {
    return rejected(
      state,
      'ALREADY_SUBMITTED',
      'This player has already registered a role.',
    );
  }

  const event: DomainEvent = {
    playerId: input.playerId,
    roleId: input.roleId,
    type: 'ROLE_REGISTERED',
  };
  const nextState: MatchState = {
    ...state,
    events: [...state.events, event],
    roleAssignments: {
      ...state.roleAssignments,
      [input.playerId]: {
        ...(input.roleId === 'HYBRID_WOLF' ? { converted: false } : {}),
        currentRoleId: input.roleId,
        originalRoleId: input.roleId,
        teamId: role.teamId,
      },
    },
    roleState: {
      ...state.roleState,
      [input.playerId]: input.roleState,
    },
  };

  return { events: [event], ok: true, state: nextState };
}

export function completeRoleRegistration(
  state: MatchState,
  phaseId: PhaseId,
): EngineResult {
  if (state.phase.type !== 'ROLE_REGISTRATION') {
    return rejected(state, 'INVALID_PHASE', 'Role registration is not active.');
  }

  if (!registrationMatchesComposition(state)) {
    return rejected(
      state,
      'INVALID_MATCH_INPUT',
      'Role registration does not match the selected deck. Please re-register roles.',
    );
  }

  const nextPhase = { type: 'PRE_GAME_VALIDATION' } as const;
  const event: DomainEvent = {
    phase: nextPhase,
    previousPhase: state.phase,
    type: 'PHASE_CHANGED',
  };
  return {
    events: [event],
    ok: true,
    state: {
      ...state,
      events: [...state.events, event],
      phase: nextPhase,
      phaseId,
    },
  };
}

export function resetRoleRegistration(state: MatchState): EngineResult {
  if (state.phase.type !== 'ROLE_REGISTRATION') {
    return rejected(state, 'INVALID_PHASE', 'Role registration is not active.');
  }

  const event: DomainEvent = { type: 'ROLE_REGISTRATION_RESET' };
  return {
    events: [event],
    ok: true,
    state: {
      ...state,
      events: [...state.events, event],
      roleAssignments: {},
      roleState: {},
    },
  };
}

export function startFirstNight(
  state: MatchState,
  phaseId: PhaseId,
  catalog: RoleCatalog,
): EngineResult {
  if (
    state.phase.type !== 'PRE_GAME_VALIDATION' ||
    !registrationMatchesComposition(state)
  ) {
    return rejected(
      state,
      'INVALID_MATCH_INPUT',
      'The match cannot start until pre-game validation succeeds.',
    );
  }

  const nextPhase = {
    nightNumber: 1,
    subphase: 'PREPARE_QUEUE',
    type: 'NIGHT',
  } as const;
  const events: DomainEvent[] = [
    { type: 'MATCH_STARTED' },
    { phase: nextPhase, previousPhase: state.phase, type: 'PHASE_CHANGED' },
  ];
  const nightContext: NightContext = {
    actions: [],
    currentTurnIndex: 0,
    effects: [],
    nightNumber: 1,
    queue: buildNightQueue(state, catalog),
  };

  return {
    events,
    ok: true,
    state: {
      ...state,
      cycle: 1,
      events: [...state.events, ...events],
      nightContext,
      phase: nextPhase,
      phaseId,
      status: 'ACTIVE',
    },
  };
}

function registrationMatchesComposition(state: MatchState): boolean {
  const playerIds = Object.keys(state.players);
  const assignments = Object.values(state.roleAssignments);
  if (assignments.length !== playerIds.length) return false;
  if (playerIds.some((playerId) => !state.roleAssignments[playerId])) {
    return false;
  }

  const expected = new Map(
    state.roleComposition.map((entry) => [entry.roleId, entry.count]),
  );
  const actual = new Map<RoleId, number>();
  for (const assignment of assignments) {
    actual.set(
      assignment.originalRoleId,
      (actual.get(assignment.originalRoleId) ?? 0) + 1,
    );
  }

  return (
    expected.size === actual.size &&
    [...expected].every(([roleId, count]) => actual.get(roleId) === count)
  );
}

function rejected(
  state: MatchState,
  code: 'ALREADY_SUBMITTED' | 'INVALID_MATCH_INPUT' | 'INVALID_PHASE',
  message: string,
): EngineResult {
  return { error: domainError(code, message), ok: false, state };
}
