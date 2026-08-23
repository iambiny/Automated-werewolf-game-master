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
  'Background music volume': 'Âm lượng nhạc nền',
  'End discussion and vote': 'Kết thúc thảo luận và bỏ phiếu',
  'Everyone is ready': 'Mọi người đã sẵn sàng',
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
  'Night action sound effects': 'Hiệu ứng âm thanh hành động ban đêm',
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
  '← Back': '← Quay lại',
  '← Home': '← Trang chủ',
  'Designed for a single phone passed around the table':
    'Được thiết kế cho một điện thoại chuyền quanh bàn',
  English: 'Tiếng Anh',
  'New game': 'Ván chơi mới',
  'Replace the saved game?': 'Thay thế ván chơi đã lưu?',
  'Continue with a new game': 'Tiếp tục với ván chơi mới',
  'Keep current match': 'Giữ ván chơi hiện tại',
  'House rules and timers are selected during New Game and saved with that match, so recovery uses the same choices.':
    'Luật riêng và đồng hồ được chọn khi tạo ván mới và được lưu cùng ván đấu, nên khi khôi phục vẫn dùng đúng các lựa chọn đó.',
  'Private results are never included in the public game view.':
    'Kết quả bí mật không bao giờ xuất hiện trong màn hình công khai.',
  'Match these counts to the cards players will draw.':
    'Điều chỉnh số lượng cho khớp với những lá bài người chơi sẽ rút.',
  'Review game rules': 'Xem lại luật chơi',
  'Only the choices that matter during this game.':
    'Chỉ những lựa chọn có ảnh hưởng đến ván chơi này.',
  'Seer reveals': 'Tiên Tri tiết lộ',
  'Team only': 'Chỉ phe',
  'Exact role': 'Vai trò chính xác',
  Guard: 'Bảo Vệ',
  'May protect themself': 'Có thể tự bảo vệ',
  "May repeat last night's target": 'Có thể bảo vệ lại mục tiêu của đêm trước',
  Witch: 'Phù Thủy',
  'Sees the Werewolf target': 'Biết mục tiêu của Ma Sói',
  'May heal themself': 'Có thể tự cứu mình',
  'May use both potions in one night':
    'Có thể dùng cả hai bình thuốc trong một đêm',
  'Fool & Mayor': 'Kẻ Ngốc và Trưởng Làng',
  'Fool survives first execution and loses vote':
    'Kẻ Ngốc sống sót lần xử tử đầu tiên và mất quyền bỏ phiếu',
  'Mayor office after death': 'Chức Trưởng Làng sau khi chết',
  Vacant: 'Bỏ trống',
  'Death reveal': 'Công bố khi chết',
  'No reveal': 'Không công bố',
  Timers: 'Đồng hồ',
  'Private role turn': 'Lượt vai trò bí mật',
  sec: 'giây',
  'Setup ·': 'Thiết lập ·',
  of: 'trên',
  Player: 'Người chơi',
  name: 'tên',
  'Continue with': 'Tiếp tục với',
  players: 'người chơi',
  'Hold to reveal roles': 'Giữ để xem vai trò',
  For: 'Dành cho',
  'Saving privately…': 'Đang lưu bí mật…',
  'Validate the deck': 'Xác thực bộ bài',
  'Pass to next player': 'Chuyển cho người chơi tiếp theo',
  'The roles do not match': 'Các vai trò không khớp',
  'Role registration does not match the selected deck. No player or role is identified.':
    'Vai trò đã đăng ký không khớp với bộ bài đã chọn. Không người chơi hay vai trò nào bị tiết lộ.',
  'Re-register every role': 'Đăng ký lại tất cả vai trò',
  'Pre-game check complete': 'Kiểm tra trước trận hoàn tất',
  'Turn on Do Not Disturb': 'Bật chế độ Không làm phiền',
  'Raise the volume for narration': 'Tăng âm lượng lời dẫn',
  'Everyone, close your eyes.': 'Mọi người hãy nhắm mắt.',
  'Place the phone with the moderator. Keep your eyes closed until dawn.':
    'Đặt điện thoại cạnh quản trò. Hãy nhắm mắt cho đến bình minh.',
  'Starting the night…': 'Đang bắt đầu đêm…',
  'Only this role should look at the screen.':
    'Chỉ người có vai trò này được nhìn màn hình.',
  'Hold the night still.': 'Hãy giữ yên màn đêm.',
  'Complete this private pause, then close your eyes when prompted.':
    'Hoàn tất khoảng dừng bí mật này, rồi nhắm mắt khi được nhắc.',
  'Werewolf target': 'Mục tiêu của Ma Sói',
  'The curse cannot choose a different player.':
    'Lời nguyền không thể chọn người chơi khác.',
  'Skip attack': 'Bỏ qua tấn công',
  'Use curse': 'Dùng lời nguyền',
  'Skip curse': 'Bỏ qua lời nguyền',
  'Use no potion': 'Không dùng bình thuốc',
  'Finish Witch turn': 'Kết thúc lượt Phù Thủy',
  'Healing potion': 'Bình thuốc cứu',
  'Poison potion': 'Bình thuốc độc',
  'Action hidden': 'Hành động đã được ẩn',
  'The screen is safe to return to the moderator.':
    'Có thể an toàn trả màn hình lại cho quản trò.',
  'Role is asleep': 'Vai trò đã ngủ',
  'Night is resolving…': 'Đang xử lý kết quả đêm…',
  'No private outcome will appear on this screen.':
    'Không kết quả bí mật nào xuất hiện trên màn hình này.',
  'Night actions remain secret. Only the final public outcome follows.':
    'Các hành động đêm vẫn được giữ bí mật. Chỉ kết quả công khai cuối cùng được thông báo.',
  'Preparing announcement…': 'Đang chuẩn bị thông báo…',
  'Reveal the morning': 'Công bố buổi sáng',
  'No one died. The reason remains hidden.':
    'Không ai chết. Nguyên nhân vẫn được giữ bí mật.',
  'No targets, protections, or hidden action sources are revealed.':
    'Không tiết lộ mục tiêu, sự bảo vệ hay nguồn hành động bí mật.',
  'Mandatory death trigger': 'Hiệu ứng khi chết bắt buộc',
  'The winner will not be checked until every Hunter shot resolves.':
    'Chưa xác định bên thắng cho đến khi mọi phát bắn của Thợ Săn được xử lý.',
  'Open vote · Moderator records': 'Bỏ phiếu công khai · Quản trò ghi nhận',
  'Recording ballot for': 'Đang ghi phiếu của',
  'Mayor ballot counts ×2': 'Phiếu của Trưởng Làng được tính ×2',
  'Public office elected': 'Đã bầu chức vụ công khai',
  "The Mayor's execution ballot counts ×2 while they hold office.":
    'Phiếu xử tử của Trưởng Làng được tính ×2 khi còn giữ chức.',
  'The village has the floor.': 'Ngôi làng đang thảo luận.',
  'Discussion is paused.': 'Thảo luận đang tạm dừng.',
  '+30 seconds': '+30 giây',
  'The vote is settled.': 'Cuộc bỏ phiếu đã kết thúc.',
  'The Village wins.': 'Phe Dân Làng chiến thắng.',
  'The Werewolves win.': 'Phe Ma Sói chiến thắng.',
  'Preparing Night 1…': 'Đang chuẩn bị Đêm 1…',
  Night: 'Đêm',
  'Open private controls': 'Mở điều khiển bí mật',
  ', open your eyes.': ', hãy mở mắt.',
  ', close your eyes.': ', hãy nhắm mắt.',
  'Complete turn': 'Hoàn tất lượt',
  'No attack': 'Không tấn công',
  Confirm: 'Xác nhận',
  target: 'mục tiêu',
  'Save the curse': 'Giữ lại lời nguyền',
  left: 'còn lại',
  'Heal the Werewolf victim without revealing their name.':
    'Cứu nạn nhân của Ma Sói mà không tiết lộ tên.',
  'There is no attack target to heal.': 'Không có mục tiêu bị tấn công để cứu.',
  'Use healing potion': 'Dùng bình thuốc cứu',
  'Confirm poison': 'Xác nhận dùng độc',
  'Werewolf aligned': 'Thuộc phe Ma Sói',
  'Village aligned': 'Thuộc phe Dân Làng',
  Unknown: 'Không rõ',
  'This result disappears as soon as you continue.':
    'Kết quả này sẽ biến mất ngay khi bạn tiếp tục.',
  'Hide result and sleep': 'Ẩn kết quả và đi ngủ',
  'Saving…': 'Đang lưu…',
  'Retry safely': 'Thử lại an toàn',
  s: ' giây',
  'The previous choice is no longer visible. Turn the screen away before passing it on.':
    'Lựa chọn trước không còn hiển thị. Hãy xoay màn hình đi trước khi chuyển cho người tiếp theo.',
  'players and their physical deck are registered. Secrets are saved on this device.':
    'người chơi và bộ bài vật lý của họ đã được đăng ký. Bí mật được lưu trên thiết bị này.',
  Morning: 'Buổi sáng',
  Seat: 'Ghế',
  'The village is unchanged.': 'Ngôi làng không có thay đổi.',
  'The night has taken its toll.': 'Đêm qua đã để lại hậu quả.',
  "The Hunter's shot lands.": 'Phát bắn của Thợ Săn đã trúng đích.',
  'Continue the morning': 'Tiếp tục buổi sáng',
  'Elect the first Mayor': 'Bầu Trưởng Làng đầu tiên',
  Round: 'Vòng',
  ballots: 'phiếu bầu',
  'Record vote for': 'Ghi phiếu cho',
  'The engine will apply vote eligibility, Mayor weight, and tie rules.':
    'Hệ thống sẽ áp dụng điều kiện bỏ phiếu, trọng số của Trưởng Làng và luật hòa phiếu.',
  'Resolve the vote': 'Xử lý kết quả bỏ phiếu',
  'Begin discussion': 'Bắt đầu thảo luận',
  'Village execution vote': 'Bỏ phiếu xử tử của làng',
  'The vote is tied. Only the tied players remain eligible.':
    'Phiếu bầu hòa. Chỉ những người chơi hòa phiếu còn đủ điều kiện.',
  'The vote is tied. Only the tied players remain eligible for the revote.':
    'Phiếu bầu hòa. Chỉ những người chơi hòa phiếu còn đủ điều kiện cho vòng bỏ phiếu lại.',
  'Werewolf-aligned players reached parity with the opposition.':
    'Phe Ma Sói đã đạt thế cân bằng với phe đối lập.',
  'Test sound again': 'Thử âm thanh lại',
};

