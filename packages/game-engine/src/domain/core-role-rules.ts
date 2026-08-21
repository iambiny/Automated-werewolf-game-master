import type { RoleId } from '@werewolf/shared';

import type { DeathCause } from './player';
import type { TeamId } from './role';

export type SeerInvestigationMode = 'TEAM' | 'ROLE';

export type InvestigationValue =
  { mode: 'TEAM'; teamId: TeamId } | { mode: 'ROLE'; roleId: RoleId };

export interface SeerRules {
  allowSelfInspect: boolean;
  investigationMode: SeerInvestigationMode;
}

export interface GuardRules {
  allowSameTargetConsecutiveNights: boolean;
  allowSelfProtect: boolean;
}

export interface WerewolfRules {
  allowNoAttack: boolean;
  selectionStrategy: 'SHARED_SELECTION';
}

export type DemonWolfCurseDecision = 'CURSE' | 'SKIP';

export interface WitchRules {
  allowHealAndPoisonSameNight: boolean;
  allowSelfHeal: boolean;
  allowSelfPoison: boolean;
  healPotionCount: number;
  poisonPotionCount: number;
  seesWerewolfVictim: boolean;
}

export interface HunterRules {
  eligibleShotCauses: DeathCause[];
}

export type FoolExecutionBehavior =
  'DIES_NORMALLY' | 'SURVIVES_FIRST_EXECUTION_LOSES_VOTE';

export interface FoolRules {
  executionBehavior: FoolExecutionBehavior;
}

export interface MayorRules {
  electionDay: number;
  executionVoteWeight: number;
  officeOnDeath: 'VACANT';
}

export interface NightResolutionRules {
  healPreventsCurse: boolean;
  hunter: HunterRules;
  mayor: MayorRules;
}

export type TiePolicy = 'NO_ELIMINATION' | 'REVOTE';

export interface WinRules {
  werewolfCondition: 'PARITY';
}
