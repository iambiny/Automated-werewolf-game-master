import {
  completeRoleRegistration,
  registerRole,
  resetRoleRegistration,
  startFirstNight,
  transitionPhase,
  type EngineResult,
  type MatchState,
} from '@werewolf/game-engine';
import {
  createMvpRoleRuntimeState,
  mvpRoleCatalog,
  type MvpRoleId,
  type MvpRuleConfig,
} from '@werewolf/role-catalog';

import type {
  GameCommand,
  GameCommandExecutor,
} from '../../application/game-controller/game-controller';

interface RegisterRolePayload {
  playerId: string;
  roleId: MvpRoleId;
}

export function createSetupCommandExecutor(
  getRules: () => MvpRuleConfig,
): GameCommandExecutor {
  return (state, command) => executeSetupCommand(state, command, getRules());
}

function executeSetupCommand(
  state: MatchState,
  command: GameCommand,
  rules: MvpRuleConfig,
): EngineResult {
  switch (command.type) {
    case 'BEGIN_ROLE_REGISTRATION':
      return transitionPhase(state, {
        phase: { type: 'ROLE_REGISTRATION' },
        phaseId: 'role-registration',
      });
    case 'REGISTER_ROLE': {
      const payload = command.payload as RegisterRolePayload;
      return registerRole(
        state,
        {
          ...payload,
          roleState: createMvpRoleRuntimeState(
            payload.playerId,
            payload.roleId,
            rules,
          ),
        },
        mvpRoleCatalog,
      );
    }
    case 'COMPLETE_ROLE_REGISTRATION':
      return completeRoleRegistration(state, 'pre-game-validation');
    case 'RESET_ROLE_REGISTRATION':
      return resetRoleRegistration(state);
    case 'START_FIRST_NIGHT':
      return startFirstNight(state, 'night-1-prepare', mvpRoleCatalog);
    default:
      return {
        error: {
          code: 'INVALID_MATCH_INPUT',
          message: `Unsupported setup command: ${command.type}`,
        },
        ok: false,
        state,
      };
  }
}
