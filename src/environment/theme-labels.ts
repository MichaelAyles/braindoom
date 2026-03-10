import { ThemeMode } from './types';

export interface ThemeLabels {
  agent: string;
  enemy: string;
  kill: string;
  kills: string;
  killVerb: string;   // "killed" / "wilted"
  ammo: string;
  shoot: string;
  hp: string;
  killsPerEp: string;
}

const LABELS: Record<ThemeMode, ThemeLabels> = {
  doom: {
    agent: 'agent',
    enemy: 'enemy',
    kill: 'kill',
    kills: 'kills',
    killVerb: 'killed',
    ammo: 'ammo',
    shoot: 'shoot',
    hp: 'hp',
    killsPerEp: 'kills/ep',
  },
  flower: {
    agent: 'gardener',
    enemy: 'flower',
    kill: 'water',
    kills: 'watered',
    killVerb: 'wilted',
    ammo: 'water',
    shoot: 'spray',
    hp: 'energy',
    killsPerEp: 'watered/ep',
  },
};

export function getLabels(theme: ThemeMode): ThemeLabels {
  return LABELS[theme];
}
