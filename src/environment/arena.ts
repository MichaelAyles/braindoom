import { State, Observation, Action, StepResult } from './types';
import { normalizeAngle } from '../utils/math';
import { SeededRNG } from '../utils/random';

const ARENA_RADIUS = 200;
const TURN_STEP = 0.15; // radians (~8.6 degrees)
const MOVE_STEP = 4;
const KILL_ANGLE = Math.PI / 18; // ±10 degrees
const KILL_RANGE = 180;
const FOV = Math.PI / 2; // 90 degree field of view
const MAX_STEPS = 200;
const AGENT_MAX_HP = 100;
const AGENT_START_AMMO = 8;
const AMMO_PER_KILL = 4;
const HP_PER_KILL = 40;
const ENEMY_DPS = 1.5;

export class Arena {
  state!: State;
  private rng: SeededRNG;
  private prevAngleDelta: number = Math.PI;

  constructor(seed = 42) {
    this.rng = new SeededRNG(seed);
    this.reset();
  }

  reset(): Observation {
    this.state = {
      agentX: 0,
      agentY: 0,
      agentAngle: this.rng.uniform(0, 2 * Math.PI),
      agentHP: AGENT_MAX_HP,
      agentAmmo: AGENT_START_AMMO,
      enemyX: 0,
      enemyY: 0,
      enemyAlive: true,
      killCount: 0,
      step: 0,
      lastAction: null,
      lastHit: false,
      lastDamaged: false,
    };
    this.spawnEnemy();
    this.prevAngleDelta = Math.abs(this.getRelativeAngle());
    return this.getObservation();
  }

  private spawnEnemy(): void {
    const angle = this.rng.uniform(0, 2 * Math.PI);
    const dist = this.rng.uniform(ARENA_RADIUS * 0.3, ARENA_RADIUS * 0.85);
    this.state.enemyX = Math.cos(angle) * dist;
    this.state.enemyY = Math.sin(angle) * dist;
    this.state.enemyAlive = true;
  }

  private getRelativeAngle(): number {
    const dx = this.state.enemyX - this.state.agentX;
    const dy = this.state.enemyY - this.state.agentY;
    const angleToEnemy = Math.atan2(dy, dx);
    return normalizeAngle(angleToEnemy - this.state.agentAngle);
  }

  private getDistance(): number {
    const dx = this.state.enemyX - this.state.agentX;
    const dy = this.state.enemyY - this.state.agentY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getObservation(): Observation {
    const relAngle = this.getRelativeAngle();
    const dist = this.getDistance();
    const visible = Math.abs(relAngle) < FOV / 2 ? 1 : 0;
    return {
      enemyAngle: relAngle / Math.PI, // [-1, 1], positive = left, negative = right
      enemyDistance: dist / ARENA_RADIUS,
      enemyVisible: visible,
    };
  }

  step(action: Action): StepResult {
    this.state.step++;
    this.state.lastAction = action;
    this.state.lastHit = false;
    this.state.lastDamaged = false;
    let reward = 0;

    switch (action) {
      case Action.TurnLeft:
        this.state.agentAngle = normalizeAngle(this.state.agentAngle + TURN_STEP);
        break;
      case Action.TurnRight:
        this.state.agentAngle = normalizeAngle(this.state.agentAngle - TURN_STEP);
        break;
      case Action.Shoot: {
        if (this.state.agentAmmo > 0) {
          this.state.agentAmmo--;
          const relAngle = Math.abs(this.getRelativeAngle());
          const dist = this.getDistance();
          if (relAngle < KILL_ANGLE && dist < KILL_RANGE && this.state.enemyAlive) {
            reward += 10;
            this.state.killCount++;
            this.state.lastHit = true;
            this.state.agentAmmo += AMMO_PER_KILL;
            this.state.agentHP = Math.min(AGENT_MAX_HP, this.state.agentHP + HP_PER_KILL);
            this.spawnEnemy();
          }
        }
        // No penalty for shooting — ammo scarcity is the constraint
        break;
      }
      case Action.MoveForward: {
        const newX = this.state.agentX + Math.cos(this.state.agentAngle) * MOVE_STEP;
        const newY = this.state.agentY + Math.sin(this.state.agentAngle) * MOVE_STEP;
        const distFromCenter = Math.sqrt(newX * newX + newY * newY);
        if (distFromCenter < ARENA_RADIUS) {
          this.state.agentX = newX;
          this.state.agentY = newY;
        }
        break;
      }
    }

    // Enemy damages agent over time (closer = more damage)
    if (this.state.enemyAlive) {
      const dist = this.getDistance();
      const proximityFactor = 1 - Math.min(dist / ARENA_RADIUS, 1);
      const damage = ENEMY_DPS * (0.3 + 0.7 * proximityFactor);
      this.state.agentHP -= damage;
      if (damage > 0.5) {
        this.state.lastDamaged = true;
      }
    }

    // Shaping reward: improvement + misalignment penalty
    const currentAngleDelta = Math.abs(this.getRelativeAngle());
    const angleImprovement = this.prevAngleDelta - currentAngleDelta;
    reward += (angleImprovement / TURN_STEP) * 0.5;
    // Per-step penalty for being off-target — makes the long way around very expensive
    reward += -currentAngleDelta * 0.08;
    this.prevAngleDelta = currentAngleDelta;

    const killed = this.state.agentHP <= 0;
    if (killed) {
      reward -= 3;
    }

    const done = killed;
    return {
      observation: this.getObservation(),
      reward,
      done,
      killed,
    };
  }
}
