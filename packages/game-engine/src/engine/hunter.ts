import type { ActionId, PlayerId } from '@werewolf/shared';

import type { GameAction, GameEffect, GameTrigger } from '../domain/action';
import type { HunterRules, MayorRules } from '../domain/core-role-rules';
import type { MatchState } from '../domain/match-state';
import type { DomainEvent } from '../events/domain-event';
import { applyDeaths } from './death';
import { domainError, type EngineResult } from './result';

export interface SubmitHunterShotInput {
  actionId: ActionId;
  targetPlayerId: PlayerId;
}

export interface HunterShotResolutionRules {
  hunter: HunterRules;
  mayor: MayorRules;
}

export function submitHunterShot(
  state: MatchState,
  input: SubmitHunterShotInput,
  rules: HunterShotResolutionRules,
): EngineResult {
  const triggerIndex = state.pendingTriggers.findIndex(isHunterTrigger);
  const trigger = state.pendingTriggers[triggerIndex];
  if (!trigger || triggerIndex < 0) {
    return {
      error: domainError(
        'ACTION_NOT_AVAILABLE',
        'There is no pending Hunter shot.',
      ),
      ok: false,
      state,
    };
  }

  if (!isValidTriggerPhase(state, trigger)) {
    return {
      error: domainError(
        'INVALID_PHASE',
        'The pending Hunter shot cannot resolve in this phase.',
      ),
      ok: false,
      state,
    };
  }

  const target = state.players[input.targetPlayerId];
  if (!target || target.lifeState !== 'ALIVE') {
    return {
      error: domainError(
        'INVALID_TARGET',
        'The Hunter target is not eligible.',
      ),
      ok: false,
      state,
    };
  }

  const action: GameAction = {
    actorPlayerIds: [trigger.playerId],
    actorRoleId: 'HUNTER',
    id: input.actionId,
    phaseId: state.phaseId,
    targetPlayerIds: [input.targetPlayerId],
    type: 'HUNTER_SHOOT',
  };
  const effect: GameEffect = {
    payload: { cause: 'HUNTER_SHOT' },
    sourcePlayerIds: [trigger.playerId],
    sourceRoleId: 'HUNTER',
    targetPlayerIds: [input.targetPlayerId],
    type: 'DIRECT_KILL',
    visibility: 'INTERNAL',
  };
  const pendingTriggers = state.pendingTriggers.filter(
    (_, index) => index !== triggerIndex,
  );
  const stateWithoutTrigger: MatchState = { ...state, pendingTriggers };
  const deathResolution = applyDeaths(
    stateWithoutTrigger,
    [{ causes: [effect.payload.cause], playerId: input.targetPlayerId }],
    trigger.type === 'HUNTER_MORNING_SHOT' ? 'NIGHT' : 'DAY',
    state.phaseId,
    rules,
  );
  const events: DomainEvent[] = [
    { action, type: 'ACTION_SUBMITTED' },
    ...deathResolution.events,
    {
      playerId: trigger.playerId,
      targetPlayerId: input.targetPlayerId,
      type: 'HUNTER_SHOT_RESOLVED',
    },
  ];
  const nextState: MatchState = {
    ...deathResolution.state,
    events: [...state.events, ...events],
  };

  return { events, ok: true, state: nextState };
}

function isHunterTrigger(trigger: GameTrigger): boolean {
  return (
    trigger.type === 'HUNTER_MORNING_SHOT' || trigger.type === 'HUNTER_DAY_SHOT'
  );
}

function isValidTriggerPhase(state: MatchState, trigger: GameTrigger): boolean {
  if (trigger.type === 'HUNTER_MORNING_SHOT') {
    return (
      state.phase.type === 'MORNING' &&
      state.phase.subphase === 'MORNING_TRIGGERS'
    );
  }

  return state.phase.type === 'DAY_DEATH_RESOLUTION';
}
