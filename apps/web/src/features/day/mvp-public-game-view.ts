import type { MatchState, PlayerId } from '@werewolf/game-engine';
import { FOOL_NO_VOTE_FLAG } from '@werewolf/game-engine';

import {
  toPublicGameView,
  type PlayerSummary,
  type PublicDeathView,
  type PublicGameView,
} from '../../application/projections/game-view';
import type { SetupRules } from '../setup/setup-model';

export function toMvpPublicGameView(
  state: MatchState,
  rules: SetupRules,
): PublicGameView {
  const base = toPublicGameView(state);
  const unannouncedDeaths = Object.values(state.players)
    .filter((player) => player.death && !player.death.announced)
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .map((player): PublicDeathView => {
      const assignment = state.roleAssignments[player.playerId];
      return {
        ...summarizePlayer(player),
        ...(rules.deathRevealPolicy === 'ROLE' && assignment
          ? { revealedRoleId: assignment.currentRoleId }
          : {}),
        ...(rules.deathRevealPolicy === 'TEAM' && assignment
          ? { revealedTeamId: assignment.teamId }
          : {}),
      };
    });
  const hunterTrigger = state.pendingTriggers.find(
    (trigger) =>
      trigger.type === 'HUNTER_MORNING_SHOT' ||
      trigger.type === 'HUNTER_DAY_SHOT',
  );
  const hunter = hunterTrigger
    ? state.players[hunterTrigger.playerId]
    : undefined;
  const voting = state.votingContext;
  const currentVoterId = voting?.eligibleVoterIds.find(
    (playerId) => voting.ballots[playerId] === undefined,
  );
  const currentVoter = currentVoterId
    ? state.players[currentVoterId]
    : undefined;
  const foolRevealedPlayerId = Object.values(state.players).find((player) =>
    player.publicFlags.includes(FOOL_NO_VOTE_FLAG),
  )?.playerId;

  return {
    ...base,
    ...(foolRevealedPlayerId ? { foolRevealedPlayerId } : {}),
    ...(hunter ? { pendingHunter: summarizePlayer(hunter) } : {}),
    ...(state.phase.type === 'GAME_OVER'
      ? { revealedRoles: toGameOverRoles(state) }
      : {}),
    ...(unannouncedDeaths.length > 0 ? { unannouncedDeaths } : {}),
    ...(voting
      ? {
          voting: {
            ballotsCast: Object.keys(voting.ballots).length,
            currentVoter: currentVoter ? summarizePlayer(currentVoter) : null,
            eligibleTargets: voting.eligibleTargetIds
              .map((playerId) => state.players[playerId])
              .filter(
                (player): player is NonNullable<typeof player> =>
                  player !== undefined,
              )
              .map(summarizePlayer),
            round: voting.round,
            totalVoters: voting.eligibleVoterIds.length,
            type: voting.type,
          },
        }
      : {}),
  };
}

export interface RevealedPlayerRole extends PlayerSummary {
  roleId: string;
  teamId: string;
}

export function toGameOverRoles(state: MatchState): RevealedPlayerRole[] {
  if (state.phase.type !== 'GAME_OVER') return [];
  return Object.values(state.players)
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .flatMap((player) => {
      const assignment = state.roleAssignments[player.playerId];
      return assignment
        ? [
            {
              ...summarizePlayer(player),
              roleId: assignment.currentRoleId,
              teamId: assignment.teamId,
            },
          ]
        : [];
    });
}

function summarizePlayer(
  player: MatchState['players'][PlayerId],
): PlayerSummary {
  return {
    displayName: player.displayName,
    playerId: player.playerId,
    seatIndex: player.seatIndex,
  };
}
