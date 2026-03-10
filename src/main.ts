import { Arena } from './environment/arena';
import { ArenaRenderer } from './environment/renderer';
import { Network } from './network/network';
import { Trainer } from './network/trainer';
import { Trajectory } from './network/types';
import { Action, Observation } from './environment/types';
import { NetworkViz } from './visualisation/network-viz';
import { RewardChart } from './visualisation/reward-chart';
import { Controls } from './visualisation/controls';
import { Annotations } from './narration/annotations';
import { sampleFromDistribution } from './utils/math';
import { SeededRNG } from './utils/random';

// Config
const NET_CONFIG = { inputSize: 4, hiddenSize: 16, outputSize: 4 };
const SNAPSHOT_EPISODES = [1, 10, 50, 100, 500, 1000, 5000, 10000];

// Types
interface Snapshot {
  episode: number;
  weightsIH: number[][];
  biasH: number[];
  weightsHO: number[][];
  biasO: number[];
}

// ---- State ----
let arena = new Arena(42);
let network = new Network(NET_CONFIG, 123);
const trainer = new Trainer(0.01, 0.99);
let rng = new SeededRNG(999);
let episode = 0;
let totalKills = 0;
let ablation = false;
let playing = true;
let speed = 1;
// theme is read/applied via arenaRenderer.theme in control callback

// Step-by-step playback state
let currentObs: Observation | null = null;
let currentTrajectory: Trajectory | null = null;
let episodeReward = 0;
let episodeActive = false;
let stepAccumulator = 0; // fractional step counter for slow speeds

// Snapshots
const snapshots: Map<number, Snapshot> = new Map();

// Replay state
let replayMode = false;
let replayNetwork: Network | null = null;
let replayArena: Arena | null = null;

function saveSnapshot(ep: number, net: Network): void {
  snapshots.set(ep, {
    episode: ep,
    weightsIH: net.weightsIH.map(row => [...row]),
    biasH: [...net.biasH],
    weightsHO: net.weightsHO.map(row => [...row]),
    biasO: [...net.biasO],
  });
}

function loadSnapshot(snap: Snapshot): Network {
  const net = new Network(NET_CONFIG, 0);
  net.weightsIH = snap.weightsIH.map(row => [...row]);
  net.biasH = [...snap.biasH];
  net.weightsHO = snap.weightsHO.map(row => [...row]);
  net.biasO = [...snap.biasO];
  return net;
}

function obsToArray(obs: Observation): number[] {
  return [obs.enemyAngleSin, obs.enemyAngleCos, obs.enemyDistance, obs.enemyVisible];
}

// ---- DOM Setup ----
function createCanvas(parent: HTMLElement, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.style.cssText = `
    width: 100%; height: auto; border-radius: 4px;
    border: 1px solid #222; background: #0a0a0a;
  `;
  parent.appendChild(canvas);
  return canvas;
}

