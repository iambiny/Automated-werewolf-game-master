export const MVP_ROLE_IDS = [
  'VILLAGER',
  'SEER',
  'GUARD',
  'HYBRID_WOLF',
  'WEREWOLF',
  'DEMON_WOLF',
  'WITCH',
  'HUNTER',
  'FOOL',
] as const;

export type MvpRoleId = (typeof MVP_ROLE_IDS)[number];

export const MVP_PUBLIC_OFFICE_IDS = ['MAYOR'] as const;

export type MvpPublicOfficeId = (typeof MVP_PUBLIC_OFFICE_IDS)[number];
