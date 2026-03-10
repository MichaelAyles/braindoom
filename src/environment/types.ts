export interface State {
  agentX: number;
  agentY: number;
  agentAngle: number; // radians, 0 = right, CCW positive
  agentHP: number;    // 0-100, dies at 0
  enemyX: number;
  enemyY: number;
  enemyAlive: boolean;
  killCount: number;
  step: number;
  lastAction: Action | null;
  lastHit: boolean;    // did last shoot action hit?
  lastDamaged: boolean; // did agent take damage this step?
}

export interface Observation {
  enemyAngleSin: number;  // sin(relative angle), [-1, 1], positive = left
  enemyAngleCos: number;  // cos(relative angle), [-1, 1], 1 = dead ahead
  enemyDistance: number;   // [0, 1] normalised distance
  enemyVisible: number;    // 0 or 1
}

export enum Action {
  TurnLeft = 0,
  TurnRight = 1,
  Shoot = 2,
  MoveForward = 3,
}

export interface StepResult {
  observation: Observation;
  reward: number;
  done: boolean;
  killed: boolean; // agent was killed by enemy
}

export type ThemeMode = 'doom' | 'flower';