function init(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  app.style.cssText = `
    max-width: 860px; margin: 0 auto; padding: 24px 16px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    color: #ccc; background: #0a0a0a;
  `;

  // Title
  const title = document.createElement('div');
  title.innerHTML = `
    <h1 style="font-size: 18px; font-weight: 700; color: #f5f5f5; margin: 0 0 4px 0;">
      148 parameters vs 200,000 neurons
    </h1>
    <p style="font-size: 12px; color: #666; margin: 0 0 20px 0;">
      A tiny neural network learns the same behaviour as the Cortical Labs CL1 DOOM demo. In your browser. In seconds.
    </p>
  `;
  app.appendChild(title);

  // Canvas row
  const canvasRow = document.createElement('div');
  canvasRow.style.cssText = `
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;
  `;
  app.appendChild(canvasRow);

  const arenaCol = document.createElement('div');
  const netCol = document.createElement('div');
  canvasRow.appendChild(arenaCol);
  canvasRow.appendChild(netCol);

  for (const [col, label] of [[arenaCol, 'arena'], [netCol, 'network']] as [HTMLElement, string][]) {
    const lbl = document.createElement('div');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;';
    col.appendChild(lbl);
  }

  const arenaCanvas = createCanvas(arenaCol, 400, 400);
  const netCanvas = createCanvas(netCol, 400, 400);

  // Reward chart
  const chartLabel = document.createElement('div');
  chartLabel.style.cssText = 'font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;';
  chartLabel.textContent = 'training progress';
  app.appendChild(chartLabel);
  const chartCanvas = createCanvas(app, 830, 150);

  // Controls
  const controlsDiv = document.createElement('div');
  controlsDiv.style.cssText = 'margin-top: 12px;';
  app.appendChild(controlsDiv);

  // Annotations
  const annotDiv = document.createElement('div');
  annotDiv.style.cssText = 'margin-top: 12px;';
  app.appendChild(annotDiv);

  // Renderers
  const arenaRenderer = new ArenaRenderer(arenaCanvas);
  const netViz = new NetworkViz(netCanvas);
  const rewardChart = new RewardChart(chartCanvas);
  const annotations = new Annotations(annotDiv);

  const controls = new Controls(controlsDiv, (state) => {
    playing = state.playing;
    speed = state.speed;
    arenaRenderer.theme = state.theme;

    if (state.ablation !== ablation) {
      ablation = state.ablation;
      annotations.showAblation(ablation);
    }

    // Handle snapshot replay
    if (state.snapshotRequest !== null) {
      const snap = snapshots.get(state.snapshotRequest);
      if (snap) {
        replayMode = true;
        replayNetwork = loadSnapshot(snap);
        replayArena = new Arena(777); // different seed so it's a fresh scenario
        currentObs = replayArena.reset();
        episodeActive = true;
        currentTrajectory = { states: [], actions: [], rewards: [], logProbs: [] };
        episodeReward = 0;
        annotations.showReplay(snap.episode);
      }
    } else if (replayMode) {
      // Return to live training
      replayMode = false;
      replayNetwork = null;
      replayArena = null;
      episodeActive = false;
      annotations.clearReplay();
    }
  });

  controlsDiv.addEventListener('reset', () => {
    arena = new Arena(42);
    network = new Network(NET_CONFIG, 123);
    rng = new SeededRNG(999);
    episode = 0;
    totalKills = 0;
    ablation = false;
    episodeActive = false;
    currentObs = null;
    currentTrajectory = null;
    stepAccumulator = 0;
    replayMode = false;
    replayNetwork = null;
    replayArena = null;
    snapshots.clear();
    rewardChart.reset();
    annotations.reset();
    controls.state.ablation = false;
    controls.state.snapshotRequest = null;
    controls.updateSnapshots([]);
  });

  // Save initial snapshot (episode 0)
  saveSnapshot(0, network);
  controls.updateSnapshots([0]);

  // ---- Step-based training loop ----
  function doStep(): void {
    const activeArena = replayMode ? replayArena! : arena;
    const activeNetwork = replayMode ? replayNetwork! : network;

    // Start new episode if needed
    if (!episodeActive) {
      currentObs = activeArena.reset();
      currentTrajectory = { states: [], actions: [], rewards: [], logProbs: [] };
      episodeReward = 0;
      episodeActive = true;
    }

    // Forward pass
    const input = obsToArray(currentObs!);
    const probs = activeNetwork.forward(input);

    let action: number;
    if (ablation) {
      action = Math.floor(rng.next() * 4);
    } else {
      action = sampleFromDistribution(probs, rng.next());
    }

    currentTrajectory!.states.push(input);
    currentTrajectory!.actions.push(action);
    currentTrajectory!.logProbs.push(Math.log(probs[action] + 1e-10));

    const result = activeArena.step(action as Action);
    currentTrajectory!.rewards.push(result.reward);
    episodeReward += result.reward;
    currentObs = result.observation;

    if (result.done) {
      // Episode finished
      if (!replayMode && !ablation) {
        trainer.update(network, currentTrajectory!);
        episode++;
        totalKills += activeArena.state.killCount;
        rewardChart.push(episodeReward);

        const avgReward = rewardChart.getLastSmoothed();
        const killRate = episode > 0 ? totalKills / episode : 0;
        annotations.update(episode, avgReward, killRate);

        // Save snapshot at milestones
        if (SNAPSHOT_EPISODES.includes(episode)) {
          saveSnapshot(episode, network);
          controls.updateSnapshots([...snapshots.keys()].sort((a, b) => a - b));
        }
      }

      episodeActive = false;

      // In replay mode, just restart the episode
      if (replayMode) {
        currentObs = activeArena.reset();
        currentTrajectory = { states: [], actions: [], rewards: [], logProbs: [] };
        episodeReward = 0;
        episodeActive = true;
      }
    }
  }

  // ---- Render loop ----
  let lastTime = 0;
  const BASE_STEP_INTERVAL = 50; // ms per step at 1x speed

  function frame(timestamp: number): void {
    if (lastTime === 0) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (playing) {
      if (speed >= 1) {
        // Fast mode: run multiple steps per frame
        const stepsThisFrame = Math.ceil(speed);
        for (let i = 0; i < stepsThisFrame; i++) {
          doStep();
        }
      } else {
        // Slow mode: accumulate time, step when ready
        stepAccumulator += dt;
        const stepInterval = BASE_STEP_INTERVAL / speed;
        while (stepAccumulator >= stepInterval) {
          stepAccumulator -= stepInterval;
          doStep();
        }
      }
    }

    // Render current state
    const activeArena = replayMode ? replayArena! : arena;
    const activeNetwork = replayMode ? replayNetwork! : network;

    arenaRenderer.render(activeArena.state);
    netViz.render(activeNetwork);
    rewardChart.render();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
