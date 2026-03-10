export class RewardChart {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  private rewards: number[] = [];
  private smoothedRewards: number[] = [];
  private survivals: boolean[] = []; // true = survived, false = died
  private smoothedSurvival: number[] = [];
  private kills: number[] = []; // kills per episode
  private smoothedKills: number[] = [];

  private windowSize = 20;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  push(episodeReward: number, survived: boolean, killCount: number): void {
    this.rewards.push(episodeReward);
    this.survivals.push(survived);
    this.kills.push(killCount);

    const start = Math.max(0, this.rewards.length - this.windowSize);

    // Smoothed reward
    const rewardWindow = this.rewards.slice(start);
    this.smoothedRewards.push(rewardWindow.reduce((a, b) => a + b, 0) / rewardWindow.length);

    // Smoothed survival rate
    const survWindow = this.survivals.slice(start);
    this.smoothedSurvival.push(survWindow.filter(s => s).length / survWindow.length);

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
    this.survivals = [];
    this.smoothedSurvival = [];
    this.kills = [];
    this.smoothedKills = [];
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

    // Raw reward dots
    for (let i = 0; i < this.rewards.length; i++) {
      const x = toX(i);
      const y = toYReward(this.rewards[i]);
      ctx.beginPath();
      ctx.arc(x, Math.max(padding.top, Math.min(padding.top + plotH, y)), 1, 0, Math.PI * 2);
      ctx.fillStyle = this.survivals[i] ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)';
      ctx.fill();
    }

    // Smoothed reward
    ctx.beginPath();
    ctx.moveTo(toX(0), toYReward(rewardVals[0]));
    for (let i = 1; i < len; i++) ctx.lineTo(toX(i), toYReward(rewardVals[i]));
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ---- Survival rate line (right Y-axis, 0-100%) ----
    const toYPct = (v: number) => padding.top + plotH - v * plotH;

    ctx.beginPath();
    ctx.moveTo(toX(0), toYPct(this.smoothedSurvival[0]));
    for (let i = 1; i < len; i++) ctx.lineTo(toX(i), toYPct(this.smoothedSurvival[i]));
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

    // ---- Right Y-axis labels (survival %) ----
    const rightX = padding.left + plotW + 4;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#22c55e';
    ctx.fillText('100%', rightX, padding.top + 4);
    ctx.fillText('0%', rightX, padding.top + plotH);

    // ---- Legend ----
    const legendY = 10;
    ctx.font = '9px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'left';

    const lastReward = rewardVals[len - 1];
    const lastSurvival = this.smoothedSurvival[len - 1];
    const lastKills = this.smoothedKills[len - 1];

    // Reward
    ctx.fillStyle = '#f97316';
    ctx.fillText(`reward: ${lastReward.toFixed(1)}`, padding.left + 4, legendY);

    // Survival
    ctx.fillStyle = '#22c55e';
    ctx.fillText(`survival: ${(lastSurvival * 100).toFixed(0)}%`, padding.left + 120, legendY);

    // Kills
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(`kills/ep: ${lastKills.toFixed(1)}`, padding.left + 250, legendY);

    // X-axis
    ctx.fillStyle = '#444';
    ctx.textAlign = 'center';
    ctx.fillText(`episode (${len})`, width / 2, height - 4);
  }
}
