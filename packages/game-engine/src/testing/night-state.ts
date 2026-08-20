import type { RoleId } from '@werewolf/shared';

import type { MatchState } from '../domain/match-state';
import { createMatch } from '../engine/create-match';

const PLAYERS = [
  { displayName: 'Seer', id: 'seer', roleId: 'SEER', teamId: 'VILLAGE' },
  { displayName: 'Guard', id: 'guard', roleId: 'GUARD', teamId: 'VILLAGE' },
  { displayName: 'Wolf', id: 'wolf', roleId: 'WEREWOLF', teamId: 'WEREWOLF' },
  {
    displayName: 'Demon Wolf',
    id: 'demon-wolf',
    roleId: 'DEMON_WOLF',
    teamId: 'WEREWOLF',
  },
  {
    displayName: 'Villager',
    id: 'villager',
    roleId: 'VILLAGER',
    teamId: 'VILLAGE',
  },
  { displayName: 'Witch', id: 'witch', roleId: 'WITCH', teamId: 'VILLAGE' },
  {
    displayName: 'Hunter',
    id: 'hunter',
    roleId: 'HUNTER',
    teamId: 'VILLAGE',
  },
  { displayName: 'Fool', id: 'fool', roleId: 'FOOL', teamId: 'VILLAGE' },
] as const;

export function createNightTestState(
  currentRoleId: RoleId,
  mode: 'ACTIVE' | 'DECOY' = 'ACTIVE',
): MatchState {
  const state = createMatch({
    id: 'night-test-match',
    initialPhaseId: 'setup',
    players: PLAYERS.map((player, seatIndex) => ({
      displayName: player.displayName,
      id: player.id,
      seatIndex,
    })),
    roleComposition: PLAYERS.map((player) => ({
      count: 1,
      roleId: player.roleId,
    })),
    rulesetId: 'test-rules',
    rulesetVersion: '1',
  });

  return {
    ...state,
    cycle: 1,
    nightContext: {
      actions: [],
      currentTurnIndex: 0,
      effects: [],
      nightNumber: 1,
      queue: [{ mode, order: 10, roleId: currentRoleId }],
    },
    phase: { nightNumber: 1, subphase: 'ROLE_TURN', type: 'NIGHT' },
    phaseId: 'night-1-role-turn',
    roleAssignments: Object.fromEntries(
      PLAYERS.map((player) => [
        player.id,
        {
          currentRoleId: player.roleId,
          originalRoleId: player.roleId,
          teamId: player.teamId,
        },
      ]),
    ),
    roleState: {
      'demon-wolf': {
        data: { curseAvailable: true },
        playerId: 'demon-wolf',
        roleId: 'DEMON_WOLF',
      },
      witch: {
        data: { healPotionRemaining: 1, poisonPotionRemaining: 1 },
        playerId: 'witch',
        roleId: 'WITCH',
      },
    },
    status: 'ACTIVE',
  };
}

export function setActiveNightTurn(
  state: MatchState,
  roleId: RoleId,
  mode: 'ACTIVE' | 'DECOY' = 'ACTIVE',
): MatchState {
  const context = state.nightContext;
  if (!context) throw new Error('Night test state has no night context.');

  return {
    ...state,
    nightContext: {
      ...context,
      currentTurnIndex: 0,
      queue: [{ mode, order: 10, roleId }],
    },
    phase: {
      nightNumber: context.nightNumber,
      subphase: 'ROLE_TURN',
      type: 'NIGHT',
    },
  };
}

export function setNightResolutionPhase(state: MatchState): MatchState {
  const context = state.nightContext;
  if (!context) throw new Error('Night test state has no night context.');

  return {
    ...state,
    phase: {
      nightNumber: context.nightNumber,
      subphase: 'RESOLUTION',
      type: 'NIGHT',
    },
    phaseId: `night-${context.nightNumber}-resolution`,
  };
}

export function markTestPlayerDead(
  state: MatchState,
  playerId: string,
): MatchState {
  const player = state.players[playerId];
  if (!player) throw new Error(`Unknown test player: ${playerId}`);

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        death: {
          announced: false,
          causes: ['OTHER'],
          phaseId: state.phaseId,
        },
        lifeState: 'DEAD',
      },
    },
  };
}
