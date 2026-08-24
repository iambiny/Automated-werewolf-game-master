# Automated Werewolf Game Master — MVP Implementation Plan

**Document version:** 1.0  
**Status:** Ready for implementation  
**Audience:** Developer / AI coding agent  
**Depends on:**
- `requirements.md`
- `system-design.md`
- `game-engine-design.md`
- `mvp-role-catalog.md`

**Primary goal:** Build a complete, playable, offline-first MVP of the Automated Werewolf Game Master as a single-device PWA.

---

# 1. Implementation Objective

Build an installable web app that lets a group play physical-card Werewolf without a human game master.

The MVP must support:

- one shared smartphone;
- physical role cards;
- private role registration;
- automated narration;
- privacy-preserving night turns;
- Seer;
- Guard;
- Werewolf;
- Demon Wolf;
- Witch;
- Hunter;
- Fool;
- Villager;
- Mayor / Trưởng làng;
- day discussion;
- voting;
- death resolution;
- win-condition detection;
- local persistence;
- refresh/reopen recovery;
- offline continuation;
- installable PWA.

---

# 2. Non-Negotiable Engineering Rules

These rules must be preserved throughout implementation.

## 2.1 Pure game engine

`packages/game-engine` must not import:

- React;
- Next.js;
- DOM/browser APIs;
- IndexedDB;
- audio APIs;
- service worker APIs.

## 2.2 UI does not own game rules

React components may:

- render current state;
- request valid targets;
- submit semantic commands.

React components may not decide:

- whether a player dies;
- whether a curse succeeds;
- whether Guard protection works;
- whether Hunter fires;
- whether a player wins;
- whether a turn is ACTIVE or DECOY.

## 2.3 Preserve privacy

Never expose full `MatchState` directly to UI.

Use public/private projections.

## 2.4 Persist meaningful transitions

Any domain-significant transition must be persisted before progressing further.

## 2.5 No backend dependency

Do not introduce:

- authentication;
- database server;
- API routes for gameplay;
- WebSocket;
- cloud storage.

Those are post-MVP.

---

# 3. Recommended Stack

## Application

```text
Next.js 15+
TypeScript
React
Tailwind CSS
ShadCN UI (optional)
```

## State / data

```text
Pure TypeScript engine
IndexedDB
Dexie recommended for browser persistence
```

## Testing

```text
Vitest
Testing Library
Playwright
```

## Tooling

```text
Yarn workspaces
ESLint
Prettier
Husky
lint-staged
commitlint
```

Do not over-engineer state management. React Context, Zustand, or a small application store is enough because domain state belongs to the engine/controller.

---

# 4. Repository Structure

Target monorepo:

```text
automated-werewolf-game-master/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── home/
│       │   │   ├── setup/
│       │   │   ├── role-registration/
│       │   │   ├── night/
│       │   │   ├── morning/
│       │   │   ├── discussion/
│       │   │   ├── voting/
│       │   │   └── game-over/
│       │   ├── application/
│       │   │   ├── game-controller/
│       │   │   ├── recovery/
│       │   │   └── presentation/
│       │   ├── adapters/
│       │   │   ├── persistence/
│       │   │   ├── audio/
│       │   │   ├── timer/
│       │   │   └── wake-lock/
│       │   └── pwa/
│       └── public/
│           └── audio/
├── packages/
│   ├── game-engine/
│   │   └── src/
│   │       ├── domain/
│   │       ├── engine/
│   │       ├── events/
│   │       ├── services/
│   │       └── testing/
│   ├── role-catalog/
│   │   └── src/
│   │       └── boardgameviet-vn/
│   │           └── mvp/
│   └── shared/
├── docs/
│   ├── requirements/
│   ├── system-design.md
│   ├── game-engine-design.md
│   ├── mvp-role-catalog.md
│   └── implementation-plan.md
├── package.json
└── yarn.lock
```

---

# 5. Delivery Strategy

Implementation is divided into 8 milestones.

Do not start UI polish before Milestone 2 engine tests pass.

```text
M0 Repository foundation
↓
M1 Core domain engine
↓
M2 MVP role mechanics
↓
M3 Persistence + application controller
↓
M4 Setup + role registration UI
↓
M5 Complete night/day gameplay
↓
M6 Audio + PWA + recovery
↓
M7 End-to-end stabilization
↓
M8 Deploy MVP
```

