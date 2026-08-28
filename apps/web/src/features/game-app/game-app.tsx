'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  MVP_ROLE_IDS,
  mvpRoleCatalog,
  type MvpRoleId,
} from '@werewolf/role-catalog';

import { IndexedDbMatchRepository } from '../../adapters/persistence/indexeddb-match-repository';
import {
  BrowserAudioService,
  roleNarrationCues,
  type AudioCue,
  type EffectKey,
  type MusicKey,
  type NightRoleId,
} from '../../adapters/audio/browser-audio-service';
import {
  createDeadlineTimer,
  extendDeadlineTimer,
  getRemainingMs,
  parseDeadlineTimer,
  pauseDeadlineTimer,
  resumeDeadlineTimer,
  type DeadlineTimerSnapshot,
} from '../../adapters/timer/deadline-timer';
import { ScreenWakeLock } from '../../adapters/wake-lock/screen-wake-lock';
import { GameController } from '../../application/game-controller/game-controller';
import type {
  PrivateTurnView,
  PlayerSummary,
  PublicDeathView,
  PublicGameView,
  PublicVotingView,
} from '../../application/projections/game-view';
import type { RoleRegistrationView } from '../../application/projections/role-registration-view';
import type { RecoveryCheckpoint } from '../../application/recovery/recovery-coordinator';
import { loadRecoveryWithTimeout } from '../../application/recovery/startup-recovery';
import { registerServiceWorker } from '../../pwa/register-service-worker';
import { toMvpPublicGameView } from '../day/mvp-public-game-view';
import { toMvpPrivateTurnView } from '../night/mvp-private-turn-view';
import { createSetupCommandExecutor } from '../role-registration/setup-command-executor';
import {
  DEFAULT_PLAYERS,
  DEFAULT_ROLE_COUNTS,
  DEFAULT_SETUP_RULES,
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
import {
  DEFAULT_LOCALE,
  LOCALE_OPTIONS,
  getRoleLabels,
  getActiveLocale,
  installPageLocalization,
  isSupportedLocale,
  setActiveLocale,
  translateInterfaceText,
  translateDeathReveal,
  translateNightPrompt,
  translatePhase,
  type SupportedLocale,
} from '../multi-language/multi-language';

type Screen =
  | 'HOME'
  | 'RECOVERY_ERROR'
  | 'NEW_GAME_WARNING'
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
  | 'DAWN'
  | 'MORNING_OUTCOME'
  | 'HUNTER'
  | 'HUNTER_OUTCOME'
  | 'MAYOR_VOTE'
  | 'MAYOR_RESULT'
  | 'MAYOR_SUCCESSOR'
  | 'DISCUSSION'
  | 'DAY_VOTE'
  | 'VOTE_OUTCOME'
  | 'GAME_OVER';

type RoleFactionId = 'VILLAGERS' | 'WEREWOLVES' | 'THIRD_PARTY';

const ROLE_FACTION_SECTIONS: ReadonlyArray<{
  id: RoleFactionId;
  label: string;
}> = [
  { id: 'VILLAGERS', label: 'Villagers' },
  { id: 'WEREWOLVES', label: 'Werewolves' },
  { id: 'THIRD_PARTY', label: 'Third Party' },
];

function roleFaction(roleId: MvpRoleId): RoleFactionId {
  const teamId = mvpRoleCatalog[roleId].teamId;
  if (teamId === 'VILLAGE') return 'VILLAGERS';
  if (teamId === 'WEREWOLF') return 'WEREWOLVES';
  return 'THIRD_PARTY';
}

export function GameApp() {
  const controllerRef = useRef<GameController | null>(null);
  const audioRef = useRef<BrowserAudioService | null>(null);
  const rulesRef = useRef(toMvpRuleConfig(DEFAULT_SETUP_RULES));
  const setupRulesRef = useRef(DEFAULT_SETUP_RULES);
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
  const [announcedDeaths, setAnnouncedDeaths] = useState<PublicDeathView[]>([]);
  const [dayMessage, setDayMessage] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<'LOCKED' | 'READY' | 'FAILED'>(
    'LOCKED',
  );
  const [narrationVolume, setNarrationVolume] = useState(0.85);
  const [effectsVolume, setEffectsVolume] = useState(0.7);
  const [nightActionEffectsEnabled, setNightActionEffectsEnabled] =
    useState(true);
  const [musicVolume, setMusicVolume] = useState(0.38);
  const [locale, setLocale] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const [recoveryIssue, setRecoveryIssue] = useState<string | null>(null);
  const [discussionTimer, setDiscussionTimer] =
    useState<DeadlineTimerSnapshot | null>(null);

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
    audioRef.current = new BrowserAudioService();
    const audioPreferences = loadAudioPreferences();
    setLocale(loadLocalePreference());
    setNarrationVolume(audioPreferences.narration);
    setEffectsVolume(audioPreferences.effects);
    setNightActionEffectsEnabled(audioPreferences.nightActions);
    setMusicVolume(audioPreferences.music);
    audioRef.current.setNarrationVolume(audioPreferences.narration);
    audioRef.current.setEffectsVolume(audioPreferences.effects);
    audioRef.current.setMusicVolume(audioPreferences.music);
    const playButtonBeep = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('button'))
        return;
      void audioRef.current?.playInterfaceBeep().catch(() => undefined);
    };
    document.addEventListener('click', playButtonBeep);
    void registerServiceWorker();
    const repository = new IndexedDbMatchRepository();
    const controller = new GameController({
      executeCommand: createSetupCommandExecutor(() => rulesRef.current),
      privateTurnProjector: (state) =>
        toMvpPrivateTurnView(state, rulesRef.current),
      publicViewProjector: (state) =>
        toMvpPublicGameView(state, setupRulesRef.current),
      repository,
    });
    controllerRef.current = controller;

    void (async () => {
      try {
        const result = await loadRecoveryWithTimeout(() =>
          controller.loadActiveMatch(),
        );
        if (!active) return;
        if (result.status === 'READY') {
          setResumeCheckpoint(result.checkpoint);
          const persistedRules = parseSetupRules(controller.getConfiguration());
          setupRulesRef.current = persistedRules;
          rulesRef.current = toMvpRuleConfig(persistedRules);
          setRules(persistedRules);
          setResumeView(controller.getPublicView());
          setDiscussionTimer(
            parseDeadlineTimer(controller.getRuntimeState()?.discussionTimer),
          );
        } else if (result.status === 'INVALID') {
          setRecoveryIssue(result.message);
          setScreen('RECOVERY_ERROR');
        } else if (result.status === 'TIMEOUT') {
          setRecoveryIssue(result.message);
          setScreen('HOME');
        }
      } catch {
        if (!active) return;
        setRecoveryIssue(
          'The saved match could not be checked. You can safely start a new game.',
        );
        setScreen('RECOVERY_ERROR');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      document.removeEventListener('click', playButtonBeep);
      repository.close();
      audioRef.current?.stopAll();
      audioRef.current = null;
      controllerRef.current = null;
    };
  }, []);

  useWakeLock(resumeView !== null && resumeView.phase.type !== 'GAME_OVER');

  useEffect(() => {
    setActiveLocale(locale);
    document.documentElement.lang = locale;
    return installPageLocalization(locale);
  }, [locale, screen]);

  useEffect(() => {
    const audio = audioRef.current;
    const cue = audioCueForScreen(screen, locale, privateTurn?.roleId);
    if (!audio || !cue || audioStatus !== 'READY') return;
    void audio.play(cue).catch(() => setAudioStatus('FAILED'));
  }, [audioStatus, locale, privateTurn?.roleId, screen]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || audioStatus !== 'READY') return;
    void audio
      .setBackgroundMusic(musicKeyForScreen(screen))
      .catch(() => setAudioStatus('FAILED'));
  }, [audioStatus, screen]);

  function beginNewGame() {
    if (resumeView && resumeView.phase.type !== 'GAME_OVER') {
      setScreen('NEW_GAME_WARNING');
      return;
    }
    resetForNewGame();
  }

  function resetForNewGame() {
    setPlayers(DEFAULT_PLAYERS.map((player) => ({ ...player })));
    setRoleCounts({ ...DEFAULT_ROLE_COUNTS });
    setRules({ ...DEFAULT_SETUP_RULES });
    setupRulesRef.current = DEFAULT_SETUP_RULES;
    setError(null);
    setRecoveryIssue(null);
    setDiscussionTimer(null);
    setScreen('PLAYERS');
  }

  async function testSound() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.unlock();
      await audio.preload([
        ...phaseNarrationCues(locale),
        ...roleNarrationCues(locale, NIGHT_AUDIO_ROLES),
        ...ACTION_EFFECTS.map((key): AudioCue => ({ key, kind: 'EFFECT' })),
      ]);
      await audio.play({ key: 'TEST_SOUND', kind: 'NARRATION', locale });
      setAudioStatus('READY');
    } catch {
      setAudioStatus('FAILED');
    }
  }

  function changeAudioVolume(
    channel: 'narration' | 'effects' | 'music',
    value: number,
  ) {
    if (channel === 'narration') {
      setNarrationVolume(value);
      audioRef.current?.setNarrationVolume(value);
      saveAudioPreferences(
        value,
        effectsVolume,
        musicVolume,
        nightActionEffectsEnabled,
      );
    } else if (channel === 'effects') {
      setEffectsVolume(value);
      audioRef.current?.setEffectsVolume(value);
      saveAudioPreferences(
        narrationVolume,
        value,
        musicVolume,
        nightActionEffectsEnabled,
      );
    } else {
      setMusicVolume(value);
      audioRef.current?.setMusicVolume(value);
      saveAudioPreferences(
        narrationVolume,
        effectsVolume,
        value,
        nightActionEffectsEnabled,
      );
    }
  }

  function changeNightActionEffects(enabled: boolean) {
    setNightActionEffectsEnabled(enabled);
    saveAudioPreferences(narrationVolume, effectsVolume, musicVolume, enabled);
  }

  function changeLocale(value: SupportedLocale) {
    setLocale(value);
    saveLocalePreference(value);
  }

  const roleLabels = getRoleLabels(locale);

  function resumeGame() {
    const controller = controllerRef.current;
    if (!controller || !resumeView) return;
    if (requiresMayorSuccessor(resumeView)) {
      setScreen('MAYOR_SUCCESSOR');
      return;
    }
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
      if (resumeView.phase.subphase === 'ANNOUNCEMENT') {
        setScreen('DAWN');
      } else if (resumeView.phase.subphase === 'MAYOR_ELECTION') {
        setScreen(resumeView.voting ? 'MAYOR_VOTE' : 'MAYOR_RESULT');
      } else if (resumeView.phase.subphase === 'READY_FOR_DISCUSSION') {
        void beginDiscussion();
      } else if (resumeView.pendingHunter) {
        setScreen('HUNTER');
      } else {
        void continueAfterResolvedTriggers('MORNING');
      }
    } else if (resumeView.phase.type === 'DISCUSSION') {
      const recovered = discussionTimer;
      if (recovered && !recovered.paused && getRemainingMs(recovered) === 0) {
        void beginDayVote();
        return;
      }
      if (!recovered) {
        const fallback = createDeadlineTimer(
          discussionTimerKey(resumeView),
          rules.discussionTimerSeconds * 1000,
        );
        setDiscussionTimer(fallback);
        void saveDiscussionTimer(fallback);
      }
      setScreen('DISCUSSION');
    } else if (resumeView.phase.type === 'VOTING') {
      setScreen('DAY_VOTE');
    } else if (resumeView.phase.type === 'DAY_DEATH_RESOLUTION') {
      if (resumeView.voting) {
        setDayMessage(
          'The vote is tied. Only the tied players remain eligible.',
        );
        setScreen('VOTE_OUTCOME');
      } else if (resumeView.pendingHunter) {
        setScreen('HUNTER');
      } else {
        void continueAfterResolvedTriggers('DAY');
      }
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
    setupRulesRef.current = rules;
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

    const actionEffect = effectForNightAction(privateTurn.roleId, action);
    if (actionEffect && nightActionEffectsEnabled) {
      playEffect(audioRef.current, actionEffect);
    }

    const nextPrivate = controller.getPrivateTurnView();
    setPrivateTurn(nextPrivate);
    if (
      (privateTurn.roleId === 'SEER' && action !== 'PASS') ||
      (privateTurn.roleId === 'DEMON_WOLF' && action === 'CURSE')
    ) {
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
    const currentView = controller.getPublicView();
    if (
      currentView?.phase.type === 'NIGHT' &&
      currentView.phase.subphase === 'RESOLUTION' &&
      currentView.nightResolved
    ) {
      await finishNight(false);
      return;
    }
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

  async function finishNight(showConversionNotice = true) {
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
    const conversionTurn = controller.getPrivateTurnView();
    if (
      showConversionNotice &&
      conversionTurn?.roleId === 'HYBRID_WOLF' &&
      conversionTurn.privateContext?.hybridWolf?.converted
    ) {
      setBusy(false);
      setPrivateTurn(conversionTurn);
      setScreen('NIGHT_WAKE');
      return;
    }
    const dawn = await controller.dispatch({ payload: {}, type: 'REACH_DAWN' });
    setBusy(false);
    if (!dawn.ok) return setNightError(dawn.error.message);
    setResumeView(controller.getPublicView());
    setPrivateTurn(null);
    setScreen('DAWN');
  }

  async function revealMorningOutcome() {
    const controller = controllerRef.current;
    if (!controller) return;
    setBusy(true);
    setError(null);
    setAnnouncedDeaths(controller.getPublicView()?.unannouncedDeaths ?? []);
    const announced = await controller.dispatch({
      payload: {},
      type: 'ANNOUNCE_DEATHS',
    });
    if (!announced.ok) {
      setBusy(false);
      return setError(announced.error.message);
    }
    const triggers = await controller.dispatch({
      payload: {},
      type: 'ENTER_MORNING_TRIGGERS',
    });
    setBusy(false);
    if (!triggers.ok) return setError(triggers.error.message);
    setResumeView(controller.getPublicView());
    setScreen('MORNING_OUTCOME');
  }

  function continueAfterMorningOutcome() {
    const view = controllerRef.current?.getPublicView();
    if (view?.pendingHunter) {
      setScreen('HUNTER');
      return;
    }
    void continueAfterResolvedTriggers('MORNING');
  }

  async function submitHunterTarget(targetPlayerId: string) {
    const controller = controllerRef.current;
    if (!controller) return;
    setBusy(true);
    setError(null);
    const result = await controller.dispatch({
      payload: {
        actionId: `hunter-shot-${Date.now()}`,
        targetPlayerId,
      },
      type: 'SUBMIT_HUNTER_SHOT',
    });
    if (!result.ok) {
      setBusy(false);
      return setError(result.error.message);
    }
    const view = controller.getPublicView();
    setAnnouncedDeaths(view?.unannouncedDeaths ?? []);
    const announced = await controller.dispatch({
      payload: {},
      type: 'ANNOUNCE_DEATHS',
    });
    setBusy(false);
    if (!announced.ok) return setError(announced.error.message);
    playEffect(audioRef.current, 'HUNTER_SHOT');
    setResumeView(controller.getPublicView());
    setScreen('HUNTER_OUTCOME');
  }

  function continueAfterHunterOutcome() {
    const view = controllerRef.current?.getPublicView();
    if (view?.pendingHunter) {
      setScreen('HUNTER');
      return;
    }
    void continueAfterResolvedTriggers(
      view?.phase.type === 'MORNING' ? 'MORNING' : 'DAY',
    );
  }

  async function continueAfterResolvedTriggers(timing: 'DAY' | 'MORNING') {
    const controller = controllerRef.current;
    if (!controller) return;
    setBusy(true);
    setError(null);
    const checked = await controller.dispatch({
      payload: {},
      type: 'CHECK_WINNER',
    });
    if (!checked.ok) {
      setBusy(false);
      return setError(checked.error.message);
    }
    let view = controller.getPublicView();
    if (!view) {
      setBusy(false);
      return;
    }
    if (view?.winner) {
      const completed = await controller.dispatch({
        payload: {},
        type: 'ENTER_GAME_OVER',
      });
      setBusy(false);
      if (!completed.ok) return setError(completed.error.message);
      setResumeView(controller.getPublicView());
      setScreen('GAME_OVER');
      return;
    }

    if (requiresMayorSuccessor(view)) {
      setBusy(false);
      setScreen('MAYOR_SUCCESSOR');
      return;
    }

    if (timing === 'MORNING') {
      setBusy(false);
      if (
        view?.cycle === rulesRef.current.mayor.electionDay &&
        !view.publicOffice.mayorElectionCompleted
      ) {
        await beginMayorElection();
      } else {
        await beginDiscussion();
      }
      return;
    }

    const nextNight = await controller.dispatch({
      payload: {},
      type: 'START_NEXT_NIGHT',
    });
    setBusy(false);
    if (!nextNight.ok) return setError(nextNight.error.message);
    view = controller.getPublicView();
    setResumeView(view);
    setScreen('NIGHT_READY');
  }

  async function beginMayorElection() {
    const controller = controllerRef.current;
    if (!controller) return;
    setBusy(true);
    const entered = await controller.dispatch({
      payload: {},
      type: 'ENTER_MAYOR_ELECTION',
    });
    if (!entered.ok) {
      setBusy(false);
      return setError(entered.error.message);
    }
    const started = await controller.dispatch({
      payload: {},
      type: 'START_MAYOR_ELECTION',
    });
    setBusy(false);
    if (!started.ok) return setError(started.error.message);
    setResumeView(controller.getPublicView());
    setScreen('MAYOR_VOTE');
  }

  async function appointMayorSuccessor(playerId: string) {
    const controller = controllerRef.current;
    const view = controller?.getPublicView();
    if (!controller || !view) return;
    setBusy(true);
    setError(null);
    const result = await controller.dispatch({
      payload: { playerId },
      type: 'APPOINT_MAYOR_SUCCESSOR',
    });
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    setResumeView(controller.getPublicView());
    await continueAfterResolvedTriggers(
      view.phase.type === 'MORNING' ? 'MORNING' : 'DAY',
    );
  }

  async function castPublicBallot(targetPlayerId: string | null) {
    const controller = controllerRef.current;
    const voting = controller?.getPublicView()?.voting;
    if (!controller || !voting?.currentVoter) return;
    setBusy(true);
    setError(null);
    const result = await controller.dispatch({
      payload: {
        targetPlayerId,
        voterId: voting.currentVoter.playerId,
      },
      type: 'CAST_VOTE',
    });
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    setResumeView(controller.getPublicView());
  }

  async function resolveMayorVote() {
    const controller = controllerRef.current;
    if (!controller) return;
    setBusy(true);
    const result = await controller.dispatch({
      payload: {},
      type: 'RESOLVE_VOTE',
    });
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    const view = controller.getPublicView();
    setResumeView(view);
    setScreen(view?.voting ? 'MAYOR_VOTE' : 'MAYOR_RESULT');
  }

  async function beginDiscussion() {
    const controller = controllerRef.current;
    const view = controller?.getPublicView();
    if (!controller || !view) return;
    setBusy(true);
    setError(null);
    if (view.phase.type === 'MORNING') {
      const ready = await controller.dispatch({
        payload: {},
        type: 'ENTER_READY_FOR_DISCUSSION',
      });
      if (!ready.ok) {
        setBusy(false);
        return setError(ready.error.message);
      }
    }
    const currentView = controller.getPublicView();
    if (!currentView) {
      setBusy(false);
      return;
    }
    const timer = createDeadlineTimer(
      discussionTimerKey(currentView),
      rules.discussionTimerSeconds * 1000,
    );
    const timerSaved = await saveDiscussionTimer(timer);
    if (!timerSaved) {
      setBusy(false);
      return;
    }
    const started = await controller.dispatch({
      payload: {},
      type: 'START_DISCUSSION',
    });
    setBusy(false);
    if (!started.ok) return setError(started.error.message);
    setResumeView(controller.getPublicView());
    setDiscussionTimer(timer);
    setScreen('DISCUSSION');
  }

  async function beginDayVote() {
    const controller = controllerRef.current;
    if (!controller) return;
    setBusy(true);
    setError(null);
    if (!(await saveDiscussionTimer(null))) {
      setBusy(false);
      return;
    }
    const entered = await controller.dispatch({
      payload: {},
      type: 'ENTER_DAY_VOTING',
    });
    if (!entered.ok) {
      setBusy(false);
      return setError(entered.error.message);
    }
    const started = await controller.dispatch({
      payload: {},
      type: 'START_DAY_VOTE',
    });
    setBusy(false);
    if (!started.ok) return setError(started.error.message);
    setResumeView(controller.getPublicView());
    setDiscussionTimer(null);
    setScreen('DAY_VOTE');
  }

  async function saveDiscussionTimer(
    timer: DeadlineTimerSnapshot | null,
  ): Promise<boolean> {
    const controller = controllerRef.current;
    if (!controller) return false;
    const current = controller.getRuntimeState() ?? {};
    const value = timer
      ? {
          deadlineAt: timer.deadlineAt,
          paused: timer.paused,
          phaseId: timer.phaseId,
          remainingMs: timer.remainingMs,
        }
      : null;
    const result = await controller.saveRuntimeState({
      ...current,
      discussionTimer: value,
    });
    if (!result.ok) {
      setError(result.error.message);
      return false;
    }
    return true;
  }

  async function resolveDayVote() {
    const controller = controllerRef.current;
    if (!controller) return;
    setBusy(true);
    setError(null);
    const entered = await controller.dispatch({
      payload: {},
      type: 'ENTER_DAY_DEATH_RESOLUTION',
    });
    if (!entered.ok) {
      setBusy(false);
      return setError(entered.error.message);
    }
    const resolved = await controller.dispatch({
      payload: {},
      type: 'RESOLVE_VOTE',
    });
    if (!resolved.ok) {
      setBusy(false);
      return setError(resolved.error.message);
    }
    let view = controller.getPublicView();
    setAnnouncedDeaths(view?.unannouncedDeaths ?? []);
    if (view?.unannouncedDeaths?.length) {
      const announced = await controller.dispatch({
        payload: {},
        type: 'ANNOUNCE_DEATHS',
      });
      if (!announced.ok) {
        setBusy(false);
        return setError(announced.error.message);
      }
      setDayMessage(null);
    } else if (view?.voting) {
      setDayMessage(
        'The vote is tied. Only the tied players remain eligible for the revote.',
      );
    } else if (view?.foolRevealedPlayerId) {
      const fool = view.players.find(
        (player) => player.playerId === view?.foolRevealedPlayerId,
      );
      setDayMessage(
        `${fool?.displayName ?? 'The Fool'} survives the execution and loses their vote.`,
      );
    } else {
      setDayMessage('No player was executed.');
    }
    view = controller.getPublicView();
    setResumeView(view);
    setBusy(false);
    setScreen('VOTE_OUTCOME');
  }

  async function continueAfterVoteOutcome() {
    const controller = controllerRef.current;
    const view = controller?.getPublicView();
    if (!controller || !view) return;
    if (view.voting) {
      setBusy(true);
      const revote = await controller.dispatch({
        payload: {},
        type: 'ENTER_REVOTE',
      });
      setBusy(false);
      if (!revote.ok) return setError(revote.error.message);
      setResumeView(controller.getPublicView());
      setScreen('DAY_VOTE');
      return;
    }
    if (view.pendingHunter) {
      setScreen('HUNTER');
      return;
    }
    await continueAfterResolvedTriggers('DAY');
  }

  if (loading) return <LoadingScreen />;

  return (
    <main className={`app-shell screen-${screen.toLowerCase()}`}>
      <AmbientBackdrop />
      <div className="app-content">
        {audioStatus === 'FAILED' && (
          <div className="status-banner" role="status">
            Audio is unavailable. Continue with the on-screen instructions.
          </div>
        )}
        {screen === 'HOME' && recoveryIssue && (
          <div className="status-banner" role="status">
            {recoveryIssue}
          </div>
        )}
        {screen === 'HOME' && (
          <HomeScreen
            hasResume={resumeView !== null}
            onNewGame={beginNewGame}
            onResume={resumeGame}
            onSettings={() => setScreen('SETTINGS')}
            resumeLabel={describePhase(resumeView, locale)}
          />
        )}
        {screen === 'RECOVERY_ERROR' && (
          <RecoveryErrorScreen
            message={
              recoveryIssue ?? 'The saved match cannot be resumed safely.'
            }
            onStartNew={resetForNewGame}
          />
        )}
        {screen === 'NEW_GAME_WARNING' && (
          <NewGameWarning
            onCancel={() => setScreen('HOME')}
            onContinue={resetForNewGame}
          />
        )}
        {screen === 'SETTINGS' && (
          <SettingsInfo
            audioStatus={audioStatus}
            effectsVolume={effectsVolume}
            locale={locale}
            musicVolume={musicVolume}
            narrationVolume={narrationVolume}
            nightActionEffectsEnabled={nightActionEffectsEnabled}
            onBack={() => setScreen('HOME')}
            onChangeVolume={changeAudioVolume}
            onChangeLocale={changeLocale}
            onNightActionEffectsChange={changeNightActionEffects}
            onTestSound={() => void testSound()}
          />
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
            roleLabels={roleLabels}
          />
        )}
        {screen === 'RULES' && (
          <RulesSetup
            busy={busy}
            error={error}
            locale={locale}
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
            roleIds={MVP_ROLE_IDS.filter((roleId) =>
              registration.preparedRoleIds.includes(roleId),
            )}
            roleLabels={roleLabels}
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
            audioStatus={audioStatus}
            busy={busy}
            error={error}
            onStart={() => void startNight()}
            onTestSound={() => void testSound()}
            playerCount={resumeView?.players.length ?? players.length}
          />
        )}
        {screen === 'NIGHT_READY' && (
          <NightReadyScreen
            busy={busy}
            error={nightError}
            nightNumber={resumeView?.cycle ?? 1}
            onStart={() => void beginNightTurns()}
            transitionSeconds={rules.nightTransitionSeconds}
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
            locale={locale}
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
            locale={locale}
            onAcknowledge={() => {
              setPrivateTurn((turn) =>
                turn
                  ? {
                      ...turn,
                      curseResult: undefined,
                      privateResult: undefined,
                    }
                  : null,
              );
              setScreen('NIGHT_SLEEP');
            }}
            timeoutSeconds={rules.roleTimerSeconds}
            turn={privateTurn}
          />
        )}
        {screen === 'NIGHT_SLEEP' && privateTurn && (
          <NightSleepScreen
            busy={busy}
            error={nightError}
            onContinue={() => void advanceNight()}
            roleId={privateTurn.roleId}
            transitionSeconds={rules.nightTransitionSeconds}
          />
        )}
        {screen === 'NIGHT_RESOLVING' && (
          <NightResolvingScreen
            busy={busy}
            error={nightError}
            onRetry={() => void finishNight()}
          />
        )}
        {screen === 'DAWN' && (
          <DawnScreen
            busy={busy}
            dayNumber={resumeView?.cycle ?? 1}
            error={error}
            onReveal={() => void revealMorningOutcome()}
          />
        )}
        {screen === 'MORNING_OUTCOME' && (
          <DeathAnnouncementScreen
            deaths={announcedDeaths}
            heading={
              announcedDeaths.length === 0
                ? 'The village is unchanged.'
                : 'The night has taken its toll.'
            }
            onContinue={continueAfterMorningOutcome}
          />
        )}
        {screen === 'HUNTER' && resumeView?.pendingHunter && (
          <HunterScreen
            busy={busy}
            error={error}
            hunter={resumeView.pendingHunter}
            onSubmit={(targetPlayerId) =>
              void submitHunterTarget(targetPlayerId)
            }
            targets={resumeView.players
              .filter((player) => player.lifeState === 'ALIVE')
              .map((player) => ({
                displayName: player.displayName,
                playerId: player.playerId,
                seatIndex: player.seatIndex,
              }))}
          />
        )}
        {screen === 'HUNTER_OUTCOME' && (
          <DeathAnnouncementScreen
            deaths={announcedDeaths}
            heading="The Hunter's shot lands."
            onContinue={continueAfterHunterOutcome}
          />
        )}
        {screen === 'MAYOR_VOTE' && resumeView?.voting && (
          <VotingScreen
            busy={busy}
            error={error}
            key={resumeView.voting.currentVoter?.playerId ?? 'mayor-resolve'}
            mayorPlayerId={undefined}
            onCast={(targetPlayerId) => void castPublicBallot(targetPlayerId)}
            onResolve={() => void resolveMayorVote()}
            onSkip={() => void castPublicBallot(null)}
            title="Elect the first Mayor"
            voting={resumeView.voting}
          />
        )}
        {screen === 'MAYOR_RESULT' && (
          <MayorResultScreen
            mayor={resumeView?.players.find(
              (player) =>
                player.playerId === resumeView.publicOffice.mayorPlayerId,
            )}
            onContinue={() => void beginDiscussion()}
          />
        )}
        {screen === 'MAYOR_SUCCESSOR' && resumeView && (
          <MayorSuccessorScreen
            busy={busy}
            error={error}
            onAppoint={(playerId) => void appointMayorSuccessor(playerId)}
            players={resumeView.players}
          />
        )}
        {screen === 'DISCUSSION' && discussionTimer && (
          <DiscussionScreen
            error={error}
            initialTimer={discussionTimer}
            onChange={(timer) => {
              setDiscussionTimer(timer);
              void saveDiscussionTimer(timer);
            }}
            onEnd={() => void beginDayVote()}
          />
        )}
        {screen === 'DAY_VOTE' && resumeView?.voting && (
          <VotingScreen
            busy={busy}
            error={error}
            key={resumeView.voting.currentVoter?.playerId ?? 'day-resolve'}
            mayorPlayerId={resumeView.publicOffice.mayorPlayerId}
            onCast={(targetPlayerId) => void castPublicBallot(targetPlayerId)}
            onResolve={() => void resolveDayVote()}
            onSkip={() => void castPublicBallot(null)}
            title="Village execution vote"
            voting={resumeView.voting}
          />
        )}
        {screen === 'VOTE_OUTCOME' && (
          <VoteOutcomeScreen
            busy={busy}
            deaths={announcedDeaths}
            message={dayMessage}
            onContinue={() => void continueAfterVoteOutcome()}
          />
        )}
        {screen === 'GAME_OVER' && resumeView?.winner && (
          <GameOverScreen
            onHome={() => {
              setResumeView(null);
              setScreen('HOME');
            }}
            onPlayAgain={beginNewGame}
            view={resumeView}
          />
        )}
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

function RecoveryErrorScreen({
  message,
  onStartNew,
}: {
  message: string;
  onStartNew: () => void;
}) {
  return (
    <section className="center-card panel-enter">
      <div className="warning-mark">!</div>
      <p className="eyebrow">Safe recovery</p>
      <h1>This match cannot be resumed.</h1>
      <p>{message}</p>
      <p>No outcome was guessed and no private information was displayed.</p>
      <button className="button button-primary" onClick={onStartNew}>
        Start a new game
      </button>
    </section>
  );
}

function NewGameWarning({
  onCancel,
  onContinue,
}: {
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="center-card panel-enter">
      <div className="warning-mark">!</div>
      <p className="eyebrow">Active match</p>
      <h2>Replace the saved game?</h2>
      <p>
        Starting registration for another game will archive the current match
        when the new match is saved.
      </p>
      <button className="button button-primary" onClick={onContinue}>
        Continue with a new game
      </button>
      <button className="button button-secondary" onClick={onCancel}>
        Keep current match
      </button>
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
  roleLabels,
}: {
  counts: RoleCounts;
  error: string | null;
  onBack: () => void;
  onChange: (counts: RoleCounts) => void;
  onContinue: () => void;
  playerCount: number;
  roleLabels: Record<MvpRoleId, string>;
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
      <div className="role-faction-list">
        {ROLE_FACTION_SECTIONS.map((faction) => (
          <section
            aria-labelledby={`faction-${faction.id}`}
            className={`role-faction role-faction-${faction.id.toLowerCase()}`}
            key={faction.id}
          >
            <h3 id={`faction-${faction.id}`}>{faction.label}</h3>
            <div className="role-count-grid">
              {MVP_ROLE_IDS.filter(
                (roleId) => roleFaction(roleId) === faction.id,
              ).map((roleId) => (
                <RoleCountCard
                  counts={counts}
                  key={roleId}
                  onChange={onChange}
                  roleId={roleId}
                  roleLabel={roleLabels[roleId]}
                />
              ))}
            </div>
          </section>
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

function RoleCountCard({
  counts,
  onChange,
  roleId,
  roleLabel,
}: {
  counts: RoleCounts;
  onChange: (counts: RoleCounts) => void;
  roleId: MvpRoleId;
  roleLabel: string;
}) {
  return (
    <div
      className={`role-count-card role-${roleId.toLowerCase().replace('_', '-')}`}
    >
      <div>
        <span className="role-glyph">{roleGlyph(roleId)}</span>
        <strong>{roleLabel}</strong>
      </div>
      <div className="stepper">
        <button
          aria-label={`Remove ${roleLabel}`}
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
        <output aria-label={`${roleLabel} count`}>{counts[roleId]}</output>
        <button
          aria-label={`Add ${roleLabel}`}
          onClick={() => onChange({ ...counts, [roleId]: counts[roleId] + 1 })}
        >
          ＋
        </button>
      </div>
    </div>
  );
}

function RulesSetup({
  busy,
  error,
  // locale,
  onBack,
  onChange,
  onContinue,
  rules,
}: {
  busy: boolean;
  error: string | null;
  locale: SupportedLocale;
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
          <SegmentedControl
            value={rules.foolExecutionBehavior}
            options={[
              ['SURVIVES_FIRST_EXECUTION_LOSES_VOTE', 'Survives, loses vote'],
              ['WINS_WHEN_EXECUTED', 'Wins when executed'],
              ['DIES_NORMALLY', 'Dies normally'],
            ]}
            onChange={(foolExecutionBehavior) =>
              onChange({ ...rules, foolExecutionBehavior })
            }
          />
          <div className="fixed-setting">
            <span>Mayor office after death</span>
            <strong>Vacant</strong>
          </div>
        </SettingGroup>
        <SettingGroup title="Death reveal">
          <SegmentedControl
            value={rules.deathRevealPolicy}
            options={[
              ['ROLE', 'Exact role'],
              ['TEAM', 'Team only'],
              ['NONE', 'No reveal'],
            ]}
            onChange={(deathRevealPolicy) =>
              onChange({ ...rules, deathRevealPolicy })
            }
          />
        </SettingGroup>
        <SettingGroup title="Timers">
          <NumberSetting
            label="Night transition delay"
            min={1}
            step={1}
            value={rules.nightTransitionSeconds}
            suffix="sec"
            onChange={(nightTransitionSeconds) =>
              onChange({ ...rules, nightTransitionSeconds })
            }
          />
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
  roleIds,
  roleLabels,
  selectedRole,
}: {
  busy: boolean;
  onConfirm: () => void;
  onSelect: (role: MvpRoleId) => void;
  playerName: string;
  roleIds: readonly MvpRoleId[];
  roleLabels: Record<MvpRoleId, string>;
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
        {roleIds.map((roleId) => (
          <button
            aria-pressed={selectedRole === roleId}
            className={
              selectedRole === roleId ? 'role-choice selected' : 'role-choice'
            }
            key={roleId}
            onClick={() => onSelect(roleId)}
          >
            <span>{roleGlyph(roleId)}</span>
            <strong>{roleLabels[roleId]}</strong>
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
  audioStatus,
  busy,
  error,
  onStart,
  onTestSound,
  playerCount,
}: {
  audioStatus: 'LOCKED' | 'READY' | 'FAILED';
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onTestSound: () => void;
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
      <button className="button button-secondary" onClick={onTestSound}>
        {audioStatus === 'READY' ? 'Sound ready — test again' : 'Test sound'}
      </button>
      <small className="audio-help">
        {audioStatus === 'FAILED'
          ? 'Sound could not start; visual instructions will remain available.'
          : 'One tap unlocks offline audio for the match.'}
      </small>
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
  transitionSeconds,
}: {
  busy: boolean;
  error: string | null;
  nightNumber: number;
  onStart: () => void;
  transitionSeconds: number;
}) {
  const remaining = useDeadlineCountdown(transitionSeconds, onStart);

  return (
    <section className="night-ready panel-enter">
      <div className="moon" aria-hidden="true" />
      <p className="eyebrow">Night {nightNumber}</p>
      <h2>Everyone, close your eyes.</h2>
      <p>
        Place the phone with the moderator. Keep your eyes closed until dawn.
      </p>
      <p className="transition-countdown" role="timer">
        First role wakes in <strong>{remaining}s</strong>
      </p>
      <InlineError message={error} />
      {busy && <p className="eyebrow">Starting the night…</p>}
      {error && (
        <button
          className="button button-primary night-action"
          disabled={busy}
          onClick={onStart}
        >
          Retry transition
        </button>
      )}
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
  locale,
  onComplete,
  onSubmit,
  onTimeout,
  rules,
  turn,
  witchActionTaken,
}: {
  busy: boolean;
  error: string | null;
  locale: SupportedLocale;
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
        <CursedRoleNotice locale={locale} turn={turn} />
        <HybridWolfNotice locale={locale} turn={turn} />
        {!turn.privateContext?.hybridWolf && <h2>Hold the night still.</h2>}
        {!turn.privateContext?.hybridWolf && (
          <p>
            Complete this private pause, then close your eyes when prompted.
          </p>
        )}
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

      <CursedRoleNotice locale={locale} turn={turn} />

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

function CursedRoleNotice({
  locale,
  turn,
}: {
  locale: SupportedLocale;
  turn: PrivateTurnView;
}) {
  const cursedPlayers = turn.privateContext?.cursedPlayers;
  if (!cursedPlayers?.length) return null;

  return (
    <div className="curse-notice" role="status">
      <strong>
        {cursedPlayers.map((player) => player.displayName).join(', ')}
        {translateInterfaceText(locale, ', you were cursed by the Demon Wolf.')}
      </strong>
      <p>
        {translateInterfaceText(
          locale,
          'Your role ability is disabled. Wake with the Werewolves from now on; your new alignment is Werewolf.',
        )}
      </p>
    </div>
  );
}

function HybridWolfNotice({
  locale,
  turn,
}: {
  locale: SupportedLocale;
  turn: PrivateTurnView;
}) {
  const hybridWolf = turn.privateContext?.hybridWolf;
  if (!hybridWolf) return null;

  const message = hybridWolf.converted
    ? 'You were attacked by the Werewolves and have been converted into a Werewolf. From now on, you win with the Werewolf team.'
    : 'You are still a member of the Village.';
  return (
    <div
      className={`curse-notice hybrid-wolf-notice ${
        hybridWolf.converted ? 'is-converted' : 'is-village'
      }`}
      role="status"
    >
      <strong>{hybridWolf.player.displayName}</strong>
      <p>{translateInterfaceText(locale, message)}</p>
    </div>
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
  locale,
  onAcknowledge,
  timeoutSeconds,
  turn,
}: {
  locale: SupportedLocale;
  onAcknowledge: () => void;
  timeoutSeconds: number;
  turn: PrivateTurnView;
}) {
  if (turn.curseResult) {
    return (
      <DemonWolfCurseResultScreen
        curseResult={turn.curseResult}
        locale={locale}
        onAcknowledge={onAcknowledge}
        roleId={turn.roleId}
        timeoutSeconds={timeoutSeconds}
      />
    );
  }

  const result = turn.privateResult;
  const target = turn.validTargets?.find(
    (player) => player.playerId === result?.targetPlayerId,
  );
  const value = result
    ? result.result.mode === 'TEAM'
      ? result.result.teamId === 'WEREWOLF'
        ? 'Werewolf aligned'
        : result.result.teamId === 'VILLAGE'
          ? 'Village aligned'
          : 'Unclear role'
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

function DemonWolfCurseResultScreen({
  curseResult,
  locale,
  onAcknowledge,
  roleId,
  timeoutSeconds,
}: {
  curseResult: NonNullable<PrivateTurnView['curseResult']>;
  locale: SupportedLocale;
  onAcknowledge: () => void;
  roleId: string;
  timeoutSeconds: number;
}) {
  const remaining = useDeadlineCountdown(timeoutSeconds, onAcknowledge);
  const succeeded = curseResult.outcome !== 'FAILED';
  return (
    <section className="night-result panel-enter">
      <NightTurnHeader remaining={remaining} roleId={roleId} />
      <div className="result-eye" aria-hidden="true">
        {succeeded ? '✓' : '×'}
      </div>
      <p className="eyebrow">For the Demon Wolf only</p>
      <h2>
        {translateInterfaceText(
          locale,
          succeeded ? 'Curse successful' : 'Curse failed',
        )}
      </h2>
      {succeeded ? (
        <div className="result-value">
          {translateInterfaceText(locale, 'Touch ')}
          {curseResult.target.displayName}
          {translateInterfaceText(locale, "'s head now")}
        </div>
      ) : (
        <p>
          {translateInterfaceText(locale, 'The curse did not take effect.')}
        </p>
      )}
      <p>
        {translateInterfaceText(
          locale,
          'Complete the private handoff before the timer ends.',
        )}
      </p>
      <button
        className="button button-primary night-action"
        onClick={onAcknowledge}
      >
        {translateInterfaceText(locale, 'End role and sleep')}
      </button>
    </section>
  );
}

function NightSleepScreen({
  busy,
  error,
  onContinue,
  roleId,
  transitionSeconds,
}: {
  busy: boolean;
  error: string | null;
  onContinue: () => void;
  roleId: string;
  transitionSeconds: number;
}) {
  const remaining = useDeadlineCountdown(transitionSeconds, onContinue);

  return (
    <section className="night-cue sleep-cue panel-enter">
      <div className="sleep-glyph" aria-hidden="true">
        {nightGlyph(roleId)}
      </div>
      <p className="eyebrow">Action hidden</p>
      <h2>{nightRoleLabel(roleId)}, close your eyes.</h2>
      <p>The next night step starts automatically when the countdown ends.</p>
      <p className="transition-countdown" role="timer">
        Eyes-closed buffer: <strong>{remaining}s</strong>
      </p>
      <InlineError message={error} />
      {busy && <p className="eyebrow">Continuing…</p>}
      {error && (
        <button
          className="button button-primary night-action"
          disabled={busy}
          onClick={onContinue}
        >
          Retry transition
        </button>
      )}
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

function DawnScreen({
  busy,
  dayNumber,
  error,
  onReveal,
}: {
  busy: boolean;
  dayNumber: number;
  error: string | null;
  onReveal: () => void;
}) {
  return (
    <section className="dawn-screen panel-enter">
      <div className="sunrise" aria-hidden="true">
        <i />
      </div>
      <p className="eyebrow">Morning {dayNumber}</p>
      <h2>The village wakes.</h2>
      <p>Night actions remain secret. Only the final public outcome follows.</p>
      <InlineError message={error} />
      <button className="button dawn-button" disabled={busy} onClick={onReveal}>
        {busy ? 'Preparing announcement…' : 'Reveal the morning'}
      </button>
    </section>
  );
}

function DeathAnnouncementScreen({
  deaths,
  heading,
  onContinue,
}: {
  deaths: PublicDeathView[];
  heading: string;
  onContinue: () => void;
}) {
  return (
    <section className="day-screen death-announcement panel-enter">
      <p className="eyebrow">Public announcement</p>
      <h2>{heading}</h2>
      {deaths.length === 0 ? (
        <div className="no-death-mark" aria-hidden="true">
          ○
        </div>
      ) : (
        <div className="death-card-list">
          {deaths.map((death) => (
            <article className="death-card" key={death.playerId}>
              <span>Seat {death.seatIndex + 1}</span>
              <strong>{death.displayName}</strong>
              <small>{deathRevealText(death)}</small>
            </article>
          ))}
        </div>
      )}
      <p>
        {deaths.length === 0
          ? 'No one died. The reason remains hidden.'
          : 'No targets, protections, or hidden action sources are revealed.'}
      </p>
      <button className="button button-primary day-action" onClick={onContinue}>
        Continue the morning
      </button>
    </section>
  );
}

function HunterScreen({
  busy,
  error,
  hunter,
  onSubmit,
  targets,
}: {
  busy: boolean;
  error: string | null;
  hunter: PlayerSummary;
  onSubmit: (targetPlayerId: string) => void;
  targets: PlayerSummary[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const target = targets.find((player) => player.playerId === selected);
  return (
    <section className="day-screen hunter-screen panel-enter">
      <div className="hunter-mark" aria-hidden="true">
        ⌖
      </div>
      <p className="eyebrow">Mandatory death trigger</p>
      <h2>{hunter.displayName}, take your final shot.</h2>
      <p>The winner will not be checked until every Hunter shot resolves.</p>
      <TargetGrid
        onSelect={setSelected}
        selectedTarget={selected}
        targets={targets}
      />
      <InlineError message={error} />
      <button
        className="button button-primary day-action"
        disabled={!target || busy}
        onClick={() => target && onSubmit(target.playerId)}
      >
        Confirm shot at {target?.displayName ?? 'a player'}
      </button>
    </section>
  );
}

function VotingScreen({
  busy,
  error,
  mayorPlayerId,
  onCast,
  onResolve,
  onSkip,
  title,
  voting,
}: {
  busy: boolean;
  error: string | null;
  mayorPlayerId?: string;
  onCast: (targetPlayerId: string) => void;
  onResolve: () => void;
  onSkip: () => void;
  title: string;
  voting: PublicVotingView;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const target = voting.eligibleTargets.find(
    (player) => player.playerId === selected,
  );
  return (
    <section className="day-screen voting-screen panel-enter">
      <div className="vote-progress">
        <span>
          Round {voting.round} · {voting.ballotsCast}/{voting.totalVoters}{' '}
          ballots
        </span>
        <i>
          <b
            style={{
              width: `${(voting.ballotsCast / Math.max(1, voting.totalVoters)) * 100}%`,
            }}
          />
        </i>
      </div>
      <p className="eyebrow">Open vote · Moderator records</p>
      <h2>{title}</h2>
      {voting.currentVoter ? (
        <>
          <div className="current-voter">
            <span>Recording ballot for</span>
            <strong>{voting.currentVoter.displayName}</strong>
            {mayorPlayerId === voting.currentVoter.playerId && (
              <small>Mayor ballot counts ×2</small>
            )}
          </div>
          <TargetGrid
            onSelect={setSelected}
            selectedTarget={selected}
            targets={voting.eligibleTargets}
          />
          <InlineError message={error} />
          <button
            className="button button-secondary day-action"
            disabled={busy}
            onClick={onSkip}
          >
            {voting.type === 'MAYOR_ELECTION'
              ? 'Skip mayor vote'
              : 'Vote to hang no one'}
          </button>
          <button
            className="button button-primary day-action"
            disabled={!target || busy}
            onClick={() => target && onCast(target.playerId)}
          >
            Record vote for {target?.displayName ?? 'a player'}
          </button>
        </>
      ) : (
        <div className="all-ballots">
          <span aria-hidden="true">✓</span>
          <strong>All public ballots are recorded</strong>
          <p>
            The engine will apply vote eligibility, Mayor weight, and tie rules.
          </p>
          <InlineError message={error} />
          <button
            className="button button-primary day-action"
            disabled={busy}
            onClick={onResolve}
          >
            Resolve the vote
          </button>
        </div>
      )}
    </section>
  );
}

function MayorResultScreen({
  mayor,
  onContinue,
}: {
  mayor?: PublicGameView['players'][number];
  onContinue: () => void;
}) {
  return (
    <section className="day-screen mayor-result panel-enter">
      <div className="mayor-seal" aria-hidden="true">
        ✦
      </div>
      <p className="eyebrow">Public office elected</p>
      <h2>{mayor?.displayName ?? 'The new Mayor'}</h2>
      <p>The Mayor's execution ballot counts ×2 while they hold office.</p>
      <button className="button button-primary day-action" onClick={onContinue}>
        Begin discussion
      </button>
    </section>
  );
}

function MayorSuccessorScreen({
  busy,
  error,
  onAppoint,
  players,
}: {
  busy: boolean;
  error: string | null;
  onAppoint: (playerId: string) => void;
  players: PublicGameView['players'];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const eligiblePlayers = players.filter(
    (player) => player.lifeState === 'ALIVE',
  );
  const successor = eligiblePlayers.find(
    (player) => player.playerId === selected,
  );
  return (
    <section className="day-screen mayor-result panel-enter">
      <div className="mayor-seal" aria-hidden="true">
        ✦
      </div>
      <p className="eyebrow">Mayor succession</p>
      <h2>Choose the next Mayor</h2>
      <p>The former Mayor has died. Give the seat to a living player.</p>
      <TargetGrid
        onSelect={setSelected}
        selectedTarget={selected}
        targets={eligiblePlayers}
      />
      <InlineError message={error} />
      <button
        className="button button-primary day-action"
        disabled={!successor || busy}
        onClick={() => successor && onAppoint(successor.playerId)}
      >
        Give the seat to {successor?.displayName ?? 'a player'}
      </button>
    </section>
  );
}

function DiscussionScreen({
  error,
  initialTimer,
  onChange,
  onEnd,
}: {
  error: string | null;
  initialTimer: DeadlineTimerSnapshot;
  onChange: (timer: DeadlineTimerSnapshot) => void;
  onEnd: () => void;
}) {
  const timer = useDiscussionTimer(initialTimer, onChange, onEnd);
  return (
    <section className="discussion-screen panel-enter">
      <p className="eyebrow">Day discussion</p>
      <h2>Find the Werewolves.</h2>
      <div
        className={
          timer.remaining <= 60
            ? 'discussion-clock warning'
            : 'discussion-clock'
        }
      >
        {formatDuration(timer.remaining)}
      </div>
      <p>
        {timer.running ? 'The village has the floor.' : 'Discussion is paused.'}
      </p>
      <div className="timer-controls">
        <button className="button button-secondary" onClick={timer.toggle}>
          {timer.running ? 'Pause' : 'Resume'}
        </button>
        <button className="button button-secondary" onClick={timer.addThirty}>
          +30 seconds
        </button>
      </div>
      <InlineError message={error} />
      <button className="button button-primary day-action" onClick={onEnd}>
        End discussion and vote
      </button>
    </section>
  );
}

function VoteOutcomeScreen({
  busy,
  deaths,
  message,
  onContinue,
}: {
  busy: boolean;
  deaths: PublicDeathView[];
  message: string | null;
  onContinue: () => void;
}) {
  const death = deaths[0];
  return (
    <section className="day-screen vote-outcome panel-enter">
      <p className="eyebrow">Execution result</p>
      <h2>
        {death ? `${death.displayName} is executed.` : 'The vote is settled.'}
      </h2>
      {death ? (
        <div className="execution-reveal">
          <span>Public reveal</span>
          <strong>{deathRevealText(death)}</strong>
        </div>
      ) : (
        <p>{message}</p>
      )}
      <button
        className="button button-primary day-action"
        disabled={busy}
        onClick={onContinue}
      >
        Continue
      </button>
    </section>
  );
}

function GameOverScreen({
  onHome,
  onPlayAgain,
  view,
}: {
  onHome: () => void;
  onPlayAgain: () => void;
  view: PublicGameView;
}) {
  const winnerTeam = view.winner?.teamId;
  const villageWon = winnerTeam === 'VILLAGE';
  const foolWon = winnerTeam === 'FOOL';
  const foolPlayerId =
    view.winner && 'playerId' in view.winner ? view.winner.playerId : undefined;
  const fool =
    foolWon && foolPlayerId
      ? view.players.find((player) => player.playerId === foolPlayerId)
      : undefined;
  return (
    <section className="game-over-screen panel-enter">
      <div className="winner-symbol" aria-hidden="true">
        {foolWon ? '★' : villageWon ? '☀' : '▲'}
      </div>
      <p className="eyebrow">Game over</p>
      <h2>
        {foolWon
          ? `${fool?.displayName ?? 'The Fool'} wins.`
          : villageWon
            ? 'The Village wins.'
            : 'The Werewolves win.'}
      </h2>
      <p>{view.winner?.reason}</p>
      <div className="role-reveal-list">
        {view.revealedRoles?.map((player) => (
          <div key={player.playerId}>
            <span>{player.displayName}</span>
            <strong>{nightRoleLabel(player.roleId)}</strong>
            <small>{player.teamId}</small>
          </div>
        ))}
      </div>
      <div className="game-over-actions">
        <button className="button button-primary" onClick={onPlayAgain}>
          Play again
        </button>
        <button className="button button-secondary" onClick={onHome}>
          Return home
        </button>
      </div>
    </section>
  );
}

function SettingsInfo({
  audioStatus,
  effectsVolume,
  musicVolume,
  narrationVolume,
  nightActionEffectsEnabled,
  locale,
  onBack,
  onChangeLocale,
  onChangeVolume,
  onNightActionEffectsChange,
  onTestSound,
}: {
  audioStatus: 'LOCKED' | 'READY' | 'FAILED';
  effectsVolume: number;
  musicVolume: number;
  narrationVolume: number;
  nightActionEffectsEnabled: boolean;
  locale: SupportedLocale;
  onBack: () => void;
  onChangeLocale: (locale: SupportedLocale) => void;
  onChangeVolume: (
    channel: 'narration' | 'effects' | 'music',
    value: number,
  ) => void;
  onNightActionEffectsChange: (enabled: boolean) => void;
  onTestSound: () => void;
}) {
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
      <div className="audio-settings">
        <label>
          <span>Language</span>
          <select
            aria-label="Language"
            onChange={(event) => {
              const nextLocale = event.target.value;
              if (isSupportedLocale(nextLocale)) onChangeLocale(nextLocale);
            }}
            value={locale}
          >
            {LOCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Narration volume</span>
          <input
            aria-label="Narration volume"
            max="1"
            min="0"
            onChange={(event) =>
              onChangeVolume('narration', Number(event.target.value))
            }
            step="0.05"
            type="range"
            value={narrationVolume}
          />
        </label>
        <label>
          <span>Effects volume</span>
          <input
            aria-label="Effects volume"
            max="1"
            min="0"
            onChange={(event) =>
              onChangeVolume('effects', Number(event.target.value))
            }
            step="0.05"
            type="range"
            value={effectsVolume}
          />
        </label>
        <label className="audio-toggle">
          <span>Night action sound effects</span>
          <input
            aria-label="Night action sound effects"
            checked={nightActionEffectsEnabled}
            onChange={(event) =>
              onNightActionEffectsChange(event.target.checked)
            }
            type="checkbox"
          />
        </label>
        <label>
          <span>Background music volume</span>
          <input
            aria-label="Background music volume"
            max="1"
            min="0"
            onChange={(event) =>
              onChangeVolume('music', Number(event.target.value))
            }
            step="0.05"
            type="range"
            value={musicVolume}
          />
        </label>
        <button className="button button-secondary" onClick={onTestSound}>
          {audioStatus === 'READY'
            ? 'Test sound again'
            : 'Unlock and test sound'}
        </button>
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
  min = 15,
  onChange,
  step = 15,
  suffix,
  value,
}: {
  label: string;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  suffix: string;
  value: number;
}) {
  return (
    <label className="number-setting">
      <span>{label}</span>
      <span>
        <input
          min={min}
          onChange={(event) => onChange(Number(event.target.value))}
          step={step}
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

function describePhase(
  view: PublicGameView | null,
  locale: SupportedLocale,
): string {
  if (!view) return '';
  return translatePhase(
    locale,
    view.phase.type,
    view.phase.type === 'NIGHT' ? view.phase.nightNumber : undefined,
  );
}

function roleGlyph(roleId: MvpRoleId): string {
  const glyphs: Record<MvpRoleId, string> = {
    DEMON_WOLF: '◆',
    FOOL: '◇',
    GUARD: '⬟',
    HYBRID_WOLF: '◐',
    HUNTER: '⌖',
    SEER: '◉',
    VILLAGER: '●',
    WEREWOLF: '▲',
    WITCH: '✦',
  };
  return glyphs[roleId];
}

function requiresMayorSuccessor(view: PublicGameView): boolean {
  return (
    view.phase.type !== 'GAME_OVER' &&
    view.publicOffice.mayorElectionCompleted &&
    view.publicOffice.mayorPlayerId === undefined &&
    view.players.some((player) => player.lifeState === 'ALIVE')
  );
}

function nightRoleLabel(roleId: string): string {
  return (
    getRoleLabels(getActiveLocale())[roleId as MvpRoleId] ??
    roleId.replaceAll('_', ' ')
  );
}

function nightGlyph(roleId: string): string {
  return MVP_ROLE_IDS.includes(roleId as MvpRoleId)
    ? roleGlyph(roleId as MvpRoleId)
    : '●';
}

function nightPrompt(roleId: string): string {
  return translateNightPrompt(getActiveLocale(), roleId);
}

function deathRevealText(death: PublicDeathView): string {
  if (death.revealedRoleId) return nightRoleLabel(death.revealedRoleId);
  if (death.revealedTeamId) {
    return translateDeathReveal(getActiveLocale(), death.revealedTeamId);
  }
  return translateDeathReveal(getActiveLocale());
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function useDiscussionTimer(
  initialTimer: DeadlineTimerSnapshot,
  onChange: (timer: DeadlineTimerSnapshot) => void,
  onExpire: () => void,
) {
  const [timer, setTimer] = useState(initialTimer);
  const [remaining, setRemaining] = useState(() =>
    Math.ceil(getRemainingMs(initialTimer) / 1000),
  );
  const expireCallback = useRef(onExpire);
  const fired = useRef(false);

  useEffect(() => {
    expireCallback.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (timer.paused) return;
    const interval = window.setInterval(() => {
      const next = Math.ceil(getRemainingMs(timer) / 1000);
      setRemaining(next);
      if (next === 0 && !fired.current) {
        fired.current = true;
        window.clearInterval(interval);
        expireCallback.current();
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [timer]);

  function toggle() {
    const next = timer.paused
      ? resumeDeadlineTimer(timer)
      : pauseDeadlineTimer(timer);
    setTimer(next);
    setRemaining(Math.ceil(getRemainingMs(next) / 1000));
    onChange(next);
  }

  function addThirty() {
    const next = extendDeadlineTimer(timer, 30_000);
    setTimer(next);
    setRemaining(Math.ceil(getRemainingMs(next) / 1000));
    onChange(next);
  }

  return { addThirty, remaining, running: !timer.paused, toggle };
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

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const wakeLock = new ScreenWakeLock();
    const request = () => {
      if (document.visibilityState === 'visible') void wakeLock.request();
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      document.removeEventListener('visibilitychange', request);
      void wakeLock.release();
    };
  }, [active]);
}

function discussionTimerKey(view: PublicGameView): string {
  return `${view.matchId}:discussion:${view.cycle}`;
}

const NIGHT_AUDIO_ROLES: readonly NightRoleId[] = [
  'SEER',
  'GUARD',
  'HYBRID_WOLF',
  'WEREWOLF',
  'DEMON_WOLF',
  'WITCH',
];
const ACTION_EFFECTS: readonly EffectKey[] = [
  'DEMON_CURSE',
  'GUARD_SHIELD',
  'HUNTER_SHOT',
  'SEER_VISION',
  'WEREWOLF_BITE',
  'WITCH_HEAL',
  'WITCH_POISON',
];

function phaseNarrationCues(locale: SupportedLocale): AudioCue[] {
  return (
    [
      'DAWN',
      'DISCUSSION_START',
      'GAME_OVER',
      'HUNTER_ACTION',
      'MAYOR_VOTE_START',
      'NIGHT_START',
      'TEST_SOUND',
      'VOTE_START',
    ] as const
  ).map((key) => ({ key, kind: 'NARRATION', locale }));
}

function audioCueForScreen(
  screen: Screen,
  locale: SupportedLocale,
  roleId?: string,
): AudioCue | null {
  if (roleId === 'HYBRID_WOLF' && screen === 'NIGHT_TURN') return null;
  if (
    (screen === 'NIGHT_WAKE' ||
      screen === 'NIGHT_TURN' ||
      screen === 'NIGHT_SLEEP') &&
    NIGHT_AUDIO_ROLES.includes(roleId as NightRoleId)
  ) {
    return {
      kind: 'ROLE_NARRATION',
      locale,
      roleId: roleId as NightRoleId,
      stage:
        screen === 'NIGHT_WAKE'
          ? 'WAKE'
          : screen === 'NIGHT_TURN'
            ? 'ACTION'
            : 'SLEEP',
    };
  }
  switch (screen) {
    case 'NIGHT_READY':
      return { key: 'NIGHT_START', kind: 'NARRATION', locale };
    case 'DAWN':
      return { key: 'DAWN', kind: 'NARRATION', locale };
    case 'DISCUSSION':
      return { key: 'DISCUSSION_START', kind: 'NARRATION', locale };
    case 'HUNTER':
      return { key: 'HUNTER_ACTION', kind: 'NARRATION', locale };
    case 'DAY_VOTE':
      return { key: 'VOTE_START', kind: 'NARRATION', locale };
    case 'MAYOR_VOTE':
      return { key: 'MAYOR_VOTE_START', kind: 'NARRATION', locale };
    case 'GAME_OVER':
      return { key: 'GAME_OVER', kind: 'NARRATION', locale };
    default:
      return null;
  }
}

function musicKeyForScreen(screen: Screen): MusicKey | null {
  if (screen.startsWith('NIGHT_')) return 'NIGHT';
  if (
    screen === 'DAY_VOTE' ||
    screen === 'MAYOR_VOTE' ||
    screen === 'VOTE_OUTCOME'
  ) {
    return 'VOTE';
  }
  if (
    [
      'DAWN',
      'MORNING_OUTCOME',
      'HUNTER',
      'HUNTER_OUTCOME',
      'MAYOR_RESULT',
      'DISCUSSION',
    ].includes(screen)
  ) {
    return 'DAY';
  }
  return null;
}

function effectForNightAction(
  roleId: string,
  action: 'TARGET' | 'SKIP' | 'CURSE' | 'HEAL' | 'POISON' | 'PASS',
): EffectKey | null {
  if (roleId === 'SEER' && action === 'TARGET') return 'SEER_VISION';
  if (roleId === 'GUARD' && action === 'TARGET') return 'GUARD_SHIELD';
  if (roleId === 'WEREWOLF' && action === 'TARGET') return 'WEREWOLF_BITE';
  if (roleId === 'DEMON_WOLF' && action === 'CURSE') return 'DEMON_CURSE';
  if (roleId === 'WITCH' && action === 'HEAL') return 'WITCH_HEAL';
  if (roleId === 'WITCH' && action === 'POISON') return 'WITCH_POISON';
  return null;
}

function playEffect(audio: BrowserAudioService | null, key: EffectKey): void {
  void audio?.play({ key, kind: 'EFFECT' }).catch(() => undefined);
}

const AUDIO_PREFERENCES_KEY = 'werewolf-audio-preferences-v1';
const LOCALE_PREFERENCES_KEY = 'werewolf-locale-v1';

function loadLocalePreference(): SupportedLocale {
  try {
    const locale = localStorage.getItem(LOCALE_PREFERENCES_KEY);
    return isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function saveLocalePreference(locale: SupportedLocale): void {
  try {
    localStorage.setItem(LOCALE_PREFERENCES_KEY, locale);
  } catch {
    // Language preferences are optional.
  }
}

function loadAudioPreferences(): {
  effects: number;
  music: number;
  narration: number;
  nightActions: boolean;
} {
  try {
    const value = JSON.parse(
      localStorage.getItem(AUDIO_PREFERENCES_KEY) ?? 'null',
    ) as unknown;
    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      if (
        typeof record.effects === 'number' &&
        typeof record.narration === 'number'
      ) {
        return {
          effects: Math.max(0, Math.min(1, record.effects)),
          music:
            typeof record.music === 'number'
              ? Math.max(0, Math.min(1, record.music))
              : 0.38,
          narration: Math.max(0, Math.min(1, record.narration)),
          nightActions:
            typeof record.nightActions === 'boolean'
              ? record.nightActions
              : true,
        };
      }
    }
  } catch {
    // Corrupt preferences never prevent the game from loading.
  }
  return { effects: 0.7, music: 0.38, narration: 0.85, nightActions: true };
}

function saveAudioPreferences(
  narration: number,
  effects: number,
  music: number,
  nightActions: boolean,
): void {
  try {
    localStorage.setItem(
      AUDIO_PREFERENCES_KEY,
      JSON.stringify({ effects, music, narration, nightActions }),
    );
  } catch {
    // Preferences are optional; active match state remains in IndexedDB.
  }
}
