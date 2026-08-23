# Automated Werewolf Game Master — MVP Role Catalog

**Document version:** 1.0  
**Status:** MVP role rules source  
**Ruleset:** BoardGameViet-compatible basic MVP preset with project-specific overrides  
**MVP roles:** Villager, Guard, Seer, Witch, Werewolf, Hunter, Fool, Demon Wolf  
**Public office:** Mayor / Trưởng làng  

---

# 1. Purpose

This document defines the roles and public office used by the MVP.

The game engine should treat this file as rule-catalog input rather than hard-code role behavior into the phase engine.

---

# 2. Team Definitions

```ts
type TeamId =
  | 'VILLAGE'
  | 'WEREWOLF';
```

MVP has no neutral win-condition faction.

---

# 3. Night Order

Default MVP order:

```text
1. Seer
2. Guard
3. Werewolf
4. Demon Wolf
5. Witch
6. Night Resolution
```

Functional roles continue to be narrated after death or ability exhaustion using DECOY turns when required by privacy rules.

---

# 4. Common Role Metadata

Recommended shape:

```ts
interface MvpRoleDefinition {
  id: RoleId;
  name: string;
  teamId: TeamId;

  hasPhysicalCard: boolean;

  night?: {
    order: number;
    narratorAlwaysCallsIfInComposition: boolean;
  };

  description: string;
}
```

---

# 5. Villager / Dân làng

```ts
id: 'VILLAGER'
teamId: 'VILLAGE'
```

## Behavior

- No night action.
- No special death trigger.
- Vote weight = 1 unless holder is Mayor.
- Wins with Village.

## Narration

No night call required.

---

# 6. Seer / Tiên tri

```ts
id: 'SEER'
teamId: 'VILLAGE'
night.order: 10
```

## Night behavior

- Called first among MVP active night roles.
- If alive: ACTIVE turn.
- If dead: DECOY turn.
- Select one valid living player to inspect.

## Investigation mode

Configurable:

```ts
type SeerInvestigationMode = 'TEAM' | 'ROLE';
```

### TEAM

Show only:

```text
Village
or
Werewolf
```

### ROLE

Show exact current role:

```text
Villager
Guard
Seer
Witch
Werewolf
Hunter
Fool
Demon Wolf
```

If a player was successfully cursed, ROLE mode continues to show their
functional current role while their team/alignment is `WEREWOLF`. They are
privately told to retain that function and also wake with the Werewolves.

## Restrictions

- Cannot select invalid/dead targets.
- Self-inspection should follow config; recommended default: disallow.

## Private information

Inspection result is visible only during Seer turn.

---

# 7. Guard / Bảo vệ

```ts
id: 'GUARD'
teamId: 'VILLAGE'
night.order: 20
```

## Night behavior

- Called after Seer.
- If alive: ACTIVE.
- If dead: DECOY.
- Select one living target to protect.

## Effect

```ts
PROTECT(target)
```

Protection can block the Werewolf attack.

If the Werewolf target is also targeted by Demon Wolf curse:

```text
Guard protection succeeds
→ Werewolf attack fails
→ Demon Wolf curse fails
→ curse is not consumed
```

## Rule configuration

Represent explicitly:

```ts
interface GuardRules {
  allowSelfProtect: boolean;
  allowSameTargetConsecutiveNights: boolean;
}
```

Use the selected basic preset values.

---

# 8. Werewolf / Ma sói

```ts
id: 'WEREWOLF'
teamId: 'WEREWOLF'
night.order: 30
```

## Night behavior

All eligible living wolf-aligned attack participants wake together.

MVP strategy:

```ts
werewolfSelectionStrategy = 'SHARED_SELECTION'
```

The group chooses one target.

## Attack effect

```ts
WEREWOLF_ATTACK(target)
```

The target is not immediately killed.

Resolution happens after all relevant night actions.

## Participants

Living holders of:

- `WEREWOLF`;
- `DEMON_WOLF` while alive;
- successfully cursed converted players if transformation makes them normal Werewolves.

## Narration after death

Werewolf group narration should continue according to ruleset privacy behavior while the game still contains the role/faction context. The engine should avoid revealing exact special-role death state from narrator omissions.

---

# 9. Demon Wolf / Sói quỷ

```ts
id: 'DEMON_WOLF'
teamId: 'WEREWOLF'
night.order: 40
```

## General behavior

Demon Wolf participates in the shared Werewolf attack like a normal wolf.

Then it receives a separate private turn immediately after the Werewolf turn.

## Runtime state

```ts
interface DemonWolfState {
  curseAvailable: boolean;
}
```

Initial:

```ts
curseAvailable = true;
```

## Curse target

Demon Wolf cannot choose any independent target.

The only possible target is:

```text
the player just selected by the Werewolf shared attack
```

## Curse decision

```ts
decision: 'CURSE' | 'SKIP'
```

If no Werewolf target exists, curse cannot succeed.

## Curse blocked

```text
Werewolves attack A
Guard protects A
Demon Wolf chooses CURSE
→ attack fails
→ curse fails
→ curseAvailable remains true
```