---

# 6. Milestone 0 — Repository Foundation

## Goal

Create a clean monorepo that can support isolated engine development.

## Tasks

### M0-01 Initialize workspace

Create:

```text
apps/web
packages/game-engine
packages/role-catalog
packages/shared
```

Configure Yarn workspaces.

### M0-02 TypeScript configuration

Create shared base `tsconfig`.

Rules:

- strict mode;
- no implicit any;
- path aliases;
- package references if useful.

### M0-03 Code quality

Configure:

- ESLint;
- Prettier;
- Husky;
- lint-staged;
- commitlint.

### M0-04 Testing setup

Install/configure:

- Vitest;
- Testing Library;
- Playwright.

### M0-05 Basic CI

Add GitHub Actions:

```text
install
→ lint
→ typecheck
→ unit tests
→ build
```

## Acceptance criteria

- [ ] `yarn install` succeeds.
- [ ] `yarn lint` succeeds.
- [ ] `yarn typecheck` succeeds.
- [ ] `yarn test` succeeds.
- [ ] Next.js starter builds.
- [ ] game-engine has no React dependency.

---

# 7. Milestone 1 — Core Domain Engine

## Goal

Create a headless Werewolf engine without role-specific complexity.

## Tasks

### M1-01 Define core IDs and types

Implement:

```ts
PlayerId
RoleId
MatchId
PhaseId
ActionId
```

Prefer branded string types only if they do not create excessive code friction.

### M1-02 Implement MatchState

Implement from `game-engine-design.md`.

Minimum:

- players;
- role assignments;
- role state;
- phase;
- cycle;
- pending actions;
- pending effects;
- pending triggers;
- public office;
- winner.

### M1-03 Implement phase engine

Transitions:

```text
SETUP
→ ROLE_REGISTRATION
→ PRE_GAME_VALIDATION
→ NIGHT
→ MORNING
→ DISCUSSION
→ VOTING
→ DAY_DEATH_RESOLUTION
→ NIGHT / GAME_OVER
```

### M1-04 Domain command result

Implement typed result:

```ts
EngineResult<T>
DomainError
```

### M1-05 Domain events

Implement baseline events:

```text
MATCH_CREATED
ROLE_REGISTERED
MATCH_STARTED
PHASE_CHANGED
NIGHT_TURN_STARTED
ACTION_SUBMITTED
PLAYER_DIED
VOTE_RESOLVED
WINNER_DECLARED
```

### M1-06 Serialization test

Verify:

```ts
JSON.parse(JSON.stringify(state))
```

produces equivalent state.

## Tests

- valid phase transitions;
- invalid transitions rejected;
- state serialization;
- command immutability if using pure-state pattern.

## Acceptance criteria

- [ ] Engine works with zero browser dependencies.
- [ ] Match state can be serialized.
- [ ] Phase transition tests pass.
- [ ] Invalid commands return typed errors.

---

# 8. Milestone 2 — MVP Role Mechanics

## Goal

Implement all gameplay rules before connecting React.

This is the highest-risk milestone.

---

## 8.1 Role catalog foundation

Create:

```text
packages/role-catalog/src/boardgameviet-vn/mvp/
```

Role IDs:

```ts
VILLAGER
SEER
GUARD
WEREWOLF
DEMON_WOLF
WITCH
HUNTER
FOOL
```

Public office:

```ts
MAYOR
```

---

## 8.2 Night queue

Default order:

```text
SEER
→ GUARD
→ WEREWOLF
→ DEMON_WOLF
→ WITCH
```

Implement:

```ts
shouldNarrateTurn()
canPerformAction()
```

Generate:

```ts
NightTurn {
  roleId,
  mode: 'ACTIVE' | 'DECOY'
}
```

### Required tests

- dead Seer → DECOY;
- dead Guard → DECOY;
- consumed Demon Wolf → DECOY;
- exhausted Witch → DECOY.

---

## 8.3 Seer

Implement:

```ts
seerInvestigationMode: 'TEAM' | 'ROLE'
```

Actions:

```ts
SEER_INSPECT
```

