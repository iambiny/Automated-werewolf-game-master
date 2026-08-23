import { describe, expect, it } from 'vitest';

import type { EngineResult, MatchState, VoteResolutionRules } from '../index';
import {
  createNightTestState,
  markTestPlayerCursed,
  markTestPlayerDead,
} from '../testing/night-state';
import { createFoolExecutionInterceptor, FOOL_NO_VOTE_FLAG } from './fool';
import { transitionPhase } from './phase-engine';
import { declareWinner, evaluateWinner } from './winner';
import {
  appointMayorSuccessor,
  castVote,
  resolveVote,
  startDayExecutionVote,
  startMayorElection,
} from './voting';

const mayorRules = {
  electionDay: 1,
  executionVoteWeight: 2,
  officeOnDeath: 'VACANT' as const,
};

const votingRules: VoteResolutionRules = {
  executionInterceptors: [
    createFoolExecutionInterceptor({
      executionBehavior: 'SURVIVES_FIRST_EXECUTION_LOSES_VOTE',
    }),
  ],
  hunter: {
    eligibleShotCauses: [
      'WEREWOLF_ATTACK',
      'WITCH_POISON',
      'HUNTER_SHOT',
      'DAY_EXECUTION',
    ],
  },
  mayor: mayorRules,
  tiePolicy: 'REVOTE',
};

