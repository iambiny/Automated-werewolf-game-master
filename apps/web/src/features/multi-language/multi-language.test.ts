import { describe, expect, it } from 'vitest';

import {
  getRoleLabels,
  isSupportedLocale,
  translateNightPrompt,
  translatePhase,
} from './multi-language';

describe('multi-language', () => {
  it('provides Vietnamese labels for every MVP role', () => {
    expect(getRoleLabels('vi')).toMatchObject({
      SEER: 'Tiên Tri',
      WEREWOLF: 'Ma Sói',
      WITCH: 'Phù Thủy',
    });
  });

  it('translates player-facing narration and phase labels', () => {
    expect(translateNightPrompt('vi', 'GUARD')).toBe(
      'Đêm nay bạn sẽ bảo vệ ai?',
    );
    expect(translatePhase('vi', 'NIGHT', 2)).toBe('Đêm 2');
  });

  it('accepts only supported locale codes', () => {
    expect(isSupportedLocale('vi')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
  });
});
