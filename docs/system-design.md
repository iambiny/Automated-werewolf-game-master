# Automated Werewolf Game Master — System Design

**Document version:** 1.0  
**Status:** Implementation blueprint  
**Related requirements:** `automated-werewolf-game-master-requirements-v1.3.md`  
**Primary stack:** Next.js + TypeScript PWA  
**Architecture:** Local-first, single-device, offline-first  
**Backend:** Not required for MVP  

---

# 1. Purpose

This document defines the technical architecture for the MVP of the Automated Werewolf Game Master.

The product model is:

> Physical cards assign roles. One shared smartphone replaces the human game master.

The MVP must:

- run on one shared phone;
- work as an installable PWA;
- continue without Internet after required assets are cached;
- keep all gameplay authoritative locally;
- persist active match state;
- recover after refresh/reopen;
- separate game rules from React/Next.js;
- support extensible roles and house-rule presets;
- preserve hidden information through active/decoy night turns.

---

# 2. Architecture Goals

## 2.1 Primary goals

1. **Pure domain engine**
   - All game rules live in framework-independent TypeScript.
   - No React, DOM, IndexedDB, browser audio, or Next.js imports inside the engine.

2. **Deterministic gameplay**
   - Same state + same actions + same config = same output.

3. **Offline-first**
   - No backend required to complete a match.

4. **Recoverable state**
   - Match state persists after domain-significant events.

5. **Privacy-aware presentation**
   - UI and narration do not leak dead roles, consumed skills, or secret outcomes.

6. **Role extensibility**
   - MVP roles are data-driven and future expansion roles can be added without rewriting the main loop.

---

# 3. High-Level Architecture

```text
┌───────────────────────────────────────────────┐
│                  Next.js PWA                  │
│                                               │
│  UI / Screens / Routing                      │
│  ├── Setup                                   │
│  ├── Secret Role Registration                │
│  ├── Night                                   │
│  ├── Morning                                 │
│  ├── Discussion                              │
│  ├── Voting                                  │
│  └── Game Over                               │
│                                               │
│  Application Layer                           │
│  ├── GameController                          │
│  ├── NightTurnCoordinator                    │
│  ├── RecoveryCoordinator                     │
│  └── Presentation Mappers                    │
│                                               │
│  Adapters                                    │
│  ├── IndexedDbMatchRepository                │
│  ├── AudioPlayer                             │
│  ├── TimerScheduler                          │
│  ├── WakeLockAdapter                         │
│  └── PwaCache                                │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│          Pure TypeScript Game Engine          │
│                                               │
│  Match State                                  │
│  Phase Engine                                 │
│  Role Catalog                                 │
│  Action Validation                            │
│  Effect Resolution                            │
│  Death Trigger Resolution                     │
│  Voting Engine                                │
│  Win Condition Engine                         │
│  Domain Events                                │
└───────────────────────────────────────────────┘
```

---

# 4. Recommended Repository Structure

```text
apps/
  web/
    src/
      app/
      components/
      features/
        setup/
        role-registration/
        night/
        morning/
        discussion/
        voting/
        game-over/
      application/
        game-controller/
        recovery/
        presentation/
      adapters/
        persistence/
        audio/
        timer/
        wake-lock/
      pwa/

packages/
  game-engine/
    src/
      domain/
        match/
        player/
        phase/
        role/
        action/
        effect/
        voting/
        death/
        winner/
      services/
      events/
      rules/
      testing/

  role-catalog/
    src/
      boardgameviet-vn/
        mvp/
          roles/
          preset.ts
          rules.ts

  shared/
    src/
      ids/
      utils/
      result/
```

Optional later:

```text
packages/
  narration/
  ui/
```

---

# 5. Dependency Rules

Allowed direction:

```text
web UI
  ↓
application layer
  ↓
game-engine
  ↓
role-catalog contracts / rules data
```

Adapters implement interfaces consumed by the application layer.

Forbidden:

```text
game-engine -> React
game-engine -> Next.js
game-engine -> window/document
game-engine -> IndexedDB
game-engine -> Web Audio API
game-engine -> service worker
```

The engine may use:

- plain TypeScript;
- standard language data structures;
- injected deterministic clock/random interfaces if needed.

---

# 6. Domain Authority

The game engine is the source of truth for:

- current phase;
- living/dead status;
- current/current-role assignment;
- role-specific resource state;
- vote weight;
- valid actions;
- target eligibility;
- night turn mode;
- attack/protect/heal/curse resolution;
- delayed Hunter shot;
- Mayor/Trưởng làng status;
- death causes;
- win conditions.

