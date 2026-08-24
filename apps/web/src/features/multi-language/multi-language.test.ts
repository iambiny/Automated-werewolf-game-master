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

  it('translates deck-builder faction headings', () => {
    expect(translateInterfaceText('vi', 'Villagers')).toBe('Phe Dân Làng');
    expect(translateInterfaceText('vi', 'Werewolves')).toBe('Phe Ma Sói');
    expect(translateInterfaceText('vi', 'Third Party')).toBe('Phe Thứ Ba');
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

  it('translates automatic night-transition copy and countdown values', () => {
    expect(translateInterfaceText('vi', 'Night transition delay')).toBe(
      'Thời gian chuyển vai ban đêm',
    );
    expect(translateInterfaceText('vi', 'First role wakes in')).toBe(
      'Vai đầu tiên thức dậy sau',
    );
    expect(translateInterfaceText('vi', 'Retry transition')).toBe(
      'Thử chuyển tiếp lại',
    );
    expect(
      translateInterfaceText(
        'vi',
        'The next night step starts automatically when the countdown ends.',
      ),
    ).toBe(
      'Bước ban đêm tiếp theo sẽ tự động bắt đầu khi hết thời gian đếm ngược.',
    );
    expect(translateInterfaceText('vi', 'Eyes-closed buffer:')).toBe(
      'Thời gian nhắm mắt:',
    );
    expect(translateInterfaceText('vi', 'Continuing…')).toBe('Đang tiếp tục…');
    expect(translateInterfaceText('vi', '5s')).toBe('5 giây');
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
    expect(translateInterfaceText('vi', 'No player was executed.')).toBe(
      'Không người chơi nào bị treo cổ.',
    );
    expect(
      translateInterfaceText(
        'vi',
        'Werewolf-aligned players reached parity with the opposition.',
      ),
    ).toBe('Phe Ma Sói đã đạt thế cân bằng với phe đối lập.');
    expect(translateInterfaceText('vi', 'Survives, loses vote')).toBe(
      'Sống sót, mất quyền bỏ phiếu',
    );
    expect(translateInterfaceText('vi', 'Wins when executed')).toBe(
      'Thắng khi bị treo cổ',
    );
    expect(
      translateInterfaceText(
        'vi',
        'Your role ability is disabled. Wake with the Werewolves from now on; your new alignment is Werewolf.',
      ),
    ).toBe(
      'Khả năng của vai trò này đã bị vô hiệu hóa. Từ bây giờ, hãy thức dậy cùng Ma Sói; phe mới của bạn là Ma Sói.',
    );
    expect(translateInterfaceText('vi', 'Lan wins.')).toBe('Lan chiến thắng.');
    expect(translateInterfaceText('vi', 'Unclear role')).toBe('Không rõ phe');
  });

  it('accepts only supported locale codes', () => {
    expect(isSupportedLocale('vi')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
  });
});
