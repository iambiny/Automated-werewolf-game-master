'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MVP_ROLE_IDS, type MvpRoleId } from '@werewolf/role-catalog';

import { IndexedDbMatchRepository } from '../../adapters/persistence/indexeddb-match-repository';
import { GameController } from '../../application/game-controller/game-controller';
import type {
  PrivateTurnView,
  PublicGameView,
} from '../../application/projections/game-view';
import type { RoleRegistrationView } from '../../application/projections/role-registration-view';
import type { RecoveryCheckpoint } from '../../application/recovery/recovery-coordinator';
import { toMvpPrivateTurnView } from '../night/mvp-private-turn-view';
import { createSetupCommandExecutor } from '../role-registration/setup-command-executor';
import {
  DEFAULT_PLAYERS,
  DEFAULT_ROLE_COUNTS,
  DEFAULT_SETUP_RULES,
  ROLE_LABELS,
  parseSetupRules,
  serializeSetupRules,
  toMvpRuleConfig,
  toRoleComposition,
  validatePlayers,
  validateRoleCounts,
  type PlayerDraft,
  type RoleCounts,
  type SetupRules,
} from '../setup/setup-model';

type Screen =
  | 'HOME'
  | 'PLAYERS'
  | 'ROLES'
  | 'RULES'
  | 'SETTINGS'
  | 'HANDOFF'
  | 'SELECT_ROLE'
  | 'PRIVACY'
  | 'REGISTRATION_ERROR'
  | 'READY'
  | 'NIGHT_READY'
  | 'NIGHT_WAKE'
  | 'NIGHT_TURN'
  | 'NIGHT_RESULT'
  | 'NIGHT_SLEEP'
  | 'NIGHT_RESOLVING'
  | 'DAWN';

