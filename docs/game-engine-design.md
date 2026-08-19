# Automated Werewolf Game Master — Game Engine Design

**Document version:** 1.0  
**Status:** Core domain implementation specification  
**Depends on:** `system-design.md`  
**Rules source:** MVP rules defined in requirements v1.3  

---

# 1. Purpose

This document defines the pure TypeScript game engine.

The engine must be:

- deterministic;
- framework-independent;
- serializable;
- testable without a browser;
- extensible for future roles;
- capable of preserving privacy through ACTIVE/DECOY turns.

---

# 2. Core Domain Types

```ts
type PlayerId = string;
type RoleId = string;
type MatchId = string;
type PhaseId = string;
type ActionId = string;
```

---

# 3. Match State

```ts
interface MatchState {
  id: MatchId;
  schemaVersion: number;
  rulesetId: string;
  rulesetVersion: string;

  status: 'SETUP' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

  cycle: number;
  phase: GamePhase;

  players: Record<PlayerId, PlayerRuntimeState>;
  roleAssignments: Record<PlayerId, RoleAssignment>;

  roleComposition: Array<{
    roleId: RoleId;
    count: number;
  }>;

  roleState: Record<PlayerId, RoleRuntimeState>;

  publicOffice: {
    mayorPlayerId?: PlayerId;
    mayorElectionCompleted: boolean;
  };

  pendingActions: GameAction[];
  pendingEffects: GameEffect[];
  pendingTriggers: GameTrigger[];

  nightContext?: NightContext;
  votingContext?: VotingContext;

  winner?: WinnerResult;

  events: DomainEvent[];
}
```

---

# 4. Player Runtime State

```ts
interface PlayerRuntimeState {
  playerId: PlayerId;
  displayName: string;
  seatIndex: number;

  lifeState: 'ALIVE' | 'DEAD';

  death?: {
    phaseId: PhaseId;
    causes: DeathCause[];
    announced: boolean;
  };
}
```

---

# 5. Role Assignment

```ts
interface RoleAssignment {
  originalRoleId: RoleId;
  currentRoleId: RoleId;
  teamId: TeamId;
}
```

`currentRoleId` supports future transformations.

For MVP Demon Wolf, after curse success the player may keep `currentRoleId = DEMON_WOLF` while `curseAvailable = false`; gameplay capability becomes equivalent to ordinary Werewolf.

---

# 6. Phase Model

```ts
type GamePhase =
  | { type: 'SETUP' }
  | { type: 'ROLE_REGISTRATION' }
  | { type: 'PRE_GAME_VALIDATION' }
  | { type: 'NIGHT'; nightNumber: number; subphase: NightSubphase }
  | { type: 'MORNING'; dayNumber: number; subphase: MorningSubphase }
  | { type: 'DISCUSSION'; dayNumber: number }
  | { type: 'VOTING'; dayNumber: number; round: number }
  | { type: 'DAY_DEATH_RESOLUTION'; dayNumber: number }
  | { type: 'GAME_OVER' };
```

Night:

```ts
type NightSubphase =
  | 'PREPARE_QUEUE'
  | 'ROLE_TURN'
  | 'RESOLUTION';
```

Morning:

```ts
type MorningSubphase =
  | 'ANNOUNCEMENT'
  | 'MORNING_TRIGGERS'
  | 'MAYOR_ELECTION'
  | 'READY_FOR_DISCUSSION';
```

---

# 7. Night Context

```ts
interface NightContext {
  nightNumber: number;

  queue: NightTurn[];
  currentTurnIndex: number;

  werewolfAttackTargetId?: PlayerId | null;
  demonWolfCurseIntent?: boolean;

  actions: GameAction[];
  effects: GameEffect[];

  resolution?: NightResolutionResult;
}
```

---

# 8. Night Turn

```ts
interface NightTurn {
  roleId: RoleId;
  order: number;
  mode: 'ACTIVE' | 'DECOY';
}
```

Queue generation:

```ts
function buildNightQueue(
  state: MatchState,
  catalog: RoleCatalog
): NightTurn[];
```

For each configured functional night role:

```ts
const shouldNarrate = role.shouldNarrateTurn(state);
const canAct = role.canPerformNightAction(state);

if (shouldNarrate) {
  queue.push({
    roleId: role.id,
    order: role.night.order,
    mode: canAct ? 'ACTIVE' : 'DECOY',
  });
}
```

---

# 9. Role Contract

