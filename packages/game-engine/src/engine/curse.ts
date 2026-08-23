import type { PlayerId } from '@werewolf/shared';

import type { MatchState } from '../domain/match-state';

export const CURSED_ROLE_STATE_KEY = 'cursed';

/** Whether the Demon Wolf converted this player and disabled their role ability. */
export function isPlayerCursed(state: MatchState, playerId: PlayerId): boolean {
  if (state.roleState[playerId]?.data[CURSED_ROLE_STATE_KEY] === true) {
    return true;
  }

  // Retain compatibility with matches saved before curse became explicit state.
  return state.events.some(
    (event) => event.type === 'PLAYER_CURSED' && event.playerId === playerId,
  );
}
