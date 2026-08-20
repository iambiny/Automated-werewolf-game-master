import { createMatch, type MatchState } from '@werewolf/game-engine';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PLAYERS,
  DEFAULT_ROLE_COUNTS,
  DEFAULT_SETUP_RULES,
  toMvpRuleConfig,
  toRoleComposition,
} from '../setup/setup-model';
import { createSetupCommandExecutor } from './setup-command-executor';

describe('setup command executor', () => {
  it('completes an eight-player registration and resolves Night 1', () => {
    const execute = createSetupCommandExecutor(() =>
      toMvpRuleConfig(DEFAULT_SETUP_RULES),
    );
    let state: MatchState = createMatch({
      id: 'eight-player-match',
      initialPhaseId: 'setup',
      players: DEFAULT_PLAYERS.map((player, seatIndex) => ({
        displayName: player.name,
        id: player.id,
        seatIndex,
      })),
      roleComposition: toRoleComposition(DEFAULT_ROLE_COUNTS),
      rulesetId: 'boardgameviet-vn',
      rulesetVersion: '1.0.0',
    });

    state = successfulState(
      execute(state, { payload: {}, type: 'BEGIN_ROLE_REGISTRATION' }),
    );
    const roles = toRoleComposition(DEFAULT_ROLE_COUNTS).flatMap((entry) =>
      Array.from({ length: entry.count }, () => entry.roleId),
    );
    for (const [index, player] of DEFAULT_PLAYERS.entries()) {
      state = successfulState(
        execute(state, {
          payload: { playerId: player.id, roleId: roles[index] },
          type: 'REGISTER_ROLE',
        }),
      );
    }

    state = successfulState(
      execute(state, { payload: {}, type: 'COMPLETE_ROLE_REGISTRATION' }),
    );
    state = successfulState(
      execute(state, { payload: {}, type: 'START_FIRST_NIGHT' }),
    );

    expect(state.status).toBe('ACTIVE');
    expect(state.phase).toMatchObject({ nightNumber: 1, type: 'NIGHT' });
    expect(state.nightContext?.queue.length).toBeGreaterThan(0);

    state = successfulState(
      execute(state, { payload: {}, type: 'START_NIGHT_ROLE_TURNS' }),
    );
    while (
      state.phase.type === 'NIGHT' &&
      state.phase.subphase === 'ROLE_TURN'
    ) {
      const context = state.nightContext;
      const turn = context?.queue[context.currentTurnIndex];
      if (!turn) throw new Error('Missing current night turn.');
      if (turn.mode === 'ACTIVE') {
        state = successfulState(
          execute(state, {
            payload: {
              actionId: `pass-${turn.roleId}`,
              reason: 'MANUAL',
            },
            type: 'PASS_NIGHT_TURN',
          }),
        );
      }
      state = successfulState(
        execute(state, { payload: {}, type: 'ADVANCE_NIGHT_TURN' }),
      );
    }
    state = successfulState(
      execute(state, { payload: {}, type: 'RESOLVE_NIGHT' }),
    );
    state = successfulState(
      execute(state, { payload: {}, type: 'REACH_DAWN' }),
    );

    expect(state.phase).toEqual({
      dayNumber: 1,
      subphase: 'ANNOUNCEMENT',
      type: 'MORNING',
    });
  });
});

function successfulState(
  result: ReturnType<ReturnType<typeof createSetupCommandExecutor>>,
): MatchState {
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}
