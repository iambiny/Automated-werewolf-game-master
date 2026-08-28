import {
  buildNightQueue,
  createMatch,
  type MatchState,
  type RoleAssignment,
} from '@werewolf/game-engine';
import { describe, expect, it } from 'vitest';

import { mvpRoleCatalog } from './catalog';
import { MVP_PUBLIC_OFFICE_IDS, MVP_ROLE_IDS, type MvpRoleId } from './ids';
import { createMvpRoleRuntimeState } from './rules';

const ROLE_TEAMS: Record<MvpRoleId, RoleAssignment['teamId']> = {
  DEMON_WOLF: 'WEREWOLF',
  FOOL: 'FOOL',
  GUARD: 'VILLAGE',
  HYBRID_WOLF: 'VILLAGE',
  HUNTER: 'VILLAGE',
  SEER: 'VILLAGE',
  VILLAGER: 'VILLAGE',
  WEREWOLF: 'WEREWOLF',
  WITCH: 'VILLAGE',
};

function playerId(roleId: MvpRoleId): string {
  return `player-${roleId.toLowerCase()}`;
}

function makeMatch(): MatchState {
  const players = MVP_ROLE_IDS.map((roleId, seatIndex) => ({
    displayName: roleId,
    id: playerId(roleId),
    seatIndex,
  }));

  const state = createMatch({
    id: 'match-pr-03',
    initialPhaseId: 'phase-setup',
    players,
    roleComposition: MVP_ROLE_IDS.map((roleId) => ({ count: 1, roleId })),
    rulesetId: 'boardgameviet-vn',
    rulesetVersion: '1.0.0',
  });

  return {
    ...state,
    roleAssignments: Object.fromEntries(
      MVP_ROLE_IDS.map((roleId) => [
        playerId(roleId),
        {
          currentRoleId: roleId,
          originalRoleId: roleId,
          teamId: ROLE_TEAMS[roleId],
        },
      ]),
    ),
    roleState: {
      [playerId('DEMON_WOLF')]: {
        data: { curseAvailable: true },
        playerId: playerId('DEMON_WOLF'),
        roleId: 'DEMON_WOLF',
      },
      [playerId('WITCH')]: {
        data: { healPotionRemaining: 1, poisonPotionRemaining: 1 },
        playerId: playerId('WITCH'),
        roleId: 'WITCH',
      },
    },
  };
}

function markDead(state: MatchState, roleId: MvpRoleId): MatchState {
  const id = playerId(roleId);
  const player = state.players[id];
  if (!player) throw new Error(`Missing ${roleId} fixture player.`);

  return {
    ...state,
    players: {
      ...state.players,
      [id]: {
        ...player,
        death: {
          announced: true,
          causes: ['OTHER'],
          phaseId: 'fixture-death',
        },
        lifeState: 'DEAD',
      },
    },
  };
}

function modeFor(state: MatchState, roleId: MvpRoleId) {
  return buildNightQueue(state, mvpRoleCatalog).find(
    (turn) => turn.roleId === roleId,
  )?.mode;
}

