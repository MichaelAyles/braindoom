export class RewardChart {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private rewards: number[] = [];
  private smoothed: number[] = [];
  private windowSize = 10;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  push(episodeReward: number): void {
    this.rewards.push(episodeReward);

    // Rolling average
    const start = Math.max(0, this.rewards.length - this.windowSize);
    const window = this.rewards.slice(start);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    this.smoothed.push(avg);
  }

  getLastSmoothed(): number {
    return this.smoothed[this.smoothed.length - 1] ?? 0;
  }

  reset(): void {
    this.rewards = [];
    this.smoothed = [];
  }

  render(): void {
    const ctx = this.ctx;
    const { width, height } = this;
    const padding = { top: 20, right: 16, bottom: 24, left: 48 };

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    if (this.smoothed.length < 2) {
      ctx.fillStyle = '#444';
      ctx.font = '11px "JetBrains Mono", "Fira Code", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('waiting for data...', width / 2, height / 2);
      return;
    }

    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const allVals = this.smoothed;
    const minVal = Math.min(...allVals, 0);
    const maxVal = Math.max(...allVals, 1);
    const range = maxVal - minVal || 1;

    const toX = (i: number) => padding.left + (i / (allVals.length - 1)) * plotW;
    const toY = (v: number) => padding.top + plotH - ((v - minVal) / range) * plotH;

    // Zero line
    if (minVal < 0 && maxVal > 0) {
      const zeroY = toY(0);
      ctx.beginPath();
      ctx.moveTo(padding.left, zeroY);
      ctx.lineTo(width - padding.right, zeroY);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Raw rewards (dots)
    for (let i = 0; i < this.rewards.length; i++) {
      const x = toX(i);
      const y = toY(this.rewards[i]);
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();
    }

    // Smoothed line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(allVals[0]));
    for (let i = 1; i < allVals.length; i++) {
      ctx.lineTo(toX(i), toY(allVals[i]));
    }
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Axes labels
    ctx.fillStyle = '#555';
    ctx.font = '10px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(maxVal.toFixed(1), padding.left - 4, padding.top + 4);
    ctx.fillText(minVal.toFixed(1), padding.left - 4, padding.top + plotH);

    ctx.textAlign = 'center';
    ctx.fillText('episode', width / 2, height - 4);

    // Title
    ctx.textAlign = 'left';
    ctx.fillStyle = '#666';
    ctx.fillText('reward (10-ep avg)', padding.left, 12);
  }
}
