import { Network } from './network';
import { Trajectory } from './types';
import { softmax } from '../utils/math';

export class Trainer {
  private lr: number;
  private gamma: number;
  private entropyCoef: number;

  constructor(lr = 0.01, gamma = 0.99, entropyCoef = 0.05) {
    this.lr = lr;
    this.gamma = gamma;
    this.entropyCoef = entropyCoef;
  }

  update(network: Network, trajectory: Trajectory): number {
    const { states, actions, rewards } = trajectory;
    const T = rewards.length;
    if (T === 0) return 0;

    // Compute discounted returns
    const returns = new Array(T);
    let G = 0;
    for (let t = T - 1; t >= 0; t--) {
      G = rewards[t] + this.gamma * G;
      returns[t] = G;
    }

    // Baseline subtraction (mean return)
    const meanReturn = returns.reduce((a: number, b: number) => a + b, 0) / T;
    const advantages = returns.map((r: number) => r - meanReturn);

    // REINFORCE: for each timestep, nudge weights to increase prob of good actions
    for (let t = 0; t < T; t++) {
      const input = states[t];
      const action = actions[t];
      const advantage = advantages[t];

      // Forward pass to get activations
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

      // Policy gradient: d_logit[k] = (indicator(k == action) - prob[k]) * advantage
      // Plus entropy bonus: encourages exploration by pushing toward uniform distribution
      const dLogits = probs.map((p: number, k: number) => {
        const policyGrad = ((k === action ? 1 : 0) - p) * advantage;
        // Entropy gradient for softmax: -d/d_logit(sum p*log(p)) = p*(1-p)*log(p) + ...
        // Simplified: push toward uniform by penalizing confident predictions
        const entropyGrad = -p * (Math.log(p + 1e-10) + 1);
        return policyGrad + this.entropyCoef * entropyGrad;
      });

      // Update output weights and biases
      for (let k = 0; k < network.config.outputSize; k++) {
        for (let j = 0; j < network.config.hiddenSize; j++) {
          network.weightsHO[k][j] += this.lr * dLogits[k] * hidden[j];
        }
        network.biasO[k] += this.lr * dLogits[k];
      }

      // Backprop through hidden layer
      for (let j = 0; j < network.config.hiddenSize; j++) {
        let dHidden = 0;
        for (let k = 0; k < network.config.outputSize; k++) {
          dHidden += dLogits[k] * network.weightsHO[k][j];
        }
        // tanh derivative: 1 - tanh^2
        const tanhDeriv = 1 - hidden[j] * hidden[j];
        dHidden *= tanhDeriv;

        for (let i = 0; i < network.config.inputSize; i++) {
          network.weightsIH[j][i] += this.lr * dHidden * input[i];
        }
        network.biasH[j] += this.lr * dHidden;
      }
    }

    return meanReturn;
  }
}