The attempt does not consume the skill.

## Curse success

```text
Werewolves attack A
A is not protected
Demon Wolf chooses CURSE
→ curse succeeds
→ A does not die from that Werewolf attack
→ A becomes Werewolf-aligned / normal Werewolf under MVP transform policy
→ curseAvailable becomes false
```

## After curse success

Gameplay capability:

```text
Demon Wolf behaves as ordinary Werewolf
```

But narrator privacy rule:

```text
Demon Wolf is still called every night until match ends
```

Subsequent separate Demon Wolf turns:

```text
DECOY
```

No curse action is available.

## If Demon Wolf dies

The role is still narrated as DECOY each applicable night to avoid leaking hidden state.

## Public information

Never announce:

- curse decision;
- curse success;
- curse failure;
- whether curse ability remains.

---

# 10. Witch / Phù thủy

```ts
id: 'WITCH'
teamId: 'VILLAGE'
night.order: 50
```

## Runtime state

```ts
interface WitchState {
  healPotionRemaining: number;
  poisonPotionRemaining: number;
}
```

Default:

```ts
healPotionRemaining = 1;
poisonPotionRemaining = 1;
```

## Night behavior

- Called after Demon Wolf.
- If alive and at least one valid action/resource exists: ACTIVE.
- If dead or no action remains: DECOY.
- Narrator continues to call Witch as required by privacy policy.

## Heal

Produces:

```ts
HEAL(target)
```

Basic rules should define:

- whether Witch sees the Werewolf target;
- whether self-save is allowed;
- whether heal may be used after curse intent;
- whether both potions may be used in same night.

For MVP, keep these values in preset config.

## Poison

Produces:

```ts
POISON(target)
```

Poison death cause:

```text
WITCH_POISON
```

## Privacy

Potion availability is private.

Narrator behavior must not reveal that potions are exhausted.

---

# 11. Hunter / Thợ săn

```ts
id: 'HUNTER'
teamId: 'VILLAGE'
```

## Night action

None while alive.

## Night death rule

If Hunter dies as a final result of night resolution:

```text
do not shoot during night
```

Create:

```ts
HUNTER_MORNING_SHOT
```

## Morning behavior

After dawn/night death announcement and before normal day flow:

- Hunter receives one target selection;
- choose one valid living player;
- target dies by `HUNTER_SHOT`;
- resolve any resulting chain;
- only then continue win check/day flow.

## Day death

Daytime Hunter trigger timing follows the selected basic rule preset.

Recommended engine support:

```ts
hunterTriggerTiming:
  | 'IMMEDIATE_ON_DAY_DEATH'
  | 'MORNING_IF_NIGHT_DEATH'
```

## Privacy

Hunter identity may become public through death reveal policy; this is independent from the trigger mechanism.

---

# 12. Fool / Kẻ ngốc

```ts
id: 'FOOL'
teamId: 'VILLAGE'
```

## General behavior

No night action.

## Day execution behavior

The MVP should encode the standard basic Fool behavior selected by the group as an execution interception rule rather than direct special-case logic in the voting engine.

Recommended shape:

```ts
interface FoolRules {
  executionBehavior:
    | 'DIES_NORMALLY'
    | 'SURVIVES_FIRST_EXECUTION_LOSES_VOTE'
    | 'CUSTOM';
}
```

For the current project, set this to the group's chosen basic rule before implementation is considered final.

## Design requirement

Voting engine emits:

```text
execution target = Fool
```

Role trigger decides the final result.

Do not write:

```ts
if (target.role === 'FOOL') ...
```

inside generic vote resolution.

---

# 13. Mayor / Trưởng làng

Mayor is NOT a role card.

```ts
type PublicOfficeId = 'MAYOR';
```

## Election timing

Election occurs:

```text
first morning after Night 1
```

Recommended phase order:

```text
Resolve Night 1
→ Dawn
→ Night-death announcement
→ Hunter morning trigger if any
→ Resolve resulting chain
→ Mayor election
→ Discussion
```

## Eligibility

Default:

- living players can vote;
- living players can be elected.

## Vote weight

After election:

```text
Mayor's normal day execution vote = 2
All other votes = 1
```

This applies to execution voting, not automatically to future Mayor elections.

## Public state

Mayor identity is public.

```ts
state.publicOffice.mayorPlayerId
```

## Mayor death and succession

When the Mayor dies, the office is vacated immediately and the game pauses
for a succession choice. The moderator selects one living player to receive
the seat before discussion or the next night continues. The successor's
identity is public and their daytime execution vote counts as 2.

---

# 14. Cursed Player / Người bị nguyền

This is not an original card role.

On successful Demon Wolf curse:

```text
target survives Werewolf attack
target becomes Werewolf-aligned
target joins future shared Werewolf attacks
```

Recommended MVP transform:

```ts
currentRoleId = original functional role
teamId = 'WEREWOLF'
```

Original role may be preserved separately for game history if desired:

```ts
originalRoleId
```

