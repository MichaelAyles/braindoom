export function tanh(x: number): number {
  if (x > 20) return 1;
  if (x < -20) return -1;
  const e2x = Math.exp(2 * x);
  return (e2x - 1) / (e2x + 1);
}

export function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// Softmax with minimum probability floor — prevents any action from reaching 0
const ACTION_FLOOR = 0.10;
export function softmaxFloored(logits: number[]): number[] {
  const raw = softmax(logits);
  const n = raw.length;
  const totalFloor = ACTION_FLOOR * n;
  return raw.map(p => ACTION_FLOOR + (1 - totalFloor) * p);
}

export function sampleFromDistribution(probs: number[], rand: number): number {
  let cumulative = 0;
  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i];
    if (rand < cumulative) return i;
  }
  return probs.length - 1;
}

export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}
