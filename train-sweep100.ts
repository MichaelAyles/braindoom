// Orchestrator: spawns 100 child processes, each running train-single.ts
import { execSync } from 'child_process';
import { SeededRNG } from './src/utils/random';

const searchRng = new SeededRNG(42);

function sample(min: number, max: number, log = false): number {
  if (log) {
    const logMin = Math.log(min);
    const logMax = Math.log(max);
    return Math.exp(logMin + searchRng.next() * (logMax - logMin));
  }
  return min + searchRng.next() * (max - min);
}

interface Result {
  id: number; lr: number; gamma: number; entropy: number; batch: number; clip: number;
  k500: number; k1000: number; k2000: number; k3000: number;
  r500: number; r1000: number; r2000: number; r3000: number;
}

const results: Result[] = [];

for (let i = 0; i < 100; i++) {
  const lr = sample(0.002, 0.05, true);
  const gamma = sample(0.93, 0.995);
  const entropy = sample(0.005, 0.08, true);
  const batch = Math.round(sample(4, 32));
  const clip = sample(0.1, 0.3);

  try {
    const out = execSync(
      `npx tsx train-single.ts ${lr} ${gamma} ${entropy} ${batch} ${clip}`,
      { timeout: 120000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    const data = JSON.parse(out);
    const r: Result = {
      id: i, lr: +lr.toFixed(5), gamma: +gamma.toFixed(3),
      entropy: +entropy.toFixed(4), batch, clip: +clip.toFixed(2),
      ...data,
    };
    results.push(r);
    process.stderr.write(`[${i + 1}/100] k1k=${data.k1000.toFixed(2)} k3k=${data.k3000.toFixed(2)} lr=${lr.toFixed(4)} b=${batch} ent=${entropy.toFixed(3)} g=${gamma.toFixed(3)}\n`);
  } catch (e: any) {
    process.stderr.write(`[${i + 1}/100] FAILED: ${e.message?.slice(0, 80)}\n`);
  }
}

// Sort by k1000 + k3000
results.sort((a, b) => (b.k1000 + b.k3000) - (a.k1000 + a.k3000));

console.log("\n=== TOP 20 BY k1000 + k3000 ===");
console.log("rank | id | lr      | batch | ent    | gamma | clip | k500 | k1k  | k2k  | k3k  | r1k   | r3k");
for (let i = 0; i < 20 && i < results.length; i++) {
  const r = results[i];
  console.log(
    `${String(i + 1).padStart(4)} | ${String(r.id).padStart(2)} | ${r.lr.toFixed(5)} | ${String(r.batch).padStart(5)} | ${r.entropy.toFixed(4)} | ${r.gamma.toFixed(3)} | ${r.clip.toFixed(2)} | ${r.k500.toFixed(2)} | ${r.k1000.toFixed(2)} | ${r.k2000.toFixed(2)} | ${r.k3000.toFixed(2)} | ${r.r1000.toFixed(1)} | ${r.r3000.toFixed(1)}`
  );
}

// Sort by k1000 alone
const byK1000 = [...results].sort((a, b) => b.k1000 - a.k1000);
console.log("\n=== TOP 10 BY k1000 ONLY ===");
for (let i = 0; i < 10 && i < byK1000.length; i++) {
  const r = byK1000[i];
  console.log(
    `${String(i + 1).padStart(4)} | id=${String(r.id).padStart(2)} lr=${r.lr.toFixed(5)} b=${r.batch} ent=${r.entropy.toFixed(4)} g=${r.gamma.toFixed(3)} clip=${r.clip.toFixed(2)} | k500=${r.k500.toFixed(2)} k1k=${r.k1000.toFixed(2)} k2k=${r.k2000.toFixed(2)} k3k=${r.k3000.toFixed(2)}`
  );
}

// Sort by k3000 alone
const byK3000 = [...results].sort((a, b) => b.k3000 - a.k3000);
console.log("\n=== TOP 10 BY k3000 ONLY ===");
for (let i = 0; i < 10 && i < byK3000.length; i++) {
  const r = byK3000[i];
  console.log(
    `${String(i + 1).padStart(4)} | id=${String(r.id).padStart(2)} lr=${r.lr.toFixed(5)} b=${r.batch} ent=${r.entropy.toFixed(4)} g=${r.gamma.toFixed(3)} clip=${r.clip.toFixed(2)} | k500=${r.k500.toFixed(2)} k1k=${r.k1000.toFixed(2)} k2k=${r.k2000.toFixed(2)} k3k=${r.k3000.toFixed(2)}`
  );
}