UI must never independently determine these rules.

---

# 7. Application Layer

The application layer orchestrates domain state and platform services.

## 7.1 GameController

Responsibilities:

- load/create match;
- send user commands to engine;
- persist resulting state/events;
- expose safe UI models;
- coordinate phase transitions;
- never contain role rules.

Reference interface:

```ts
interface GameController {
  createMatch(input: CreateMatchInput): Promise<void>;
  loadActiveMatch(): Promise<void>;

  dispatch(command: GameCommand): Promise<GameCommandResult>;

  getPublicView(): PublicGameView;
  getPrivateTurnView(): PrivateTurnView | null;
}
```

## 7.2 NightTurnCoordinator

Responsible for the theatrical sequence, not rule resolution.

It coordinates:

```text
privacy screen
→ wake audio
→ wake delay
→ ACTIVE/DECOY turn
→ action timer
→ sleep audio
→ privacy delay
→ next narrated role
```

It must ask the engine:

```ts
shouldNarrateTurn(...)
canPerformAction(...)
```

It must not infer these from UI state.

## 7.3 RecoveryCoordinator

Responsibilities:

- detect active match;
- validate persisted schema;
- resume from a safe checkpoint;
- apply expired timer behavior;
- restart narration safely;
- avoid replaying private results.

---

# 8. Domain Command Model

UI should dispatch semantic commands rather than mutate state.

Examples:

```ts
type GameCommand =
  | { type: 'REGISTER_ROLE'; playerId: PlayerId; roleId: RoleId }
  | { type: 'START_MATCH' }
  | { type: 'START_NIGHT' }
  | { type: 'SUBMIT_SEER_TARGET'; targetPlayerId: PlayerId }
  | { type: 'SUBMIT_GUARD_TARGET'; targetPlayerId: PlayerId }
  | { type: 'SUBMIT_WEREWOLF_TARGET'; targetPlayerId: PlayerId | null }
  | { type: 'SUBMIT_DEMON_WOLF_CURSE'; decision: 'CURSE' | 'SKIP' }
  | { type: 'SUBMIT_WITCH_ACTION'; action: WitchCommand }
  | { type: 'RESOLVE_NIGHT' }
  | { type: 'SUBMIT_HUNTER_SHOT'; targetPlayerId: PlayerId }
  | { type: 'ELECT_MAYOR'; playerId: PlayerId }
  | { type: 'CAST_VOTE'; voterId: PlayerId; targetPlayerId: PlayerId }
  | { type: 'RESOLVE_VOTE' };
```

---

# 9. Persistence Design

## 9.1 Storage

Use IndexedDB.

Suggested stores:

```text
matches
settings
deckPresets
narrationMetadata
```

`matches` stores the complete active match snapshot plus event metadata.

## 9.2 Persist after

- role registration;
- phase transition;
- action submission;
- effect resolution;
- death resolution;
- Hunter shot;
- Mayor election;
- vote cast;
- vote resolved;
- winner declared.

## 9.3 Snapshot format

```ts
interface PersistedMatchEnvelope {
  schemaVersion: number;
  engineVersion: string;
  rulesetId: string;
  rulesetVersion: string;
  savedAt: number;
  match: MatchState;
}
```

## 9.4 Safe checkpoints

Examples:

```text
ROLE_REGISTRATION_PLAYER_HANDOFF
NIGHT_BEFORE_ROLE_WAKE
NIGHT_WAITING_FOR_ACTION
NIGHT_AFTER_ROLE_SLEEP
MORNING_BEFORE_HUNTER_TRIGGER
DAY_DISCUSSION
DAY_VOTING
```

A private investigation result should not itself be a resumable screen.

---

# 10. PWA Design

## 10.1 Requirements

- installable manifest;
- standalone mode;
- cached app shell;
- cached default narration assets;
- offline route handling;
- versioned service worker cache.

## 10.2 Cache categories

```text
static-shell-vX
audio-pack-vi-vX
role-catalog-vX
```

## 10.3 Upgrade behavior

When a new application version is available during an active match:

- do not force reload;
- complete/resume the current game using compatible cached assets;
- allow update after match completion where possible.

---

# 11. Audio Architecture

Use an `AudioService` abstraction.

