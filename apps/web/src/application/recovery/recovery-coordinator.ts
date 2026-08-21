import type { GamePhase, MatchState, MatchStatus } from '@werewolf/game-engine';

import {
  PERSISTED_MATCH_SCHEMA_VERSION,
  type MatchRepository,
  type PersistedMatchEnvelope,
} from '../persistence/match-repository';

export type RecoveryCheckpoint =
  | 'ROLE_REGISTRATION_PLAYER_HANDOFF'
  | 'NIGHT_BEFORE_ROLE_WAKE'
  | 'NIGHT_WAITING_FOR_ACTION'
  | 'NIGHT_AFTER_ROLE_SLEEP'
  | 'MORNING_BEFORE_HUNTER_TRIGGER'
  | 'DAY_DISCUSSION'
  | 'DAY_VOTING';

export type RecoveryResult =
  | { status: 'NONE' }
  | {
      code: 'UNSUPPORTED_SCHEMA' | 'INVALID_PERSISTED_MATCH';
      message: string;
      status: 'INVALID';
    }
  | {
      checkpoint: RecoveryCheckpoint;
      envelope: PersistedMatchEnvelope;
      match: MatchState;
      status: 'READY';
    };

export class RecoveryCoordinator {
  constructor(private readonly repository: MatchRepository) {}

  async loadActive(): Promise<RecoveryResult> {
    let envelope: unknown;
    try {
      envelope = await this.repository.getActive();
    } catch {
      return {
        code: 'INVALID_PERSISTED_MATCH',
        message: 'Local storage is unavailable, so no match was loaded.',
        status: 'INVALID',
      };
    }
    if (envelope === null) return { status: 'NONE' };

    const validation = validatePersistedMatchEnvelope(envelope);
    if (!validation.ok) return validation.error;

    return {
      checkpoint: getRecoveryCheckpoint(validation.envelope.match),
      envelope: validation.envelope,
      match: validation.envelope.match,
      status: 'READY',
    };
  }
}

type EnvelopeValidation =
  | { envelope: PersistedMatchEnvelope; ok: true }
  | { error: Extract<RecoveryResult, { status: 'INVALID' }>; ok: false };

export function validatePersistedMatchEnvelope(
  value: unknown,
): EnvelopeValidation {
  if (!isRecord(value) || !Number.isInteger(value.schemaVersion)) {
    return invalid('INVALID_PERSISTED_MATCH', 'The saved match is malformed.');
  }

  if (value.schemaVersion !== PERSISTED_MATCH_SCHEMA_VERSION) {
    return invalid(
      'UNSUPPORTED_SCHEMA',
      `Saved match schema ${String(value.schemaVersion)} is not supported.`,
    );
  }

  if (
    typeof value.engineVersion !== 'string' ||
    typeof value.rulesetId !== 'string' ||
    typeof value.rulesetVersion !== 'string' ||
    typeof value.savedAt !== 'number' ||
    !Number.isFinite(value.savedAt) ||
    (value.runtime !== undefined && !isRecord(value.runtime)) ||
    !isMatchState(value.match) ||
    (value.match.status !== 'SETUP' && value.match.status !== 'ACTIVE') ||
    value.rulesetId !== value.match.rulesetId ||
    value.rulesetVersion !== value.match.rulesetVersion
  ) {
    return invalid('INVALID_PERSISTED_MATCH', 'The saved match is malformed.');
  }

  return { envelope: value as unknown as PersistedMatchEnvelope, ok: true };
}

export function getRecoveryCheckpoint(state: MatchState): RecoveryCheckpoint {
  switch (state.phase.type) {
    case 'SETUP':
    case 'ROLE_REGISTRATION':
    case 'PRE_GAME_VALIDATION':
      return 'ROLE_REGISTRATION_PLAYER_HANDOFF';
    case 'NIGHT':
      if (state.phase.subphase === 'PREPARE_QUEUE') {
        return 'NIGHT_BEFORE_ROLE_WAKE';
      }
      if (state.phase.subphase === 'RESOLUTION') {
        return 'NIGHT_AFTER_ROLE_SLEEP';
      }
      return hasCurrentTurnAction(state)
        ? 'NIGHT_AFTER_ROLE_SLEEP'
        : 'NIGHT_WAITING_FOR_ACTION';
    case 'MORNING':
    case 'DAY_DEATH_RESOLUTION':
      return 'MORNING_BEFORE_HUNTER_TRIGGER';
    case 'DISCUSSION':
      return 'DAY_DISCUSSION';
    case 'VOTING':
      return 'DAY_VOTING';
    case 'GAME_OVER':
      return 'DAY_DISCUSSION';
  }
}

function hasCurrentTurnAction(state: MatchState): boolean {
  const context = state.nightContext;
  const turn = context?.queue[context.currentTurnIndex];
  return Boolean(
    turn &&
    context?.actions.some((action) => action.actorRoleId === turn.roleId),
  );
}

function isMatchState(value: unknown): value is MatchState {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== 'string' ||
    !Number.isInteger(value.cycle) ||
    typeof value.phaseId !== 'string' ||
    typeof value.rulesetId !== 'string' ||
    typeof value.rulesetVersion !== 'string' ||
    !Number.isInteger(value.schemaVersion) ||
    !isMatchStatus(value.status) ||
    !isGamePhase(value.phase) ||
    !isRecord(value.players) ||
    !isRecord(value.roleAssignments) ||
    !isRecord(value.roleState) ||
    !isRecord(value.publicOffice) ||
    !Array.isArray(value.roleComposition) ||
    !Array.isArray(value.pendingActions) ||
    !Array.isArray(value.pendingEffects) ||
    !Array.isArray(value.pendingTriggers) ||
    !Array.isArray(value.events)
  ) {
    return false;
  }

  return Object.values(value.players).every(
    (player) =>
      isRecord(player) &&
      typeof player.playerId === 'string' &&
      typeof player.displayName === 'string' &&
      Number.isInteger(player.seatIndex) &&
      (player.lifeState === 'ALIVE' || player.lifeState === 'DEAD') &&
      Array.isArray(player.publicFlags),
  );
}

function isGamePhase(value: unknown): value is GamePhase {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'SETUP':
    case 'ROLE_REGISTRATION':
    case 'PRE_GAME_VALIDATION':
    case 'GAME_OVER':
      return true;
    case 'NIGHT':
      return (
        Number.isInteger(value.nightNumber) &&
        ['PREPARE_QUEUE', 'ROLE_TURN', 'RESOLUTION'].includes(
          String(value.subphase),
        )
      );
    case 'MORNING':
      return (
        Number.isInteger(value.dayNumber) &&
        [
          'ANNOUNCEMENT',
          'MORNING_TRIGGERS',
          'MAYOR_ELECTION',
          'READY_FOR_DISCUSSION',
        ].includes(String(value.subphase))
      );
    case 'DISCUSSION':
    case 'DAY_DEATH_RESOLUTION':
      return Number.isInteger(value.dayNumber);
    case 'VOTING':
      return Number.isInteger(value.dayNumber) && Number.isInteger(value.round);
    default:
      return false;
  }
}

function isMatchStatus(value: unknown): value is MatchStatus {
  return (
    value === 'SETUP' ||
    value === 'ACTIVE' ||
    value === 'COMPLETED' ||
    value === 'ABANDONED'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(
  code: 'UNSUPPORTED_SCHEMA' | 'INVALID_PERSISTED_MATCH',
  message: string,
): EnvelopeValidation {
  return { error: { code, message, status: 'INVALID' }, ok: false };
}