Private result must not enter public projection.

### Tests

- TEAM returns faction;
- ROLE returns exact current role;
- invalid/dead target rejected;
- dead Seer cannot submit action.

---

## 8.4 Guard

Action:

```ts
GUARD_PROTECT
```

Runtime:

```ts
lastProtectedPlayerId?
```

Config:

```ts
allowSelfProtect
allowSameTargetConsecutiveNights
```

### Tests

- valid protection;
- invalid target;
- consecutive restriction if enabled;
- dead Guard DECOY.

---

## 8.5 Werewolf

Use:

```ts
selectionStrategy = 'SHARED_SELECTION'
```

Action:

```ts
WEREWOLF_ATTACK
```

Support:

- one target;
- optional no-attack if preset allows.

### Tests

- one group attack;
- transformed cursed player joins wolf attack group;
- dead non-special wolf no longer acts.

---

## 8.6 Demon Wolf

Runtime:

```ts
curseAvailable: boolean
```

Turn after Werewolf.

Decision:

```ts
CURSE
SKIP
```

Target always equals wolf target.

### Core scenarios

#### Curse failure

```text
wolf attacks A
guard protects A
demon wolf chooses curse
→ A survives
→ curse fails
→ curseAvailable remains true
```

#### Curse success

```text
wolf attacks A
not protected
demon wolf chooses curse
→ A survives wolf attack
→ A transforms to Werewolf
→ curseAvailable false
```

#### Post-success privacy

```text
next nights
→ Demon Wolf still narrated
→ DECOY
```

### Tests

All three scenarios are mandatory.

---

## 8.7 Witch

Runtime:

```ts
healPotionRemaining
poisonPotionRemaining
```

Actions:

```ts
WITCH_HEAL
WITCH_POISON
```

Keep rules configurable.

Do not hard-code potion UI assumptions inside engine.

### Tests

- heal prevents eligible night death;
- poison kills target;
- resources decrement;
- exhausted Witch → DECOY.

---

## 8.8 Hunter

Night death:

```text
queue HUNTER_MORNING_SHOT
```

No shot during night.

Morning:

```text
Hunter selects target
→ target dies
→ resolve chain
→ win check
```

### Tests

- Hunter dies at night;
- morning trigger created;
- winner not evaluated before Hunter shot;
- shot target dies.

---

## 8.9 Fool

Implement execution interception extension point.

Do not finalize arbitrary house behavior inside generic voting logic.

Create role rule interface now.

If exact project preset is still unresolved, temporarily define one explicit constant and mark it clearly.

---

## 8.10 Mayor

Election:

```text
first morning after Night 1
```

Vote weight:

```text
Mayor = 2
others = 1
```

### Tests

- election occurs once;
- Mayor identity stored publicly;
- weighted execution vote works.

---

## 8.11 Win conditions

Village:

```text
no living Werewolf-aligned player
```

Werewolf:

implement configured parity rule.

Evaluate only:

- after morning triggers complete;
- after day death chain completes.

## Milestone acceptance

- [ ] All core scenario tests pass.
- [ ] No React dependency.
- [ ] Complete two-cycle simulated match can run headlessly.
- [ ] Demon Wolf scenarios pass.
- [ ] Hunter timing passes.
- [ ] Mayor weighted vote passes.
- [ ] ACTIVE/DECOY tests pass.

---

# 9. Milestone 3 — Application Controller and Persistence

## Goal

Connect domain engine to browser infrastructure without coupling them.

## 9.1 IndexedDB repository

Recommended Dexie schema:

```text
matches
settings
deckPresets
```

Interface:

```ts
interface MatchRepository {
  save(match: PersistedMatchEnvelope): Promise<void>;
  getActive(): Promise<PersistedMatchEnvelope | null>;
  delete(id: MatchId): Promise<void>;
}
```

## 9.2 GameController

Responsibilities:

```text
UI command
→ engine
→ save result
→ expose view projection
```

Critical order:

```text
engine result
→ persist
→ advance UI
```

Do not show next meaningful phase before save succeeds.

## 9.3 Public projection

Implement:

```ts
toPublicGameView(state)
```

Must exclude secret data.

## 9.4 Private projection

Implement:

