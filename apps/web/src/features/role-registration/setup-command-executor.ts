import {
  advanceNightTurn,
  announcePendingDeaths,
  appointMayorSuccessor,
  castVote,
  completeRoleRegistration,
  declareWinner,
  evaluateWinner,
  registerRole,
  resolveNight,
  resolveVote,
  resetRoleRegistration,
  startNightRoleTurns,
  startDayExecutionVote,
  startFirstNight,
  startMayorElection,
  startNextNight,
  submitDemonWolfCurseDecision,
  submitGuardProtection,
  submitHunterShot,
  submitNightPass,
  submitSeerInspection,
  submitWerewolfAttack,
  submitWitchHeal,
  submitWitchPoison,
  transitionPhase,
  type EngineResult,
  type MatchState,
} from '@werewolf/game-engine';
import {
  createMvpExecutionInterceptors,
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

interface TargetActionPayload {
  actionId: string;
  targetPlayerId: string;
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
    case 'START_NIGHT_ROLE_TURNS':
      return startNightRoleTurns(state, `night-${state.cycle}-turn-0`);
    case 'SUBMIT_SEER_TARGET':
      return submitSeerInspection(
        state,
        command.payload as TargetActionPayload,
        rules.seer,
      );
    case 'SUBMIT_GUARD_TARGET':
      return submitGuardProtection(
        state,
        command.payload as TargetActionPayload,
        rules.guard,
      );
    case 'SUBMIT_WEREWOLF_TARGET': {
      const payload = command.payload as {
        actionId: string;
        targetPlayerId: string | null;
      };
      return submitWerewolfAttack(state, payload, rules.werewolf);
    }
    case 'SUBMIT_DEMON_WOLF_CURSE':
      return submitDemonWolfCurseDecision(
        state,
        command.payload as {
          actionId: string;
          decision: 'CURSE' | 'SKIP';
        },
      );
    case 'SUBMIT_WITCH_HEAL': {
      const targetPlayerId = state.nightContext?.werewolfAttackTargetId;
      return submitWitchHeal(
        state,
        {
          actionId: (command.payload as { actionId: string }).actionId,
          targetPlayerId: targetPlayerId ?? '',
        },
        rules.witch,
      );
    }
    case 'SUBMIT_WITCH_POISON':
      return submitWitchPoison(
        state,
        command.payload as TargetActionPayload,
        rules.witch,
      );
    case 'PASS_NIGHT_TURN':
      return submitNightPass(
        state,
        command.payload as {
          actionId: string;
          reason: 'MANUAL' | 'TIMEOUT';
        },
      );
    case 'ADVANCE_NIGHT_TURN':
      return advanceNightTurn(
        state,
        `night-${state.cycle}-turn-${(state.nightContext?.currentTurnIndex ?? 0) + 1}`,
      );
    case 'RESOLVE_NIGHT':
      return resolveNight(state, {
        ...rules.nightResolution,
        hunter: rules.hunter,
        mayor: rules.mayor,
      });
    case 'REACH_DAWN':
      if (!state.nightContext?.resolution) {
        return {
          error: {
            code: 'ACTION_NOT_AVAILABLE',
            message: 'Dawn is not available until night resolution completes.',
          },
          ok: false,
          state,
        };
      }
      return transitionPhase(state, {
        phase: {
          dayNumber: state.cycle,
          subphase: 'ANNOUNCEMENT',
          type: 'MORNING',
        },
        phaseId: `morning-${state.cycle}-announcement`,
      });
    case 'ANNOUNCE_DEATHS':
      return announcePendingDeaths(state);
    case 'ENTER_MORNING_TRIGGERS':
      return transitionPhase(state, {
        phase: {
          dayNumber: state.cycle,
          subphase: 'MORNING_TRIGGERS',
          type: 'MORNING',
        },
        phaseId: `morning-${state.cycle}-triggers`,
      });
    case 'SUBMIT_HUNTER_SHOT':
      return submitHunterShot(state, command.payload as TargetActionPayload, {
        hunter: rules.hunter,
        mayor: rules.mayor,
      });
    case 'CHECK_WINNER':
      return evaluateWinner(state, rules.win)
        ? declareWinner(state, rules.win)
        : { events: [], ok: true, state };
    case 'ENTER_GAME_OVER':
      return transitionPhase(state, {
        phase: { type: 'GAME_OVER' },
        phaseId: 'game-over',
      });
    case 'ENTER_MAYOR_ELECTION':
      return transitionPhase(state, {
        phase: {
          dayNumber: state.cycle,
          subphase: 'MAYOR_ELECTION',
          type: 'MORNING',
        },
        phaseId: `morning-${state.cycle}-mayor-election`,
      });
    case 'START_MAYOR_ELECTION':
      return startMayorElection(state, rules.mayor);
    case 'APPOINT_MAYOR_SUCCESSOR':
      return appointMayorSuccessor(
        state,
        (command.payload as { playerId: string }).playerId,
      );
    case 'CAST_VOTE':
      return castVote(
        state,
        command.payload as { targetPlayerId: string | null; voterId: string },
      );
    case 'RESOLVE_VOTE':
      return resolveVote(state, {
        executionInterceptors: createMvpExecutionInterceptors(rules),
        hunter: rules.hunter,
        mayor: rules.mayor,
        tiePolicy: rules.tiePolicy,
      });
    case 'ENTER_READY_FOR_DISCUSSION':
      return transitionPhase(state, {
        phase: {
          dayNumber: state.cycle,
          subphase: 'READY_FOR_DISCUSSION',
          type: 'MORNING',
        },
        phaseId: `morning-${state.cycle}-ready`,
      });
    case 'START_DISCUSSION':
      return transitionPhase(state, {
        phase: { dayNumber: state.cycle, type: 'DISCUSSION' },
        phaseId: `day-${state.cycle}-discussion`,
      });
    case 'ENTER_DAY_VOTING':
      return transitionPhase(state, {
        phase: { dayNumber: state.cycle, round: 1, type: 'VOTING' },
        phaseId: `day-${state.cycle}-vote-1`,
      });
    case 'START_DAY_VOTE':
      return startDayExecutionVote(state);
    case 'ENTER_DAY_DEATH_RESOLUTION':
      return transitionPhase(state, {
        phase: { dayNumber: state.cycle, type: 'DAY_DEATH_RESOLUTION' },
        phaseId: `day-${state.cycle}-death-resolution`,
      });
    case 'ENTER_REVOTE': {
      const round = state.votingContext?.round ?? 1;
      return transitionPhase(state, {
        phase: { dayNumber: state.cycle, round, type: 'VOTING' },
        phaseId: `day-${state.cycle}-vote-${round}`,
      });
    }
    case 'START_NEXT_NIGHT':
      return startNextNight(
        state,
        `night-${state.cycle + 1}-prepare`,
        mvpRoleCatalog,
      );
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