```ts
interface AudioService {
  unlock(): Promise<void>;
  preload(keys: AudioKey[]): Promise<void>;
  play(key: AudioKey): Promise<void>;
  stopAll(): void;
  setNarrationVolume(value: number): void;
  setEffectsVolume(value: number): void;
}
```

The application layer waits for `play()` completion to synchronize narration.

Starting a replacement narration cue may pause a previous cue before its
browser `play()` promise has settled. The resulting `AbortError` represents
intentional interruption and resolves normally; other playback failures still
activate the visual fallback.

iOS WebKit media authorization is element-specific. `unlock()` therefore
primes reusable narration, effects, and music elements synchronously inside the
user gesture. Preloading may continue asynchronously afterward, but automated
phase transitions reuse the primed elements by replacing their sources.

Fallback:

```text
audio unavailable
→ show exact instruction as text
→ continue gameplay
```

---

# 12. Timer Architecture

Timer state belongs to the application layer but must persist enough information for recovery.

Use absolute deadlines:

```ts
interface PersistedTimer {
  id: string;
  startedAt: number;
  deadlineAt: number;
  pauseState?: {
    pausedAt: number;
    remainingMs: number;
  };
}
```

Do not persist only a decremented `remainingSeconds`.

---

# 13. Wake Lock

Use Screen Wake Lock API where available.

```ts
interface WakeLockService {
  request(): Promise<void>;
  release(): Promise<void>;
  isSupported(): boolean;
}
```

Wake lock failure must never block the game.

---

# 14. Public vs Private View Models

Do not pass the entire domain state to React screens.

Define specific projections.

## 14.1 Public view

May contain:

- player names;
- alive/dead public state;
- day/night number;
- public death results;
- Mayor status;
- discussion timer;
- voting results if vote mode is public.

Must not contain:

- role assignments;
- Seer result;
- Guard target;
- wolf target;
- Demon Wolf curse state;
- Witch secret resources unless current private Witch turn;
- internal hidden effects.

## 14.2 Private turn view

Generated only for the currently active private turn.

```ts
interface PrivateTurnView {
  roleId: RoleId;
  mode: 'ACTIVE' | 'DECOY';
  instruction: string;
  validTargets?: PlayerSummary[];
  privateResult?: InvestigationResult;
}
```

For `DECOY`, secret action data must be absent.

---

# 15. Privacy-Preserving Night Queue

Queue generation has two independent questions:

```ts
shouldNarrateTurn(roleContext): boolean;
canPerformAction(roleContext): boolean;
```

Result:

```ts
interface NightTurn {
  roleId: RoleId;
  mode: 'ACTIVE' | 'DECOY';
  order: number;
}
```

Examples:

```text
Dead Seer
→ shouldNarrate = true
→ canPerform = false
→ DECOY

Living Demon Wolf, curse used
→ shouldNarrate = true
→ canPerform = false
→ DECOY
```

---

# 16. MVP Night Order

Default preset:

```text
SEER
→ GUARD
→ HYBRID_WOLF (private status)
→ WEREWOLF
→ DEMON_WOLF
→ WITCH
→ NIGHT_RESOLUTION
```

The engine stores ordering as metadata, not switch/case code.

---

# 17. Mayor / Trưởng làng Architecture

Mayor is a public office/status, not a role card.

```ts
interface PublicOfficeState {
  mayorPlayerId?: PlayerId;
}
```

Election timing:

```text
Morning after Night 1
→ resolve Hunter morning trigger first if applicable
→ elect Mayor
→ continue day flow
```

Voting:

```ts
function getVoteWeight(playerId: PlayerId, state: MatchState): number {
  return state.publicOffice.mayorPlayerId === playerId ? 2 : 1;
}
```

If Mayor dies, MVP behavior should follow the selected house/base rule encoded in configuration.

---

# 18. Demon Wolf Architecture

Demon Wolf participates in the shared Werewolf action as a wolf-aligned player.

Separate curse turn occurs after Werewolf attack selection.

Private state:

```ts
interface DemonWolfState {
  curseAvailable: boolean;
}
```

Curse target:

```text
exact same target selected by Werewolf attack
```

Curse is an intent, not immediate mutation.

Resolution:

```text
wolf attack target A
+ curse intent
+ Guard protects A
→ attack prevented
→ curse fails
→ curseAvailable remains true
```

Success:

```text
wolf attack target A
+ curse intent
+ attack not prevented
→ curse conversion succeeds
→ ordinary wolf death is replaced
→ curseAvailable = false
```

After success:

```text
Demon Wolf narrator turn continues every night
→ DECOY
```

