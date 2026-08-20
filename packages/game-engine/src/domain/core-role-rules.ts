import type { RoleId } from '@werewolf/shared';

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
