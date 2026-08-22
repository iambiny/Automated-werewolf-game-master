import type { MvpRoleId } from '@werewolf/role-catalog';

export const SUPPORTED_LOCALES = ['en', 'vi'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

let activeLocale: SupportedLocale = DEFAULT_LOCALE;

export const LOCALE_OPTIONS: ReadonlyArray<{
  label: string;
  value: SupportedLocale;
}> = [
  { label: 'English', value: 'en' },
  { label: 'Tiếng Việt', value: 'vi' },
];

const roleLabels: Record<SupportedLocale, Record<MvpRoleId, string>> = {
  en: {
    DEMON_WOLF: 'Demon Wolf',
    FOOL: 'Fool',
    GUARD: 'Guard',
    HUNTER: 'Hunter',
    SEER: 'Seer',
    VILLAGER: 'Villager',
    WEREWOLF: 'Werewolf',
    WITCH: 'Witch',
  },
  vi: {
    DEMON_WOLF: 'Sói Quỷ',
    FOOL: 'Kẻ Ngốc',
    GUARD: 'Bảo Vệ',
    HUNTER: 'Thợ Săn',
    SEER: 'Tiên Tri',
    VILLAGER: 'Dân Làng',
    WEREWOLF: 'Ma Sói',
    WITCH: 'Phù Thủy',
  },
};

export function getRoleLabels(
  locale: SupportedLocale,
): Record<MvpRoleId, string> {
  return roleLabels[locale];
}

export function getActiveLocale(): SupportedLocale {
  return activeLocale;
}

export function setActiveLocale(locale: SupportedLocale): void {
  activeLocale = locale;
}

// This catalogue covers shared controls and all screen copy that is rendered as
// static DOM text. Dynamic role, phase, and narration strings use the typed
// helpers below so interpolated values remain intact.
const pageCopy: Record<string, string> = {
  'A game of trust after dark': 'Trò chơi của niềm tin sau màn đêm',
  'Active match': 'Ván chơi đang diễn ra',
  'Add player': 'Thêm người chơi',
  'All public ballots are recorded': 'Đã ghi nhận tất cả phiếu bầu công khai',
  'Arrange players in clockwise seat order.':
    'Sắp xếp người chơi theo thứ tự ghế ngồi chiều kim đồng hồ.',
  'Begin Night 1': 'Bắt đầu Đêm 1',
  'Begin secret registration': 'Bắt đầu đăng ký vai trò bí mật',
  'Build the physical deck': 'Chuẩn bị bộ bài vật lý',
  'Cards selected': 'Số lá bài đã chọn',
  'Confirm my role': 'Xác nhận vai trò của tôi',
  'Choose your role': 'Chọn vai trò của bạn',
  'Checking the village…': 'Đang kiểm tra ngôi làng…',
  Continue: 'Tiếp tục',
  'Day discussion': 'Thảo luận ban ngày',
  'Effects volume': 'Âm lượng hiệu ứng',
  'End discussion and vote': 'Kết thúc thảo luận và bỏ phiếu',
  'Everyone is ready': 'Mọi người đã sẵn sàng',
  'Everyone, close your eyes.': 'Mọi người hãy nhắm mắt.',
  'Execution result': 'Kết quả xử tử',
  'Everyone else, look away. Your card stays private.':
    'Mọi người khác hãy nhìn đi chỗ khác. Lá bài của bạn được giữ bí mật.',
  'Find the Werewolves.': 'Tìm Ma Sói.',
  'For the Seer only': 'Chỉ dành cho Tiên Tri',
  'Game over': 'Trò chơi kết thúc',
  'Hidden safely': 'Đã được ẩn an toàn',
  Home: 'Trang chủ',
  Language: 'Ngôn ngữ',
  'Match your physical card': 'Đối chiếu lá bài vật lý của bạn',
  'Morning announcement': 'Thông báo buổi sáng',
  'Narration volume': 'Âm lượng lời dẫn',
  'No target': 'Không có mục tiêu',
  'No outcome was guessed and no private information was displayed.':
    'Không có kết quả nào bị phỏng đoán và không có thông tin riêng tư nào được hiển thị.',
  'One shared device. Physical cards. A calm game master who never forgets what happened in the night.':
    'Một thiết bị chung. Những lá bài vật lý. Một quản trò điềm tĩnh không bao giờ quên những gì đã xảy ra trong đêm.',
  'One tap unlocks offline audio for the match.':
    'Một lần chạm sẽ mở khóa âm thanh ngoại tuyến cho ván đấu.',
  'Pass the phone to': 'Chuyển điện thoại cho',
  Pause: 'Tạm dừng',
  'Play again': 'Chơi lại',
  'Place the phone where everyone can hear':
    'Đặt điện thoại ở nơi mọi người đều có thể nghe thấy',
  'Private action': 'Hành động bí mật',
  'Private choice': 'Lựa chọn bí mật',
  'Private validation': 'Xác thực riêng tư',
  'Privacy by design': 'Thiết kế bảo mật riêng tư',
  'Public announcement': 'Thông báo công khai',
  'Public reveal': 'Công bố công khai',
  Resume: 'Tiếp tục',
  'Resume game': 'Tiếp tục ván chơi',
  'Return home': 'Về trang chủ',
  'Role saved': 'Đã lưu vai trò',
  'Rules travel with the match': 'Luật chơi đi cùng ván đấu',
  'Safe recovery': 'Khôi phục an toàn',
  Settings: 'Cài đặt',
  'Secret registration': 'Đăng ký bí mật',
  'Set the house rules': 'Thiết lập luật riêng',
  'Sound ready — test again': 'Âm thanh sẵn sàng — thử lại',
  'Sound could not start; visual instructions will remain available.':
    'Không thể khởi động âm thanh; hướng dẫn trực quan vẫn sẽ khả dụng.',
  'Start a new game': 'Bắt đầu ván chơi mới',
  'Starting registration for another game will archive the current match when the new match is saved.':
    'Bắt đầu đăng ký cho ván khác sẽ lưu trữ ván hiện tại khi ván mới được lưu.',
  'Start the night': 'Bắt đầu đêm',
  'Test sound': 'Thử âm thanh',
  'The village is ready': 'Ngôi làng đã sẵn sàng',
  'The village sleeps': 'Ngôi làng chìm vào giấc ngủ',
  'The village wakes.': 'Ngôi làng thức giấc.',
  'This match cannot be resumed.': 'Không thể tiếp tục ván đấu này.',
  'Tiếng Việt': 'Tiếng Việt',
  'Unlock and test sound': 'Mở khóa và thử âm thanh',
  'Wake quietly': 'Thức dậy nhẹ nhàng',
  Werewolf: 'Ma Sói',
  'Who is at the table?': 'Ai đang ngồi quanh bàn?',
  'Your target': 'Mục tiêu của bạn',
  'Your role': 'Vai trò của bạn',
};

const pageCopyReverse = Object.fromEntries(
  Object.entries(pageCopy).map(([english, vietnamese]) => [
    vietnamese,
    english,
  ]),
);

export function installPageLocalization(locale: SupportedLocale): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const translate = (value: string) =>
    locale === 'vi'
      ? (pageCopy[value] ?? translatePattern(value, locale))
      : (pageCopyReverse[value] ?? translatePattern(value, locale));
  const localizeElement = (element: Element) => {
    for (const attribute of ['aria-label', 'placeholder', 'title']) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, translate(value));
    }
  };
  const localizeText = (node: Text) => {
    const original = node.nodeValue ?? '';
    const trimmed = original.trim();
    const translated = translate(trimmed);
    if (translated !== trimmed)
      node.nodeValue = original.replace(trimmed, translated);
  };
  const localize = (root: Node) => {
    if (root instanceof Text) {
      localizeText(root);
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
    textNodes.forEach(localizeText);
    if (root instanceof Element) localizeElement(root);
    if (root instanceof Element || root instanceof Document) {
      root
        .querySelectorAll('[aria-label], [placeholder], [title]')
        .forEach(localizeElement);
    }
  };
  localize(document.body);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') localize(mutation.target);
      else if (mutation.type === 'characterData') localize(mutation.target);
      else mutation.addedNodes.forEach(localize);
    }
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['aria-label', 'placeholder', 'title'],
    characterData: true,
    childList: true,
    subtree: true,
  });
  return () => observer.disconnect();
}

