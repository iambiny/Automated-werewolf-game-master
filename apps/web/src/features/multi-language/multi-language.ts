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
