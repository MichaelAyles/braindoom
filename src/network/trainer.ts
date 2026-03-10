import { Network } from './network';
import { Trajectory } from './types';
import { softmaxFloored } from '../utils/math';

export class Trainer {
  private lr: number;
  private lrMin: number;
  private lrDecayRate: number;
  private gamma: number;
  private entropyCoef: number;
  private batch: Trajectory[] = [];
  private batchSize: number;
  private clipEpsilon: number;
  private numEpochs: number;
  private updateCount = 0;
  private frozen = false;

  // Running baseline
  private baselineMean = 0;
  private baselineCount = 0;

  // Best performance tracking
  private recentReturns: number[] = [];
  private bestAvgReturn = -Infinity;
  private bestWeights: { weightsIH: number[][]; biasH: number[]; weightsHO: number[][]; biasO: number[] } | null = null;
  private declineBatches = 0;

  constructor(
    lr = 0.008,
    gamma = 0.97,
    entropyCoef = 0.02,
    batchSize = 16,
    clipEpsilon = 0.2,
    numEpochs = 2,
    lrMin = 0.003,
    lrDecayRate = 0.997,
  ) {
    this.lr = lr;
    this.lrMin = lrMin;
    this.lrDecayRate = lrDecayRate;
    this.gamma = gamma;
    this.entropyCoef = entropyCoef;
    this.batchSize = batchSize;
    this.clipEpsilon = clipEpsilon;
    this.numEpochs = numEpochs;
  }

  addTrajectory(network: Network, trajectory: Trajectory): boolean {
    // Track returns for best-checkpoint
    const T = trajectory.rewards.length;
    if (T > 0) {
      let G = 0;
      for (let t = T - 1; t >= 0; t--) G = trajectory.rewards[t] + this.gamma * G;
      this.recentReturns.push(G);
      if (this.recentReturns.length > 50) this.recentReturns.shift();
    }

    if (this.frozen) return false;

    this.batch.push(trajectory);
    if (this.batch.length >= this.batchSize) {
      this.updateBatch(network);
      this.batch = [];
      this.updateCount++;
      // Decay LR after each batch update
      this.lr = Math.max(this.lrMin, this.lr * this.lrDecayRate);

      // Check if we should save best weights or freeze (wait for warmup)
      if (this.recentReturns.length >= 50 && this.updateCount >= 150) {
        const avgReturn = this.recentReturns.reduce((a, b) => a + b, 0) / this.recentReturns.length;
        if (avgReturn > this.bestAvgReturn) {
          this.bestAvgReturn = avgReturn;
          this.bestWeights = {
            weightsIH: network.weightsIH.map(r => [...r]),
            biasH: [...network.biasH],
            weightsHO: network.weightsHO.map(r => [...r]),
            biasO: [...network.biasO],
          };
          this.declineBatches = 0;
        } else if (avgReturn < this.bestAvgReturn * 0.5) {
          // Performance dropped to less than half of best — restore and freeze
          this.declineBatches++;
          if (this.declineBatches >= 5 && this.bestWeights) {
            network.weightsIH = this.bestWeights.weightsIH.map(r => [...r]);
            network.biasH = [...this.bestWeights.biasH];
            network.weightsHO = this.bestWeights.weightsHO.map(r => [...r]);
            network.biasO = [...this.bestWeights.biasO];
            this.frozen = true;
          }
        } else {
          this.declineBatches = 0;
        }
      }

      return true;
    }
    return false;
  }