function translatePattern(value: string, locale: SupportedLocale): string {
  if (locale === 'vi') {
    return value
      .replace(/^Night (\d+)$/, 'Đêm $1')
      .replace(/^Morning (\d+)$/, 'Buổi sáng $1')
      .replace(/^Seat (\d+)$/, 'Ghế $1')
      .replace(/^For (.+)$/, 'Dành cho $1')
      .replace(/^Continue with (\d+) players$/, 'Tiếp tục với $1 người chơi');
  }
  return value
    .replace(/^Đêm (\d+)$/, 'Night $1')
    .replace(/^Buổi sáng (\d+)$/, 'Morning $1')
    .replace(/^Ghế (\d+)$/, 'Seat $1')
    .replace(/^Dành cho (.+)$/, 'For $1')
    .replace(/^Tiếp tục với (\d+) người chơi$/, 'Continue with $1 players');
}

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === 'string' &&
    SUPPORTED_LOCALES.includes(value as SupportedLocale)
  );
}

export function translatePhase(
  locale: SupportedLocale,
  phase: 'ROLE_REGISTRATION' | 'PRE_GAME_VALIDATION' | 'NIGHT' | string,
  nightNumber?: number,
): string {
  if (locale === 'vi') {
    if (phase === 'ROLE_REGISTRATION') return 'Đăng ký vai trò bí mật';
    if (phase === 'PRE_GAME_VALIDATION') return 'Sẵn sàng bắt đầu Đêm 1';
    if (phase === 'NIGHT') return `Đêm ${nightNumber ?? ''}`.trim();
  }
  if (phase === 'ROLE_REGISTRATION') return 'Secret role registration';
  if (phase === 'PRE_GAME_VALIDATION') return 'Ready to begin Night 1';
  if (phase === 'NIGHT') return `Night ${nightNumber ?? ''}`.trim();
  return phase.replaceAll('_', ' ').toLocaleLowerCase(locale);
}