The converted target retains `currentRoleId` and `originalRoleId`, but its
role runtime state must record `cursed: true`. A cursed functional role is
Werewolf-aligned for the shared attack and cannot use its original ability.
Role command validation and queue eligibility must reject cursed Seer,
Guard, Witch, and Fool actions. A cursed Witch's private turn must not expose
the Werewolf victim or potion counts, and a cursed Hunter must not create a
revenge-shot trigger when killed.

Hybrid Wolf conversion is a distinct, higher-priority transition. An
unprotected pack attack changes `VILLAGE/HYBRID_WOLF` to
`WEREWOLF/WEREWOLF`, records `converted: true`, and preserves
`originalRoleId: HYBRID_WOLF`. Guard protection blocks it. A same-target Demon
Wolf curse is consumed without applying the generic cursed-role state; when
Guard blocks the attack, the curse remains available. The configured Hybrid
Wolf private status turn is always queued as DECOY, including after conversion,
and a successful conversion adds a private pre-dawn notification.

The Fool is a neutral third alignment (`teamId: 'FOOL'`). Team-only Seer
investigation returns `Unclear role` for the Fool. Neutral Fool players are
not counted as Village opposition for Werewolf parity. Fool execution is a
ruleset choice: die normally, survive once and lose the vote, or win when
selected for execution.

---

# 19. Hunter Architecture

Hunter has a delayed morning trigger when killed during the night.

Do not fire during night resolution.

Night resolution creates:

```ts
pendingMorningTriggers.push({
  type: 'HUNTER_SHOT',
  playerId: hunterId,
});
```

Morning flow:

```text
announce deaths
→ if Hunter died overnight
→ private/public Hunter target selection
→ resolve shot
→ resolve resulting death chain
→ check winner
→ continue to Mayor election/discussion
```

Daytime Hunter death may use a separate trigger timing defined by the role rules.

---

# 20. Error and Recovery Strategy

## 20.1 Domain errors

Use typed results/errors:

```ts
type DomainError =
  | { code: 'INVALID_PHASE' }
  | { code: 'INVALID_TARGET' }
  | { code: 'ACTION_NOT_AVAILABLE' }
  | { code: 'ROLE_NOT_ELIGIBLE' }
  | { code: 'MATCH_ALREADY_COMPLETED' };
```

## 20.2 UI behavior

- recoverable validation error → remain on screen;
- persistence failure → block further meaningful progression;
- audio failure → fallback to text;
- unexpected state → show safe recovery UI, never guess game outcome.

---

# 21. Testing Architecture

## 21.1 Engine tests

Use pure TypeScript unit/scenario tests.

No browser required.

## 21.2 Application tests

Test:

- timer expiration;
- persistence;
- recovery;
- active/decoy narration behavior.

## 21.3 E2E

Use browser automation for:

- PWA startup;
- role registration;
- full game loop;
- refresh recovery;
- offline continuation.

---

# 22. Deployment Architecture

MVP can be deployed as static/SSR-capable Next.js hosting.

Recommended first options:

- Vercel;
- Cloudflare Pages/Workers if PWA service worker setup remains straightforward.

No database/backend deployment required.

Deployment pipeline:

```text
push main
→ install
→ typecheck
→ lint
→ unit tests
→ build
→ deploy
→ smoke test PWA
```

---

# 23. Architecture Decision Summary

1. Single-device PWA.
2. No backend for MVP.
3. IndexedDB for active match persistence.
4. Pure TypeScript game engine.
5. Next.js only for application/UI shell.
6. Role metadata and rules are versioned.
7. Active and decoy turns are separate concepts.
8. Narration schedule is not equivalent to action eligibility.
9. Demon Wolf curse is resolution-time conditional logic.
10. Hunter night death produces a morning trigger.
11. Mayor is public office/status, not card role.
12. Public/private view projections protect secret state.

---

# 24. Definition of Ready for Coding

Architecture is ready for implementation when:

- [x] core package boundaries are defined;
- [x] persistence ownership is defined;
- [x] public/private view separation is defined;
- [x] night queue active/decoy semantics are defined;
- [x] PWA/offline approach is defined;
- [x] audio/timer abstractions are defined;
- [x] Mayor architecture is defined;
- [x] Demon Wolf architecture is defined;
- [x] Hunter delayed trigger is defined;
- [ ] exact Game Engine contracts are implemented from `game-engine-design.md`;
- [ ] role definitions are implemented from `mvp-role-catalog.md`.