The converted player is privately notified during their functional role turn
that they are cursed, retain that function, and must also wake with the
Werewolves.

## Seer interaction

If Seer mode is `TEAM` after transformation:

```text
WEREWOLF
```

If mode is `ROLE` under the MVP recommendation:

```text
WEREWOLF
```

---

# 15. Narration Privacy Matrix

| Role | Alive + ability | Dead | Ability exhausted |
|---|---|---|---|
| Seer | ACTIVE | DECOY | N/A |
| Guard | ACTIVE | DECOY | N/A |
| Werewolf group | ACTIVE if eligible wolves exist | narrator behavior follows faction privacy | N/A |
| Demon Wolf | ACTIVE if curse available | DECOY | DECOY |
| Witch | ACTIVE if valid action exists | DECOY | DECOY |
| Hunter | no regular night turn | no regular night turn | N/A |
| Fool | no night turn | no night turn | N/A |
| Villager | no night turn | no night turn | N/A |

---

# 16. MVP Role IDs

```ts
export const MVP_ROLE_IDS = [
  'VILLAGER',
  'SEER',
  'GUARD',
  'WEREWOLF',
  'DEMON_WOLF',
  'WITCH',
  'HUNTER',
  'FOOL',
] as const;
```

---

# 17. Suggested TypeScript Catalog Shape

```ts
export const mvpRoleCatalog = {
  VILLAGER: {
    teamId: 'VILLAGE',
  },

  SEER: {
    teamId: 'VILLAGE',
    night: {
      order: 10,
      alwaysNarrateIfInComposition: true,
    },
  },

  GUARD: {
    teamId: 'VILLAGE',
    night: {
      order: 20,
      alwaysNarrateIfInComposition: true,
    },
  },

  WEREWOLF: {
    teamId: 'WEREWOLF',
    night: {
      order: 30,
      alwaysNarrateIfInComposition: true,
    },
  },

  DEMON_WOLF: {
    teamId: 'WEREWOLF',
    night: {
      order: 40,
      alwaysNarrateIfInComposition: true,
    },
  },

  WITCH: {
    teamId: 'VILLAGE',
    night: {
      order: 50,
      alwaysNarrateIfInComposition: true,
    },
  },

  HUNTER: {
    teamId: 'VILLAGE',
  },

  FOOL: {
    teamId: 'VILLAGE',
  },
} satisfies RoleCatalog;
```

---

# 18. MVP Rule Preset

Recommended shape:

```ts
interface MvpRulePreset {
  seer: {
    investigationMode: 'TEAM' | 'ROLE';
  };

  guard: {
    allowSelfProtect: boolean;
    allowSameTargetConsecutiveNights: boolean;
  };

  witch: {
    seesWerewolfVictim: boolean;
    allowSelfHeal: boolean;
    allowHealAndPoisonSameNight: boolean;
    healPotionCount: number;
    poisonPotionCount: number;
  };

  werewolf: {
    selectionStrategy: 'SHARED_SELECTION';
    allowNoAttack: boolean;
  };

  fool: FoolRules;

  hunter: {
    morningShotIfNightDeath: true;
  };

  mayor: {
    electionDay: 1;
    executionVoteWeight: 2;
    officeOnDeath: 'VACANT' | 'SUCCESSOR';
  };

  privacy: {
    narrateDeadFunctionalRoles: true;
    narrateExhaustedFunctionalRoles: true;
  };
}
```

---

# 19. Role Acceptance Tests

## Villager
- no private night turn.

## Seer
- first night role;
- TEAM config works;
- ROLE config works;
- dead Seer becomes DECOY.

## Guard
- blocks wolf target;
- target rules enforced;
- dead Guard becomes DECOY.

## Werewolf
- shared selection;
- single attack intent;
- transformed cursed player joins wolf group.

## Demon Wolf
- only same target as wolves;
- protected target causes curse failure;
- failed curse does not consume;
- success converts target;
- success consumes curse;
- still narrated every night after success as DECOY;
- dead Demon Wolf still DECOY narrated.

## Witch
- potion counts persist;
- action validity enforced;
- dead/exhausted Witch still DECOY narrated.

## Hunter
- night death creates morning trigger;
- no night-time immediate shot;
- morning shot resolves before regular day flow.

## Fool
- execution behavior delegated to role rule.

## Mayor
- election after first night;
- Mayor vote counts as 2 during day execution vote.

---

# 20. Catalog Definition of Done

The MVP catalog is implementation-ready when:

- [x] role IDs are fixed;
- [x] team assignments are fixed;
- [x] night order is fixed;
- [x] Seer investigation modes are defined;
- [x] Demon Wolf curse rules are defined;
- [x] Hunter morning trigger is defined;
- [x] Mayor public-office semantics are defined;
- [x] active/decoy narration policy is defined;
- [ ] exact Fool execution rule value is chosen;
- [ ] exact Guard rule values are set in preset;
- [ ] exact Witch rule values are set in preset;
- [x] Mayor succession appoints a living replacement after the office holder dies.
