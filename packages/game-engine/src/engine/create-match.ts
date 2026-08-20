import type { MatchId, PhaseId, PlayerId } from '@werewolf/shared';

import type { MatchState } from '../domain/match-state';
import type { RoleCompositionEntry } from '../domain/role';

export interface CreateMatchPlayerInput {
  displayName: string;
  id: PlayerId;
  seatIndex: number;
}

export interface CreateMatchInput {
  id: MatchId;
  initialPhaseId: PhaseId;
  players: CreateMatchPlayerInput[];
  roleComposition: RoleCompositionEntry[];
  rulesetId: string;
  rulesetVersion: string;
  schemaVersion?: number;
}

export function createMatch(input: CreateMatchInput): MatchState {
  const players = Object.fromEntries(
    input.players.map((player) => [
      player.id,
      {
        displayName: player.displayName,
        lifeState: 'ALIVE' as const,
        playerId: player.id,
        seatIndex: player.seatIndex,
      },
    ]),
  );

  return {
    cycle: 0,
    events: [{ type: 'MATCH_CREATED', matchId: input.id }],
    id: input.id,
    pendingActions: [],
    pendingEffects: [],
    pendingTriggers: [],
    phase: { type: 'SETUP' },
    phaseId: input.initialPhaseId,
    players,
    publicOffice: {
      mayorElectionCompleted: false,
    },
    roleAssignments: {},
    roleComposition: input.roleComposition.map((entry) => ({ ...entry })),
    roleState: {},
    rulesetId: input.rulesetId,
    rulesetVersion: input.rulesetVersion,
    schemaVersion: input.schemaVersion ?? 1,
    status: 'SETUP',
  };
}