export function GameApp() {
  const controllerRef = useRef<GameController | null>(null);
  const rulesRef = useRef(toMvpRuleConfig(DEFAULT_SETUP_RULES));
  const nextPlayerId = useRef(9);
  const [screen, setScreen] = useState<Screen>('HOME');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeView, setResumeView] = useState<PublicGameView | null>(null);
  const [resumeCheckpoint, setResumeCheckpoint] =
    useState<RecoveryCheckpoint | null>(null);
  const [players, setPlayers] = useState<PlayerDraft[]>(DEFAULT_PLAYERS);
  const [roleCounts, setRoleCounts] = useState<RoleCounts>(DEFAULT_ROLE_COUNTS);
  const [rules, setRules] = useState<SetupRules>(DEFAULT_SETUP_RULES);
  const [registration, setRegistration] = useState<RoleRegistrationView | null>(
    null,
  );
  const [selectedRole, setSelectedRole] = useState<MvpRoleId | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [privateTurn, setPrivateTurn] = useState<PrivateTurnView | null>(null);
  const [nightError, setNightError] = useState<string | null>(null);
  const [witchActionTaken, setWitchActionTaken] = useState(false);

  const hidePrivateContent = useCallback(() => {
    setRevealed(false);
    setSelectedRole(null);
    setScreen((current) => (current === 'SELECT_ROLE' ? 'HANDOFF' : current));
  }, []);

  usePrivacyGuard(
    screen === 'HANDOFF' || screen === 'SELECT_ROLE' || screen === 'PRIVACY',
    hidePrivateContent,
  );

  useEffect(() => {
    let active = true;
    const repository = new IndexedDbMatchRepository();
    const controller = new GameController({
      executeCommand: createSetupCommandExecutor(() => rulesRef.current),
      privateTurnProjector: (state) =>
        toMvpPrivateTurnView(state, rulesRef.current),
      repository,
    });
    controllerRef.current = controller;

    void controller.loadActiveMatch().then((result) => {
      if (!active) return;
      if (result.status === 'READY') {
        setResumeCheckpoint(result.checkpoint);
        setResumeView(controller.getPublicView());
        const persistedRules = parseSetupRules(controller.getConfiguration());
        rulesRef.current = toMvpRuleConfig(persistedRules);
        setRules(persistedRules);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      repository.close();
      controllerRef.current = null;
    };
  }, []);

  function beginNewGame() {
    setPlayers(DEFAULT_PLAYERS.map((player) => ({ ...player })));
    setRoleCounts({ ...DEFAULT_ROLE_COUNTS });
    setRules({ ...DEFAULT_SETUP_RULES });
    setError(null);
    setScreen('PLAYERS');
  }

  function resumeGame() {
    const controller = controllerRef.current;
    if (!controller || !resumeView) return;
    if (resumeView.phase.type === 'ROLE_REGISTRATION') {
      setRegistration(controller.getRoleRegistrationView());
      setScreen('HANDOFF');
    } else if (resumeView.phase.type === 'PRE_GAME_VALIDATION') {
      setScreen('READY');
    } else if (resumeView.phase.type === 'NIGHT') {
      if (resumeView.phase.subphase === 'PREPARE_QUEUE') {
        setScreen('NIGHT_READY');
      } else if (resumeView.phase.subphase === 'RESOLUTION') {
        void finishNight();
      } else {
        setPrivateTurn(controller.getPrivateTurnView());
        setScreen(
          resumeCheckpoint === 'NIGHT_AFTER_ROLE_SLEEP'
            ? 'NIGHT_SLEEP'
            : 'NIGHT_WAKE',
        );
      }
    } else if (resumeView.phase.type === 'MORNING') {
      setScreen('DAWN');
    }
  }

  function continueFromPlayers() {
    const validation = validatePlayers(players);
    if (validation) return setError(validation);
    setError(null);
    setScreen('ROLES');
  }

  function continueFromRoles() {
    const validation = validateRoleCounts(roleCounts, players.length);
    if (validation) return setError(validation);
    setError(null);
    setScreen('RULES');
  }

  async function beginRegistration() {
    const controller = controllerRef.current;
    if (!controller) return;
    setBusy(true);
    setError(null);
    rulesRef.current = toMvpRuleConfig(rules);
    const created = await controller.createMatch(
      {
        id: `match-${Date.now()}`,
        initialPhaseId: 'setup',
        players: players.map((player, seatIndex) => ({
          displayName: player.name.trim().replace(/\s+/g, ' '),
          id: player.id,
          seatIndex,
        })),
        roleComposition: toRoleComposition(roleCounts),
        rulesetId: 'boardgameviet-vn',
        rulesetVersion: '1.0.0',
      },
      serializeSetupRules(rules),
    );
    if (!created.ok) {
      setError(created.error.message);
      setBusy(false);
      return;
    }
    const transitioned = await controller.dispatch({
      payload: {},
      type: 'BEGIN_ROLE_REGISTRATION',
    });
    setBusy(false);
    if (!transitioned.ok) return setError(transitioned.error.message);
    setResumeView(controller.getPublicView());
    setRegistration(controller.getRoleRegistrationView());
    setScreen('HANDOFF');
  }

  async function confirmRole() {
    const controller = controllerRef.current;
    const player = registration?.currentPlayer;
    if (!controller || !player || !selectedRole) return;
    setBusy(true);
    const result = await controller.dispatch({
      payload: { playerId: player.playerId, roleId: selectedRole },
      type: 'REGISTER_ROLE',
    });
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    setRevealed(false);
    setSelectedRole(null);
    setRegistration(controller.getRoleRegistrationView());
    setScreen('PRIVACY');
  }

  async function passDevice() {
    const controller = controllerRef.current;
    if (!controller || !registration) return;
    if (!registration.complete) return setScreen('HANDOFF');
    setBusy(true);
    const result = await controller.dispatch({
      payload: {},
      type: 'COMPLETE_ROLE_REGISTRATION',
    });
    setBusy(false);
    if (!result.ok) {
      setError(
        'Role registration does not match the selected deck. Please re-register roles.',
      );
      setScreen('REGISTRATION_ERROR');
      return;
    }
    setResumeView(controller.getPublicView());
    setScreen('READY');
  }

  async function restartRegistration() {
    const controller = controllerRef.current;
    if (!controller) return;
    setBusy(true);
    const result = await controller.dispatch({
      payload: {},
      type: 'RESET_ROLE_REGISTRATION',
    });
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    setError(null);
    setRegistration(controller.getRoleRegistrationView());
    setScreen('HANDOFF');
  }

  async function startNight() {
    const controller = controllerRef.current;
    if (!controller) return;
    setBusy(true);
    const result = await controller.dispatch({
      payload: {},
      type: 'START_FIRST_NIGHT',
    });
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    setResumeView(controller.getPublicView());
    setScreen('NIGHT_READY');
  }

  async function beginNightTurns() {
    const controller = controllerRef.current;
    if (!controller) return;
    setBusy(true);
    setNightError(null);
    const result = await controller.dispatch({
      payload: {},
      type: 'START_NIGHT_ROLE_TURNS',
    });
    setBusy(false);
    if (!result.ok) return setNightError(result.error.message);
    setResumeView(controller.getPublicView());
    setPrivateTurn(controller.getPrivateTurnView());
    setWitchActionTaken(false);
    setScreen('NIGHT_WAKE');
  }

  async function submitNightAction(
    action: 'TARGET' | 'SKIP' | 'CURSE' | 'HEAL' | 'POISON' | 'PASS',
    targetPlayerId?: string,
    reason: 'MANUAL' | 'TIMEOUT' = 'MANUAL',
  ) {
    const controller = controllerRef.current;
    if (!controller || !privateTurn) return;
    setBusy(true);
    setNightError(null);
    const actionId = `action-${Date.now()}-${privateTurn.roleId.toLowerCase()}`;
    let command;
    switch (privateTurn.roleId) {
      case 'SEER':
        command = {
          payload: { actionId, targetPlayerId: targetPlayerId ?? '' },
          type: action === 'PASS' ? 'PASS_NIGHT_TURN' : 'SUBMIT_SEER_TARGET',
        };
        break;
      case 'GUARD':
        command = {
          payload: { actionId, targetPlayerId: targetPlayerId ?? '' },
          type: action === 'PASS' ? 'PASS_NIGHT_TURN' : 'SUBMIT_GUARD_TARGET',
        };
        break;
      case 'WEREWOLF':
        command = {
          payload: {
            actionId,
            targetPlayerId: action === 'SKIP' ? null : (targetPlayerId ?? ''),
          },
          type: 'SUBMIT_WEREWOLF_TARGET',
        };
        break;
      case 'DEMON_WOLF':
        command = {
          payload: {
            actionId,
            decision: action === 'CURSE' ? 'CURSE' : 'SKIP',
          },
          type: 'SUBMIT_DEMON_WOLF_CURSE',
        };
        break;
      case 'WITCH':
        command =
          action === 'HEAL'
            ? { payload: { actionId }, type: 'SUBMIT_WITCH_HEAL' }
            : action === 'POISON'
              ? {
                  payload: { actionId, targetPlayerId: targetPlayerId ?? '' },
                  type: 'SUBMIT_WITCH_POISON',
                }
              : {
                  payload: { actionId, reason },
                  type: 'PASS_NIGHT_TURN',
                };
        break;
      default:
        command = {
          payload: { actionId, reason },
          type: 'PASS_NIGHT_TURN',
        };
    }
    if (action === 'PASS') {
      command = {
        payload: { actionId, reason },
        type: 'PASS_NIGHT_TURN',
      };
    }
    const result = await controller.dispatch(command);
    setBusy(false);
    if (!result.ok) return setNightError(result.error.message);

    const nextPrivate = controller.getPrivateTurnView();
    setPrivateTurn(nextPrivate);
    if (privateTurn.roleId === 'SEER' && action !== 'PASS') {
      setScreen('NIGHT_RESULT');
    } else if (
      privateTurn.roleId === 'WITCH' &&
      (action === 'HEAL' || action === 'POISON') &&
      rules.witchAllowHealAndPoison
    ) {
      setWitchActionTaken(true);
    } else {
      setScreen('NIGHT_SLEEP');
    }
  }

  function completeDecoyOrWitchTurn() {
    if (privateTurn?.mode === 'DECOY' || witchActionTaken) {
      setScreen('NIGHT_SLEEP');
      return;
    }
    void submitNightAction('PASS');
  }

  async function advanceNight() {
    const controller = controllerRef.current;
    if (!controller) return;
    setBusy(true);
    setNightError(null);
    const result = await controller.dispatch({
      payload: {},
      type: 'ADVANCE_NIGHT_TURN',
    });
    setBusy(false);
    if (!result.ok) return setNightError(result.error.message);
    const publicView = controller.getPublicView();
    setResumeView(publicView);
    if (
      publicView?.phase.type === 'NIGHT' &&
      publicView.phase.subphase === 'RESOLUTION'
    ) {
      await finishNight();
      return;
    }
    setPrivateTurn(controller.getPrivateTurnView());
    setWitchActionTaken(false);
    setScreen('NIGHT_WAKE');
  }

  async function finishNight() {
    const controller = controllerRef.current;
    if (!controller) return;
    setScreen('NIGHT_RESOLVING');
    setBusy(true);
    setNightError(null);
    if (!controller.getPublicView()?.nightResolved) {
      const resolved = await controller.dispatch({
        payload: {},
        type: 'RESOLVE_NIGHT',
      });
      if (!resolved.ok) {
        setBusy(false);
        setNightError(resolved.error.message);
        return;
      }
    }
    const dawn = await controller.dispatch({ payload: {}, type: 'REACH_DAWN' });
    setBusy(false);
    if (!dawn.ok) return setNightError(dawn.error.message);
    setResumeView(controller.getPublicView());
    setPrivateTurn(null);
    setScreen('DAWN');
  }

  if (loading) return <LoadingScreen />;

  return (
    <main className={`app-shell screen-${screen.toLowerCase()}`}>
      <AmbientBackdrop />
      <div className="app-content">
        {screen === 'HOME' && (
          <HomeScreen
            hasResume={resumeView !== null}
            onNewGame={beginNewGame}
            onResume={resumeGame}
            onSettings={() => setScreen('SETTINGS')}
            resumeLabel={describePhase(resumeView)}
          />
        )}
        {screen === 'SETTINGS' && (
          <SettingsInfo onBack={() => setScreen('HOME')} />
        )}
        {screen === 'PLAYERS' && (
          <PlayerSetup
            error={error}
            onBack={() => setScreen('HOME')}
            onChange={setPlayers}
            onContinue={continueFromPlayers}
            onNewPlayer={() => `player-${nextPlayerId.current++}`}
            players={players}
          />
        )}
        {screen === 'ROLES' && (
          <RoleSetup
            counts={roleCounts}
            error={error}
            onBack={() => setScreen('PLAYERS')}
            onChange={setRoleCounts}
            onContinue={continueFromRoles}
            playerCount={players.length}
          />
        )}
        {screen === 'RULES' && (
          <RulesSetup
            busy={busy}
            error={error}
            onBack={() => setScreen('ROLES')}
            onChange={setRules}
            onContinue={() => void beginRegistration()}
            rules={rules}
          />
        )}
        {screen === 'HANDOFF' && registration?.currentPlayer && (
          <HandoffScreen
            playerName={registration.currentPlayer.displayName}
            progress={`${registration.registeredCount + 1} / ${registration.totalPlayers}`}
            revealed={revealed}
            onReveal={() => {
              setRevealed(true);
              setScreen('SELECT_ROLE');
            }}
          />
        )}
        {screen === 'SELECT_ROLE' && registration?.currentPlayer && (
          <RoleSelection
            busy={busy}
            onConfirm={() => void confirmRole()}
            onSelect={setSelectedRole}
            playerName={registration.currentPlayer.displayName}
            selectedRole={selectedRole}
          />
        )}
        {screen === 'PRIVACY' && registration && (
          <PrivacyScreen
            busy={busy}
            isComplete={registration.complete}
            onContinue={() => void passDevice()}
          />
        )}
        {screen === 'REGISTRATION_ERROR' && (
          <RegistrationError
            busy={busy}
            onRestart={() => void restartRegistration()}
          />
        )}
        {screen === 'READY' && (
          <ReadyScreen
            busy={busy}
            error={error}
            onStart={() => void startNight()}
            playerCount={resumeView?.players.length ?? players.length}
          />
        )}
        {screen === 'NIGHT_READY' && (
          <NightReadyScreen
            busy={busy}
            error={nightError}
            nightNumber={resumeView?.cycle ?? 1}
            onStart={() => void beginNightTurns()}
          />
        )}
        {screen === 'NIGHT_WAKE' && privateTurn && (
          <NightWakeScreen
            onReady={() => setScreen('NIGHT_TURN')}
            roleId={privateTurn.roleId}
          />
        )}
        {screen === 'NIGHT_TURN' && privateTurn && (
          <NightTurnScreen
            busy={busy}
            error={nightError}
            onComplete={completeDecoyOrWitchTurn}
            onSubmit={(action, targetPlayerId) =>
              void submitNightAction(action, targetPlayerId)
            }
            onTimeout={() => {
              if (privateTurn.mode === 'DECOY') {
                setScreen('NIGHT_SLEEP');
              } else {
                void submitNightAction('PASS', undefined, 'TIMEOUT');
              }
            }}
            rules={rules}
            turn={privateTurn}
            witchActionTaken={witchActionTaken}
          />
        )}
        {screen === 'NIGHT_RESULT' && privateTurn && (
          <NightResultScreen
            onAcknowledge={() => {
              setPrivateTurn((turn) =>
                turn ? { ...turn, privateResult: undefined } : null,
              );
              setScreen('NIGHT_SLEEP');
            }}
            turn={privateTurn}
          />
        )}
        {screen === 'NIGHT_SLEEP' && privateTurn && (
          <NightSleepScreen
            busy={busy}
            error={nightError}
            onContinue={() => void advanceNight()}
            roleId={privateTurn.roleId}
          />
        )}
        {screen === 'NIGHT_RESOLVING' && (
          <NightResolvingScreen
            busy={busy}
            error={nightError}
            onRetry={() => void finishNight()}
          />
        )}
        {screen === 'DAWN' && <DawnScreen dayNumber={resumeView?.cycle ?? 1} />}
      </div>
    </main>
  );
}

function HomeScreen({
  hasResume,
  onNewGame,
  onResume,
  onSettings,
  resumeLabel,
}: {
  hasResume: boolean;
  onNewGame: () => void;
  onResume: () => void;
  onSettings: () => void;
  resumeLabel: string;
}) {
  return (
    <section className="home-screen panel-enter">
      <div className="brand-mark" aria-hidden="true">
        <span>W</span>
      </div>
      <p className="eyebrow">A game of trust after dark</p>
      <h1>Werewolf</h1>
      <p className="lede">
        One shared device. Physical cards. A calm game master who never forgets
        what happened in the night.
      </p>
      <div className="home-actions">
        {hasResume && (
          <button className="button button-primary" onClick={onResume}>
            <span>Resume game</span>
            <small>{resumeLabel}</small>
          </button>
        )}
        <button
          className={
            hasResume ? 'button button-secondary' : 'button button-primary'
          }
          onClick={onNewGame}
        >
          New game
        </button>
        <button className="button button-ghost" onClick={onSettings}>
          Settings
        </button>
      </div>
      <p className="home-footnote">
        Designed for a single phone passed around the table
      </p>
    </section>
  );
}

function PlayerSetup({
  error,
  onBack,
  onChange,
  onContinue,
  onNewPlayer,
  players,
}: {
  error: string | null;
  onBack: () => void;
  onChange: (players: PlayerDraft[]) => void;
  onContinue: () => void;
  onNewPlayer: () => string;
  players: PlayerDraft[];
}) {
  function update(index: number, name: string) {
    onChange(
      players.map((player, i) => (i === index ? { ...player, name } : player)),
    );
  }
  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= players.length) return;
    const next = [...players];
    const current = next[index];
    const destination = next[target];
    if (!current || !destination) return;
    next[index] = destination;
    next[target] = current;
    onChange(next);
  }
  return (
    <WizardFrame
      step="1 of 3"
      title="Who is at the table?"
      subtitle="Arrange players in clockwise seat order."
      onBack={onBack}
    >
      <div className="player-list">
        {players.map((player, index) => (
          <div className="player-row" key={player.id}>
            <span className="seat-number">{index + 1}</span>
            <label className="sr-only" htmlFor={`player-${player.id}`}>
              Player {index + 1} name
            </label>
            <input
              id={`player-${player.id}`}
              value={player.name}
              onChange={(event) => update(index, event.target.value)}
            />
            <div className="row-actions">
              <button
                aria-label={`Move ${player.name} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                aria-label={`Move ${player.name} down`}
                disabled={index === players.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                aria-label={`Remove ${player.name}`}
                disabled={players.length === 1}
                onClick={() => onChange(players.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        className="add-button"
        onClick={() =>
          onChange([
            ...players,
            { id: onNewPlayer(), name: `Player ${players.length + 1}` },
          ])
        }
      >
        <span>＋</span> Add player
      </button>
      <InlineError message={error} />
      <button
        className="button button-primary sticky-action"
        onClick={onContinue}
      >
        Continue with {players.length} players
      </button>
    </WizardFrame>
  );
}

function RoleSetup({
  counts,
  error,
  onBack,
  onChange,
  onContinue,
  playerCount,
}: {
  counts: RoleCounts;
  error: string | null;
  onBack: () => void;
  onChange: (counts: RoleCounts) => void;
  onContinue: () => void;
  playerCount: number;
}) {
  const total = MVP_ROLE_IDS.reduce((sum, roleId) => sum + counts[roleId], 0);
  return (
    <WizardFrame
      step="2 of 3"
      title="Build the physical deck"
      subtitle="Match these counts to the cards players will draw."
      onBack={onBack}
    >
      <div className="deck-meter">
        <span>Cards selected</span>
        <strong className={total === playerCount ? 'count-valid' : ''}>
          {total} / {playerCount}
        </strong>
      </div>
      <div className="role-count-grid">
        {MVP_ROLE_IDS.map((roleId) => (
          <div
            className={`role-count-card role-${roleId.toLowerCase().replace('_', '-')}`}
            key={roleId}
          >
            <div>
              <span className="role-glyph">{roleGlyph(roleId)}</span>
              <strong>{ROLE_LABELS[roleId]}</strong>
            </div>
            <div className="stepper">
              <button
                aria-label={`Remove ${ROLE_LABELS[roleId]}`}
                disabled={counts[roleId] === 0}
                onClick={() =>
                  onChange({
                    ...counts,
                    [roleId]: Math.max(0, counts[roleId] - 1),
                  })
                }
              >
                −
              </button>
              <output aria-label={`${ROLE_LABELS[roleId]} count`}>
                {counts[roleId]}
              </output>
              <button
                aria-label={`Add ${ROLE_LABELS[roleId]}`}
                onClick={() =>
                  onChange({ ...counts, [roleId]: counts[roleId] + 1 })
                }
              >
                ＋
              </button>
            </div>
          </div>
        ))}
      </div>
      <InlineError message={error} />
      <button
        className="button button-primary sticky-action"
        onClick={onContinue}
      >
        Review game rules
      </button>
    </WizardFrame>
  );
}

function RulesSetup({
  busy,
  error,
  onBack,
  onChange,
  onContinue,
  rules,
}: {
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onChange: (rules: SetupRules) => void;
  onContinue: () => void;
  rules: SetupRules;
}) {
  return (
    <WizardFrame
      step="3 of 3"
      title="Set the house rules"
      subtitle="Only the choices that matter during this game."
      onBack={onBack}
    >
      <div className="settings-stack">
        <SettingGroup title="Seer reveals">
          <SegmentedControl
            value={rules.seerMode}
            options={[
              ['TEAM', 'Team only'],
              ['ROLE', 'Exact role'],
            ]}
            onChange={(seerMode) => onChange({ ...rules, seerMode })}
          />
        </SettingGroup>
        <SettingGroup title="Guard">
          <Toggle
            checked={rules.guardAllowSelfProtect}
            label="May protect themself"
            onChange={(guardAllowSelfProtect) =>
              onChange({ ...rules, guardAllowSelfProtect })
            }
          />
          <Toggle
            checked={rules.guardAllowConsecutiveTarget}
            label="May repeat last night's target"
            onChange={(guardAllowConsecutiveTarget) =>
              onChange({ ...rules, guardAllowConsecutiveTarget })
            }
          />
        </SettingGroup>
        <SettingGroup title="Witch">
          <Toggle
            checked={rules.witchSeesVictim}
            label="Sees the Werewolf target"
            onChange={(witchSeesVictim) =>
              onChange({ ...rules, witchSeesVictim })
            }
          />
          <Toggle
            checked={rules.witchAllowSelfHeal}
            label="May heal themself"
            onChange={(witchAllowSelfHeal) =>
              onChange({ ...rules, witchAllowSelfHeal })
            }
          />
          <Toggle
            checked={rules.witchAllowHealAndPoison}
            label="May use both potions in one night"
            onChange={(witchAllowHealAndPoison) =>
              onChange({ ...rules, witchAllowHealAndPoison })
            }
          />
        </SettingGroup>
        <SettingGroup title="Fool & Mayor">
          <Toggle
            checked={rules.foolSurvivesFirstExecution}
            label="Fool survives first execution and loses vote"
            onChange={(foolSurvivesFirstExecution) =>
              onChange({ ...rules, foolSurvivesFirstExecution })
            }
          />
          <div className="fixed-setting">
            <span>Mayor office after death</span>
            <strong>Vacant</strong>
          </div>
        </SettingGroup>
        <SettingGroup title="Timers">
          <NumberSetting
            label="Private role turn"
            value={rules.roleTimerSeconds}
            suffix="sec"
            onChange={(roleTimerSeconds) =>
              onChange({ ...rules, roleTimerSeconds })
            }
          />
          <NumberSetting
            label="Day discussion"
            value={rules.discussionTimerSeconds}
            suffix="sec"
            onChange={(discussionTimerSeconds) =>
              onChange({ ...rules, discussionTimerSeconds })
            }
          />
        </SettingGroup>
      </div>
      <InlineError message={error} />
      <button
        className="button button-primary sticky-action"
        disabled={busy}
        onClick={onContinue}
      >
        {busy ? 'Saving…' : 'Begin secret registration'}
      </button>
    </WizardFrame>
  );
}

function HandoffScreen({
  playerName,
  progress,
  revealed,
  onReveal,
}: {
  playerName: string;
  progress: string;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <section className="private-screen handoff-screen panel-enter">
      <div className="private-top">
        <span>Secret registration</span>
        <span>{progress}</span>
      </div>
      <div className="privacy-icon" aria-hidden="true">
        ◌
      </div>
      <p className="eyebrow">Pass the phone to</p>
      <h2>{playerName}</h2>
      <p>Everyone else, look away. Your card stays private.</p>
      <HoldToReveal revealed={revealed} onReveal={onReveal} />
    </section>
  );
}

function HoldToReveal({
  revealed,
  onReveal,
}: {
  revealed: boolean;
  onReveal: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }, []);
  function start() {
    if (revealed || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(onReveal, 700);
  }
  useEffect(() => cancel, [cancel]);
  return (
    <button
      className={`hold-button ${holding ? 'is-holding' : ''}`}
      onPointerDown={start}
      onPointerLeave={cancel}
      onPointerUp={cancel}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') start();
      }}
      onKeyUp={cancel}
    >
      <span>Hold to reveal roles</span>
      <i aria-hidden="true" />
    </button>
  );
}

function RoleSelection({
  busy,
  onConfirm,
  onSelect,
  playerName,
  selectedRole,
}: {
  busy: boolean;
  onConfirm: () => void;
  onSelect: (role: MvpRoleId) => void;
  playerName: string;
  selectedRole: MvpRoleId | null;
}) {
  return (
    <section className="private-screen role-select-screen panel-enter">
      <div className="private-top">
        <span>Private choice</span>
        <span>For {playerName}</span>
      </div>
      <p className="eyebrow">Match your physical card</p>
      <h2>Choose your role</h2>
      <div className="role-choice-grid">
        {MVP_ROLE_IDS.map((roleId) => (
          <button
            aria-pressed={selectedRole === roleId}
            className={
              selectedRole === roleId ? 'role-choice selected' : 'role-choice'
            }
            key={roleId}
            onClick={() => onSelect(roleId)}
          >
            <span>{roleGlyph(roleId)}</span>
            <strong>{ROLE_LABELS[roleId]}</strong>
          </button>
        ))}
      </div>
      <button
        className="button button-primary sticky-action"
        disabled={!selectedRole || busy}
        onClick={onConfirm}
      >
        {busy ? 'Saving privately…' : 'Confirm my role'}
      </button>
    </section>
  );
}

function PrivacyScreen({
  busy,
  isComplete,
  onContinue,
}: {
  busy: boolean;
  isComplete: boolean;
  onContinue: () => void;
}) {
  return (
    <section className="private-screen privacy-screen panel-enter">
      <div className="privacy-seal" aria-hidden="true">
        ✓
      </div>
      <p className="eyebrow">Hidden safely</p>
      <h2>Role saved</h2>
      <p>
        The previous choice is no longer visible. Turn the screen away before
        passing it on.
      </p>
      <button
        className="button button-primary"
        disabled={busy}
        onClick={onContinue}
      >
        {isComplete ? 'Validate the deck' : 'Pass to next player'}
      </button>
    </section>
  );
}

function RegistrationError({
  busy,
  onRestart,
}: {
  busy: boolean;
  onRestart: () => void;
}) {
  return (
    <section className="center-card panel-enter">
      <div className="warning-mark">!</div>
      <p className="eyebrow">Private validation</p>
      <h2>The roles do not match</h2>
      <p>
        Role registration does not match the selected deck. No player or role is
        identified.
      </p>
      <button
        className="button button-primary"
        disabled={busy}
        onClick={onRestart}
      >
        {busy ? 'Clearing…' : 'Re-register every role'}
      </button>
    </section>
  );
}

function ReadyScreen({
  busy,
  error,
  onStart,
  playerCount,
}: {
  busy: boolean;
  error: string | null;
  onStart: () => void;
  playerCount: number;
}) {
  return (
    <section className="center-card ready-card panel-enter">
      <div className="ready-ring" aria-hidden="true">
        ☾
      </div>
      <p className="eyebrow">Pre-game check complete</p>
      <h2>The village is ready</h2>
      <p>
        {playerCount} players and their physical deck are registered. Secrets
        are saved on this device.
      </p>
      <ul className="check-list">
        <li>Turn on Do Not Disturb</li>
        <li>Raise the volume for narration</li>
        <li>Place the phone where everyone can hear</li>
      </ul>
      <InlineError message={error} />
      <button
        className="button button-primary"
        disabled={busy}
        onClick={onStart}
      >
        {busy ? 'Preparing Night 1…' : 'Begin Night 1'}
      </button>
    </section>
  );
}

function NightReadyScreen({
  busy,
  error,
  nightNumber,
  onStart,
}: {
  busy: boolean;
  error: string | null;
  nightNumber: number;
  onStart: () => void;
}) {
  return (
    <section className="night-ready panel-enter">
      <div className="moon" aria-hidden="true" />
      <p className="eyebrow">Night {nightNumber}</p>
      <h2>Everyone, close your eyes.</h2>
      <p>
        Place the phone with the moderator. Keep your eyes closed until dawn.
      </p>
      <InlineError message={error} />
      <button
        className="button button-primary night-action"
        disabled={busy}
        onClick={onStart}
      >
        {busy ? 'Starting the night…' : 'Everyone is ready'}
      </button>
    </section>
  );
}

function NightWakeScreen({
  onReady,
  roleId,
}: {
  onReady: () => void;
  roleId: string;
}) {
  return (
    <section className="night-cue panel-enter">
      <div className="sound-rings" aria-hidden="true">
        <i />
        <i />
        <span>{nightGlyph(roleId)}</span>
      </div>
      <p className="eyebrow">Wake quietly</p>
      <h2>{nightRoleLabel(roleId)}, open your eyes.</h2>
      <p>Only this role should look at the screen.</p>
      <button className="button button-primary night-action" onClick={onReady}>
        Open private controls
      </button>
    </section>
  );
}

function NightTurnScreen({
  busy,
  error,
  onComplete,
  onSubmit,
  onTimeout,
  rules,
  turn,
  witchActionTaken,
}: {
  busy: boolean;
  error: string | null;
  onComplete: () => void;
  onSubmit: (
    action: 'TARGET' | 'SKIP' | 'CURSE' | 'HEAL' | 'POISON' | 'PASS',
    targetPlayerId?: string,
  ) => void;
  onTimeout: () => void;
  rules: SetupRules;
  turn: PrivateTurnView;
  witchActionTaken: boolean;
}) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const remaining = useDeadlineCountdown(rules.roleTimerSeconds, onTimeout);

  if (turn.mode === 'DECOY') {
    return (
      <section className="night-private-turn panel-enter">
        <NightTurnHeader remaining={remaining} roleId={turn.roleId} />
        <div className="decoy-orb" aria-hidden="true">
          {nightGlyph(turn.roleId)}
        </div>
        <h2>Hold the night still.</h2>
        <p>Complete this private pause, then close your eyes when prompted.</p>
        <button
          className="button button-primary night-action"
          disabled={busy}
          onClick={onComplete}
        >
          Complete turn
        </button>
      </section>
    );
  }

  const targets = turn.validTargets ?? [];
  const selected = targets.find((target) => target.playerId === selectedTarget);
  const isTargetRole =
    turn.roleId === 'SEER' ||
    turn.roleId === 'GUARD' ||
    turn.roleId === 'WEREWOLF';

  return (
    <section className="night-private-turn panel-enter">
      <NightTurnHeader remaining={remaining} roleId={turn.roleId} />
      <p className="eyebrow">Private action</p>
      <h2>{nightPrompt(turn.roleId)}</h2>

      {isTargetRole && (
        <TargetGrid
          onSelect={setSelectedTarget}
          selectedTarget={selectedTarget}
          targets={targets}
        />
      )}

      {turn.roleId === 'DEMON_WOLF' && (
        <div className="fixed-target-card">
          <span>Werewolf target</span>
          <strong>
            {turn.privateContext?.werewolfVictim?.displayName ?? 'No target'}
          </strong>
          <small>The curse cannot choose a different player.</small>
        </div>
      )}

      {turn.roleId === 'WITCH' && (
        <WitchControls
          busy={busy}
          onSelect={setSelectedTarget}
          onSubmit={onSubmit}
          selectedTarget={selectedTarget}
          targets={targets}
          turn={turn}
        />
      )}

      <InlineError message={error} />

      {isTargetRole && (
        <div className="night-submit-row">
          {turn.roleId === 'WEREWOLF' && (
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => onSubmit('SKIP')}
            >
              No attack
            </button>
          )}
          <button
            className="button button-primary"
            disabled={!selected || busy}
            onClick={() => onSubmit('TARGET', selected?.playerId)}
          >
            Confirm {selected?.displayName ?? 'target'}
          </button>
        </div>
      )}

      {turn.roleId === 'DEMON_WOLF' && (
        <div className="night-submit-row">
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={() => onSubmit('SKIP')}
          >
            Save the curse
          </button>
          <button
            className="button button-primary"
            disabled={!turn.privateContext?.werewolfVictim || busy}
            onClick={() => onSubmit('CURSE')}
          >
            Use curse
          </button>
        </div>
      )}

      {turn.roleId === 'WITCH' && (
        <button
          className="button button-ghost finish-witch"
          disabled={busy}
          onClick={onComplete}
        >
          {witchActionTaken ? 'Finish Witch turn' : 'Use no potion'}
        </button>
      )}

      {!['SEER', 'GUARD', 'WEREWOLF', 'DEMON_WOLF', 'WITCH'].includes(
        turn.roleId,
      ) && (
        <button
          className="button button-primary night-action"
          disabled={busy}
          onClick={() => onSubmit('PASS')}
        >
          Complete turn
        </button>
      )}
    </section>
  );
}

function WitchControls({
  busy,
  onSelect,
  onSubmit,
  selectedTarget,
  targets,
  turn,
}: {
  busy: boolean;
  onSelect: (playerId: string) => void;
  onSubmit: (
    action: 'TARGET' | 'SKIP' | 'CURSE' | 'HEAL' | 'POISON' | 'PASS',
    targetPlayerId?: string,
  ) => void;
  selectedTarget: string | null;
  targets: NonNullable<PrivateTurnView['validTargets']>;
  turn: PrivateTurnView;
}) {
  const healCount = turn.privateContext?.healPotionRemaining ?? 0;
  const poisonCount = turn.privateContext?.poisonPotionRemaining ?? 0;
  const canHeal = turn.privateContext?.canHealWerewolfVictim === true;
  return (
    <div className="witch-controls">
      <div className="potion-card potion-heal">
        <div>
          <span>Healing potion</span>
          <strong>{healCount} left</strong>
        </div>
        <p>
          {turn.privateContext?.werewolfVictim
            ? `${turn.privateContext.werewolfVictim.displayName} was attacked.`
            : canHeal
              ? 'Heal the Werewolf victim without revealing their name.'
              : 'There is no attack target to heal.'}
        </p>
        <button
          className="button button-secondary"
          disabled={healCount === 0 || !canHeal || busy}
          onClick={() => onSubmit('HEAL')}
        >
          Use healing potion
        </button>
      </div>
      <div className="potion-card potion-poison">
        <div>
          <span>Poison potion</span>
          <strong>{poisonCount} left</strong>
        </div>
        {poisonCount > 0 && (
          <TargetGrid
            compact
            onSelect={onSelect}
            selectedTarget={selectedTarget}
            targets={targets}
          />
        )}
        <button
          className="button button-secondary"
          disabled={!selectedTarget || poisonCount === 0 || busy}
          onClick={() => onSubmit('POISON', selectedTarget ?? undefined)}
        >
          Confirm poison
        </button>
      </div>
    </div>
  );
}

function TargetGrid({
  compact = false,
  onSelect,
  selectedTarget,
  targets,
}: {
  compact?: boolean;
  onSelect: (playerId: string) => void;
  selectedTarget: string | null;
  targets: NonNullable<PrivateTurnView['validTargets']>;
}) {
  return (
    <div className={compact ? 'target-grid compact' : 'target-grid'}>
      {targets.map((target) => (
        <button
          aria-pressed={selectedTarget === target.playerId}
          className={
            selectedTarget === target.playerId
              ? 'target-button selected'
              : 'target-button'
          }
          key={target.playerId}
          onClick={() => onSelect(target.playerId)}
        >
          <span>{target.seatIndex + 1}</span>
          <strong>{target.displayName}</strong>
        </button>
      ))}
    </div>
  );
}

function NightTurnHeader({
  remaining,
  roleId,
}: {
  remaining: number;
  roleId: string;
}) {
  return (
    <header className="night-turn-header">
      <span>
        {nightGlyph(roleId)} {nightRoleLabel(roleId)}
      </span>
      <strong className={remaining <= 10 ? 'timer-warning' : ''}>
        {remaining}s
      </strong>
    </header>
  );
}

function NightResultScreen({
  onAcknowledge,
  turn,
}: {
  onAcknowledge: () => void;
  turn: PrivateTurnView;
}) {
  const result = turn.privateResult;
  const target = turn.validTargets?.find(
    (player) => player.playerId === result?.targetPlayerId,
  );
  const value = result
    ? result.result.mode === 'TEAM'
      ? result.result.teamId === 'WEREWOLF'
        ? 'Werewolf aligned'
        : 'Village aligned'
      : nightRoleLabel(result.result.roleId)
    : 'Unknown';
  return (
    <section className="night-result panel-enter">
      <div className="result-eye" aria-hidden="true">
        ◉
      </div>
      <p className="eyebrow">For the Seer only</p>
      <h2>{target?.displayName ?? 'Your target'}</h2>
      <div className="result-value">{value}</div>
      <p>This result disappears as soon as you continue.</p>
      <button
        className="button button-primary night-action"
        onClick={onAcknowledge}
      >
        Hide result and sleep
      </button>
    </section>
  );
}

function NightSleepScreen({
  busy,
  error,
  onContinue,
  roleId,
}: {
  busy: boolean;
  error: string | null;
  onContinue: () => void;
  roleId: string;
}) {
  return (
    <section className="night-cue sleep-cue panel-enter">
      <div className="sleep-glyph" aria-hidden="true">
        {nightGlyph(roleId)}
      </div>
      <p className="eyebrow">Action hidden</p>
      <h2>{nightRoleLabel(roleId)}, close your eyes.</h2>
      <p>The screen is safe to return to the moderator.</p>
      <InlineError message={error} />
      <button
        className="button button-primary night-action"
        disabled={busy}
        onClick={onContinue}
      >
        {busy ? 'Saving…' : 'Role is asleep'}
      </button>
    </section>
  );
}

function NightResolvingScreen({
  busy,
  error,
  onRetry,
}: {
  busy: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <section className="night-resolving panel-enter">
      <div className="resolve-pulse" aria-hidden="true" />
      <p className="eyebrow">The village sleeps</p>
      <h2>Night is resolving…</h2>
      <p>No private outcome will appear on this screen.</p>
      <InlineError message={error} />
      {error && (
        <button
          className="button button-primary night-action"
          disabled={busy}
          onClick={onRetry}
        >
          Retry safely
        </button>
      )}
    </section>
  );
}

function DawnScreen({ dayNumber }: { dayNumber: number }) {
  return (
    <section className="dawn-screen panel-enter">
      <div className="sunrise" aria-hidden="true">
        <i />
      </div>
      <p className="eyebrow">Morning {dayNumber}</p>
      <h2>The village wakes.</h2>
      <p>Night outcomes are sealed. Morning announcements continue in PR-10.</p>
    </section>
  );
}

function SettingsInfo({ onBack }: { onBack: () => void }) {
  return (
    <section className="center-card panel-enter">
      <button className="back-button" onClick={onBack}>
        ← Home
      </button>
      <p className="eyebrow">Settings</p>
      <h2>Rules travel with the match</h2>
      <p>
        House rules and timers are selected during New Game and saved with that
        match, so recovery uses the same choices.
      </p>
      <div className="info-block">
        <strong>Privacy by design</strong>
        <span>Private results are never included in the public game view.</span>
      </div>
    </section>
  );
}

function WizardFrame({
  children,
  onBack,
  step,
  subtitle,
  title,
}: {
  children: ReactNode;
  onBack: () => void;
  step: string;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="wizard panel-enter">
      <header className="wizard-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <span className="step-label">Setup · {step}</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      {children}
    </section>
  );
}

function SettingGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="setting-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <i aria-hidden="true" />
    </label>
  );
}
function SegmentedControl<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: Array<[T, string]>;
  value: T;
}) {
  return (
    <div className="segmented">
      {options.map(([option, label]) => (
        <button
          aria-pressed={option === value}
          className={option === value ? 'active' : ''}
          key={option}
          onClick={() => onChange(option)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
function NumberSetting({
  label,
  onChange,
  suffix,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <label className="number-setting">
      <span>{label}</span>
      <span>
        <input
          min="15"
          onChange={(event) => onChange(Number(event.target.value))}
          step="15"
          type="number"
          value={value}
        />{' '}
        {suffix}
      </span>
    </label>
  );
}
function InlineError({ message }: { message: string | null }) {
  return message ? (
    <p className="inline-error" role="alert">
      {message}
    </p>
  ) : null;
}
function LoadingScreen() {
  return (
    <main className="app-shell">
      <AmbientBackdrop />
      <div className="loading-screen">
        <div className="brand-mark">
          <span>W</span>
        </div>
        <p>Checking the village…</p>
      </div>
    </main>
  );
}
function AmbientBackdrop() {
  return (
    <div className="ambient" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  );
}

function describePhase(view: PublicGameView | null): string {
  if (!view) return '';
  if (view.phase.type === 'ROLE_REGISTRATION')
    return 'Secret role registration';
  if (view.phase.type === 'PRE_GAME_VALIDATION')
    return 'Ready to begin Night 1';
  if (view.phase.type === 'NIGHT') return `Night ${view.phase.nightNumber}`;
  return view.phase.type.replaceAll('_', ' ').toLocaleLowerCase();
}

function roleGlyph(roleId: MvpRoleId): string {
  const glyphs: Record<MvpRoleId, string> = {
    DEMON_WOLF: '◆',
    FOOL: '◇',
    GUARD: '⬟',
    HUNTER: '⌖',
    SEER: '◉',
    VILLAGER: '●',
    WEREWOLF: '▲',
    WITCH: '✦',
  };
  return glyphs[roleId];
}

function nightRoleLabel(roleId: string): string {
  return ROLE_LABELS[roleId as MvpRoleId] ?? roleId.replaceAll('_', ' ');
}

function nightGlyph(roleId: string): string {
  return MVP_ROLE_IDS.includes(roleId as MvpRoleId)
    ? roleGlyph(roleId as MvpRoleId)
    : '●';
}

function nightPrompt(roleId: string): string {
  switch (roleId) {
    case 'SEER':
      return 'Whose truth will you reveal?';
    case 'GUARD':
      return 'Who will you protect tonight?';
    case 'WEREWOLF':
      return 'Choose the village target.';
    case 'DEMON_WOLF':
      return 'Will you spend the curse?';
    case 'WITCH':
      return 'Will you use a potion?';
    default:
      return 'Complete your night action.';
  }
}

function useDeadlineCountdown(seconds: number, onTimeout: () => void): number {
  const [remaining, setRemaining] = useState(seconds);
  const timeoutCallback = useRef(onTimeout);
  const fired = useRef(false);

  useEffect(() => {
    timeoutCallback.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    const deadline = Date.now() + seconds * 1000;
    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0 && !fired.current) {
        fired.current = true;
        window.clearInterval(interval);
        timeoutCallback.current();
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [seconds]);

  return remaining;
}

function usePrivacyGuard(active: boolean, hide: () => void) {
  useEffect(() => {
    if (!active) return;
    function handleVisibility() {
      if (document.visibilityState !== 'visible') hide();
    }
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', hide);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', hide);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [active, hide]);
}