  private updateBatch(network: Network): void {
    // Collect all timesteps with augmentation
    const allStates: number[][] = [];
    const allActions: number[] = [];
    const allAdvantages: number[] = [];
    const allOldLogProbs: number[] = [];

    const rawReturns: number[] = [];

    for (const traj of this.batch) {
      const T = traj.rewards.length;
      if (T === 0) continue;

      // Discounted returns
      const returns = new Array(T);
      let G = 0;
      for (let t = T - 1; t >= 0; t--) {
        G = traj.rewards[t] + this.gamma * G;
        returns[t] = G;
      }

      for (let t = 0; t < T; t++) {
        // Original data
        allStates.push(traj.states[t]);
        allActions.push(traj.actions[t]);
        rawReturns.push(returns[t]);
        allOldLogProbs.push(traj.logProbs[t]);

        // Symmetric mirror: flip angle, swap left/right
        allStates.push([-traj.states[t][0], traj.states[t][1], traj.states[t][2]]);
        allActions.push(traj.actions[t] === 0 ? 1 : traj.actions[t] === 1 ? 0 : traj.actions[t]);
        rawReturns.push(returns[t]);
        // For mirrored data, compute old log prob from current network
        // (ratio will start at 1.0, so PPO doesn't clip initially)
        allOldLogProbs.push(NaN); // sentinel: skip PPO clip for augmented data
      }
    }

    if (rawReturns.length === 0) return;

    // Update running baseline
    for (const r of rawReturns) {
      this.baselineCount++;
      const alpha = Math.max(0.005, 1 / this.baselineCount);
      this.baselineMean += alpha * (r - this.baselineMean);
    }

    // Normalize advantages
    for (let i = 0; i < rawReturns.length; i++) {
      allAdvantages.push(rawReturns[i] - this.baselineMean);
    }
    const mean = allAdvantages.reduce((a, b) => a + b, 0) / allAdvantages.length;
    let variance = 0;
    for (const a of allAdvantages) variance += (a - mean) * (a - mean);
    variance /= allAdvantages.length;
    const std = Math.sqrt(variance + 1e-8);
    for (let i = 0; i < allAdvantages.length; i++) {
      allAdvantages[i] = (allAdvantages[i] - mean) / std;
    }

    // Per-timestep learning rate (like original REINFORCE)
    const lr = this.lr / this.batch.length;

    // Multiple PPO epochs
    for (let epoch = 0; epoch < this.numEpochs; epoch++) {
      for (let t = 0; t < allStates.length; t++) {
        const input = allStates[t];
        const action = allActions[t];
        const advantage = allAdvantages[t];
        const oldLogProb = allOldLogProbs[t];

        // Forward pass
        const hidden = new Array(network.config.hiddenSize);
        for (let j = 0; j < network.config.hiddenSize; j++) {
          let sum = network.biasH[j];
          for (let i = 0; i < network.config.inputSize; i++) {
            sum += network.weightsIH[j][i] * input[i];
          }
          hidden[j] = Math.tanh(sum);
        }
        const logits = new Array(network.config.outputSize);
        for (let k = 0; k < network.config.outputSize; k++) {
          let sum = network.biasO[k];
          for (let j = 0; j < network.config.hiddenSize; j++) {
            sum += network.weightsHO[k][j] * hidden[j];
          }
          logits[k] = sum;
        }
        const probs = softmaxFloored(logits);

        // PPO clipping (skip for augmented data where oldLogProb is NaN)
        if (!isNaN(oldLogProb)) {
          const newLogProb = Math.log(probs[action] + 1e-10);
          const ratio = Math.exp(newLogProb - oldLogProb);
          if (advantage > 0 && ratio > 1 + this.clipEpsilon) continue;
          if (advantage < 0 && ratio < 1 - this.clipEpsilon) continue;
        }

        // Policy gradient + entropy bonus
        const dLogits = new Array(network.config.outputSize);
        for (let k = 0; k < network.config.outputSize; k++) {
          const policyGrad = ((k === action ? 1 : 0) - probs[k]) * advantage;
          const entropyGrad = -probs[k] * (Math.log(probs[k] + 1e-10) + 1);
          dLogits[k] = policyGrad + this.entropyCoef * entropyGrad;
          // Clip individual gradient components to prevent explosions
          dLogits[k] = Math.max(-2, Math.min(2, dLogits[k]));
        }

        // Update weights (per-timestep, like original)
        for (let k = 0; k < network.config.outputSize; k++) {
          for (let j = 0; j < network.config.hiddenSize; j++) {
            network.weightsHO[k][j] += lr * dLogits[k] * hidden[j];
          }
          network.biasO[k] += lr * dLogits[k];
        }

        // Backprop through hidden
        for (let j = 0; j < network.config.hiddenSize; j++) {
          let dHidden = 0;
          for (let k = 0; k < network.config.outputSize; k++) {
            dHidden += dLogits[k] * network.weightsHO[k][j];
          }
          dHidden *= (1 - hidden[j] * hidden[j]);
          dHidden = Math.max(-2, Math.min(2, dHidden)); // clip

          for (let i = 0; i < network.config.inputSize; i++) {
            network.weightsIH[j][i] += lr * dHidden * input[i];
          }
          network.biasH[j] += lr * dHidden;
        }
      }
    }
  }
}
