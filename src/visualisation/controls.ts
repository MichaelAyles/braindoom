import { ThemeMode } from '../environment/types';

export interface ControlState {
  playing: boolean;
  speed: number;
  ablation: boolean;
  theme: ThemeMode;
  snapshotRequest: number | null; // episode number to replay, or null
}

export type ControlCallback = (state: ControlState) => void;

const SPEEDS = [0.01, 0.1, 0.5, 1, 5, 20, 100];

export class Controls {
  state: ControlState = {
    playing: true,
    speed: 1,
    ablation: false,
    theme: 'doom',
    snapshotRequest: null,
  };
  private container: HTMLElement;
  private onChange: ControlCallback;
  private speedIndex = 3; // starts at 1x
  private playBtn!: HTMLButtonElement;
  private speedBtn!: HTMLButtonElement;
  private ablationBtn!: HTMLButtonElement;
  private themeBtn!: HTMLButtonElement;
  private snapshotBar!: HTMLElement;
  private snapshotBtns: HTMLButtonElement[] = [];
  private availableSnapshots: number[] = [];

  constructor(container: HTMLElement, onChange: ControlCallback) {
    this.container = container;
    this.onChange = onChange;
    this.build();
  }

  updateSnapshots(episodes: number[]): void {
    this.availableSnapshots = episodes;
    this.rebuildSnapshotBar();
  }

  private build(): void {
    this.container.innerHTML = '';
    this.container.style.cssText = `
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    `;

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 8px; align-items: center; flex-wrap: wrap;';
    this.container.appendChild(row);

    this.playBtn = this.makeBtn('pause', () => {
      this.state.playing = !this.state.playing;
      this.playBtn.textContent = this.state.playing ? 'pause' : 'play';
      this.onChange(this.state);
    });

    this.speedBtn = this.makeBtn('speed: 1x', () => {
      this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
      this.state.speed = SPEEDS[this.speedIndex];
      this.speedBtn.textContent = `speed: ${this.state.speed}x`;
      this.onChange(this.state);
    });

    this.ablationBtn = this.makeBtn('ablate: off', () => {
      this.state.ablation = !this.state.ablation;
      this.ablationBtn.textContent = `ablate: ${this.state.ablation ? 'on' : 'off'}`;
      this.ablationBtn.style.borderColor = this.state.ablation ? '#ef4444' : '#333';
      this.ablationBtn.style.color = this.state.ablation ? '#ef4444' : '#999';
      this.onChange(this.state);
    });

    this.themeBtn = this.makeBtn('mode: doom', () => {
      this.state.theme = this.state.theme === 'doom' ? 'flower' : 'doom';
      this.themeBtn.textContent = `mode: ${this.state.theme}`;
      this.themeBtn.style.borderColor = this.state.theme === 'flower' ? '#22c55e' : '#333';
      this.themeBtn.style.color = this.state.theme === 'flower' ? '#22c55e' : '#999';
      this.onChange(this.state);
    });

    const resetBtn = this.makeBtn('reset', () => {
      this.container.dispatchEvent(new CustomEvent('reset'));
    });

    row.append(this.playBtn, this.speedBtn, this.ablationBtn, this.themeBtn, resetBtn);

    // Snapshot replay bar
    this.snapshotBar = document.createElement('div');
    this.snapshotBar.style.cssText = `
      display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
      margin-top: 8px;
    `;
    this.container.appendChild(this.snapshotBar);
  }

  private rebuildSnapshotBar(): void {
    this.snapshotBar.innerHTML = '';
    this.snapshotBtns = [];

    if (this.availableSnapshots.length === 0) return;

    const label = document.createElement('span');
    label.textContent = 'replay:';
    label.style.cssText = 'font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.05em;';
    this.snapshotBar.appendChild(label);

    // "live" button to return to training
    const liveBtn = this.makeBtn('live', () => {
      this.state.snapshotRequest = null;
      this.highlightSnapshotBtn(null);
      this.onChange(this.state);
    });
    liveBtn.style.fontSize = '10px';
    liveBtn.style.padding = '2px 8px';
    this.snapshotBar.appendChild(liveBtn);

    for (const ep of this.availableSnapshots) {
      const btn = this.makeBtn(`ep ${ep}`, () => {
        this.state.snapshotRequest = ep;
        this.state.playing = true;
        this.playBtn.textContent = 'pause';
        // Set slow speed for replay
        this.speedIndex = 0;
        this.state.speed = SPEEDS[0];
        this.speedBtn.textContent = `speed: ${this.state.speed}x`;
        this.highlightSnapshotBtn(ep);
        this.onChange(this.state);
      });
      btn.style.fontSize = '10px';
      btn.style.padding = '2px 8px';
      btn.dataset.ep = String(ep);
      this.snapshotBtns.push(btn);
      this.snapshotBar.appendChild(btn);
    }
  }

  private highlightSnapshotBtn(ep: number | null): void {
    for (const btn of this.snapshotBtns) {
      const isActive = ep !== null && btn.dataset.ep === String(ep);
      btn.style.borderColor = isActive ? '#f97316' : '#333';
      btn.style.color = isActive ? '#f97316' : '#999';
    }
  }

  private makeBtn(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = onClick;
    btn.style.cssText = `
      background: transparent; border: 1px solid #333; color: #999;
      padding: 4px 12px; font-family: inherit; font-size: 11px;
      cursor: pointer; border-radius: 3px; transition: border-color 0.2s, color 0.2s;
    `;
    btn.onmouseenter = () => { btn.style.borderColor = '#666'; btn.style.color = '#ccc'; };
    btn.onmouseleave = () => {
      if (btn === this.ablationBtn && this.state.ablation) return;
      if (btn === this.themeBtn && this.state.theme === 'flower') return;
      const isActiveSnapshot = btn.dataset.ep && this.state.snapshotRequest === Number(btn.dataset.ep);
      if (isActiveSnapshot) return;
      btn.style.borderColor = '#333';
      btn.style.color = '#999';
    };
    return btn;
  }
}