```ts
toPrivateTurnView(state)
```

Only returns current private turn data.

## 9.5 Recovery

On startup:

```text
active match exists?
→ validate schema
→ show Resume / Start New
```

## Tests

- state save/load;
- recovery after role action;
- recovery after night resolution;
- secret state absent from public projection.

## Acceptance criteria

- [ ] Reload preserves game.
- [ ] Invalid persisted schema fails safely.
- [ ] Public view has no hidden role map.

---

# 10. Milestone 4 — Setup and Secret Role Registration UI

## Goal

Make it possible to configure and start a match safely.

---

## 10.1 Home

Screens:

```text
New Game
Resume Game
Settings
```

## 10.2 Player setup

Features:

- add player;
- edit player;
- remove player;
- reorder seats.

Mobile-first.

## 10.3 Role composition setup

Allow counts for:

```text
Villager
Seer
Guard
Werewolf
Demon Wolf
Witch
Hunter
Fool
```

Validation:

```text
role count === player count
```

## 10.4 Rule settings

Expose only MVP-relevant settings.

Minimum:

```text
Seer: TEAM / ROLE
Guard options
Witch options
Fool rule
Mayor death policy
Timers
```

Do not expose every engine config to user.

## 10.5 Secret registration flow

For each player:

```text
neutral handoff
→ show player name
→ hold/reveal
→ select role
→ confirm
→ privacy screen
→ pass phone
```

Requirements:

- no browser-history leak;
- no previous role visible;
- deck mismatch gives generic error.
- group physical-deck controls into Villagers, Werewolves, and Third Party;
- show only prepared roles during private role selection, including after
  recovery.

## Acceptance criteria

- [ ] Complete 8-player setup possible.
- [ ] Role mismatch caught.
- [ ] Previous role cannot be seen with Back button.
- [ ] Match starts only after validation.

---

# 11. Milestone 5 — Complete Gameplay UI

## Goal

Make the full MVP playable without developer tools.

---

# 11.1 Night shell

Public night screen:

```text
Night N
Everyone close your eyes
```

Large dark UI.

The screen runs the configured night-transition countdown (5 seconds by
default) and starts the first queued role automatically. The same countdown is
used after each sleep cue; it advances to the next role or, after the final
role, resolves the night and transitions directly to dawn. Transition failures
retain a manual retry without exposing private state.

## 11.2 Role transition

Pattern:

```text
privacy
→ wake narration/text
→ ACTIVE/DECOY turn
→ confirmation
→ sleep narration/text
→ privacy
```

## 11.3 Seer UI

ACTIVE:

- target list;
- confirm;
- show private result;
- acknowledge;
- purge result.

DECOY:

- no actionable result;
- maintain similar timing.

## 11.4 Guard UI

- target selector;
- confirmation.

## 11.5 Werewolf UI

- shared target selector;
- optional skip if allowed;
- confirmation.

## 11.6 Demon Wolf UI

ACTIVE:

```text
Target: same wolf victim
[Curse] [Skip]
```

Do not allow another target.

DECOY:

- no real command accepted.

## 11.7 Witch UI

- display allowed action choices;
- target if poison needed;
- confirmation.

## 11.8 Night resolution

No raw resolution data visible.

Transition directly to dawn.

---

# 12. Morning Flow

Order:

```text
Dawn
→ announce deaths
→ Hunter morning trigger if required
→ resolve Hunter target death
→ check game status
→ if first morning: Mayor election
→ discussion
```

Important:

Do not declare winner before pending Hunter morning shot is resolved.

---

# 13. Mayor Election UI

Show living players.

Use open vote entry for MVP.

Possible interaction:

```text
candidate
+ vote increment controls
```

or sequential voter entry.

Use simplest table-friendly UX.

Result publicly announces Mayor.

---

# 14. Discussion UI

Large timer.

Controls:

```text
Pause
Resume
+30 sec
End Discussion
```

Configurable duration.

---

# 15. Day Voting UI

Recommended MVP:

```text
Open Vote
```

One person records votes.

The UI should visibly show:

```text
Mayor vote = ×2
```

Engine remains source of weighted result.

Day execution requires a strict majority: the leading weighted tally must
exceed half of all currently living players. Exact-half and minority results
leave every candidate alive and end the vote without a revote.