```ts
interface RoleDefinition {
  id: RoleId;
  teamId: TeamId;

  night?: {
    order: number;
    activation: 'NEVER' | 'EVERY_NIGHT' | 'CONDITIONAL';
  };

  shouldNarrateTurn(
    state: MatchState,
    holderIds: PlayerId[]
  ): boolean;

  canPerformNightAction(
    state: MatchState,
    holderIds: PlayerId[]
  ): boolean;

  getNightActionDefinition?(
    state: MatchState
  ): ActionDefinition | null;

  getDeathTriggers?(
    context: DeathTriggerContext
  ): GameTrigger[];

  getVoteWeightModifier?(
    context: VoteWeightContext
  ): number;
}
```

Role-specific rules may use specialized helpers rather than one oversized interface.

---

# 10. Action Model

```ts
interface GameAction {
  id: ActionId;
  phaseId: PhaseId;

  actorRoleId: RoleId;
  actorPlayerIds: PlayerId[];

  type: string;
  targetPlayerIds: PlayerId[];

  payload?: Record<string, unknown>;
}
```

MVP action types:

```ts
type MvpActionType =
  | 'SEER_INSPECT'
  | 'GUARD_PROTECT'
  | 'WEREWOLF_ATTACK'
  | 'DEMON_WOLF_CURSE_DECISION'
  | 'WITCH_HEAL'
  | 'WITCH_POISON'
  | 'HUNTER_SHOOT'
  | 'MAYOR_ELECTION_VOTE'
  | 'DAY_EXECUTION_VOTE';
```

---

# 11. Action Validation

Every command must be validated against current state.

Reference result:

```ts
type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'INVALID_PHASE'
        | 'INVALID_TARGET'
        | 'ACTION_NOT_AVAILABLE'
        | 'ROLE_NOT_ALIVE'
        | 'RESOURCE_EXHAUSTED'
        | 'ALREADY_SUBMITTED';
    };
```

DECOY turns never accept real gameplay actions.

---

# 12. Effect Model

```ts
type GameEffect =
  | {
      type: 'INVESTIGATION_RESULT';
      sourcePlayerId: PlayerId;
      targetPlayerId: PlayerId;
      result: InvestigationValue;
    }
  | {
      type: 'PROTECT';
      sourcePlayerId: PlayerId;
      targetPlayerId: PlayerId;
    }
  | {
      type: 'WEREWOLF_ATTACK';
      sourcePlayerIds: PlayerId[];
      targetPlayerId: PlayerId;
    }
  | {
      type: 'DEMON_WOLF_CURSE_INTENT';
      sourcePlayerId: PlayerId;
      targetPlayerId: PlayerId;
    }
  | {
      type: 'HEAL';
      sourcePlayerId: PlayerId;
      targetPlayerId: PlayerId;
    }
  | {
      type: 'POISON';
      sourcePlayerId: PlayerId;
      targetPlayerId: PlayerId;
    }
  | {
      type: 'DIRECT_KILL';
      sourcePlayerId?: PlayerId;
      targetPlayerId: PlayerId;
      cause: DeathCause;
    };
```

---

# 13. Seer Resolution

Seer acts first.

Config:

```ts
type SeerInvestigationMode = 'TEAM' | 'ROLE';
```

When action is submitted:

```ts
function resolveSeerInspection(
  state: MatchState,
  targetId: PlayerId,
  mode: SeerInvestigationMode
): InvestigationValue;
```

`TEAM` returns current alignment/team.

`ROLE` returns exact current role.

The result is private and does not affect public state.

---

# 14. Guard Resolution

Guard submits protection intent before Werewolf attack selection.

```ts
interface GuardRuntimeState {
  lastProtectedPlayerId?: PlayerId;
}
```

Target restrictions come from config.

Produces:

```ts
{ type: 'PROTECT', targetPlayerId }
```

---

# 15. Werewolf Resolution

All eligible wolf-aligned attack participants share one selection.

```ts
interface WerewolfAttackAction {
  type: 'WEREWOLF_ATTACK';
  targetPlayerIds: [PlayerId] | [];
}
```

MVP supports one selected target or no attack if configured.

The target is stored in `NightContext.werewolfAttackTargetId`.

---

# 16. Demon Wolf Resolution

## 16.1 Runtime state

```ts
interface DemonWolfRuntimeState {
  curseAvailable: boolean;
}
```

## 16.2 Target

Demon Wolf cannot select a separate target.

Curse target is exactly:

```ts
state.nightContext.werewolfAttackTargetId
```

## 16.3 Turn mode

If Demon Wolf is alive and `curseAvailable = true`:

```text
ACTIVE
```

If dead or curse already consumed:

```text
DECOY
```

Narrator still calls Demon Wolf every night because it exists in the original configured role composition.

## 16.4 Intent

Choosing CURSE creates:

