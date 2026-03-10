import { ThemeMode } from '../environment/types';

export interface ControlState {
  playing: boolean;
  speed: number;
  ablation: boolean;
  theme: ThemeMode;
  snapshotRequest: number | null;
}

export type ControlCallback = (state: ControlState) => void;

const SPEEDS: { label: string; value: number }[] = [
  { label: '0.02x', value: 0.02 },
  { label: '0.1x',  value: 0.1 },
  { label: '0.5x',  value: 0.5 },
  { label: '1x',    value: 1 },
  { label: '2x',    value: 2 },
  { label: '5x',    value: 5 },
  { label: '10x',   value: 10 },
  { label: '50x',   value: 50 },
  { label: 'max',   value: 200 },
];
const DEFAULT_SPEED_INDEX = 3; // 1x (which is the old 0.5x)

export class Controls {
  state: ControlState = {
    playing: true,
    speed: SPEEDS[DEFAULT_SPEED_INDEX].value,
    ablation: false,
    theme: 'flower',
    snapshotRequest: null,
  };
  private container: HTMLElement;
  private onChange: ControlCallback;
  private playBtn!: HTMLButtonElement;
  private speedSelect!: HTMLSelectElement;
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

    // Speed dropdown
    this.speedSelect = document.createElement('select');
    this.speedSelect.style.cssText = `
      background: transparent; border: 1px solid #333; color: #999;
      padding: 4px 8px; font-family: inherit; font-size: 11px;
      cursor: pointer; border-radius: 3px;
      appearance: auto; -webkit-appearance: auto;
    `;
    for (let i = 0; i < SPEEDS.length; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = SPEEDS[i].label;
      opt.style.cssText = 'background: #1a1a1a; color: #ccc;';
      if (i === DEFAULT_SPEED_INDEX) opt.selected = true;
      this.speedSelect.appendChild(opt);
    }
    this.speedSelect.onchange = () => {
      const idx = Number(this.speedSelect.value);
      this.state.speed = SPEEDS[idx].value;
      this.onChange(this.state);
    };

    this.ablationBtn = this.makeBtn('ablate: off', () => {
      this.state.ablation = !this.state.ablation;
      this.ablationBtn.textContent = `ablate: ${this.state.ablation ? 'on' : 'off'}`;
      this.ablationBtn.style.borderColor = this.state.ablation ? '#ef4444' : '#333';
      this.ablationBtn.style.color = this.state.ablation ? '#ef4444' : '#999';
      this.onChange(this.state);
    });

    this.themeBtn = this.makeBtn('mode: flower', () => {
      this.state.theme = this.state.theme === 'doom' ? 'flower' : 'doom';
      this.themeBtn.textContent = `mode: ${this.state.theme}`;
      this.themeBtn.style.borderColor = this.state.theme === 'flower' ? '#22c55e' : '#333';
      this.themeBtn.style.color = this.state.theme === 'flower' ? '#22c55e' : '#999';
      this.onChange(this.state);
    });

    const resetBtn = this.makeBtn('reset', () => {
      this.container.dispatchEvent(new CustomEvent('reset'));
    });

    // Apply initial flower theme styling
    this.themeBtn.style.borderColor = '#22c55e';
    this.themeBtn.style.color = '#22c55e';

    row.append(this.playBtn, this.speedSelect, this.ablationBtn, this.themeBtn, resetBtn);

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
        // Set to slow speed for replay (0.5x)
        this.speedSelect.value = '2';
        this.state.speed = SPEEDS[2].value;
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
