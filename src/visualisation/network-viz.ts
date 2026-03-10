import { Network } from '../network/network';

const INPUT_LABELS = ['angle', 'dist', 'visible'];
const OUTPUT_LABELS = ['left', 'right', 'shoot', 'fwd'];

interface NodeInfo {
  layer: number; // 0=input, 1=hidden, 2=output
  index: number;
  x: number;
  y: number;
}

interface WeightHistory {
  label: string;
  values: number[];
}

const MAX_HISTORY = 500;

export class NetworkViz {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;

  // Interaction state
  private hoverNode: NodeInfo | null = null;
  private selectedNode: NodeInfo | null = null;
  private nodePositions: NodeInfo[] = [];

  // Weight history for selected node
  private weightHistories: Map<string, number[]> = new Map();
  private historyStep = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width;
    this.height = canvas.height;

    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('click', (e) => this.onClick(e));
    canvas.addEventListener('mouseleave', () => { this.hoverNode = null; });
    canvas.style.cursor = 'default';
  }

  private getCanvasPos(e: MouseEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    return [
      (e.clientX - rect.left) * scaleX,
      (e.clientY - rect.top) * scaleY,
    ];
  }

  private findNode(mx: number, my: number): NodeInfo | null {
    const hitRadius = 12;
    for (const node of this.nodePositions) {
      const dx = mx - node.x;
      const dy = my - node.y;
      if (dx * dx + dy * dy < hitRadius * hitRadius) return node;
    }
    return null;
  }

  private onMouseMove(e: MouseEvent): void {
    const [mx, my] = this.getCanvasPos(e);
    this.hoverNode = this.findNode(mx, my);
    this.canvas.style.cursor = this.hoverNode ? 'pointer' : 'default';
  }

  private onClick(e: MouseEvent): void {
    const [mx, my] = this.getCanvasPos(e);
    const clicked = this.findNode(mx, my);
    if (clicked && this.selectedNode &&
        clicked.layer === this.selectedNode.layer &&
        clicked.index === this.selectedNode.index) {
      // Deselect on second click
      this.selectedNode = null;
    } else {
      this.selectedNode = clicked;
    }
  }

  recordWeights(network: Network): void {
    this.historyStep++;

    // Record all weights that any node might need
    // Input→Hidden weights
    for (let j = 0; j < network.config.hiddenSize; j++) {
      for (let i = 0; i < network.config.inputSize; i++) {
        const key = `ih_${i}_${j}`;
        let arr = this.weightHistories.get(key);
        if (!arr) { arr = []; this.weightHistories.set(key, arr); }
        arr.push(network.weightsIH[j][i]);
        if (arr.length > MAX_HISTORY) arr.shift();
      }
    }
    // Hidden biases
    for (let j = 0; j < network.config.hiddenSize; j++) {
      const key = `bh_${j}`;
      let arr = this.weightHistories.get(key);
      if (!arr) { arr = []; this.weightHistories.set(key, arr); }
      arr.push(network.biasH[j]);
      if (arr.length > MAX_HISTORY) arr.shift();
    }
    // Hidden→Output weights
    for (let k = 0; k < network.config.outputSize; k++) {
      for (let j = 0; j < network.config.hiddenSize; j++) {
        const key = `ho_${j}_${k}`;
        let arr = this.weightHistories.get(key);
        if (!arr) { arr = []; this.weightHistories.set(key, arr); }
        arr.push(network.weightsHO[k][j]);
        if (arr.length > MAX_HISTORY) arr.shift();
      }
    }
    // Output biases
    for (let k = 0; k < network.config.outputSize; k++) {
      const key = `bo_${k}`;
      let arr = this.weightHistories.get(key);
      if (!arr) { arr = []; this.weightHistories.set(key, arr); }
      arr.push(network.biasO[k]);
      if (arr.length > MAX_HISTORY) arr.shift();
    }
  }

  resetHistory(): void {
    this.weightHistories.clear();
    this.historyStep = 0;
    this.selectedNode = null;
    this.hoverNode = null;
  }

  render(network: Network): void {
    const ctx = this.ctx;
    const { width, height } = this;

    const showHistory = this.selectedNode !== null;
    const mainHeight = showHistory ? height * 0.6 : height;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const layers = [
      network.config.inputSize,
      network.config.hiddenSize,
      network.config.outputSize,
    ];
    const layerX = [width * 0.15, width * 0.5, width * 0.85];
    const nodeRadius = 8;

    // Compute node positions (fitted to main area)
    this.nodePositions = [];
    const positions: [number, number][][] = layers.map((count, li) => {
      const totalHeight = (count - 1) * 28;
      const startY = (mainHeight - totalHeight) / 2;
      return Array.from({ length: count }, (_, i) => {
        const x = layerX[li];
        const y = startY + i * 28;
        this.nodePositions.push({ layer: li, index: i, x, y });
        return [x, y] as [number, number];
      });
    });

    // Find max weight for normalization
    let maxW = 0;
    for (const row of network.weightsIH) for (const w of row) maxW = Math.max(maxW, Math.abs(w));
    for (const row of network.weightsHO) for (const w of row) maxW = Math.max(maxW, Math.abs(w));
    if (maxW === 0) maxW = 1;

    // Highlight connections for hovered/selected node
    const focusNode = this.hoverNode ?? this.selectedNode;

    // Draw connections: input → hidden
    for (let j = 0; j < layers[1]; j++) {
      for (let i = 0; i < layers[0]; i++) {
        const w = network.weightsIH[j][i];
        const highlight = focusNode && (
          (focusNode.layer === 0 && focusNode.index === i) ||
          (focusNode.layer === 1 && focusNode.index === j)
        );
        this.drawConnection(
          positions[0][i][0], positions[0][i][1],
          positions[1][j][0], positions[1][j][1],
          w, maxW, focusNode ? (highlight ? 1.0 : 0.1) : -1
        );
      }
    }

    // Draw connections: hidden → output
    for (let k = 0; k < layers[2]; k++) {
      for (let j = 0; j < layers[1]; j++) {
        const w = network.weightsHO[k][j];
        const highlight = focusNode && (
          (focusNode.layer === 1 && focusNode.index === j) ||
          (focusNode.layer === 2 && focusNode.index === k)
        );
        this.drawConnection(
          positions[1][j][0], positions[1][j][1],
          positions[2][k][0], positions[2][k][1],
          w, maxW, focusNode ? (highlight ? 1.0 : 0.1) : -1
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
      const isActive = focusNode?.layer === 0 && focusNode.index === i;
      this.drawNode(x, y, isActive ? nodeRadius + 2 : nodeRadius, '#3b82f6', 0.8);
      ctx.fillStyle = '#888';
      ctx.textAlign = 'right';
      ctx.fillText(INPUT_LABELS[i] || `i${i}`, x - 14, y);
    }

    // Hidden nodes
    for (let j = 0; j < layers[1]; j++) {
      const [x, y] = positions[1][j];
      const activation = network.lastHidden[j] ?? 0;
      const brightness = Math.abs(activation);
      const isActive = focusNode?.layer === 1 && focusNode.index === j;
      this.drawNode(x, y, isActive ? nodeRadius + 1 : nodeRadius - 1, activation >= 0 ? '#22c55e' : '#a855f7', brightness);
    }

    // Output nodes
    ctx.textAlign = 'left';
    for (let k = 0; k < layers[2]; k++) {
      const [x, y] = positions[2][k];
      const prob = network.lastOutput[k] ?? 0.25;
      const isActive = focusNode?.layer === 2 && focusNode.index === k;
      this.drawNode(x, y, isActive ? nodeRadius + 2 : nodeRadius, '#f97316', prob);
      ctx.fillStyle = '#888';
      ctx.fillText(`${OUTPUT_LABELS[k] || `o${k}`} ${(prob * 100).toFixed(0)}%`, x + 14, y);
    }

    // Tooltip on hover
    if (this.hoverNode && !this.selectedNode) {
      this.drawTooltip(network, this.hoverNode);
    }

    // Weight history panel
    if (showHistory) {
      this.drawHistoryPanel(mainHeight);
    }

    // Footer
    ctx.fillStyle = '#555';
    ctx.font = '10px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'left';
    const footerY = showHistory ? height - 8 : mainHeight - 8;
    ctx.fillText(`${network.paramCount()} parameters`, 8, footerY);
    if (!this.selectedNode) {
      ctx.textAlign = 'right';
      ctx.fillText('click a node for weight history', width - 8, footerY);
    }
  }

  private drawTooltip(network: Network, node: NodeInfo): void {
    const ctx = this.ctx;
    const weights = this.getNodeWeights(network, node);
    if (weights.length === 0) return;

    const lines = weights.map(w => `${w.label}: ${w.value.toFixed(4)}`);
    const lineHeight = 14;
    const padding = 6;
    const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2;
    const boxHeight = lines.length * lineHeight + padding * 2;

    // Position tooltip to the right of the node, or left if near edge
    let tx = node.x + 16;
    let ty = node.y - boxHeight / 2;
    if (tx + maxWidth > this.width - 4) tx = node.x - 16 - maxWidth;
    if (ty < 4) ty = 4;
    if (ty + boxHeight > this.height - 4) ty = this.height - 4 - boxHeight;

    ctx.fillStyle = 'rgba(20, 20, 20, 0.95)';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tx, ty, maxWidth, boxHeight, 3);
    ctx.fill();
    ctx.stroke();

    ctx.font = '10px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i < lines.length; i++) {
      const w = weights[i];
      ctx.fillStyle = w.value > 0 ? '#ef4444' : w.value < 0 ? '#3b82f6' : '#666';
      ctx.fillText(lines[i], tx + padding, ty + padding + (i + 0.8) * lineHeight);
    }
  }

  private drawHistoryPanel(topY: number): void {
    const ctx = this.ctx;
    const node = this.selectedNode!;
    const panelY = topY + 4;
    const panelH = this.height - panelY - 20;
    const panelX = 8;
    const panelW = this.width - 16;

    // Panel background
    ctx.fillStyle = '#111';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 4);
    ctx.fill();
    ctx.stroke();

    // Get weight histories for this node
    const histories = this.getNodeHistories(node);
    if (histories.length === 0 || histories[0].values.length < 2) {
      ctx.fillStyle = '#555';
      ctx.font = '10px "JetBrains Mono", "Fira Code", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('waiting for training data...', this.width / 2, panelY + panelH / 2);
      return;
    }

    // Header
    const nodeLabel = node.layer === 0 ? INPUT_LABELS[node.index] :
                      node.layer === 2 ? OUTPUT_LABELS[node.index] :
                      `h${node.index}`;
    ctx.fillStyle = '#888';
    ctx.font = '10px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`weights for ${nodeLabel} (click to dismiss)`, panelX + 8, panelY + 14);

    // Plot area
    const plotX = panelX + 40;
    const plotY = panelY + 22;
    const plotW = panelW - 80;
    const plotH = panelH - 30;

    // Find global min/max across all histories
    let minV = Infinity, maxV = -Infinity;
    for (const h of histories) {
      for (const v of h.values) {
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    }
    const range = (maxV - minV) || 1;
    const margin = range * 0.1;
    minV -= margin;
    maxV += margin;

    // Zero line
    const zeroY = plotY + plotH * (1 - (0 - minV) / (maxV - minV));
    if (zeroY > plotY && zeroY < plotY + plotH) {
      ctx.beginPath();
      ctx.moveTo(plotX, zeroY);
      ctx.lineTo(plotX + plotW, zeroY);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Colors for different weight lines
    const colors = [
      '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
      '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
      '#14b8a6', '#e11d48', '#8b5cf6', '#10b981', '#f43f5e',
      '#0ea5e9',
    ];

    // Draw each weight history line
    const maxLen = Math.max(...histories.map(h => h.values.length));
    for (let hi = 0; hi < histories.length; hi++) {
      const h = histories[hi];
      if (h.values.length < 2) continue;
      const color = colors[hi % colors.length];

      ctx.beginPath();
      for (let i = 0; i < h.values.length; i++) {
        const x = plotX + (i / (maxLen - 1)) * plotW;
        const y = plotY + plotH * (1 - (h.values[i] - minV) / (maxV - minV));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Legend label at end of line
      const lastV = h.values[h.values.length - 1];
      const lastY = plotY + plotH * (1 - (lastV - minV) / (maxV - minV));
      ctx.fillStyle = color;
      ctx.font = '9px "JetBrains Mono", "Fira Code", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(h.label, plotX + plotW + 4, lastY + 3);
    }

    // Y-axis labels
    ctx.fillStyle = '#555';
    ctx.font = '9px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(maxV.toFixed(2), plotX - 4, plotY + 4);
    ctx.fillText(minV.toFixed(2), plotX - 4, plotY + plotH);
  }

  private getNodeWeights(network: Network, node: NodeInfo): { label: string; value: number }[] {
    const weights: { label: string; value: number }[] = [];
    if (node.layer === 0) {
      // Input node: show weights to all hidden nodes
      for (let j = 0; j < network.config.hiddenSize; j++) {
        weights.push({ label: `→h${j}`, value: network.weightsIH[j][node.index] });
      }
    } else if (node.layer === 1) {
      // Hidden node: show incoming weights from inputs + bias, outgoing to outputs
      for (let i = 0; i < network.config.inputSize; i++) {
        weights.push({ label: `${INPUT_LABELS[i]}→`, value: network.weightsIH[node.index][i] });
      }
      weights.push({ label: 'bias', value: network.biasH[node.index] });
      for (let k = 0; k < network.config.outputSize; k++) {
        weights.push({ label: `→${OUTPUT_LABELS[k]}`, value: network.weightsHO[k][node.index] });
      }
    } else if (node.layer === 2) {
      // Output node: show incoming weights from hidden + bias
      for (let j = 0; j < network.config.hiddenSize; j++) {
        weights.push({ label: `h${j}→`, value: network.weightsHO[node.index][j] });
      }
      weights.push({ label: 'bias', value: network.biasO[node.index] });
    }
    return weights;
  }

  private getNodeHistories(node: NodeInfo): WeightHistory[] {
    const histories: WeightHistory[] = [];
    if (node.layer === 0) {
      for (let j = 0; j < 16; j++) {
        const key = `ih_${node.index}_${j}`;
        const vals = this.weightHistories.get(key);
        if (vals) histories.push({ label: `h${j}`, values: vals });
      }
    } else if (node.layer === 1) {
      for (let i = 0; i < 3; i++) {
        const key = `ih_${i}_${node.index}`;
        const vals = this.weightHistories.get(key);
        if (vals) histories.push({ label: INPUT_LABELS[i], values: vals });
      }
      const biasKey = `bh_${node.index}`;
      const biasVals = this.weightHistories.get(biasKey);
      if (biasVals) histories.push({ label: 'bias', values: biasVals });
      for (let k = 0; k < 4; k++) {
        const key = `ho_${node.index}_${k}`;
        const vals = this.weightHistories.get(key);
        if (vals) histories.push({ label: OUTPUT_LABELS[k], values: vals });
      }
    } else if (node.layer === 2) {
      for (let j = 0; j < 16; j++) {
        const key = `ho_${j}_${node.index}`;
        const vals = this.weightHistories.get(key);
        if (vals) histories.push({ label: `h${j}`, values: vals });
      }
      const biasKey = `bo_${node.index}`;
      const biasVals = this.weightHistories.get(biasKey);
      if (biasVals) histories.push({ label: 'bias', values: biasVals });
    }
    return histories;
  }

  private drawConnection(
    x1: number, y1: number, x2: number, y2: number,
    weight: number, maxW: number, focusAlpha: number
  ): void {
    const ctx = this.ctx;
    const norm = weight / maxW;
    let alpha = Math.min(Math.abs(norm) * 0.8 + 0.05, 0.9);
    if (focusAlpha >= 0) alpha *= focusAlpha;
    const lineWidth = Math.abs(norm) * 2.5 + 0.3;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = norm > 0
      ? `rgba(239, 68, 68, ${alpha})`
      : `rgba(59, 130, 246, ${alpha})`;
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