describe('MVP role catalog', () => {
  it('defines the complete physical role and public-office IDs', () => {
    expect(Object.keys(mvpRoleCatalog)).toEqual([...MVP_ROLE_IDS]);
    expect(MVP_PUBLIC_OFFICE_IDS).toEqual(['MAYOR']);
    expect(
      Object.values(mvpRoleCatalog).every((role) => role.hasPhysicalCard),
    ).toBe(true);
  });

  it('initializes fixed and configured consumable role state', () => {
    const rules = {
      witch: {
        allowHealAndPoisonSameNight: false,
        allowSelfHeal: false,
        allowSelfPoison: false,
        healPotionCount: 2,
        poisonPotionCount: 3,
        seesWerewolfVictim: true,
      },
    };

    expect(createMvpRoleRuntimeState('demon', 'DEMON_WOLF', rules)).toEqual({
      data: { curseAvailable: true },
      playerId: 'demon',
      roleId: 'DEMON_WOLF',
    });
    expect(createMvpRoleRuntimeState('hybrid', 'HYBRID_WOLF', rules)).toEqual({
      data: { converted: false },
      playerId: 'hybrid',
      roleId: 'HYBRID_WOLF',
    });
    expect(createMvpRoleRuntimeState('witch', 'WITCH', rules)).toEqual({
      data: { healPotionRemaining: 2, poisonPotionRemaining: 3 },
      playerId: 'witch',
      roleId: 'WITCH',
    });
  });

  it('builds the metadata-driven MVP night order', () => {
    const queue = buildNightQueue(makeMatch(), mvpRoleCatalog);

    expect(queue).toEqual([
      { mode: 'ACTIVE', order: 10, roleId: 'SEER' },
      { mode: 'ACTIVE', order: 20, roleId: 'GUARD' },
      { mode: 'ACTIVE', order: 30, roleId: 'WEREWOLF' },
      { mode: 'ACTIVE', order: 40, roleId: 'DEMON_WOLF' },
      { mode: 'DECOY', order: 45, roleId: 'HYBRID_WOLF' },
      { mode: 'ACTIVE', order: 50, roleId: 'WITCH' },
    ]);
  });

  it.each(['SEER', 'GUARD'] as const)(
    'keeps a dead %s narrated as DECOY',
    (roleId) => {
      const state = markDead(makeMatch(), roleId);

      expect(modeFor(state, roleId)).toBe('DECOY');
    },
  );

  it('keeps a consumed Demon Wolf turn narrated as DECOY', () => {
    const state = makeMatch();
    const id = playerId('DEMON_WOLF');
    const consumed: MatchState = {
      ...state,
      roleState: {
        ...state.roleState,
        [id]: {
          data: { curseAvailable: false },
          playerId: id,
          roleId: 'DEMON_WOLF',
        },
      },
    };

    expect(modeFor(consumed, 'DEMON_WOLF')).toBe('DECOY');
  });

  it('keeps the Hybrid Wolf private turn after conversion', () => {
    const state = makeMatch();
    const id = playerId('HYBRID_WOLF');
    const converted: MatchState = {
      ...state,
      roleAssignments: {
        ...state.roleAssignments,
        [id]: {
          converted: true,
          currentRoleId: 'WEREWOLF',
          originalRoleId: 'HYBRID_WOLF',
          teamId: 'WEREWOLF',
        },
      },
    };

    expect(modeFor(converted, 'HYBRID_WOLF')).toBe('DECOY');
    expect(modeFor(converted, 'WEREWOLF')).toBe('ACTIVE');
  });

  it('keeps an exhausted Witch turn narrated as DECOY', () => {
    const state = makeMatch();
    const id = playerId('WITCH');
    const exhausted: MatchState = {
      ...state,
      roleState: {
        ...state.roleState,
        [id]: {
          data: { healPotionRemaining: 0, poisonPotionRemaining: 0 },
          playerId: id,
          roleId: 'WITCH',
        },
      },
    };

    expect(modeFor(exhausted, 'WITCH')).toBe('DECOY');
  });

  it.each(['SEER', 'GUARD', 'WITCH'] as const)(
    'keeps a cursed %s turn narrated but disables its ability',
    (roleId) => {
      const state = makeMatch();
      const id = playerId(roleId);
      const existing = state.roleState[id];
      const cursed: MatchState = {
        ...state,
        events: [...state.events, { playerId: id, type: 'PLAYER_CURSED' }],
        roleState: {
          ...state.roleState,
          [id]: {
            data: { ...existing?.data, cursed: true },
            playerId: id,
            roleId,
          },
        },
      };

      expect(modeFor(cursed, roleId)).toBe('DECOY');
    },
  );

  it('keeps a dead Demon Wolf and dead Witch narrated as DECOY', () => {
    const state = markDead(markDead(makeMatch(), 'DEMON_WOLF'), 'WITCH');

    expect(modeFor(state, 'DEMON_WOLF')).toBe('DECOY');
    expect(modeFor(state, 'WITCH')).toBe('DECOY');
  });

  it('omits roles absent from the original composition', () => {
    const state = makeMatch();
    const withoutSeer: MatchState = {
      ...state,
      roleComposition: state.roleComposition.filter(
        (entry) => entry.roleId !== 'SEER',
      ),
    };

    expect(
      buildNightQueue(withoutSeer, mvpRoleCatalog).some(
        (turn) => turn.roleId === 'SEER',
      ),
    ).toBe(false);
  });

  it('narrates the shared Werewolf turn when only Demon Wolf is configured', () => {
    const state = makeMatch();
    const demonOnly: MatchState = {
      ...state,
      roleComposition: [{ count: 1, roleId: 'DEMON_WOLF' }],
    };
    const queue = buildNightQueue(demonOnly, mvpRoleCatalog);

    expect(queue.map((turn) => turn.roleId)).toEqual([
      'WEREWOLF',
      'DEMON_WOLF',
    ]);
    expect(queue.every((turn) => turn.mode === 'ACTIVE')).toBe(true);
  });

  it('does not mutate match state while deriving the queue', () => {
    const state = makeMatch();
    const snapshot = JSON.parse(JSON.stringify(state));

    buildNightQueue(state, mvpRoleCatalog);

    expect(state).toEqual(snapshot);
  });
});