The private night-action countdown is rendered as a large top-right pill so it
remains legible while the acting player uses the target controls.

---

# 16. Death Resolution UI

Show:

- executed player;
- role if reveal policy allows;
- death-trigger flow.

Hunter daytime trigger, if applicable, occurs here.

Fool behavior is handled from role rule result.

---

# 17. Game Over UI

Show:

- winner;
- surviving players;
- reveal roles;
- Play Again;
- Home.

---

# 18. Milestone 6 — Audio, Timers, PWA, Recovery

## Goal

Turn the functional game into a usable tabletop moderator.

---

## 18.1 Audio service

Implement:

```ts
unlock()
preload()
play()
stop()
```

Add local Vietnamese narration clips.

Initial MVP can use temporary recorded/TTS-generated static files.

Do not use network TTS at runtime.

## 18.2 Audio startup

Before game:

```text
Test Sound
→ unlock browser audio
```

## 18.3 Timer service

Use absolute deadline.

Persist:

```text
deadlineAt
pause state
```

## 18.4 Wake lock

Request during active match.

Re-request after visibility change if necessary.

## 18.5 PWA manifest

Include:

```text
name
short_name
icons
standalone
theme
background
```

## 18.6 Service worker

Cache:

- app shell;
- role assets;
- audio assets;
- fonts/icons.

## 18.7 Offline test

Required:

```text
load application once
turn network off
start new game
complete multiple phases
```

## Acceptance criteria

- [ ] narration works after one unlock action;
- [ ] visual fallback works if audio fails;
- [ ] installed PWA launches standalone;
- [ ] active match works offline;
- [ ] refresh during match recovers safely.

---

# 19. Milestone 7 — Stabilization and E2E

## Goal

Prove this is a game, not just a collection of screens.

---

## 19.1 Required E2E scenario

Create an 8-player game:

```text
2 Werewolves
1 Seer
1 Guard
1 Witch
1 Hunter
1 Fool
1 Villager
```

If testing Demon Wolf, substitute one Werewolf with Demon Wolf.

Complete:

```text
role registration
Night 1
morning
Mayor election
discussion
vote
Night 2
Hunter event
winner
```

---

## 19.2 Required edge-case scenarios

### E2E-01 Guard + Demon Wolf

```text
Guard protects wolf target
Demon Wolf curses
→ curse fails
→ skill retained
```

### E2E-02 Successful curse

```text
unprotected target
→ curse succeeds
→ converted player joins wolves
→ Demon Wolf future turn DECOY
```

### E2E-03 Dead functional role privacy

```text
Seer dies
next night Seer narration still occurs
```

### E2E-04 Hunter night death

```text
Hunter dies
morning shot occurs
winner only checked after shot
```

### E2E-05 Recovery

Reload during:

- role registration;
- role turn;
- discussion;
- voting.

### E2E-06 Offline

Complete one full cycle with network disabled.

---

# 20. Quality Gates

Before MVP deploy:

```text
yarn lint
yarn typecheck
yarn test
yarn test:e2e
yarn build
```

All must pass.

No `console.log` containing:

- role assignments;
- Seer result;
- wolf target;
- Demon Wolf state;
- Witch state.

---

# 21. Milestone 8 — Deployment

## Goal

Ship a private/public testable MVP URL.

## Recommended deployment

Use Vercel first.

Reasons:

- easiest Next.js deployment;
- preview deployments;
- HTTPS;
- simple rollback.

## Deployment tasks

### M8-01 Production build

Verify service worker and PWA manifest.

### M8-02 Mobile smoke test

Test on:

- iPhone Safari;
- Android Chrome.

### M8-03 Install test

Test:

```text
Add to Home Screen
launch standalone
audio
offline
wake lock
```

### M8-04 Production smoke game

Play at least one real match.

---

# 22. Suggested Implementation Order by Pull Request

Keep PRs small enough for AI/code review.

## PR-01

```text
chore: initialize monorepo and tooling
```

## PR-02

```text
feat(engine): add core match state and phase engine
```

## PR-03

```text
feat(engine): add role catalog and night turn queue
```

## PR-04

```text
feat(engine): implement seer guard and werewolf mechanics
```

