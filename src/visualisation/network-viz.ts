import { Network } from '../network/network';

const INPUT_LABELS = ['sin(θ)', 'cos(θ)', 'dist', 'visible'];
const OUTPUT_LABELS = ['left', 'right', 'shoot', 'fwd'];

export class NetworkViz {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  render(network: Network): void {
    const ctx = this.ctx;
    const { width, height } = this;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const layers = [
      network.config.inputSize,
      network.config.hiddenSize,
      network.config.outputSize,
    ];
    const layerX = [width * 0.15, width * 0.5, width * 0.85];
    const nodeRadius = 8;

    // Compute node positions
    const positions: [number, number][][] = layers.map((count, li) => {
      const totalHeight = (count - 1) * 28;
      const startY = (height - totalHeight) / 2;
      return Array.from({ length: count }, (_, i) => [
        layerX[li],
        startY + i * 28,
      ]);
    });

    // Find max weight for normalization
    let maxW = 0;
    for (const row of network.weightsIH) for (const w of row) maxW = Math.max(maxW, Math.abs(w));
    for (const row of network.weightsHO) for (const w of row) maxW = Math.max(maxW, Math.abs(w));
    if (maxW === 0) maxW = 1;

    // Draw connections: input → hidden
    for (let j = 0; j < layers[1]; j++) {
      for (let i = 0; i < layers[0]; i++) {
        const w = network.weightsIH[j][i];
        this.drawConnection(
          positions[0][i][0], positions[0][i][1],
          positions[1][j][0], positions[1][j][1],
          w, maxW
        );
      }
    }

    // Draw connections: hidden → output
    for (let k = 0; k < layers[2]; k++) {
      for (let j = 0; j < layers[1]; j++) {
        const w = network.weightsHO[k][j];
        this.drawConnection(
          positions[1][j][0], positions[1][j][1],
          positions[2][k][0], positions[2][k][1],
          w, maxW
        );
      }
    }

    // Draw nodes
    ctx.font = '10px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Input nodes
    for (let i = 0; i < layers[0]; i++) {
      const [x, y] = positions[0][i];
      this.drawNode(x, y, nodeRadius, '#3b82f6', 0.8);
      ctx.fillStyle = '#888';
      ctx.textAlign = 'right';
      ctx.fillText(INPUT_LABELS[i] || `i${i}`, x - 14, y);
    }

    // Hidden nodes
    for (let j = 0; j < layers[1]; j++) {
      const [x, y] = positions[1][j];
      const activation = network.lastHidden[j] ?? 0;
      const brightness = Math.abs(activation);
      this.drawNode(x, y, nodeRadius - 1, activation >= 0 ? '#22c55e' : '#a855f7', brightness);
    }

    // Output nodes
    ctx.textAlign = 'left';
    for (let k = 0; k < layers[2]; k++) {
      const [x, y] = positions[2][k];
      const prob = network.lastOutput[k] ?? 0.25;
      this.drawNode(x, y, nodeRadius, '#f97316', prob);
      ctx.fillStyle = '#888';
      ctx.fillText(`${OUTPUT_LABELS[k] || `o${k}`} ${(prob * 100).toFixed(0)}%`, x + 14, y);
    }

    // Title
    ctx.fillStyle = '#555';
    ctx.font = '10px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${network.paramCount()} parameters`, 8, height - 8);
  }

  private drawConnection(
    x1: number, y1: number, x2: number, y2: number,
    weight: number, maxW: number
  ): void {
    const ctx = this.ctx;
    const norm = weight / maxW;
    const alpha = Math.min(Math.abs(norm) * 0.8 + 0.05, 0.9);
    const lineWidth = Math.abs(norm) * 2.5 + 0.3;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = norm > 0
      ? `rgba(239, 68, 68, ${alpha})`   // red = positive
      : `rgba(59, 130, 246, ${alpha})`;  // blue = negative
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  private drawNode(x: number, y: number, r: number, color: string, intensity: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2 + intensity * 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
