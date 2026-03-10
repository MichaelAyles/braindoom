export interface NetworkConfig {
  inputSize: number;
  hiddenSize: number;
  outputSize: number;
}

export interface Trajectory {
  states: number[][];
  actions: number[];
  rewards: number[];
  logProbs: number[];
}
