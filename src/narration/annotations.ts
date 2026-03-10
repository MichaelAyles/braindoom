import { ThemeMode } from '../environment/types';

interface Milestone {
  trigger: (episode: number, avgReward: number, killRate: number) => boolean;
  text: (theme: ThemeMode) => string;
  fired: boolean;
}

export class Annotations {
  private container: HTMLElement;
  private milestones: Milestone[];
  private inReplay = false;
  theme: ThemeMode = 'doom';

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.style.cssText = `
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 12px; color: #999; line-height: 1.6;
      min-height: 40px; padding: 0;
    `;

    this.milestones = [
      {
        trigger: (ep) => ep === 1,
        text: () => 'Episode 1. Weights are random, actions are random. This is the starting condition, equivalent to the CL1 ablation baseline where decoder output is randomised.',
        fired: false,
      },
      {
        trigger: (ep, avg) => ep >= 5 && avg > -15,
        text: (t) => t === 'flower'
          ? 'The angle-to-turn weights are differentiating. The network is learning "if flower is left, turn left." The CL1 neurons took days of continuous stimulation to reach this point.'
          : 'The angle-to-turn weights are differentiating. The network is learning "if enemy is left, turn left." The CL1 neurons took days of continuous stimulation to reach this point.',
        fired: false,
      },
      {
        trigger: (ep, avg) => ep >= 15 && avg > -5,
        text: (t) => t === 'flower'
          ? 'Orientation is reliable now. The gardener turns toward the flower consistently. Watch the connections from "angle" to "left" and "right" in the network diagram.'
          : 'Orientation is reliable now. The agent turns toward the enemy consistently. Watch the connections from "angle" to "left" and "right" in the network diagram.',
        fired: false,
      },
      {
        trigger: (ep, _avg, killRate) => ep >= 10 && killRate > 0.5,
        text: (t) => t === 'flower'
          ? 'The spray weights are engaging. The gardener is learning when to water. 132 parameters, a few seconds of compute.'
          : 'The shoot weights are engaging. The agent is learning when to fire. 132 parameters, a few seconds of compute.',
        fired: false,
      },
      {
        trigger: (ep, avg) => ep >= 30 && avg > 0,
        text: (t) => t === 'flower'
          ? 'Full behaviour acquired. Turn toward flower, spray when aimed. This is the same capability the CL1 demo shows, reproduced with a network you can see through entirely.'
          : 'Full behaviour acquired. Turn toward target, shoot when aimed. This is the same capability the CL1 demo shows, reproduced with a network you can see through entirely.',
        fired: false,
      },
      {
        trigger: (ep, avg) => ep >= 100 && avg > 5,
        text: (t) => t === 'flower'
          ? 'The network is efficient now. It rarely misses a flower. Try the ablation toggle to see what happens when the weights are bypassed.'
          : 'The network is efficient now. It rarely misses. Try the ablation toggle to see what happens when the weights are bypassed.',
        fired: false,
      },
    ];
  }

  update(episode: number, avgReward: number, killRate: number): void {
    if (this.inReplay) return;
    for (const m of this.milestones) {
      if (!m.fired && m.trigger(episode, avgReward, killRate)) {
        m.fired = true;
        this.show(m.text(this.theme));
      }
    }
  }

  showAblation(on: boolean): void {
    if (on) {
      this.show(
        'Ablation active. The network output is replaced with uniform random actions. ' +
        'Performance drops to chance immediately. This is the same test Cortical Labs use ' +
        'to prove the neurons contribute. It proves the same thing here: the weights matter.'
      );
    } else {
      this.show('Ablation off. Trained network restored. Performance returns immediately.');
    }
  }

  showReplay(episode: number): void {
    this.inReplay = true;
    if (episode === 0) {
      this.show(
        `Replaying episode 0 weights. The network hasn't learned anything yet. ` +
        `Actions are effectively random. This is the "blank slate", equivalent to ` +
        `what the CL1 biological neurons look like before conditioning.`
      );
    } else {
      this.show(
        `Replaying with weights from episode ${episode}. ` +
        `Watch how the behaviour differs from earlier snapshots. ` +
        `The same 132 parameters, just different values.`
      );
    }
  }

  clearReplay(): void {
    this.inReplay = false;
    this.show('Back to live training.');
  }

  reset(): void {
    for (const m of this.milestones) m.fired = false;
    this.inReplay = false;
    this.container.textContent = '';
  }

  private show(text: string): void {
    this.container.textContent = text;
    this.container.style.opacity = '0';
    requestAnimationFrame(() => {
      this.container.style.transition = 'opacity 0.4s';
      this.container.style.opacity = '1';
    });
  }
}
