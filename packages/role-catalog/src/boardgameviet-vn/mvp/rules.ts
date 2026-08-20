import type {
  GuardRules,
  SeerRules,
  WerewolfRules,
} from '@werewolf/game-engine';

export interface MvpCoreRuleConfig {
  guard: GuardRules;
  seer: SeerRules;
  werewolf: WerewolfRules;
}