## PR-05

```text
feat(engine): implement demon wolf curse resolution
```

## PR-06

```text
feat(engine): implement witch hunter fool and mayor
```

## PR-07

```text
feat(app): add IndexedDB persistence and game controller
```

## PR-08

```text
feat(ui): add game setup and role registration
```

## PR-09

```text
feat(ui): implement night gameplay
```

## PR-10

```text
feat(ui): implement morning discussion and voting
```

## PR-11

```text
feat(pwa): add audio offline support and recovery
```

## PR-12

```text
test: add full MVP end-to-end coverage
```

## PR-13

```text
chore: production deployment configuration
```

---

# 23. Vibe Coding Prompt Strategy

When using an AI coding agent, do not ask:

> Build the whole project.

Instead feed it one milestone or PR at a time.

Recommended prompt pattern:

```text
You are implementing PR-XX for Automated Werewolf Game Master.

Read and follow:
- docs/requirements/requirements.md
- docs/system-design.md
- docs/game-engine-design.md
- docs/mvp-role-catalog.md
- docs/implementation-plan.md

Scope:
<exact PR scope>

Do not implement future milestones.
Do not add a backend.
Do not move game rules into React.
Do not expose private MatchState to UI.

Before coding:
1. inspect current repository;
2. describe the minimal change plan;
3. implement;
4. run typecheck/tests;
5. summarize changed files and remaining issues.
```

---

# 24. Recommended First Coding Prompt

Start with:

```text
Implement PR-01 and PR-02 only.

Set up the Yarn workspace monorepo and implement the framework-independent
game-engine core:

- MatchState
- PlayerRuntimeState
- RoleAssignment
- GamePhase
- EngineResult
- DomainError
- domain events
- legal phase transitions
- serialization-safe state

Do not implement role behavior yet.
Do not implement UI gameplay yet.
Do not add IndexedDB yet.

Add unit tests for:
- valid transitions
- invalid transitions
- JSON serialization
- match creation

Run lint, typecheck, and tests before finishing.
```

After PR-02 passes, proceed to role mechanics.

---

# 25. MVP Scope Guard

During implementation, reject scope creep such as:

- accounts;
- multiplayer phones;
- backend;
- remote database;
- WebSocket;
- QR cards;
- additional expansions;
- community roles;
- statistics;
- native app rewrite;
- AI narration generation;
- admin dashboard.

Create a backlog issue instead.

---

# 26. Known Rule Values to Finalize

Before final gameplay QA, explicitly set:

1. Fool execution behavior.
2. Guard consecutive-target rule.
3. Witch exact potion behavior.
4. Mayor behavior on death.

These values live in the MVP rule preset and must not block initial engine scaffolding.

---

# 27. Final MVP Definition of Done

The MVP is complete when a group can:

1. open/install the PWA;
2. create players;
3. select role composition;
4. privately register physical cards;
5. start the game;
6. complete automated night turns;
7. receive correct private Seer results;
8. resolve Guard/Wolf/Demon Wolf/Witch interactions;
9. announce morning deaths;
10. resolve Hunter morning shot;
11. elect Mayor after the first night;
12. discuss with timer;
13. vote with Mayor weight ×2;
14. resolve Fool/Hunter special behavior;
15. detect winner;
16. survive refresh/app reopen;
17. play without Internet after assets are cached;
18. finish the match without a human moderator.

---

# 28. Post-MVP Backlog

After real-world validation:

```text
Phase 2
├── New Moon roles
├── Characters
├── Character Plus
├── improved narration packs
├── richer presets
├── statistics
├── cloud sync
├── companion player devices
└── Capacitor/native packaging
```

Do not start these until the MVP has been played successfully by real groups.

---

# 29. Immediate Next Action

Begin with:

```text
PR-01: repository/tooling foundation
PR-02: pure TypeScript domain core
```

Do not build polished screens until the core engine scenario tests are passing.

The first technical milestone should be a headless test capable of running:

```text
Night 1
Seer inspect
Guard protect
Werewolves attack
Demon Wolf decision
Witch action
Resolve
Morning
Hunter trigger if needed
Mayor election
Day vote
Win check
```

Once that works deterministically, proceed to the mobile tabletop UI.
