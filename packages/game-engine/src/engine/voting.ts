import type { PlayerId } from '@werewolf/shared';

import type {
  HunterRules,
  MayorRules,
  TiePolicy,
} from '../domain/core-role-rules';
import type { ExecutionInterceptor } from '../domain/execution';
import type { MatchState } from '../domain/match-state';
import type { DomainEvent, VoteResolution } from '../events/domain-event';
import { applyDeaths } from './death';
import { FOOL_NO_VOTE_FLAG } from './fool';
import { domainError, type EngineResult } from './result';

export interface VoteBallot {
  targetPlayerId: PlayerId;
  voterId: PlayerId;
}

export interface VoteResolutionRules {
  executionInterceptors: ExecutionInterceptor[];
  hunter: HunterRules;
  mayor: MayorRules;
  tiePolicy: TiePolicy;
}

export function startMayorElection(
  state: MatchState,
  rules: MayorRules,
): EngineResult {
  if (
    state.phase.type !== 'MORNING' ||
    state.phase.subphase !== 'MAYOR_ELECTION' ||
    state.phase.dayNumber !== rules.electionDay
  ) {
    return failedVote(
      state,
      'INVALID_PHASE',
      'Mayor election is not available in this phase.',
    );
  }
  if (state.publicOffice.mayorElectionCompleted) {
    return failedVote(
      state,
      'ACTION_NOT_AVAILABLE',
      'Mayor election has already completed.',
    );
  }

  return startVotingContext(state, 'MAYOR_ELECTION');
}

export function startDayExecutionVote(state: MatchState): EngineResult {
  if (state.phase.type !== 'VOTING') {
    return failedVote(
      state,
      'INVALID_PHASE',
      'Day execution voting requires the VOTING phase.',
    );
  }

  return startVotingContext(state, 'DAY_EXECUTION');
}

export function castVote(state: MatchState, ballot: VoteBallot): EngineResult {
  const context = state.votingContext;
  if (!context || !isVoteCollectionPhase(state, context.type)) {
    return failedVote(
      state,
      'INVALID_PHASE',
      'There is no vote accepting ballots in this phase.',
    );
  }
  if (
    !context.eligibleVoterIds.includes(ballot.voterId) ||
    !context.eligibleTargetIds.includes(ballot.targetPlayerId)
  ) {
    return failedVote(
      state,
      'INVALID_TARGET',
      'The voter or vote target is not eligible.',
    );
  }
  if (context.ballots[ballot.voterId]) {
    return failedVote(
      state,
      'ALREADY_SUBMITTED',
      'This voter has already submitted a ballot.',
    );
  }

  const event: DomainEvent = {
    targetPlayerId: ballot.targetPlayerId,
    type: 'VOTE_CAST',
    voterId: ballot.voterId,
  };
  const nextState: MatchState = {
    ...state,
    events: [...state.events, event],
    votingContext: {
      ...context,
      ballots: { ...context.ballots, [ballot.voterId]: ballot.targetPlayerId },
    },
  };

  return { events: [event], ok: true, state: nextState };
}

export function resolveVote(
  state: MatchState,
  rules: VoteResolutionRules,
): EngineResult {
  const context = state.votingContext;
  if (!context || !isVoteResolutionPhase(state, context.type)) {
    return failedVote(
      state,
      'INVALID_PHASE',
      'There is no vote ready for resolution in this phase.',
    );
  }
  if (
    context.eligibleVoterIds.some(
      (voterId) => context.ballots[voterId] === undefined,
    )
  ) {
    return failedVote(
      state,
      'ACTION_NOT_AVAILABLE',
      'Every eligible voter must submit a ballot before resolution.',
    );
  }

  const tallies = context.eligibleTargetIds.map((targetPlayerId) => ({
    targetPlayerId,
    weightedVotes: 0,
  }));
  for (const [voterId, targetPlayerId] of Object.entries(context.ballots)) {
    const tally = tallies.find(
      (entry) => entry.targetPlayerId === targetPlayerId,
    );
    if (tally) {
      tally.weightedVotes +=
        context.type === 'DAY_EXECUTION'
          ? getVoteWeight(state, voterId, rules.mayor)
          : 1;
    }
  }

  const highestVote = Math.max(...tallies.map((tally) => tally.weightedVotes));
  const tiedPlayerIds = tallies
    .filter((tally) => tally.weightedVotes === highestVote)
    .map((tally) => tally.targetPlayerId);
  if (tiedPlayerIds.length !== 1) {
    return resolveTie(state, tallies, tiedPlayerIds, rules.tiePolicy);
  }

  const selectedPlayerId = tiedPlayerIds[0];
  if (!selectedPlayerId) {
    return failedVote(
      state,
      'ACTION_NOT_AVAILABLE',
      'The vote did not produce a target.',
    );
  }

  if (context.type === 'MAYOR_ELECTION') {
    return electMayor(state, selectedPlayerId, tallies);
  }

  return executeVoteTarget(state, selectedPlayerId, tallies, rules);
}

export function getVoteWeight(
  state: MatchState,
  voterId: PlayerId,
  rules: MayorRules,
): number {
  return state.publicOffice.mayorPlayerId === voterId
    ? rules.executionVoteWeight
    : 1;
}

