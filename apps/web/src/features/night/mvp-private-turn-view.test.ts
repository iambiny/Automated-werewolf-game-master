import { describe, expect, it } from 'vitest';

import { createNightTestState } from '../../../../../packages/game-engine/src/testing/night-state';
import { DEFAULT_SETUP_RULES, toMvpRuleConfig } from '../setup/setup-model';
import { toMvpPrivateTurnView } from './mvp-private-turn-view';

const rules = toMvpRuleConfig(DEFAULT_SETUP_RULES);

describe('MVP private night projection', () => {
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

  it('removes targets and resources from a DECOY turn', () => {
    const view = toMvpPrivateTurnView(
      createNightTestState('WITCH', 'DECOY'),
      rules,
    );

    expect(view).toMatchObject({ mode: 'DECOY', roleId: 'WITCH' });
    expect(view?.privateContext).toBeUndefined();
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
});
