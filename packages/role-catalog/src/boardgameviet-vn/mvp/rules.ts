import type {
  ExecutionInterceptor,
  FoolRules,
  GuardRules,
  HunterRules,
  MayorRules,
  NightResolutionRules,
  SeerRules,
  TiePolicy,
  WerewolfRules,
  WinRules,
  WitchRules,
} from '@werewolf/game-engine';
import { createFoolExecutionInterceptor } from '@werewolf/game-engine';
import type { PlayerId, RoleRuntimeState } from '@werewolf/game-engine';

import type { MvpRoleId } from './ids';

export interface MvpRuleConfig {
  fool: FoolRules;
  guard: GuardRules;
  hunter: HunterRules;
  mayor: MayorRules;
  nightResolution: Pick<NightResolutionRules, 'healPreventsCurse'>;
  seer: SeerRules;
  tiePolicy: TiePolicy;
  werewolf: WerewolfRules;
  win: WinRules;
  witch: WitchRules;
}

export type MvpCoreRuleConfig = MvpRuleConfig;

export function createMvpExecutionInterceptors(
  rules: Pick<MvpRuleConfig, 'fool'>,
): ExecutionInterceptor[] {
  return [createFoolExecutionInterceptor(rules.fool)];
}

export function createMvpRoleRuntimeState(
  playerId: PlayerId,
  roleId: MvpRoleId,
  rules: Pick<MvpRuleConfig, 'witch'>,
): RoleRuntimeState {
  if (roleId === 'HYBRID_WOLF') {
    return { data: { converted: false }, playerId, roleId };
  }

  if (roleId === 'DEMON_WOLF') {
    return { data: { curseAvailable: true }, playerId, roleId };
  }

  if (roleId === 'WITCH') {
    return {
      data: {
        healPotionRemaining: rules.witch.healPotionCount,
        poisonPotionRemaining: rules.witch.poisonPotionCount,
      },
      playerId,
      roleId,
    };
  }

  return { data: {}, playerId, roleId };
}
