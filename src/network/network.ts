import { NetworkConfig } from './types';
import { tanh, softmax } from '../utils/math';
import { SeededRNG } from '../utils/random';

export class Network {
  readonly config: NetworkConfig;

  // Layer 1: input → hidden
  weightsIH: number[][];
  biasH: number[];

  // Layer 2: hidden → output
  weightsHO: number[][];
  biasO: number[];

  // Cached activations for visualization
  lastHidden: number[] = [];
  lastOutput: number[] = [];

  constructor(config: NetworkConfig, seed = 123) {
    this.config = config;
    const rng = new SeededRNG(seed);

    // Xavier init
    const scaleIH = Math.sqrt(2 / (config.inputSize + config.hiddenSize));
    const scaleHO = Math.sqrt(2 / (config.hiddenSize + config.outputSize));

    this.weightsIH = Array.from({ length: config.hiddenSize }, () =>
      Array.from({ length: config.inputSize }, () => rng.uniform(-scaleIH, scaleIH))
    );
    this.biasH = new Array(config.hiddenSize).fill(0);

    this.weightsHO = Array.from({ length: config.outputSize }, () =>
      Array.from({ length: config.hiddenSize }, () => rng.uniform(-scaleHO, scaleHO))
    );
    this.biasO = new Array(config.outputSize).fill(0);
  }

  forward(input: number[]): number[] {
    // Hidden layer: tanh activation
    const hidden = new Array(this.config.hiddenSize);
    for (let j = 0; j < this.config.hiddenSize; j++) {
      let sum = this.biasH[j];
      for (let i = 0; i < this.config.inputSize; i++) {
        sum += this.weightsIH[j][i] * input[i];
      }
      hidden[j] = tanh(sum);
    }
    this.lastHidden = hidden;

    // Output layer: linear (softmax applied separately)
    const logits = new Array(this.config.outputSize);
    for (let k = 0; k < this.config.outputSize; k++) {
      let sum = this.biasO[k];
      for (let j = 0; j < this.config.hiddenSize; j++) {
        sum += this.weightsHO[k][j] * hidden[j];
      }
      logits[k] = sum;
    }

    this.lastOutput = softmax(logits);
    return this.lastOutput;
  }

  paramCount(): number {
    const { inputSize, hiddenSize, outputSize } = this.config;
    return (inputSize * hiddenSize + hiddenSize) + (hiddenSize * outputSize + outputSize);
  }

  // Get flat array of all weights for visualization
  getAllWeights(): number[] {
    const weights: number[] = [];
    for (const row of this.weightsIH) weights.push(...row);
    weights.push(...this.biasH);
    for (const row of this.weightsHO) weights.push(...row);
    weights.push(...this.biasO);
    return weights;
  }
}
