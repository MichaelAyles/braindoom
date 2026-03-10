import { State, ThemeMode } from './types';

const ARENA_RADIUS = 200;
const FOV = Math.PI / 2;
const KILL_ANGLE = (15 * Math.PI) / 180; // ±15 degrees (matches arena max hit angle)

const THEMES = {
  doom: {
    agent: '#3b82f6',
    enemy: '#ef4444',
    enemyGlow: 'rgba(239, 68, 68, 0.15)',
    fov: 'rgba(59, 130, 246, 0.06)',
    killZone: 'rgba(239, 68, 68, 0.08)',
    facing: '#3b82f6',
    hitFlash: '#1a0800',
    damageFlash: '#1a0000',
    enemyLabel: 'enemy',
    agentLabel: 'agent',
    killLabel: 'kills',
    hpLabel: 'hp',
    ammoLabel: 'ammo',
  },
  flower: {
    agent: '#22c55e',
    enemy: '#f59e0b',
    enemyGlow: 'rgba(245, 158, 11, 0.2)',
    fov: 'rgba(34, 197, 94, 0.06)',
    killZone: 'rgba(34, 197, 94, 0.1)',
    facing: '#22c55e',
    hitFlash: '#0a1a00',
    damageFlash: '#1a1000',
    enemyLabel: 'flower',
    agentLabel: 'gardener',
    killLabel: 'watered',
    hpLabel: 'energy',
    ammoLabel: 'water',
  },
};

