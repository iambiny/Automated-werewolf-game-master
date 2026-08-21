export type NightSubphase = 'PREPARE_QUEUE' | 'ROLE_TURN' | 'RESOLUTION';

export type MorningSubphase =
  | 'ANNOUNCEMENT'
  | 'MORNING_TRIGGERS'
  | 'MAYOR_ELECTION'
  | 'READY_FOR_DISCUSSION';

export type GamePhase =
  | { type: 'SETUP' }
  | { type: 'ROLE_REGISTRATION' }
  | { type: 'PRE_GAME_VALIDATION' }
  | { type: 'NIGHT'; nightNumber: number; subphase: NightSubphase }
  | { type: 'MORNING'; dayNumber: number; subphase: MorningSubphase }
  | { type: 'DISCUSSION'; dayNumber: number }
  | { type: 'VOTING'; dayNumber: number; round: number }
  | { type: 'DAY_DEATH_RESOLUTION'; dayNumber: number }
  | { type: 'GAME_OVER' };

export type GamePhaseType = GamePhase['type'];
