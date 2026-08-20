import { describe, expect, it } from 'vitest';

import type {
  EngineResult,
  MatchState,
  NightResolutionRules,
  VoteResolutionRules,
  WitchRules,
} from '../index';
import {
  createNightTestState,
  setActiveNightTurn,
} from '../testing/night-state';
import { submitDemonWolfCurseDecision } from './demon-wolf';
import { createFoolExecutionInterceptor } from './fool';
import { submitGuardProtection } from './guard';
import { submitHunterShot } from './hunter';
import { resolveNight } from './night-resolution';
import { transitionPhase } from './phase-engine';
import {
  castVote,
  resolveVote,
  startDayExecutionVote,
  startMayorElection,
} from './voting';
import { submitWerewolfAttack } from './werewolf';
import { declareWinner, evaluateWinner } from './winner';
import { submitWitchPoison } from './witch';

const mayor = {
  electionDay: 1,
  executionVoteWeight: 2,
  officeOnDeath: 'VACANT' as const,
};
const hunter = {
  eligibleShotCauses: [
    'WEREWOLF_ATTACK',
    'WITCH_POISON',
    'HUNTER_SHOT',
    'DAY_EXECUTION',
  ] as const,
};
const nightRules: NightResolutionRules = {
  healPreventsCurse: true,
  hunter: { eligibleShotCauses: [...hunter.eligibleShotCauses] },
  mayor,
};
const voteRules: VoteResolutionRules = {
  executionInterceptors: [
    createFoolExecutionInterceptor({ executionBehavior: 'DIES_NORMALLY' }),
  ],
  hunter: { eligibleShotCauses: [...hunter.eligibleShotCauses] },
  mayor,
  tiePolicy: 'NO_ELIMINATION',
};
const witchRules: WitchRules = {
  allowHealAndPoisonSameNight: true,
  allowSelfHeal: false,
  allowSelfPoison: false,
  healPotionCount: 1,
  poisonPotionCount: 1,
  seesWerewolfVictim: true,
};

function success(result: EngineResult): MatchState {
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function move(state: MatchState, phase: MatchState['phase'], id: string) {
  return success(transitionPhase(state, { phase, phaseId: id }));
}

describe('two-cycle headless match', () => {
  it('runs through protection, Mayor, execution, Hunter, and winner checkpoints', () => {
    let state = createNightTestState('GUARD');

    state = success(
      submitGuardProtection(
        state,
        { actionId: 'n1-guard', targetPlayerId: 'villager' },
        {
          allowSameTargetConsecutiveNights: false,
          allowSelfProtect: false,
        },
      ),
    );
    state = success(
      submitWerewolfAttack(
        setActiveNightTurn(state, 'WEREWOLF'),
        { actionId: 'n1-wolf', targetPlayerId: 'villager' },
        { allowNoAttack: false, selectionStrategy: 'SHARED_SELECTION' },
      ),
    );
    state = success(
      submitDemonWolfCurseDecision(setActiveNightTurn(state, 'DEMON_WOLF'), {
        actionId: 'n1-demon-skip',
        decision: 'SKIP',
      }),
    );
    state = move(
      state,
      { nightNumber: 1, subphase: 'RESOLUTION', type: 'NIGHT' },
      'night-1-resolution',
    );
    state = success(resolveNight(state, nightRules));
    expect(state.players.villager?.lifeState).toBe('ALIVE');

    state = move(
      state,
      { dayNumber: 1, subphase: 'ANNOUNCEMENT', type: 'MORNING' },
      'morning-1-announcement',
    );
    state = move(
      state,
      { dayNumber: 1, subphase: 'MORNING_TRIGGERS', type: 'MORNING' },
      'morning-1-triggers',
    );
    state = move(
      state,
      { dayNumber: 1, subphase: 'MAYOR_ELECTION', type: 'MORNING' },
      'morning-1-mayor',
    );
    state = success(startMayorElection(state, mayor));
    for (const voterId of state.votingContext?.eligibleVoterIds ?? []) {
      state = success(castVote(state, { targetPlayerId: 'seer', voterId }));
    }
    state = success(resolveVote(state, voteRules));
    expect(state.publicOffice.mayorPlayerId).toBe('seer');

    state = move(
      state,
      {
        dayNumber: 1,
        subphase: 'READY_FOR_DISCUSSION',
        type: 'MORNING',
      },
      'morning-1-ready',
    );
    state = move(
      state,
      { dayNumber: 1, type: 'DISCUSSION' },
      'day-1-discussion',
    );
    state = move(
      state,
      { dayNumber: 1, round: 1, type: 'VOTING' },
      'day-1-voting',
    );
    state = success(startDayExecutionVote(state));
    for (const voterId of state.votingContext?.eligibleVoterIds ?? []) {
      state = success(
        castVote(state, { targetPlayerId: 'demon-wolf', voterId }),
      );
    }
    state = move(
      state,
      { dayNumber: 1, type: 'DAY_DEATH_RESOLUTION' },
      'day-1-death',
    );
    state = success(resolveVote(state, voteRules));
    expect(state.players['demon-wolf']?.lifeState).toBe('DEAD');
    expect(evaluateWinner(state, { werewolfCondition: 'PARITY' })).toBeNull();

    state = move(
      state,
      { nightNumber: 2, subphase: 'PREPARE_QUEUE', type: 'NIGHT' },
      'night-2-prepare',
    );
    state = {
      ...state,
      nightContext: {
        actions: [],
        currentTurnIndex: 0,
        effects: [],
        nightNumber: 2,
        queue: [{ mode: 'ACTIVE', order: 30, roleId: 'WEREWOLF' }],
      },
    };
    state = move(
      state,
      { nightNumber: 2, subphase: 'ROLE_TURN', type: 'NIGHT' },
      'night-2-wolf-turn',
    );
    state = success(
      submitWerewolfAttack(
        state,
        { actionId: 'n2-wolf', targetPlayerId: 'hunter' },
        { allowNoAttack: false, selectionStrategy: 'SHARED_SELECTION' },
      ),
    );
    state = success(
      submitWitchPoison(
        setActiveNightTurn(state, 'WITCH'),
        { actionId: 'n2-witch-poison', targetPlayerId: 'wolf' },
        witchRules,
      ),
    );
    state = move(
      state,
      { nightNumber: 2, subphase: 'RESOLUTION', type: 'NIGHT' },
      'night-2-resolution',
    );
    state = success(resolveNight(state, nightRules));
    expect(state.players.hunter?.lifeState).toBe('DEAD');
    expect(state.players.wolf?.lifeState).toBe('DEAD');

    state = move(
      state,
      { dayNumber: 2, subphase: 'ANNOUNCEMENT', type: 'MORNING' },
      'morning-2-announcement',
    );
    state = move(
      state,
      { dayNumber: 2, subphase: 'MORNING_TRIGGERS', type: 'MORNING' },
      'morning-2-triggers',
    );
    expect(evaluateWinner(state, { werewolfCondition: 'PARITY' })).toBeNull();
    state = success(
      submitHunterShot(
        state,
        { actionId: 'hunter-final-shot', targetPlayerId: 'fool' },
        { hunter: nightRules.hunter, mayor: nightRules.mayor },
      ),
    );
    state = success(declareWinner(state, { werewolfCondition: 'PARITY' }));

    expect(state.winner?.teamId).toBe('VILLAGE');
    expect(state.cycle).toBe(2);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
