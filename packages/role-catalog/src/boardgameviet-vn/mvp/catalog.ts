import type {
  MatchState,
  PlayerId,
  RoleCatalog,
  RoleDefinition,
  RoleId,
} from '@werewolf/game-engine';
import { isPlayerCursed } from '@werewolf/game-engine';

import type { MvpRoleId } from './ids';

const passiveRoleBehavior = {
  canPerformAction: () => false,
  shouldNarrateTurn: () => false,
};

export const mvpRoleCatalog = {
  VILLAGER: {
    ...passiveRoleBehavior,
    description: 'A Village-aligned player with no special night action.',
    hasPhysicalCard: true,
    id: 'VILLAGER',
    name: 'Villager / Dân làng',
    teamId: 'VILLAGE',
  },
  SEER: {
    canPerformAction: hasLivingHolder,
    description: 'Inspects one living player during the night.',
    hasPhysicalCard: true,
    id: 'SEER',
    name: 'Seer / Tiên tri',
    night: {
      activation: 'EVERY_NIGHT',
      narratorAlwaysCallsIfInComposition: true,
      order: 10,
    },
    shouldNarrateTurn: narrateWhenConfigured('SEER'),
    teamId: 'VILLAGE',
  },
  GUARD: {
    canPerformAction: hasLivingHolder,
    description: 'Protects one living player during the night.',
    hasPhysicalCard: true,
    id: 'GUARD',
    name: 'Guard / Bảo vệ',
    night: {
      activation: 'EVERY_NIGHT',
      narratorAlwaysCallsIfInComposition: true,
      order: 20,
    },
    shouldNarrateTurn: narrateWhenConfigured('GUARD'),
    teamId: 'VILLAGE',
  },
  WEREWOLF: {
    canPerformAction: hasLivingWerewolfAlignedPlayer,
    description: 'Participates in the shared Werewolf attack selection.',
    hasPhysicalCard: true,
    id: 'WEREWOLF',
    name: 'Werewolf / Ma sói',
    night: {
      activation: 'EVERY_NIGHT',
      narratorAlwaysCallsIfInComposition: true,
      order: 30,
    },
    shouldNarrateTurn: narrateWerewolfGroup,
    teamId: 'WEREWOLF',
  },
  DEMON_WOLF: {
    canPerformAction: hasLivingDemonWolfWithCurse,
    description:
      'Joins the Werewolf attack and may curse that attack target once.',
    hasPhysicalCard: true,
    id: 'DEMON_WOLF',
    name: 'Demon Wolf / Sói quỷ',
    night: {
      activation: 'EVERY_NIGHT',
      narratorAlwaysCallsIfInComposition: true,
      order: 40,
    },
    shouldNarrateTurn: narrateWhenConfigured('DEMON_WOLF'),
    teamId: 'WEREWOLF',
  },
  WITCH: {
    canPerformAction: hasLivingWitchWithPotion,
    description: 'May use limited healing and poison potions at night.',
    hasPhysicalCard: true,
    id: 'WITCH',
    name: 'Witch / Phù thủy',
    night: {
      activation: 'EVERY_NIGHT',
      narratorAlwaysCallsIfInComposition: true,
      order: 50,
    },
    shouldNarrateTurn: narrateWhenConfigured('WITCH'),
    teamId: 'VILLAGE',
  },
  HUNTER: {
    ...passiveRoleBehavior,
    description: 'Receives a rule-driven shot trigger after an eligible death.',
    hasPhysicalCard: true,
    id: 'HUNTER',
    name: 'Hunter / Thợ săn',
    teamId: 'VILLAGE',
  },
  FOOL: {
    ...passiveRoleBehavior,
    description: 'Uses a rule-driven interception when selected for execution.',
    hasPhysicalCard: true,
    id: 'FOOL',
    name: 'Fool / Kẻ ngốc',
    teamId: 'FOOL',
  },
} as const satisfies RoleCatalog & Record<MvpRoleId, RoleDefinition>;

function narrateWhenConfigured(
  roleId: MvpRoleId,
): RoleDefinition['shouldNarrateTurn'] {
  return (state) => isRoleConfigured(state, roleId);
}

function narrateWerewolfGroup(state: MatchState): boolean {
  return (
    isRoleConfigured(state, 'WEREWOLF') || isRoleConfigured(state, 'DEMON_WOLF')
  );
}

function isRoleConfigured(state: MatchState, roleId: RoleId): boolean {
  return state.roleComposition.some(
    (entry) => entry.roleId === roleId && entry.count > 0,
  );
}

function hasLivingHolder(state: MatchState, holderIds: PlayerId[]): boolean {
  return holderIds.some(
    (playerId) =>
      state.players[playerId]?.lifeState === 'ALIVE' &&
      !isPlayerCursed(state, playerId),
  );
}

function hasLivingWerewolfAlignedPlayer(state: MatchState): boolean {
  return Object.entries(state.roleAssignments).some(
    ([playerId, assignment]) =>
      assignment.teamId === 'WEREWOLF' &&
      state.players[playerId]?.lifeState === 'ALIVE',
  );
}

function hasLivingDemonWolfWithCurse(
  state: MatchState,
  holderIds: PlayerId[],
): boolean {
  return holderIds.some(
    (playerId) =>
      state.players[playerId]?.lifeState === 'ALIVE' &&
      state.roleState[playerId]?.data.curseAvailable === true,
  );
}

function hasLivingWitchWithPotion(
  state: MatchState,
  holderIds: PlayerId[],
): boolean {
  return holderIds.some((playerId) => {
    if (state.players[playerId]?.lifeState !== 'ALIVE') return false;
    if (isPlayerCursed(state, playerId)) return false;

    const data = state.roleState[playerId]?.data;
    const healPotionRemaining = data?.healPotionRemaining;
    const poisonPotionRemaining = data?.poisonPotionRemaining;

    return (
      (typeof healPotionRemaining === 'number' && healPotionRemaining > 0) ||
      (typeof poisonPotionRemaining === 'number' && poisonPotionRemaining > 0)
    );
  });
}
