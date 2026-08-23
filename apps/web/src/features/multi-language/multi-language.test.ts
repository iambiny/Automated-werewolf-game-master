import { describe, expect, it } from 'vitest';

import {
  getRoleLabels,
  isSupportedLocale,
  translateInterfaceText,
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

  it('translates every kind of character night action copy', () => {
    expect(translateInterfaceText('vi', 'Open private controls')).toBe(
      'Mở điều khiển bí mật',
    );
    expect(translateInterfaceText('vi', 'No attack')).toBe('Không tấn công');
    expect(translateInterfaceText('vi', 'Save the curse')).toBe(
      'Giữ lại lời nguyền',
    );
    expect(translateInterfaceText('vi', 'Use healing potion')).toBe(
      'Dùng bình thuốc cứu',
    );
    expect(translateInterfaceText('vi', 'Confirm poison')).toBe(
      'Xác nhận dùng độc',
    );
    expect(translateInterfaceText('vi', '2 left')).toBe('Còn 2');
    expect(translateInterfaceText('vi', 'Player 3 was attacked.')).toBe(
      'Player 3 đã bị tấn công.',
    );
    expect(translateInterfaceText('vi', ', close your eyes.')).toBe(
      ', hãy nhắm mắt.',
    );
  });

  it('translates public-flow, voting, and winner messages', () => {
    expect(translateInterfaceText('vi', 'Morning')).toBe('Buổi sáng');
    expect(translateInterfaceText('vi', 'Seat')).toBe('Ghế');
    expect(translateInterfaceText('vi', 'Round')).toBe('Vòng');
    expect(translateInterfaceText('vi', 'ballots')).toBe('phiếu bầu');
    expect(translateInterfaceText('vi', 'Elect the first Mayor')).toBe(
      'Bầu Trưởng Làng đầu tiên',
    );
    expect(translateInterfaceText('vi', 'Resolve the vote')).toBe(
      'Xử lý kết quả bỏ phiếu',
    );
    expect(
      translateInterfaceText(
        'vi',
        'Werewolf-aligned players reached parity with the opposition.',
      ),
    ).toBe('Phe Ma Sói đã đạt thế cân bằng với phe đối lập.');
  });

  it('accepts only supported locale codes', () => {
    expect(isSupportedLocale('vi')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
  });
});