```ts
{
  type: 'DEMON_WOLF_CURSE_INTENT',
  targetPlayerId: wolfTarget,
}
```

It does not consume the ability immediately.

---

# 17. Witch Resolution

```ts
interface WitchRuntimeState {
  healPotionRemaining: number;
  poisonPotionRemaining: number;
}
```

The engine validates selected Witch actions from preset rules.

Actions convert into `HEAL` and/or `POISON` effects.

Potion resource consumption occurs when a valid Witch action is accepted according to rules, except where rules explicitly define success-based consumption.

---

# 18. Night Resolution Pipeline

Reference algorithm:

```text
1. Read Guard protection effects.
2. Read Werewolf attack target.
3. Read Demon Wolf curse intent.
4. Read Witch heal/poison effects.
5. Determine whether Werewolf attack is prevented.
6. If wolf attack prevented:
     - ordinary wolf death does not occur
     - curse does not succeed
     - Demon Wolf retains curse ability
7. Else if wolf attack is not prevented AND valid curse intent exists:
     - replace ordinary wolf death with curse conversion
     - consume Demon Wolf curse ability
8. Else:
     - resolve ordinary wolf attack death
9. Apply Witch heal interaction according to preset.
10. Apply Witch poison.
11. Determine final night deaths.
12. Queue morning death triggers.
13. Persist night resolution.
```

Actual implementation should use explicit effect priority rather than tightly coupling every role in one function, but MVP scenario behavior must match this outcome.

---

# 19. Curse Conversion

On success:

```ts
function applyDemonWolfCurse(
  state: MatchState,
  targetPlayerId: PlayerId
): MatchState;
```

The target becomes wolf-aligned according to MVP rules.

Recommended:

```ts
roleAssignments[target].teamId = 'WEREWOLF';
roleAssignments[target].currentRoleId = 'WEREWOLF';
```

If the product later requires preserving original role identity while changing faction, this should become a configurable transformation policy.

Curse success must remain private.

---

# 20. Death Model

```ts
type DeathCause =
  | 'WEREWOLF_ATTACK'
  | 'WITCH_POISON'
  | 'HUNTER_SHOT'
  | 'DAY_EXECUTION'
  | 'OTHER';
```

```ts
interface PendingDeath {
  playerId: PlayerId;
  causes: DeathCause[];
  timing: 'NIGHT' | 'DAY';
}
```

---

# 21. Hunter Delayed Morning Trigger

If Hunter is among final night deaths:

```ts
pendingTriggers.push({
  type: 'HUNTER_MORNING_SHOT',
  playerId: hunterId,
});
```

Do not resolve shot at night.

Morning:

```text
announce night deaths
→ process HUNTER_MORNING_SHOT
→ Hunter chooses living target
→ resolve target death
→ resolve resulting triggers
→ win check
```

Reference trigger:

```ts
type GameTrigger =
  | {
      type: 'HUNTER_MORNING_SHOT';
      playerId: PlayerId;
    }
  | {
      type: 'HUNTER_IMMEDIATE_SHOT';
      playerId: PlayerId;
    };
```

---

# 22. Mayor / Trưởng làng

Mayor is stored separately from roles.

Election occurs on first morning after Night 1.

```ts
interface MayorState {
  mayorPlayerId?: PlayerId;
  electedAtDay?: number;
}
```

Vote weight:

```ts
function getVoteWeight(
  state: MatchState,
  voterId: PlayerId
): number {
  if (state.publicOffice.mayorPlayerId === voterId) return 2;
  return 1;
}
```

Mayor election itself uses one vote per eligible voter unless separately configured.

---

# 23. Voting Context

```ts
interface VotingContext {
  type: 'MAYOR_ELECTION' | 'DAY_EXECUTION';
  round: number;

  eligibleVoterIds: PlayerId[];
  eligibleTargetIds: PlayerId[];

  ballots: Record<PlayerId, PlayerId>;
}
```

Resolution:

```ts
interface VoteTally {
  targetPlayerId: PlayerId;
  weightedVotes: number;
}
```

For normal execution voting:

```text
Mayor ballot contributes 2
other ballots contribute 1
```

---

# 24. Fool / Kẻ ngốc

MVP rule behavior must be defined in the role catalog.

The engine should support day-execution interception via role trigger:

```ts
interface ExecutionInterceptionContext {
  targetPlayerId: PlayerId;
}
```

A role may transform the result of an execution from death into another public state transition.

Do not hard-code Fool in the voting engine.

---

# 25. Win Condition Engine

```ts
interface WinEvaluator {
  evaluate(state: MatchState): WinnerResult | null;
}
```