function success(result: EngineResult): MatchState {
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function keepOnly(state: MatchState, livingPlayerIds: string[]): MatchState {
  return Object.keys(state.players).reduce(
    (current, playerId) =>
      livingPlayerIds.includes(playerId)
        ? current
        : markTestPlayerDead(current, playerId),
    state,
  );
}

function castBallots(
  state: MatchState,
  ballots: Array<{ targetPlayerId: string | null; voterId: string }>,
): MatchState {
  return ballots.reduce(
    (current, ballot) => success(castVote(current, ballot)),
    state,
  );
}

function enterDayDeathResolution(state: MatchState): MatchState {
  return success(
    transitionPhase(state, {
      phase: { dayNumber: 1, type: 'DAY_DEATH_RESOLUTION' },
      phaseId: 'day-1-death-resolution',
    }),
  );
}

describe('Mayor and voting mechanics', () => {
  it('elects Mayor exactly once on the first morning', () => {
    let state = createNightTestState('SEER');
    state = {
      ...state,
      phase: { dayNumber: 1, subphase: 'MAYOR_ELECTION', type: 'MORNING' },
      phaseId: 'morning-1-mayor',
    };
    state = success(startMayorElection(state, mayorRules));
    const voters = state.votingContext?.eligibleVoterIds ?? [];
    state = castBallots(
      state,
      voters.map((voterId) => ({ targetPlayerId: 'seer', voterId })),
    );
    state = success(resolveVote(state, votingRules));

    expect(state.publicOffice).toEqual({
      mayorElectionCompleted: true,
      mayorPlayerId: 'seer',
    });
    expect(state.events).toContainEqual({
      playerId: 'seer',
      type: 'MAYOR_ELECTED',
    });
    expect(startMayorElection(state, mayorRules)).toMatchObject({
      error: { code: 'ACTION_NOT_AVAILABLE' },
      ok: false,
    });
  });

  it('randomly elects a Mayor when every voter skips', () => {
    let state = createNightTestState('SEER');
    state = {
      ...state,
      phase: { dayNumber: 1, subphase: 'MAYOR_ELECTION', type: 'MORNING' },
      phaseId: 'morning-1-mayor',
    };
    state = success(startMayorElection(state, mayorRules));
    const voters = state.votingContext?.eligibleVoterIds ?? [];
    const targets = state.votingContext?.eligibleTargetIds ?? [];
    state = castBallots(
      state,
      voters.map((voterId) => ({ targetPlayerId: null, voterId })),
    );
    state = success(resolveVote(state, { ...votingRules, random: () => 0.5 }));

    expect(state.publicOffice).toEqual({
      mayorElectionCompleted: true,
      mayorPlayerId: targets[Math.floor(targets.length * 0.5)],
    });
    expect(
      state.events.filter((event) => event.type === 'VOTE_SKIPPED'),
    ).toHaveLength(voters.length);
  });

  it('does not let a voter replace a skipped ballot', () => {
    let state = createNightTestState('SEER');
    state = {
      ...state,
      phase: { dayNumber: 1, subphase: 'MAYOR_ELECTION', type: 'MORNING' },
      phaseId: 'morning-1-mayor',
    };
    state = success(startMayorElection(state, mayorRules));
    state = success(castVote(state, { targetPlayerId: null, voterId: 'seer' }));

    expect(
      castVote(state, { targetPlayerId: 'guard', voterId: 'seer' }),
    ).toMatchObject({
      error: { code: 'ALREADY_SUBMITTED' },
      ok: false,
    });
  });

  it('executes no one when every voter skips the day vote', () => {
    let state = keepOnly(createNightTestState('SEER'), [
      'seer',
      'guard',
      'villager',
    ]);
    state = {
      ...state,
      phase: { dayNumber: 1, round: 1, type: 'VOTING' },
      phaseId: 'day-1-voting',
    };
    state = success(startDayExecutionVote(state));
    const voters = state.votingContext?.eligibleVoterIds ?? [];
    state = castBallots(
      state,
      voters.map((voterId) => ({ targetPlayerId: null, voterId })),
    );
    state = enterDayDeathResolution(state);
    const resolution = resolveVote(state, votingRules);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error(resolution.error.message);
    expect(resolution.state.votingContext).toBeUndefined();
    expect(
      Object.values(resolution.state.players).filter(
        (player) => player.lifeState === 'ALIVE',
      ),
    ).toHaveLength(3);
    expect(resolution.events).toEqual([
      {
        result: {
          tallies: expect.arrayContaining([
            { targetPlayerId: 'seer', weightedVotes: 0 },
          ]),
          tiedPlayerIds: [],
        },
        type: 'VOTE_RESOLVED',
      },
    ]);
  });

  it('applies Mayor weight to a day execution ballot', () => {
    let state = keepOnly(createNightTestState('SEER'), [
      'seer',
      'guard',
      'villager',
      'fool',
    ]);
    state = {
      ...state,
      phase: { dayNumber: 1, round: 1, type: 'VOTING' },
      phaseId: 'day-1-voting',
      publicOffice: {
        mayorElectionCompleted: true,
        mayorPlayerId: 'seer',
      },
    };
    state = success(startDayExecutionVote(state));
    state = castBallots(state, [
      { targetPlayerId: 'guard', voterId: 'seer' },
      { targetPlayerId: 'villager', voterId: 'guard' },
      { targetPlayerId: 'villager', voterId: 'villager' },
      { targetPlayerId: 'guard', voterId: 'fool' },
    ]);
    state = enterDayDeathResolution(state);

    const resolution = resolveVote(state, votingRules);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error(resolution.error.message);
    const voteEvent = resolution.events.find(
      (event) => event.type === 'VOTE_RESOLVED',
    );
    expect(voteEvent).toMatchObject({
      result: {
        eliminatedPlayerId: 'guard',
        tallies: expect.arrayContaining([
          { targetPlayerId: 'guard', weightedVotes: 3 },
          { targetPlayerId: 'villager', weightedVotes: 2 },
        ]),
      },
    });
    expect(resolution.state.players.guard?.lifeState).toBe('DEAD');
  });

  it('delegates Fool execution to an interceptor and removes its vote', () => {
    let state = keepOnly(createNightTestState('SEER'), [
      'seer',
      'villager',
      'fool',
    ]);
    state = {
      ...state,
      phase: { dayNumber: 1, round: 1, type: 'VOTING' },
      phaseId: 'day-1-voting',
    };
    state = success(startDayExecutionVote(state));
    state = castBallots(
      state,
      ['seer', 'villager', 'fool'].map((voterId) => ({
        targetPlayerId: 'fool',
        voterId,
      })),
    );
    state = enterDayDeathResolution(state);
    state = success(resolveVote(state, votingRules));

    expect(state.players.fool?.lifeState).toBe('ALIVE');
    expect(state.players.fool?.publicFlags).toContain(FOOL_NO_VOTE_FLAG);
    expect(state.events).toContainEqual({
      playerId: 'fool',
      roleId: 'FOOL',
      type: 'EXECUTION_INTERCEPTED',
    });

    state = {
      ...state,
      phase: { dayNumber: 2, round: 1, type: 'VOTING' },
      phaseId: 'day-2-voting',
    };
    state = success(startDayExecutionVote(state));
    expect(state.votingContext?.eligibleVoterIds).not.toContain('fool');
  });

  it('declares the Fool the winner when that execution option is enabled', () => {
    let state = keepOnly(createNightTestState('SEER'), [
      'seer',
      'villager',
      'fool',
    ]);
    state = {
      ...state,
      phase: { dayNumber: 1, round: 1, type: 'VOTING' },
      phaseId: 'day-1-voting',
    };
    state = success(startDayExecutionVote(state));
    state = castBallots(
      state,
      ['seer', 'villager', 'fool'].map((voterId) => ({
        targetPlayerId: 'fool',
        voterId,
      })),
    );
    state = enterDayDeathResolution(state);
    state = success(
      resolveVote(state, {
        ...votingRules,
        executionInterceptors: [
          createFoolExecutionInterceptor({
            executionBehavior: 'WINS_WHEN_EXECUTED',
          }),
        ],
      }),
    );

    expect(state.players.fool?.lifeState).toBe('ALIVE');
    expect(state.winner).toEqual({
      playerId: 'fool',
      reason: 'The Fool was selected for execution.',
      teamId: 'FOOL',
    });
    expect(state.events).toContainEqual({
      type: 'WINNER_DECLARED',
      winner: state.winner,
    });
    expect(evaluateWinner(state, { werewolfCondition: 'PARITY' })).toEqual(
      state.winner,
    );
    expect(declareWinner(state, { werewolfCondition: 'PARITY' })).toEqual({
      events: [],
      ok: true,
      state,
    });
  });

  it('executes a cursed Fool without applying its configured ability', () => {
    let state = keepOnly(createNightTestState('SEER'), [
      'seer',
      'villager',
      'fool',
    ]);
    state = markTestPlayerCursed(state, 'fool');
    state = {
      ...state,
      phase: { dayNumber: 1, round: 1, type: 'VOTING' },
      phaseId: 'day-1-voting',
    };
    state = success(startDayExecutionVote(state));
    state = castBallots(
      state,
      ['seer', 'villager', 'fool'].map((voterId) => ({
        targetPlayerId: 'fool',
        voterId,
      })),
    );
    state = enterDayDeathResolution(state);
    state = success(
      resolveVote(state, {
        ...votingRules,
        executionInterceptors: [
          createFoolExecutionInterceptor({
            executionBehavior: 'WINS_WHEN_EXECUTED',
          }),
        ],
      }),
    );

    expect(state.players.fool?.lifeState).toBe('DEAD');
    expect(state.winner).toBeUndefined();
  });

  it('creates a constrained revote and returns to the voting phase legally', () => {
    let state = keepOnly(createNightTestState('SEER'), [
      'seer',
      'guard',
      'villager',
      'fool',
    ]);
    state = {
      ...state,
      phase: { dayNumber: 1, round: 1, type: 'VOTING' },
      phaseId: 'day-1-voting',
    };
    state = success(startDayExecutionVote(state));
    state = castBallots(state, [
      { targetPlayerId: 'guard', voterId: 'seer' },
      { targetPlayerId: 'villager', voterId: 'guard' },
      { targetPlayerId: 'villager', voterId: 'villager' },
      { targetPlayerId: 'guard', voterId: 'fool' },
    ]);
    state = enterDayDeathResolution(state);
    state = success(resolveVote(state, votingRules));

    expect(state.votingContext).toMatchObject({
      ballots: {},
      eligibleTargetIds: ['guard', 'villager'],
      round: 2,
    });

    const returnedToVote = transitionPhase(state, {
      phase: { dayNumber: 1, round: 2, type: 'VOTING' },
      phaseId: 'day-1-revote',
    });
    expect(returnedToVote.ok).toBe(true);
  });

  it('queues a daytime Hunter shot after execution', () => {
    let state = keepOnly(createNightTestState('SEER'), [
      'seer',
      'hunter',
      'villager',
    ]);
    state = {
      ...state,
      phase: { dayNumber: 1, round: 1, type: 'VOTING' },
      phaseId: 'day-1-voting',
    };
    state = success(startDayExecutionVote(state));
    state = castBallots(
      state,
      ['seer', 'hunter', 'villager'].map((voterId) => ({
        targetPlayerId: 'hunter',
        voterId,
      })),
    );
    state = enterDayDeathResolution(state);
    state = success(resolveVote(state, votingRules));

    expect(state.pendingTriggers).toContainEqual({
      playerId: 'hunter',
      type: 'HUNTER_DAY_SHOT',
    });
  });

  it('appoints a living successor when the Mayor dies', () => {
    let state = keepOnly(createNightTestState('SEER'), [
      'seer',
      'guard',
      'villager',
    ]);
    state = {
      ...state,
      phase: { dayNumber: 1, round: 1, type: 'VOTING' },
      phaseId: 'day-1-voting',
      publicOffice: {
        mayorElectionCompleted: true,
        mayorPlayerId: 'seer',
      },
    };
    state = success(startDayExecutionVote(state));
    state = castBallots(
      state,
      ['seer', 'guard', 'villager'].map((voterId) => ({
        targetPlayerId: 'seer',
        voterId,
      })),
    );
    state = enterDayDeathResolution(state);
    state = success(resolveVote(state, votingRules));

    expect(state.publicOffice).toEqual({ mayorElectionCompleted: true });
    expect(state.events).toContainEqual({
      playerId: 'seer',
      type: 'MAYOR_VACATED',
    });

    state = success(appointMayorSuccessor(state, 'guard'));
    expect(state.publicOffice).toEqual({
      mayorElectionCompleted: true,
      mayorPlayerId: 'guard',
    });
    expect(state.events).toContainEqual({
      playerId: 'guard',
      type: 'MAYOR_SUCCESSOR_APPOINTED',
    });
  });
});
