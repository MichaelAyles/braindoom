import { State, ThemeMode } from './types';

const ARENA_RADIUS = 200;
const FOV = Math.PI / 2;
const KILL_ANGLE = Math.PI / 18;

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
  },
};

export class ArenaRenderer {
  private ctx: CanvasRenderingContext2D;
  private size: number;
  private center: number;
  private scale: number;
  private hitFlash = 0;
  private damageFlash = 0;
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

  triggerDamageFlash(): void {
    this.damageFlash = 1;
  }

  render(state: State, episode = 0): void {
    const ctx = this.ctx;
    const { size, center } = this;
    const t = THEMES[this.theme];

    // Flash on hit/damage
    if (state.lastHit) this.hitFlash = 1;
    if (state.lastDamaged) this.damageFlash = Math.max(this.damageFlash, 0.5);

    // Background
    let bg = '#0a0a0a';
    if (this.hitFlash > 0.3) bg = t.hitFlash;
    if (this.damageFlash > 0.3) bg = t.damageFlash;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    this.hitFlash *= 0.85;
    this.damageFlash *= 0.85;

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
    }

    // HP bar
    const hpBarWidth = 60;
    const hpBarHeight = 4;
    const hpX = size - hpBarWidth - 10;
    const hpY = 12;
    const hpFrac = Math.max(0, state.agentHP / 100);
    ctx.fillStyle = '#222';
    ctx.fillRect(hpX, hpY, hpBarWidth, hpBarHeight);
    ctx.fillStyle = hpFrac > 0.5 ? '#22c55e' : hpFrac > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(hpX, hpY, hpBarWidth * hpFrac, hpBarHeight);

    // HUD
    ctx.fillStyle = '#666';
    ctx.font = '11px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`episode: ${episode}`, 8, 16);
    ctx.fillText(`${t.killLabel}: ${state.killCount}`, 8, 30);
    ctx.fillText(`step: ${state.step}`, 8, 44);
    ctx.fillText(`ammo: ${state.agentAmmo}`, 8, 58);
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
