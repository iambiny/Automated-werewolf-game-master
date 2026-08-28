import { describe, expect, it } from 'vitest';

import type { NightResolutionRules } from '../domain/core-role-rules';
import {
  createNightTestState,
  markTestPlayerDead,
  setNightResolutionPhase,
} from '../testing/night-state';
import { startNextNight } from './day-flow';
import { resolveNight } from './night-resolution';
import { SILENCED_FLAG, submitSilencerTarget } from './silencer';
import { startDayExecutionVote } from './voting';

const resolutionRules = {
  healPreventsCurse: false,
  hunter: {
    eligibleShotCauses: ['WEREWOLF_ATTACK', 'WITCH_POISON', 'DAY_EXECUTION'],
  },
  mayor: {
    electionDay: 1,
    executionVoteWeight: 2,
    officeOnDeath: 'VACANT' as const,
  },
} satisfies NightResolutionRules;

describe('Silencer', () => {
  it('allows self-targeting and records a deferred silence effect', () => {
    const result = submitSilencerTarget(createNightTestState('SILENCER'), {
      actionId: 'silence-self',
      targetPlayerId: 'silencer',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.nightContext?.effects).toContainEqual({
      sourcePlayerIds: ['silencer'],
      sourceRoleId: 'SILENCER',
      targetPlayerIds: ['silencer'],
      type: 'SILENCE',
      visibility: 'INTERNAL',
    });
  });

  it('rejects the same target on consecutive nights but permits them after a skipped night', () => {
    const state = createNightTestState('SILENCER');
    state.cycle = 2;
    state.roleState.silencer = {
      data: {
        lastSilencedNightNumber: 1,
        lastSilencedPlayerId: 'villager',
      },
      playerId: 'silencer',
      roleId: 'SILENCER',
    };

    expect(
      submitSilencerTarget(state, {
        actionId: 'repeat',
        targetPlayerId: 'villager',
      }),
    ).toMatchObject({ error: { code: 'INVALID_TARGET' }, ok: false });

    state.cycle = 3;
    expect(
      submitSilencerTarget(state, {
        actionId: 'after-skip',
        targetPlayerId: 'villager',
      }).ok,
    ).toBe(true);
  });

  it('applies silence after night resolution even if the Silencer dies', () => {
    let state = createNightTestState('SILENCER');
    const submitted = submitSilencerTarget(state, {
      actionId: 'silence-villager',
      targetPlayerId: 'villager',
    });
    if (!submitted.ok) throw new Error(submitted.error.message);
    state = markTestPlayerDead(submitted.state, 'silencer');
    const resolved = resolveNight(
      setNightResolutionPhase(state),
      resolutionRules,
    );

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players.villager?.publicFlags).toContain(
      SILENCED_FLAG,
    );
    expect(resolved.state.events).toContainEqual({
      playerId: 'villager',
      type: 'SILENCE_APPLIED',
    });
  });

  it('has no effect when the selected player dies that night', () => {
    let state = createNightTestState('SILENCER');
    const submitted = submitSilencerTarget(state, {
      actionId: 'silence-villager',
      targetPlayerId: 'villager',
    });
    if (!submitted.ok) throw new Error(submitted.error.message);
    state = markTestPlayerDead(submitted.state, 'villager');
    const resolved = resolveNight(
      setNightResolutionPhase(state),
      resolutionRules,
    );

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players.villager?.publicFlags).not.toContain(
      SILENCED_FLAG,
    );
  });

  it('removes the silenced player from voters, not targets, and expires at nightfall', () => {
    const state = createNightTestState('SILENCER');
    state.players.villager = {
      ...state.players.villager!,
      publicFlags: [SILENCED_FLAG],
    };
    state.phase = { dayNumber: 1, round: 1, type: 'VOTING' };
    const vote = startDayExecutionVote(state);

    expect(vote.ok).toBe(true);
    if (!vote.ok) return;
    expect(vote.state.votingContext?.eligibleVoterIds).not.toContain(
      'villager',
    );
    expect(vote.state.votingContext?.eligibleTargetIds).toContain('villager');

    const beforeNight = {
      ...vote.state,
      pendingTriggers: [],
      phase: { dayNumber: 1, type: 'DAY_DEATH_RESOLUTION' } as const,
    };
    const nextNight = startNextNight(beforeNight, 'night-2', {});
    expect(nextNight.ok).toBe(true);
    if (!nextNight.ok) return;
    expect(nextNight.state.players.villager?.publicFlags).not.toContain(
      SILENCED_FLAG,
    );
  });
});
