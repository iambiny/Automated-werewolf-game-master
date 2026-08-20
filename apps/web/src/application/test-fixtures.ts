import { createMatch, type MatchState } from '@werewolf/game-engine';

export function makeMatchState(): MatchState {
  return createMatch({
    id: 'match-1',
    initialPhaseId: 'phase-setup',
    players: [
      { displayName: 'An', id: 'player-1', seatIndex: 0 },
      { displayName: 'Binh', id: 'player-2', seatIndex: 1 },
      { displayName: 'Chi', id: 'player-3', seatIndex: 2 },
    ],
    roleComposition: [
      { count: 1, roleId: 'SEER' },
      { count: 1, roleId: 'WEREWOLF' },
      { count: 1, roleId: 'VILLAGER' },
    ],
    rulesetId: 'boardgameviet-vn',
    rulesetVersion: '1.0.0',
  });
}

export function makeSecretNightState(): MatchState {
  const state = makeMatchState();
  return {
    ...state,
    cycle: 1,
    nightContext: {
      actions: [
        {
          actorPlayerIds: ['player-1'],
          actorRoleId: 'SEER',
          id: 'action-1',
          phaseId: 'phase-night-role',
          targetPlayerIds: ['player-2'],
          type: 'SEER_INSPECT',
        },
      ],
      currentTurnIndex: 0,
      effects: [
        {
          payload: { mode: 'ROLE', roleId: 'WEREWOLF' },
          sourcePlayerIds: ['player-1'],
          sourceRoleId: 'SEER',
          targetPlayerIds: ['player-2'],
          type: 'INVESTIGATION_RESULT',
          visibility: 'PRIVATE',
        },
      ],
      nightNumber: 1,
      queue: [{ mode: 'ACTIVE', order: 10, roleId: 'SEER' }],
      werewolfAttackTargetId: 'player-3',
    },
    pendingActions: [],
    pendingEffects: [],
    phase: { nightNumber: 1, subphase: 'ROLE_TURN', type: 'NIGHT' },
    phaseId: 'phase-night-role',
    roleAssignments: {
      'player-1': {
        currentRoleId: 'SEER',
        originalRoleId: 'SEER',
        teamId: 'VILLAGE',
      },
      'player-2': {
        currentRoleId: 'WEREWOLF',
        originalRoleId: 'WEREWOLF',
        teamId: 'WEREWOLF',
      },
      'player-3': {
        currentRoleId: 'VILLAGER',
        originalRoleId: 'VILLAGER',
        teamId: 'VILLAGE',
      },
    },
    roleState: {
      'player-3': {
        data: { healPotionRemaining: true, poisonPotionRemaining: true },
        playerId: 'player-3',
        roleId: 'WITCH',
      },
    },
    status: 'ACTIVE',
  };
}
