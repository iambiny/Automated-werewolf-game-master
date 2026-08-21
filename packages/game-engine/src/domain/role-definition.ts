import type { PlayerId, RoleId } from '@werewolf/shared';

import type { MatchState } from './match-state';
import type { TeamId } from './role';

export type NightActivation = 'EVERY_NIGHT' | 'CONDITIONAL';

export interface NightRoleMetadata {
  activation: NightActivation;
  narratorAlwaysCallsIfInComposition: boolean;
  order: number;
}

export interface RoleDefinition {
  canPerformAction(state: MatchState, holderIds: PlayerId[]): boolean;
  description: string;
  hasPhysicalCard: boolean;
  id: RoleId;
  name: string;
  night?: NightRoleMetadata;
  shouldNarrateTurn(state: MatchState, holderIds: PlayerId[]): boolean;
  teamId: TeamId;
}

export type RoleCatalog = Readonly<Record<RoleId, RoleDefinition>>;