const pageCopyReverse = Object.fromEntries(
  Object.entries(pageCopy).map(([english, vietnamese]) => [
    vietnamese,
    english,
  ]),
);

export function translateInterfaceText(
  locale: SupportedLocale,
  value: string,
): string {
  return locale === 'vi'
    ? (pageCopy[value] ?? translatePattern(value, locale))
    : (pageCopyReverse[value] ?? translatePattern(value, locale));
}

export function installPageLocalization(locale: SupportedLocale): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const translate = (value: string) => translateInterfaceText(locale, value);
  const localizeElement = (element: Element) => {
    for (const attribute of ['aria-label', 'placeholder', 'title']) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const translated = translate(value);
      if (translated !== value) element.setAttribute(attribute, translated);
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
      .replace(/^Continue with (\d+) players$/, 'Tiếp tục với $1 người chơi')
      .replace(/^Setup · (.+)$/, 'Thiết lập · $1')
      .replace(/^(\d+) of (\d+)$/, '$1 trên $2')
      .replace(/^Player (\d+) name$/, 'Tên người chơi $1')
      .replace(/^Move (.+) up$/, 'Di chuyển $1 lên')
      .replace(/^Move (.+) down$/, 'Di chuyển $1 xuống')
      .replace(/^Remove (.+)$/, 'Xóa $1')
      .replace(/^Add (.+)$/, 'Thêm $1')
      .replace(/^(.+) count$/, 'Số lượng $1')
      .replace(/^(.+) sec$/, '$1 giây')
      .replace(/^(\d+) left$/, 'Còn $1')
      .replace(/^(.+) was attacked\.$/, '$1 đã bị tấn công.');
  }
  return value
    .replace(/^Đêm (\d+)$/, 'Night $1')
    .replace(/^Buổi sáng (\d+)$/, 'Morning $1')
    .replace(/^Ghế (\d+)$/, 'Seat $1')
    .replace(/^Dành cho (.+)$/, 'For $1')
    .replace(/^Tiếp tục với (\d+) người chơi$/, 'Continue with $1 players')
    .replace(/^Thiết lập · (.+)$/, 'Setup · $1')
    .replace(/^(\d+) trên (\d+)$/, '$1 of $2')
    .replace(/^Tên người chơi (\d+)$/, 'Player $1 name')
    .replace(/^Di chuyển (.+) lên$/, 'Move $1 up')
    .replace(/^Di chuyển (.+) xuống$/, 'Move $1 down')
    .replace(/^Xóa (.+)$/, 'Remove $1')
    .replace(/^Thêm (.+)$/, 'Add $1')
    .replace(/^Số lượng (.+)$/, '$1 count')
    .replace(/^(.+) giây$/, '$1 sec')
    .replace(/^Còn (\d+)$/, '$1 left')
    .replace(/^(.+) đã bị tấn công\.$/, '$1 was attacked.');
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
