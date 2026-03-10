import { Network } from './network';
import { Trajectory } from './types';
import { softmax } from '../utils/math';

export class Trainer {
  private lr: number;
  private gamma: number;
  private entropyCoef: number;
  private batch: Trajectory[] = [];
  private batchSize: number;

  constructor(lr = 0.01, gamma = 0.99, entropyCoef = 0.03, batchSize = 8) {
    this.lr = lr;
    this.gamma = gamma;
    this.entropyCoef = entropyCoef;
    this.batchSize = batchSize;
  }

  // Queue a trajectory. Returns true if batch is full and weights were updated.
  addTrajectory(network: Network, trajectory: Trajectory): boolean {
    this.batch.push(trajectory);
    if (this.batch.length >= this.batchSize) {
      this.updateBatch(network);
      this.batch = [];
      return true;
    }
    return false;
  }

  private updateBatch(network: Network): void {
    // Collect all timesteps from all episodes in the batch
    const allStates: number[][] = [];
    const allActions: number[] = [];
    const allAdvantages: number[] = [];

    for (const traj of this.batch) {
      const T = traj.rewards.length;
      if (T === 0) continue;

      // Compute discounted returns for this episode
      const returns = new Array(T);
      let G = 0;
      for (let t = T - 1; t >= 0; t--) {
        G = traj.rewards[t] + this.gamma * G;
        returns[t] = G;
      }

      for (let t = 0; t < T; t++) {
        allStates.push(traj.states[t]);
        allActions.push(traj.actions[t]);
        allAdvantages.push(returns[t]);
      }
    }

    if (allAdvantages.length === 0) return;

    // Normalise advantages across the whole batch (zero mean, unit variance)
    const mean = allAdvantages.reduce((a, b) => a + b, 0) / allAdvantages.length;
    let variance = 0;
    for (const a of allAdvantages) variance += (a - mean) * (a - mean);
    variance /= allAdvantages.length;
    const std = Math.sqrt(variance + 1e-8);
    for (let i = 0; i < allAdvantages.length; i++) {
      allAdvantages[i] = (allAdvantages[i] - mean) / std;
    }

    // Single gradient step over all timesteps in the batch
    for (let t = 0; t < allStates.length; t++) {
      const input = allStates[t];
      const action = allActions[t];
      const advantage = allAdvantages[t];

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
      const probs = softmax(logits);

      // Policy gradient + entropy bonus
      const dLogits = probs.map((p: number, k: number) => {
        const policyGrad = ((k === action ? 1 : 0) - p) * advantage;
        const entropyGrad = -p * (Math.log(p + 1e-10) + 1);
        return policyGrad + this.entropyCoef * entropyGrad;
      });

      // Scale learning rate by batch size so effective LR is consistent
      const lr = this.lr / this.batch.length;

      // Update output weights and biases
      for (let k = 0; k < network.config.outputSize; k++) {
        for (let j = 0; j < network.config.hiddenSize; j++) {
          network.weightsHO[k][j] += lr * dLogits[k] * hidden[j];
        }
        network.biasO[k] += lr * dLogits[k];
      }

      // Backprop through hidden layer
      for (let j = 0; j < network.config.hiddenSize; j++) {
        let dHidden = 0;
        for (let k = 0; k < network.config.outputSize; k++) {
          dHidden += dLogits[k] * network.weightsHO[k][j];
        }
        const tanhDeriv = 1 - hidden[j] * hidden[j];
        dHidden *= tanhDeriv;

        for (let i = 0; i < network.config.inputSize; i++) {
          network.weightsIH[j][i] += lr * dHidden * input[i];
        }
        network.biasH[j] += lr * dHidden;
      }
    }
  }
}