Default baseline:

```text
Village wins if no living Werewolf-aligned players remain.

Werewolf wins if configured parity/control condition is met.
```

Win checks occur only at stable checkpoints:

- after morning death-trigger chain;
- after day execution/death-trigger chain.

Do not check between low-level effect mutations.

---

# 26. Domain Events

```ts
type DomainEvent =
  | { type: 'MATCH_STARTED' }
  | { type: 'PHASE_CHANGED'; phase: GamePhase }
  | { type: 'NIGHT_TURN_STARTED'; roleId: RoleId; mode: 'ACTIVE' | 'DECOY' }
  | { type: 'ACTION_SUBMITTED'; action: GameAction }
  | { type: 'NIGHT_RESOLVED'; result: NightResolutionResult }
  | { type: 'PLAYER_DIED'; playerId: PlayerId; causes: DeathCause[] }
  | { type: 'PLAYER_CURSED'; playerId: PlayerId }
  | { type: 'DEMON_WOLF_CURSE_CONSUMED'; playerId: PlayerId }
  | { type: 'HUNTER_SHOT_RESOLVED'; targetPlayerId: PlayerId }
  | { type: 'MAYOR_ELECTED'; playerId: PlayerId }
  | { type: 'VOTE_RESOLVED'; result: VoteResolution }
  | { type: 'WINNER_DECLARED'; winner: WinnerResult };
```

---

# 27. Engine API

Recommended public API:

```ts
interface WerewolfEngine {
  createMatch(input: CreateMatchInput): MatchState;

  registerRole(
    state: MatchState,
    input: RegisterRoleInput
  ): EngineResult;

  startMatch(state: MatchState): EngineResult;

  getNightQueue(state: MatchState): NightTurn[];

  submitAction(
    state: MatchState,
    action: GameAction
  ): EngineResult;

  resolveNight(state: MatchState): EngineResult;

  resolveTrigger(
    state: MatchState,
    command: TriggerCommand
  ): EngineResult;

  startMayorElection(state: MatchState): EngineResult;

  castVote(
    state: MatchState,
    ballot: VoteBallot
  ): EngineResult;

  resolveVote(state: MatchState): EngineResult;

  evaluateWinner(state: MatchState): WinnerResult | null;
}
```

---

# 28. Engine Result

```ts
type EngineResult<T = MatchState> =
  | {
      ok: true;
      state: T;
      events: DomainEvent[];
    }
  | {
      ok: false;
      state: MatchState;
      error: DomainError;
    };
```

Pure functions are preferred where practical.

---

# 29. Determinism

Avoid:

- `Math.random()` inside rule logic;
- wall-clock decisions;
- asynchronous races;
- UI ordering dependency.

If random behavior is ever introduced, inject an RNG interface and persist the seed/result.

---

# 30. Serialization

All engine state must be JSON-serializable.

Avoid:

- class instances requiring prototypes;
- Map/Set unless converted;
- functions stored in state;
- Date objects.

Use primitives/plain objects.

---

# 31. Test Scenarios Required Before UI Integration

## T-01 Seer TEAM
Seer inspects wolf → result `WEREWOLF`.

## T-02 Seer ROLE
Seer inspects Demon Wolf → exact `DEMON_WOLF`.

## T-03 Guard blocks attack
Guard protects wolf target → target survives.

## T-04 Curse blocked
Guard protects wolf target + Demon Wolf chooses curse → curse fails, ability remains.

## T-05 Curse succeeds
Unprotected wolf target + curse → target converted, no wolf death, ability consumed.

## T-06 Demon Wolf decoy after consumption
Next night Demon Wolf still appears in queue as DECOY.

## T-07 Dead Seer decoy
Seer dies → next night Seer still narrated DECOY.

## T-08 Hunter night death
Hunter dies at night → no immediate shot → morning trigger created.

## T-09 Hunter morning shot
Morning Hunter shot kills target before normal discussion.

## T-10 Mayor election
First morning after Night 1 → Mayor elected.

## T-11 Mayor vote weight
Mayor execution ballot contributes 2.

## T-12 Winner checkpoint
Winner not declared before pending Hunter morning shot resolves.

---

# 32. Definition of Done

Game engine is ready for product integration when:

- [ ] all state is serializable;
- [ ] no browser/framework imports exist;
- [ ] MVP role actions compile from role catalog;
- [ ] active/decoy queue behavior is tested;
- [ ] Demon Wolf curse cases are tested;
- [ ] Hunter delayed trigger is tested;
- [ ] Mayor vote weight is tested;
- [ ] win conditions are checkpoint-based;
- [ ] scenario tests are deterministic.