export class ArenaRenderer {
  private ctx: CanvasRenderingContext2D;
  private size: number;
  private center: number;
  private scale: number;
  private hitFlash = 0;
  private shootFlash = 0;
  theme: ThemeMode = 'doom';

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.size = canvas.width;
    this.center = this.size / 2;
    this.scale = (this.size * 0.45) / ARENA_RADIUS;
  }

  private toScreen(x: number, y: number): [number, number] {
    return [
      this.center + x * this.scale,
      this.center - y * this.scale,
    ];
  }

  triggerHitFlash(): void {
    this.hitFlash = 1;
  }


  render(state: State, episode = 0): void {
    const ctx = this.ctx;
    const { size, center } = this;
    const t = THEMES[this.theme];

    // Flash on hit/shoot
    if (state.lastHit) this.hitFlash = 1;
    if (state.lastShot) this.shootFlash = 1;

    // Background — only flash on successful hit, not passive damage
    let bg = '#0a0a0a';
    if (this.hitFlash > 0.3) bg = t.hitFlash;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    this.hitFlash *= 0.85;

    // Arena border
    ctx.beginPath();
    ctx.arc(center, center, ARENA_RADIUS * this.scale, 0, Math.PI * 2);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Grid
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 0.5;
    for (let i = -ARENA_RADIUS; i <= ARENA_RADIUS; i += 50) {
      const [x1, y1] = this.toScreen(i, -ARENA_RADIUS);
      const [x2, y2] = this.toScreen(i, ARENA_RADIUS);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const [x3, y3] = this.toScreen(-ARENA_RADIUS, i);
      const [x4, y4] = this.toScreen(ARENA_RADIUS, i);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }

    const [ax, ay] = this.toScreen(state.agentX, state.agentY);

    // FOV cone
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    const fovLen = 120 * this.scale;
    const a1 = -(state.agentAngle - FOV / 2);
    const a2 = -(state.agentAngle + FOV / 2);
    ctx.arc(ax, ay, fovLen, a1, a2, true);
    ctx.closePath();
    ctx.fillStyle = t.fov;
    ctx.fill();

    // Kill zone
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    const ka1 = -(state.agentAngle - KILL_ANGLE);
    const ka2 = -(state.agentAngle + KILL_ANGLE);
    ctx.arc(ax, ay, fovLen, ka1, ka2, true);
    ctx.closePath();
    ctx.fillStyle = t.killZone;
    ctx.fill();

    // Facing direction line
    const facingLen = 30 * this.scale;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(
      ax + Math.cos(-state.agentAngle) * facingLen,
      ay + Math.sin(-state.agentAngle) * facingLen
    );
    ctx.strokeStyle = t.facing;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Agent
    ctx.beginPath();
    ctx.arc(ax, ay, 6, 0, Math.PI * 2);
    ctx.fillStyle = t.agent;
    ctx.fill();

    // Shoot/spray flash — tracer line from agent in facing direction
    if (this.shootFlash > 0.1) {
      const tracerLen = fovLen * 1.2;
      const tracerColor = this.theme === 'flower'
        ? `rgba(59, 130, 246, ${this.shootFlash * 0.7})`  // blue for watering
        : `rgba(239, 68, 68, ${this.shootFlash * 0.7})`;  // red for shooting
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(
        ax + Math.cos(-state.agentAngle) * tracerLen,
        ay + Math.sin(-state.agentAngle) * tracerLen
      );
      ctx.strokeStyle = tracerColor;
      ctx.lineWidth = 2 + this.shootFlash * 2;
      ctx.stroke();

      // Muzzle burst at agent
      ctx.beginPath();
      ctx.arc(ax, ay, 8 + this.shootFlash * 4, 0, Math.PI * 2);
      ctx.fillStyle = this.theme === 'flower'
        ? `rgba(59, 130, 246, ${this.shootFlash * 0.3})`
        : `rgba(239, 68, 68, ${this.shootFlash * 0.3})`;
      ctx.fill();
    }
    this.shootFlash *= 0.75;

    // Enemy / flower
    if (state.enemyAlive) {
      const [ex, ey] = this.toScreen(state.enemyX, state.enemyY);

      if (this.theme === 'flower') {
        this.drawFlower(ex, ey);
      } else {
        // Enemy dot
        ctx.beginPath();
        ctx.arc(ex, ey, 5, 0, Math.PI * 2);
        ctx.fillStyle = t.enemy;
        ctx.fill();
        // Glow
        ctx.beginPath();
        ctx.arc(ex, ey, 10, 0, Math.PI * 2);
        ctx.fillStyle = t.enemyGlow;
        ctx.fill();
      }

      // Enemy HP pips
      const maxHP = 3;
      const pipW = 4;
      const pipH = 3;
      const pipGap = 2;
      const totalW = maxHP * pipW + (maxHP - 1) * pipGap;
      const startX = ex - totalW / 2;
      const pipY = ey - 16;
      for (let i = 0; i < maxHP; i++) {
        const px = startX + i * (pipW + pipGap);
        ctx.fillStyle = i < state.enemyHP ? t.enemy : '#333';
        ctx.fillRect(px, pipY, pipW, pipH);
      }
    }

    // HP bar (scales to max of 100 or current HP)
    const hpBarWidth = 60;
    const hpBarHeight = 4;
    const hpX = size - hpBarWidth - 10;
    const hpY = 12;
    const hpMax = Math.max(100, state.agentHP);
    const hpFrac = Math.max(0, state.agentHP / hpMax);
    const hpPct = state.agentHP / 100; // for color thresholds
    ctx.fillStyle = '#222';
    ctx.fillRect(hpX, hpY, hpBarWidth, hpBarHeight);
    ctx.fillStyle = hpPct > 1 ? '#06b6d4' : hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(hpX, hpY, hpBarWidth * hpFrac, hpBarHeight);

    // HUD
    ctx.fillStyle = '#666';
    ctx.font = '11px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`episode: ${episode}`, 8, 16);
    ctx.fillText(`${t.killLabel}: ${state.killCount}`, 8, 30);
    ctx.fillText(`step: ${state.step}`, 8, 44);
    ctx.fillText(`${t.ammoLabel}: ${state.agentAmmo}`, 8, 58);
    ctx.textAlign = 'right';
    ctx.fillText(`${t.hpLabel}: ${Math.max(0, Math.round(state.agentHP))}`, size - 8, 28);
  }

  private drawFlower(x: number, y: number): void {
    const ctx = this.ctx;
    // Petals
    const petalCount = 6;
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2;
      const px = x + Math.cos(angle) * 8;
      const py = y + Math.sin(angle) * 8;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    }
    // Center
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#854d0e';
    ctx.fill();
  }
}
