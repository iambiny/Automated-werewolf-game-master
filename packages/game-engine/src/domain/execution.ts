import type { PlayerId, RoleId } from '@werewolf/shared';

import type { MatchState } from './match-state';

export type ExecutionInterceptionResult =
  | { type: 'DIE' }
  | { publicFlags: string[]; type: 'SURVIVE' }
  | { type: 'WIN' };

export interface ExecutionInterceptor {
  intercept(
    state: MatchState,
    targetPlayerId: PlayerId,
  ): ExecutionInterceptionResult;
  roleId: RoleId;
}
