import type {
  GamePhase,
  InvestigationValue,
  LifeState,
  MatchState,
  MatchStatus,
  PlayerId,
  RoleId,
  WinnerResult,
} from '@werewolf/game-engine';

export interface PublicPlayerView {
  deathAnnounced: boolean;
  displayName: string;
  lifeState: LifeState;
  playerId: PlayerId;
  publicFlags: string[];
  seatIndex: number;
}

export interface PublicGameView {
  cycle: number;
  matchId: string;
  phase: GamePhase;
  players: PublicPlayerView[];
  publicOffice: {
    mayorElectionCompleted: boolean;
    mayorPlayerId?: PlayerId;
  };
  status: MatchStatus;
  winner?: WinnerResult;
}

export interface PrivateTurnView {
  instruction: string;
  mode: 'ACTIVE' | 'DECOY';
  privateResult?: {
    result: InvestigationValue;
    targetPlayerId: PlayerId;
  };
  roleId: RoleId;
}

export function toPublicGameView(state: MatchState): PublicGameView {
  return {
    cycle: state.cycle,
    matchId: state.id,
    phase: structuredClone(state.phase),
    players: Object.values(state.players)
      .sort((left, right) => left.seatIndex - right.seatIndex)
      .map((player) => ({
        deathAnnounced: player.death?.announced ?? false,
        displayName: player.displayName,
        lifeState: player.lifeState,
        playerId: player.playerId,
        publicFlags: [...player.publicFlags],
        seatIndex: player.seatIndex,
      })),
    publicOffice: { ...state.publicOffice },
    status: state.status,
    ...(state.winner ? { winner: { ...state.winner } } : {}),
  };
}

export function toPrivateTurnView(state: MatchState): PrivateTurnView | null {
  if (state.phase.type !== 'NIGHT' || state.phase.subphase !== 'ROLE_TURN') {
    return null;
  }

  const context = state.nightContext;
  const turn = context?.queue[context.currentTurnIndex];
  if (!context || !turn) return null;

  const baseView: PrivateTurnView = {
    instruction:
      turn.mode === 'ACTIVE'
        ? `Complete the private ${turn.roleId} turn.`
        : `Complete the private ${turn.roleId} handoff.`,
    mode: turn.mode,
    roleId: turn.roleId,
  };

  if (turn.mode === 'DECOY' || turn.roleId !== 'SEER') return baseView;

  const result = [...context.effects]
    .reverse()
    .find((effect) => effect.type === 'INVESTIGATION_RESULT');
  const targetPlayerId = result?.targetPlayerIds[0];

  return result && targetPlayerId
    ? {
        ...baseView,
        privateResult: {
          result: structuredClone(result.payload),
          targetPlayerId,
        },
      }
    : baseView;
}
