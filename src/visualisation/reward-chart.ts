import { ThemeMode } from '../environment/types';

export class RewardChart {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  private rewards: number[] = [];
  private smoothedRewards: number[] = [];
  private steps: number[] = []; // steps per episode (survival length)
  private smoothedSteps: number[] = [];
  private kills: number[] = []; // kills per episode
  private smoothedKills: number[] = [];
  private ablated: boolean[] = []; // was this episode run under ablation?

  private windowSize = 20;
  theme: ThemeMode = 'doom';

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  push(episodeReward: number, stepCount: number, killCount: number, isAblated = false): void {
    this.rewards.push(episodeReward);
    this.steps.push(stepCount);
    this.kills.push(killCount);
    this.ablated.push(isAblated);

    const start = Math.max(0, this.rewards.length - this.windowSize);

    // Smoothed reward
    const rewardWindow = this.rewards.slice(start);
    this.smoothedRewards.push(rewardWindow.reduce((a, b) => a + b, 0) / rewardWindow.length);

    // Smoothed steps per episode
    const stepWindow = this.steps.slice(start);
    this.smoothedSteps.push(stepWindow.reduce((a, b) => a + b, 0) / stepWindow.length);

    // Smoothed kills per episode
    const killWindow = this.kills.slice(start);
    this.smoothedKills.push(killWindow.reduce((a, b) => a + b, 0) / killWindow.length);
  }

  getLastSmoothed(): number {
    return this.smoothedRewards[this.smoothedRewards.length - 1] ?? 0;
  }

  reset(): void {
    this.rewards = [];
    this.smoothedRewards = [];
    this.steps = [];
    this.smoothedSteps = [];
    this.kills = [];
    this.smoothedKills = [];
    this.ablated = [];
  }

  render(): void {
    const ctx = this.ctx;
    const { width, height } = this;
    const padding = { top: 16, right: 80, bottom: 24, left: 48 };

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    if (this.smoothedRewards.length < 2) {
      ctx.fillStyle = '#444';
      ctx.font = '11px "JetBrains Mono", "Fira Code", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('waiting for data...', width / 2, height / 2);
      return;
    }

    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const len = this.smoothedRewards.length;

    const toX = (i: number) => padding.left + (i / (len - 1)) * plotW;

    // ---- Ablation overlay (red shaded regions) ----
    let inAblation = false;
    let ablationStart = 0;
    for (let i = 0; i < len; i++) {
      if (this.ablated[i] && !inAblation) {
        inAblation = true;
        ablationStart = i;
      } else if (!this.ablated[i] && inAblation) {
        inAblation = false;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.fillRect(toX(ablationStart), padding.top, toX(i) - toX(ablationStart), plotH);
        // Top bar
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.fillRect(toX(ablationStart), padding.top, toX(i) - toX(ablationStart), 2);
      }
    }
    // Close trailing ablation region
    if (inAblation) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      ctx.fillRect(toX(ablationStart), padding.top, toX(len - 1) - toX(ablationStart), plotH);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.fillRect(toX(ablationStart), padding.top, toX(len - 1) - toX(ablationStart), 2);
      // Label
      ctx.fillStyle = '#ef4444';
      ctx.font = '9px "JetBrains Mono", "Fira Code", monospace';
      ctx.textAlign = 'center';
      const midX = (toX(ablationStart) + toX(len - 1)) / 2;
      ctx.fillText('ablation', midX, padding.top + 14);
    }

    // ---- Reward line (left Y-axis) ----
    const rewardVals = this.smoothedRewards;
    const minR = Math.min(...rewardVals, 0);
    const maxR = Math.max(...rewardVals, 1);
    const rangeR = maxR - minR || 1;
    const toYReward = (v: number) => padding.top + plotH - ((v - minR) / rangeR) * plotH;

    // Zero line
    if (minR < 0 && maxR > 0) {
      const zeroY = toYReward(0);
      ctx.beginPath();
      ctx.moveTo(padding.left, zeroY);
      ctx.lineTo(padding.left + plotW, zeroY);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Raw reward dots (color by step count — longer survival = greener)
    const maxSteps = Math.max(...this.steps, 1);
    for (let i = 0; i < this.rewards.length; i++) {
      const x = toX(i);
      const y = toYReward(this.rewards[i]);
      const stepFrac = this.steps[i] / maxSteps;
      ctx.beginPath();
      ctx.arc(x, Math.max(padding.top, Math.min(padding.top + plotH, y)), 1, 0, Math.PI * 2);
      if (this.ablated[i]) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      } else {
        ctx.fillStyle = stepFrac > 0.5
          ? `rgba(34, 197, 94, ${0.08 + stepFrac * 0.15})`
          : `rgba(239, 68, 68, ${0.08 + (1 - stepFrac) * 0.1})`;
      }
      ctx.fill();
    }

    // Smoothed reward
    ctx.beginPath();
    ctx.moveTo(toX(0), toYReward(rewardVals[0]));
    for (let i = 1; i < len; i++) ctx.lineTo(toX(i), toYReward(rewardVals[i]));
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ---- Steps/ep line (right Y-axis, scaled) ----
    const maxS = Math.max(...this.smoothedSteps, 1);
    const toYPct = (v: number) => padding.top + plotH - v * plotH;

    ctx.beginPath();
    ctx.moveTo(toX(0), toYPct(this.smoothedSteps[0] / maxS));
    for (let i = 1; i < len; i++) ctx.lineTo(toX(i), toYPct(this.smoothedSteps[i] / maxS));
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ---- Kills/ep line (right Y-axis, scaled) ----
    const maxK = Math.max(...this.smoothedKills, 1);
    ctx.beginPath();
    ctx.moveTo(toX(0), toYPct(this.smoothedKills[0] / maxK));
    for (let i = 1; i < len; i++) ctx.lineTo(toX(i), toYPct(this.smoothedKills[i] / maxK));
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // ---- Left Y-axis labels (reward) ----
    ctx.fillStyle = '#f97316';
    ctx.font = '9px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(maxR.toFixed(0), padding.left - 4, padding.top + 4);
    ctx.fillText(minR.toFixed(0), padding.left - 4, padding.top + plotH);

    // ---- Right Y-axis labels (steps) ----
    const rightX = padding.left + plotW + 4;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#22c55e';
    ctx.fillText(`${maxS.toFixed(0)}`, rightX, padding.top + 4);
    ctx.fillText('0', rightX, padding.top + plotH);

    // ---- Legend ----
    const legendY = 10;
    ctx.font = '9px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'left';

    const lastReward = rewardVals[len - 1];
    const lastSteps = this.smoothedSteps[len - 1];
    const lastKills = this.smoothedKills[len - 1];

    // Reward
    ctx.fillStyle = '#f97316';
    ctx.fillText(`reward: ${lastReward.toFixed(1)}`, padding.left + 4, legendY);

    // Steps
    ctx.fillStyle = '#22c55e';
    ctx.fillText(`steps/ep: ${lastSteps.toFixed(0)}`, padding.left + 120, legendY);

    // Kills
    ctx.fillStyle = '#3b82f6';
    const killLabel = this.theme === 'flower' ? 'watered/ep' : 'kills/ep';
    ctx.fillText(`${killLabel}: ${lastKills.toFixed(1)}`, padding.left + 250, legendY);

    // X-axis
    ctx.fillStyle = '#444';
    ctx.textAlign = 'center';
    ctx.fillText(`episode (${len})`, width / 2, height - 4);
  }
}
