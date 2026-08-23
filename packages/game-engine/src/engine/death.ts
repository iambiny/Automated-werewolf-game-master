import type { PhaseId, PlayerId } from '@werewolf/shared';

import type { HunterRules, MayorRules } from '../domain/core-role-rules';
import type { MatchState, PublicOfficeState } from '../domain/match-state';
import type { DeathCause } from '../domain/player';
import type { DomainEvent } from '../events/domain-event';
import type { GameTrigger } from '../domain/action';
import { isPlayerCursed } from './curse';

export interface PendingDeath {
  causes: DeathCause[];
  playerId: PlayerId;
}

export interface DeathResolutionRules {
  hunter: HunterRules;
  mayor: MayorRules;
}

export interface DeathResolutionResult {
  deaths: PendingDeath[];
  events: DomainEvent[];
  state: MatchState;
}

export function applyDeaths(
  state: MatchState,
  pendingDeaths: PendingDeath[],
  timing: 'DAY' | 'NIGHT',
  phaseId: PhaseId,
  rules: DeathResolutionRules,
): DeathResolutionResult {
  const deaths = combineDeaths(pendingDeaths).filter(
    (death) => state.players[death.playerId]?.lifeState === 'ALIVE',
  );
  const players = { ...state.players };
  const triggers: GameTrigger[] = [];
  const events: DomainEvent[] = [];
  let publicOffice = state.publicOffice;

  for (const death of deaths) {
    const player = players[death.playerId];
    if (!player) continue;

    players[death.playerId] = {
      ...player,
      death: { announced: false, causes: death.causes, phaseId },
      lifeState: 'DEAD',
    };
    events.push({
      causes: death.causes,
      playerId: death.playerId,
      type: 'PLAYER_DIED',
    });

    if (
      state.roleAssignments[death.playerId]?.currentRoleId === 'HUNTER' &&
      !isPlayerCursed(state, death.playerId) &&
      death.causes.some((cause) =>
        rules.hunter.eligibleShotCauses.includes(cause),
      )
    ) {
      triggers.push({
        playerId: death.playerId,
        type: timing === 'NIGHT' ? 'HUNTER_MORNING_SHOT' : 'HUNTER_DAY_SHOT',
      });
    }

    if (state.publicOffice.mayorPlayerId === death.playerId) {
      publicOffice = vacateMayor(state.publicOffice);
      events.push({ playerId: death.playerId, type: 'MAYOR_VACATED' });
    }
  }

  return {
    deaths,
    events,
    state: {
      ...state,
      pendingTriggers: [...state.pendingTriggers, ...triggers],
      players,
      publicOffice,
    },
  };
}

function combineDeaths(pendingDeaths: PendingDeath[]): PendingDeath[] {
  const causesByPlayer = new Map<PlayerId, DeathCause[]>();

  for (const death of pendingDeaths) {
    const causes = causesByPlayer.get(death.playerId) ?? [];
    for (const cause of death.causes) {
      if (!causes.includes(cause)) causes.push(cause);
    }
    causesByPlayer.set(death.playerId, causes);
  }

  return [...causesByPlayer].map(([playerId, causes]) => ({
    causes,
    playerId,
  }));
}

function vacateMayor(publicOffice: PublicOfficeState): PublicOfficeState {
  const next = { ...publicOffice };
  delete next.mayorPlayerId;
  return next;
}
