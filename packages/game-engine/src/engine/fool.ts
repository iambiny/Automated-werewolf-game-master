import type { ExecutionInterceptor } from '../domain/execution';
import type { FoolRules } from '../domain/core-role-rules';

export const FOOL_NO_VOTE_FLAG = 'FOOL_REVEALED_NO_VOTE';

export function createFoolExecutionInterceptor(
  rules: FoolRules,
): ExecutionInterceptor {
  return {
    intercept(state, targetPlayerId) {
      if (rules.executionBehavior === 'DIES_NORMALLY') {
        return { type: 'DIE' };
      }

      const flags = state.players[targetPlayerId]?.publicFlags ?? [];
      if (flags.includes(FOOL_NO_VOTE_FLAG)) return { type: 'DIE' };

      return {
        publicFlags: [...flags, FOOL_NO_VOTE_FLAG],
        type: 'SURVIVE',
      };
    },
    roleId: 'FOOL',
  };
}