export function translateNightPrompt(
  locale: SupportedLocale,
  roleId: string,
): string {
  const prompts: Record<SupportedLocale, Record<string, string>> = {
    en: {
      DEMON_WOLF: 'Will you spend the curse?',
      GUARD: 'Who will you protect tonight?',
      SEER: 'Whose truth will you reveal?',
      WEREWOLF: 'Choose the village target.',
      WITCH: 'Will you use a potion?',
      default: 'Complete your night action.',
    },
    vi: {
      DEMON_WOLF: 'Bạn có dùng lời nguyền không?',
      GUARD: 'Đêm nay bạn sẽ bảo vệ ai?',
      SEER: 'Bạn sẽ soi thân phận của ai?',
      WEREWOLF: 'Chọn mục tiêu trong làng.',
      WITCH: 'Bạn có dùng bình thuốc không?',
      default: 'Hoàn thành hành động đêm của bạn.',
    },
  };
  return prompts[locale][roleId] ?? prompts[locale].default ?? '';
}

export function translateDeathReveal(
  locale: SupportedLocale,
  teamId?: string,
): string {
  if (!teamId)
    return locale === 'vi'
      ? 'Vai trò vẫn được giữ bí mật'
      : 'Role remains hidden';
  if (teamId === 'WEREWOLF') {
    return locale === 'vi' ? 'Phe Ma Sói' : 'Werewolf aligned';
  }
  return locale === 'vi' ? 'Phe Dân Làng' : 'Village aligned';
}
