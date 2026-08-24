import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PLAYERS,
  DEFAULT_ROLE_COUNTS,
  DEFAULT_SETUP_RULES,
  parseSetupRules,
  serializeSetupRules,
  toRoleComposition,
  validatePlayers,
  validateRoleCounts,
} from './setup-model';

describe('setup model', () => {
  it('provides a valid eight-player starter setup', () => {
    expect(validatePlayers(DEFAULT_PLAYERS)).toBeNull();
    expect(validateRoleCounts(DEFAULT_ROLE_COUNTS, 8)).toBeNull();
    expect(
      toRoleComposition(DEFAULT_ROLE_COUNTS).reduce(
        (total, entry) => total + entry.count,
        0,
      ),
    ).toBe(8);
  });

  it('normalizes names when detecting duplicates', () => {
    expect(
      validatePlayers([
        { id: '1', name: '  Alice ' },
        { id: '2', name: 'alice' },
      ]),
    ).toBe('Player names must be unique.');
  });

  it('reports deck size mismatches', () => {
    expect(validateRoleCounts(DEFAULT_ROLE_COUNTS, 9)).toBe(
      'Your deck has 8 cards for 9 players.',
    );
  });

  it('round-trips persisted rule settings', () => {
    expect(parseSetupRules(serializeSetupRules(DEFAULT_SETUP_RULES))).toEqual(
      DEFAULT_SETUP_RULES,
    );
  });

  it('defaults older saved matches to a five-second night transition', () => {
    expect(parseSetupRules({}).nightTransitionSeconds).toBe(5);
  });

  it('migrates the previous Fool toggle and accepts the win option', () => {
    expect(
      parseSetupRules({ foolSurvivesFirstExecution: false })
        .foolExecutionBehavior,
    ).toBe('DIES_NORMALLY');
    expect(
      parseSetupRules({ foolExecutionBehavior: 'WINS_WHEN_EXECUTED' })
        .foolExecutionBehavior,
    ).toBe('WINS_WHEN_EXECUTED');
  });
});