function startVotingContext(
  state: MatchState,
  type: 'MAYOR_ELECTION' | 'DAY_EXECUTION',
): EngineResult {
  const livingPlayerIds = getLivingPlayerIds(state);
  const eligibleVoterIds = livingPlayerIds.filter(
    (playerId) =>
      !state.players[playerId]?.publicFlags.includes(FOOL_NO_VOTE_FLAG),
  );
  const nextState: MatchState = {
    ...state,
    votingContext: {
      ballots: {},
      eligibleTargetIds: livingPlayerIds,
      eligibleVoterIds,
      round: 1,
      type,
    },
  };

  return { events: [], ok: true, state: nextState };
}

function resolveTie(
  state: MatchState,
  tallies: VoteResolution['tallies'],
  tiedPlayerIds: PlayerId[],
  tiePolicy: TiePolicy,
): EngineResult {
  const result: VoteResolution = { tallies, tiedPlayerIds };
  const event: DomainEvent = { result, type: 'VOTE_RESOLVED' };
  let nextState: MatchState;

  if (tiePolicy === 'REVOTE' && state.votingContext) {
    nextState = {
      ...state,
      events: [...state.events, event],
      votingContext: {
        ...state.votingContext,
        ballots: {},
        eligibleTargetIds: tiedPlayerIds,
        round: state.votingContext.round + 1,
      },
    };
  } else {
    nextState = clearVotingContext({
      ...state,
      events: [...state.events, event],
    });
  }

  return { events: [event], ok: true, state: nextState };
}

function electMayor(
  state: MatchState,
  playerId: PlayerId,
  tallies: VoteResolution['tallies'],
): EngineResult {
  const result: VoteResolution = { tallies, tiedPlayerIds: [] };
  const events: DomainEvent[] = [
    { result, type: 'VOTE_RESOLVED' },
    { playerId, type: 'MAYOR_ELECTED' },
  ];
  const nextState = clearVotingContext({
    ...state,
    events: [...state.events, ...events],
    publicOffice: {
      mayorElectionCompleted: true,
      mayorPlayerId: playerId,
    },
  });

  return { events, ok: true, state: nextState };
}

function executeVoteTarget(
  state: MatchState,
  targetPlayerId: PlayerId,
  tallies: VoteResolution['tallies'],
  rules: VoteResolutionRules,
): EngineResult {
  const roleId = state.roleAssignments[targetPlayerId]?.currentRoleId;
  const interceptor = rules.executionInterceptors.find(
    (candidate) => candidate.roleId === roleId,
  );
  const interception = interceptor?.intercept(state, targetPlayerId);
  const baseResult: VoteResolution = { tallies, tiedPlayerIds: [] };

  if (interceptor && interception?.type === 'SURVIVE') {
    const event: DomainEvent = {
      playerId: targetPlayerId,
      roleId: interceptor.roleId,
      type: 'EXECUTION_INTERCEPTED',
    };
    const player = state.players[targetPlayerId];
    if (!player) {
      return failedVote(
        state,
        'INVALID_TARGET',
        'Execution target is missing.',
      );
    }
    const voteEvent: DomainEvent = {
      result: baseResult,
      type: 'VOTE_RESOLVED',
    };
    const nextState = clearVotingContext({
      ...state,
      events: [...state.events, voteEvent, event],
      players: {
        ...state.players,
        [targetPlayerId]: {
          ...player,
          publicFlags: interception.publicFlags,
        },
      },
    });
    return { events: [voteEvent, event], ok: true, state: nextState };
  }

  const deathResolution = applyDeaths(
    state,
    [{ causes: ['DAY_EXECUTION'], playerId: targetPlayerId }],
    'DAY',
    state.phaseId,
    rules,
  );
  const result: VoteResolution = {
    ...baseResult,
    eliminatedPlayerId: targetPlayerId,
  };
  const voteEvent: DomainEvent = { result, type: 'VOTE_RESOLVED' };
  const events = [voteEvent, ...deathResolution.events];
  const nextState = clearVotingContext({
    ...deathResolution.state,
    events: [...state.events, ...events],
  });

  return { events, ok: true, state: nextState };
}

function isVoteCollectionPhase(
  state: MatchState,
  type: 'MAYOR_ELECTION' | 'DAY_EXECUTION',
): boolean {
  return type === 'MAYOR_ELECTION'
    ? state.phase.type === 'MORNING' &&
        state.phase.subphase === 'MAYOR_ELECTION'
    : state.phase.type === 'VOTING';
}

function isVoteResolutionPhase(
  state: MatchState,
  type: 'MAYOR_ELECTION' | 'DAY_EXECUTION',
): boolean {
  return type === 'MAYOR_ELECTION'
    ? isVoteCollectionPhase(state, type)
    : state.phase.type === 'DAY_DEATH_RESOLUTION';
}

function getLivingPlayerIds(state: MatchState): PlayerId[] {
  return Object.values(state.players)
    .filter((player) => player.lifeState === 'ALIVE')
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .map((player) => player.playerId);
}

function clearVotingContext(state: MatchState): MatchState {
  const next = { ...state };
  delete next.votingContext;
  return next;
}

function failedVote(
  state: MatchState,
  code:
    | 'ACTION_NOT_AVAILABLE'
    | 'ALREADY_SUBMITTED'
    | 'INVALID_PHASE'
    | 'INVALID_TARGET',
  message: string,
): EngineResult {
  return { error: domainError(code, message), ok: false, state };
}
