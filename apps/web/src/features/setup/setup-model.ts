import type {
  FoolExecutionBehavior,
  JsonObject,
  RoleCompositionEntry,
} from '@werewolf/game-engine';
import type { MvpRoleId, MvpRuleConfig } from '@werewolf/role-catalog';
import { MVP_ROLE_IDS } from '@werewolf/role-catalog';

import { getRoleLabels } from '../multi-language/multi-language';

export interface PlayerDraft {
  id: string;
  name: string;
}

export type RoleCounts = Record<MvpRoleId, number>;

export interface SetupRules {
  deathRevealPolicy: 'NONE' | 'ROLE' | 'TEAM';
  discussionTimerSeconds: number;
  foolExecutionBehavior: FoolExecutionBehavior;
  guardAllowConsecutiveTarget: boolean;
  guardAllowSelfProtect: boolean;
  nightTransitionSeconds: number;
  roleTimerSeconds: number;
  seerMode: 'ROLE' | 'TEAM';
  witchAllowHealAndPoison: boolean;
  witchAllowSelfHeal: boolean;
  witchSeesVictim: boolean;
}

export const ROLE_LABELS = getRoleLabels('en');

export const DEFAULT_PLAYERS: PlayerDraft[] = Array.from(
  { length: 8 },
  (_, index) => ({ id: `player-${index + 1}`, name: `Player ${index + 1}` }),
);

export const DEFAULT_ROLE_COUNTS: RoleCounts = {
  DEMON_WOLF: 0,
  FOOL: 0,
  GUARD: 1,
  HYBRID_WOLF: 0,
  HUNTER: 1,
  SEER: 1,
  VILLAGER: 2,
  WEREWOLF: 2,
  WITCH: 1,
};

export const DEFAULT_SETUP_RULES: SetupRules = {
  deathRevealPolicy: 'ROLE',
  discussionTimerSeconds: 300,
  foolExecutionBehavior: 'SURVIVES_FIRST_EXECUTION_LOSES_VOTE',
  guardAllowConsecutiveTarget: false,
  guardAllowSelfProtect: true,
  nightTransitionSeconds: 5,
  roleTimerSeconds: 45,
  seerMode: 'TEAM',
  witchAllowHealAndPoison: false,
  witchAllowSelfHeal: true,
  witchSeesVictim: true,
};

export function validatePlayers(players: PlayerDraft[]): string | null {
  if (players.length === 0) return 'Add at least one player.';
  if (players.some((player) => player.name.trim().length === 0)) {
    return 'Every player needs a name.';
  }

  const normalized = players.map((player) => normalizeName(player.name));
  if (new Set(normalized).size !== normalized.length) {
    return 'Player names must be unique.';
  }

  return null;
}

export function validateRoleCounts(
  counts: RoleCounts,
  playerCount: number,
): string | null {
  const roleCount = MVP_ROLE_IDS.reduce(
    (total, roleId) => total + counts[roleId],
    0,
  );
  return roleCount === playerCount
    ? null
    : `Your deck has ${roleCount} cards for ${playerCount} players.`;
}

export function toRoleComposition(counts: RoleCounts): RoleCompositionEntry[] {
  return MVP_ROLE_IDS.filter((roleId) => counts[roleId] > 0).map((roleId) => ({
    count: counts[roleId],
    roleId,
  }));
}

export function toMvpRuleConfig(rules: SetupRules): MvpRuleConfig {
  return {
    fool: {
      executionBehavior: rules.foolExecutionBehavior,
    },
    guard: {
      allowSameTargetConsecutiveNights: rules.guardAllowConsecutiveTarget,
      allowSelfProtect: rules.guardAllowSelfProtect,
    },
    hunter: {
      eligibleShotCauses: ['WEREWOLF_ATTACK', 'WITCH_POISON', 'DAY_EXECUTION'],
    },
    mayor: {
      electionDay: 1,
      executionVoteWeight: 2,
      officeOnDeath: 'VACANT',
    },
    nightResolution: { healPreventsCurse: true },
    seer: {
      allowSelfInspect: false,
      investigationMode: rules.seerMode,
    },
    tiePolicy: 'REVOTE',
    werewolf: {
      allowNoAttack: true,
      selectionStrategy: 'SHARED_SELECTION',
    },
    win: { werewolfCondition: 'PARITY' },
    witch: {
      allowHealAndPoisonSameNight: rules.witchAllowHealAndPoison,
      allowSelfHeal: rules.witchAllowSelfHeal,
      allowSelfPoison: false,
      healPotionCount: 1,
      poisonPotionCount: 1,
      seesWerewolfVictim: rules.witchSeesVictim,
    },
  };
}

export function serializeSetupRules(rules: SetupRules): JsonObject {
  return { ...rules };
}

export function parseSetupRules(value: JsonObject | null): SetupRules {
  if (!value) return DEFAULT_SETUP_RULES;
  return {
    deathRevealPolicy:
      value.deathRevealPolicy === 'NONE' ||
      value.deathRevealPolicy === 'ROLE' ||
      value.deathRevealPolicy === 'TEAM'
        ? value.deathRevealPolicy
        : DEFAULT_SETUP_RULES.deathRevealPolicy,
    discussionTimerSeconds: numberOr(
      value.discussionTimerSeconds,
      DEFAULT_SETUP_RULES.discussionTimerSeconds,
    ),
    foolExecutionBehavior: parseFoolExecutionBehavior(value),
    guardAllowConsecutiveTarget: booleanOr(
      value.guardAllowConsecutiveTarget,
      DEFAULT_SETUP_RULES.guardAllowConsecutiveTarget,
    ),
    guardAllowSelfProtect: booleanOr(
      value.guardAllowSelfProtect,
      DEFAULT_SETUP_RULES.guardAllowSelfProtect,
    ),
    nightTransitionSeconds: numberOr(
      value.nightTransitionSeconds,
      DEFAULT_SETUP_RULES.nightTransitionSeconds,
    ),
    roleTimerSeconds: numberOr(
      value.roleTimerSeconds,
      DEFAULT_SETUP_RULES.roleTimerSeconds,
    ),
    seerMode:
      value.seerMode === 'ROLE' || value.seerMode === 'TEAM'
        ? value.seerMode
        : DEFAULT_SETUP_RULES.seerMode,
    witchAllowHealAndPoison: booleanOr(
      value.witchAllowHealAndPoison,
      DEFAULT_SETUP_RULES.witchAllowHealAndPoison,
    ),
    witchAllowSelfHeal: booleanOr(
      value.witchAllowSelfHeal,
      DEFAULT_SETUP_RULES.witchAllowSelfHeal,
    ),
    witchSeesVictim: booleanOr(
      value.witchSeesVictim,
      DEFAULT_SETUP_RULES.witchSeesVictim,
    ),
  };
}

function parseFoolExecutionBehavior(value: JsonObject): FoolExecutionBehavior {
  if (
    value.foolExecutionBehavior === 'DIES_NORMALLY' ||
    value.foolExecutionBehavior === 'SURVIVES_FIRST_EXECUTION_LOSES_VOTE' ||
    value.foolExecutionBehavior === 'WINS_WHEN_EXECUTED'
  ) {
    return value.foolExecutionBehavior;
  }

  // Migrate settings saved by versions that exposed this as a toggle.
  if (typeof value.foolSurvivesFirstExecution === 'boolean') {
    return value.foolSurvivesFirstExecution
      ? 'SURVIVES_FIRST_EXECUTION_LOSES_VOTE'
      : 'DIES_NORMALLY';
  }

  return DEFAULT_SETUP_RULES.foolExecutionBehavior;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
