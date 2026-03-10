export interface State {
  agentX: number;
  agentY: number;
  agentAngle: number; // radians, 0 = right, CCW positive
  agentHP: number;    // 0-100, dies at 0
  agentAmmo: number;  // shots remaining
  enemyX: number;
  enemyY: number;
  enemyHP: number;       // 0-3, dies at 0
  enemyAlive: boolean;
  killCount: number;
  step: number;
  lastAction: Action | null;
  lastShot: boolean;    // did agent fire a shot? (had ammo)
  lastHit: boolean;     // did last shot hit the enemy?
  lastDamaged: boolean; // did agent take damage this step?
}

export interface Observation {
  enemyAngle: number;    // [-1, 1] normalised relative angle. -1 = hard left, +1 = hard right, 0 = dead centre
  enemyDistance: number;  // [0, 1] normalised distance
  enemyVisible: number;   // 0 or 1
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
