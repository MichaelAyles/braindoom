// Single training run - receives config via CLI args, outputs result as JSON
import { Arena } from './src/environment/arena';
import { Network } from './src/network/network';
import { Trainer } from './src/network/trainer';
import { Trajectory } from './src/network/types';
import { Action, Observation } from './src/environment/types';
import { sampleFromDistribution } from './src/utils/math';
import { SeededRNG } from './src/utils/random';

const NET_CONFIG = { inputSize: 3, hiddenSize: 16, outputSize: 4 };

function obsToArray(obs: Observation): number[] {
  return [obs.enemyAngle, obs.enemyDistance, obs.enemyVisible];
}

const args = process.argv.slice(2);
const lr = parseFloat(args[0]);
const gamma = parseFloat(args[1]);
const entropy = parseFloat(args[2]);
const batch = parseInt(args[3]);
const clip = parseFloat(args[4]);
const lrMin = args[5] ? parseFloat(args[5]) : 0;
const lrDecay = args[6] ? parseFloat(args[6]) : 1;
const numEpisodes = args[7] ? parseInt(args[7]) : 3000;

const arena = new Arena(42);
const network = new Network(NET_CONFIG, 123);
const trainer = new Trainer(lr, gamma, entropy, batch, clip, 1, lrMin, lrDecay);
const rng = new SeededRNG(999);

const recentKills: number[] = [];
const recentRewards: number[] = [];
const checkpoints: Record<number, { k: number; r: number }> = {};
const checkpointEps = [500, 1000, 2000, 3000, 5000, 7000, 10000, 15000, 20000];

for (let episode = 1; episode <= numEpisodes; episode++) {
  let obs = arena.reset();
  const trajectory: Trajectory = { states: [], actions: [], rewards: [], logProbs: [] };
  let episodeReward = 0;

  while (true) {
    const input = obsToArray(obs);
    const probs = network.forward(input);
    const action = sampleFromDistribution(probs, rng.next());
    trajectory.states.push(input);
    trajectory.actions.push(action);
    trajectory.logProbs.push(Math.log(probs[action] + 1e-10));
    const r = arena.step(action as Action);
    trajectory.rewards.push(r.reward);
    episodeReward += r.reward;
    obs = r.observation;
    if (r.done) break;
  }

  trainer.addTrajectory(network, trajectory);
  recentKills.push(arena.state.killCount);
  recentRewards.push(episodeReward);
  if (recentKills.length > 50) recentKills.shift();
  if (recentRewards.length > 50) recentRewards.shift();

  if (checkpointEps.includes(episode)) {
    const avgK = recentKills.reduce((a, b) => a + b, 0) / recentKills.length;
    const avgR = recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length;
    checkpoints[episode] = { k: avgK, r: avgR };
  }
}

// Output all collected checkpoints
const result: Record<string, number> = {};
for (const ep of checkpointEps) {
  if (checkpoints[ep]) {
    result[`k${ep}`] = checkpoints[ep].k;
    result[`r${ep}`] = +checkpoints[ep].r.toFixed(1);
  }
}
console.log(JSON.stringify(result));
