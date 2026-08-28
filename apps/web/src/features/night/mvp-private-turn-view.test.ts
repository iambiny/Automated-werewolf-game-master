import { describe, expect, it } from 'vitest';

import {
  createNightTestState,
  markTestPlayerCursed,
  setActiveNightTurn,
} from '../../../../../packages/game-engine/src/testing/night-state';
import {
  submitDemonWolfCurseDecision,
  submitGuardProtection,
  submitWerewolfAttack,
} from '@werewolf/game-engine';
import { DEFAULT_SETUP_RULES, toMvpRuleConfig } from '../setup/setup-model';
import { toMvpPrivateTurnView } from './mvp-private-turn-view';

const rules = toMvpRuleConfig(DEFAULT_SETUP_RULES);

describe('MVP private night projection', () => {
  it('shows the Hybrid Wolf private allegiance status before and after conversion', () => {
    const village = createNightTestState('HYBRID_WOLF', 'DECOY');
    const before = toMvpPrivateTurnView(village, rules);

    const converted = structuredClone(village);
    converted.roleAssignments['hybrid-wolf'] = {
      converted: true,
      currentRoleId: 'WEREWOLF',
      originalRoleId: 'HYBRID_WOLF',
      teamId: 'WEREWOLF',
    };
    converted.roleState['hybrid-wolf'] = {
      data: { converted: true },
      playerId: 'hybrid-wolf',
      roleId: 'WEREWOLF',
    };
    const after = toMvpPrivateTurnView(converted, rules);

    expect(before?.privateContext?.hybridWolf).toMatchObject({
      converted: false,
      player: { playerId: 'hybrid-wolf' },
    });
    expect(after?.privateContext?.hybridWolf).toMatchObject({
      converted: true,
      player: { playerId: 'hybrid-wolf' },
    });

    converted.phase = {
      nightNumber: 1,
      subphase: 'RESOLUTION',
      type: 'NIGHT',
    };
    converted.nightContext!.resolution = {
      attackPrevented: false,
      curseOutcome: 'NONE',
      deaths: [],
      nightNumber: 1,
      transformedPlayerId: 'hybrid-wolf',
    };
    expect(toMvpPrivateTurnView(converted, rules)).toBeNull();
  });

  it('shows a pending bite conversion during the normal Hybrid Wolf turn', () => {
    const attack = submitWerewolfAttack(
      createNightTestState('WEREWOLF'),
      { actionId: 'bite-hybrid', targetPlayerId: 'hybrid-wolf' },
      { allowNoAttack: false, selectionStrategy: 'SHARED_SELECTION' },
    );
    expect(attack.ok).toBe(true);
    if (!attack.ok) throw new Error(attack.error.message);
    const state = setActiveNightTurn(attack.state, 'HYBRID_WOLF', 'DECOY');

    expect(
      toMvpPrivateTurnView(state, rules)?.privateContext?.hybridWolf,
    ).toMatchObject({
      converted: true,
      player: { playerId: 'hybrid-wolf' },
    });
  });

  it('shows Werewolves only eligible village targets', () => {
    const view = toMvpPrivateTurnView(createNightTestState('WEREWOLF'), rules);

    expect(view?.validTargets?.map((target) => target.playerId)).not.toContain(
      'wolf',
    );
    expect(view?.validTargets?.map((target) => target.playerId)).not.toContain(
      'demon-wolf',
    );
    expect(view?.validTargets?.map((target) => target.playerId)).toContain(
      'villager',
    );
  });

  it('shows the Demon Wolf only the shared attack target', () => {
    const state = createNightTestState('DEMON_WOLF');
    state.nightContext!.werewolfAttackTargetId = 'villager';

    const view = toMvpPrivateTurnView(state, rules);

    expect(view?.validTargets).toBeUndefined();
    expect(view?.privateContext?.werewolfVictim).toMatchObject({
      displayName: 'Villager',
      playerId: 'villager',
    });
  });

  it('shows a successful private curse handoff immediately after submission', () => {
    const state = createNightTestState('DEMON_WOLF');
    state.nightContext!.werewolfAttackTargetId = 'villager';
    const result = submitDemonWolfCurseDecision(state, {
      actionId: 'curse-villager',
      decision: 'CURSE',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(toMvpPrivateTurnView(result.state, rules)?.curseResult).toEqual({
      outcome: 'SUCCEEDED',
      target: { displayName: 'Villager', playerId: 'villager', seatIndex: 4 },
    });
  });

  it('shows curse failure without a successful handoff when Guard protected the target', () => {
    let state = createNightTestState('GUARD');
    const protectedResult = submitGuardProtection(
      state,
      { actionId: 'protect-villager', targetPlayerId: 'villager' },
      { allowSameTargetConsecutiveNights: false, allowSelfProtect: false },
    );
    expect(protectedResult.ok).toBe(true);
    if (!protectedResult.ok) throw new Error(protectedResult.error.message);
    state = setActiveNightTurn(protectedResult.state, 'DEMON_WOLF');
    state.nightContext!.werewolfAttackTargetId = 'villager';
    const curseResult = submitDemonWolfCurseDecision(state, {
      actionId: 'blocked-curse',
      decision: 'CURSE',
    });

    expect(curseResult.ok).toBe(true);
    if (!curseResult.ok) throw new Error(curseResult.error.message);
    expect(toMvpPrivateTurnView(curseResult.state, rules)?.curseResult).toEqual(
      {
        outcome: 'FAILED',
        target: { displayName: 'Villager', playerId: 'villager', seatIndex: 4 },
      },
    );
  });

  it('removes the ability UI from a cursed functional role', () => {
    const state = markTestPlayerCursed(createNightTestState('SEER'), 'seer');

    const view = toMvpPrivateTurnView(state, rules);

    expect(view).toMatchObject({ mode: 'DECOY', roleId: 'SEER' });
    expect(view?.privateContext?.cursedPlayers).toEqual([
      { displayName: 'Seer', playerId: 'seer', seatIndex: 0 },
    ]);
    expect(view?.validTargets).toBeUndefined();
  });

  it('removes targets and resources from a DECOY turn', () => {
    const view = toMvpPrivateTurnView(
      createNightTestState('WITCH', 'DECOY'),
      rules,
    );

    expect(view).toMatchObject({ mode: 'DECOY', roleId: 'WITCH' });
    expect(view?.privateContext).toBeUndefined();
    expect(view?.validTargets).toBeUndefined();
  });

  it('does not reveal the Werewolf victim or potions to a cursed Witch', () => {
    const state = markTestPlayerCursed(createNightTestState('WITCH'), 'witch');
    state.nightContext!.werewolfAttackTargetId = 'villager';

    const view = toMvpPrivateTurnView(state, rules);

    expect(view).toMatchObject({ mode: 'DECOY', roleId: 'WITCH' });
    expect(view?.privateContext?.cursedPlayers).toEqual([
      { displayName: 'Witch', playerId: 'witch', seatIndex: 5 },
    ]);
    expect(view?.privateContext?.werewolfVictim).toBeUndefined();
    expect(view?.privateContext?.healPotionRemaining).toBeUndefined();
    expect(view?.privateContext?.poisonPotionRemaining).toBeUndefined();
    expect(view?.validTargets).toBeUndefined();
  });

  it('limits Witch context to private potion resources and configured victim visibility', () => {
    const state = createNightTestState('WITCH');
    state.nightContext!.werewolfAttackTargetId = 'villager';

    const visible = toMvpPrivateTurnView(state, rules);
    const hidden = toMvpPrivateTurnView(state, {
      ...rules,
      witch: { ...rules.witch, seesWerewolfVictim: false },
    });

    expect(visible?.privateContext).toMatchObject({
      canHealWerewolfVictim: true,
      healPotionRemaining: 1,
      poisonPotionRemaining: 1,
      werewolfVictim: { playerId: 'villager' },
    });
    expect(hidden?.privateContext?.werewolfVictim).toBeUndefined();
  });

  it('does not show or offer healing for a Guard-protected Werewolf target', () => {
    let state = createNightTestState('GUARD');
    const protectedResult = submitGuardProtection(
      state,
      { actionId: 'guard-protect-wolf-target', targetPlayerId: 'villager' },
      { allowSameTargetConsecutiveNights: false, allowSelfProtect: false },
    );
    expect(protectedResult.ok).toBe(true);
    if (!protectedResult.ok) throw new Error(protectedResult.error.message);
    state = setActiveNightTurn(protectedResult.state, 'WITCH');
    state.nightContext!.werewolfAttackTargetId = 'villager';

    const view = toMvpPrivateTurnView(state, rules);

    expect(view?.privateContext).toMatchObject({
      canHealWerewolfVictim: false,
      healPotionRemaining: 1,
      poisonPotionRemaining: 1,
    });
    expect(view?.privateContext?.werewolfVictim).toBeUndefined();
  });
});
