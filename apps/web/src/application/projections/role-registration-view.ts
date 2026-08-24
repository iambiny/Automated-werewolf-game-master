import type { MatchState, PlayerId, RoleId } from '@werewolf/game-engine';

export interface RoleRegistrationPlayerView {
  displayName: string;
  playerId: PlayerId;
  seatIndex: number;
}

export interface RoleRegistrationView {
  complete: boolean;
  currentPlayer: RoleRegistrationPlayerView | null;
  preparedRoleIds: RoleId[];
  registeredCount: number;
  totalPlayers: number;
}

export function toRoleRegistrationView(
  state: MatchState,
): RoleRegistrationView | null {
  if (state.phase.type !== 'ROLE_REGISTRATION') return null;

  const players = Object.values(state.players).sort(
    (left, right) => left.seatIndex - right.seatIndex,
  );
  const current = players.find(
    (player) => state.roleAssignments[player.playerId] === undefined,
  );

  return {
    complete: current === undefined,
    currentPlayer: current
      ? {
          displayName: current.displayName,
          playerId: current.playerId,
          seatIndex: current.seatIndex,
        }
      : null,
    preparedRoleIds: state.roleComposition
      .filter((entry) => entry.count > 0)
      .map((entry) => entry.roleId),
    registeredCount: Object.keys(state.roleAssignments).length,
    totalPlayers: players.length,
  };
}
