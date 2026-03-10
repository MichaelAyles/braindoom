import { ThemeMode } from '../environment/types';

export interface LogEntry {
  episode: number;
  reward: number;
  kills: number;
  steps: number;
  avgPeakHP: number;
  avgPeakAmmo: number;
  avgSteps: number;
  actionsL: number;
  actionsR: number;
  actionsS: number;
  actionsF: number;
  probs: number[];
}

interface Column {
  key: keyof LogEntry | 'probs_fmt';
  label: (theme: ThemeMode) => string;
  fmt: (e: LogEntry) => string;
}

const COLUMNS: Column[] = [
  { key: 'episode', label: () => 'ep', fmt: e => String(e.episode) },
  { key: 'reward', label: () => 'reward', fmt: e => e.reward.toFixed(1) },
  { key: 'kills', label: t => t === 'flower' ? 'watered' : 'kills', fmt: e => String(e.kills) },
  { key: 'steps', label: () => 'steps', fmt: e => String(e.steps) },
  { key: 'avgPeakHP', label: t => t === 'flower' ? 'avg50 energy' : 'avg50 HP', fmt: e => e.avgPeakHP.toFixed(0) },
  { key: 'avgPeakAmmo', label: t => t === 'flower' ? 'avg50 water' : 'avg50 ammo', fmt: e => e.avgPeakAmmo.toFixed(1) },
  { key: 'avgSteps', label: () => 'avg50 steps', fmt: e => e.avgSteps.toFixed(0) },
  { key: 'actionsL', label: () => 'L%', fmt: e => e.actionsL + '%' },
  { key: 'actionsR', label: () => 'R%', fmt: e => e.actionsR + '%' },
  { key: 'actionsS', label: () => 'S%', fmt: e => e.actionsS + '%' },
  { key: 'actionsF', label: () => 'F%', fmt: e => e.actionsF + '%' },
  { key: 'probs_fmt', label: () => 'probs', fmt: e => e.probs.map(p => p.toFixed(2)).join(', ') },
];

const CSV_HEADERS = 'episode,reward,kills,steps,avgPeakHP,avgPeakAmmo,avgSteps,L%,R%,S%,F%,probL,probR,probS,probF';

export class TrainingLog {
  private container: HTMLElement;
  private tbody: HTMLTableSectionElement;
  private headerCells: HTMLTableCellElement[] = [];
  private entries: LogEntry[] = [];
  private copyBtn: HTMLButtonElement;
  private csvBtn: HTMLButtonElement;
  private _theme: ThemeMode = 'doom';

  get theme(): ThemeMode { return this._theme; }
  set theme(t: ThemeMode) {
    this._theme = t;
    this.updateHeaders();
  }

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = 'margin-top: 16px;';

    // Header row
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;';

    const label = document.createElement('div');
    label.textContent = 'training log';
    label.style.cssText = 'font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.05em;';
    header.appendChild(label);

    this.copyBtn = this.makeButton('copy jsonl');
    this.copyBtn.addEventListener('click', () => this.copyJSONL());
    header.appendChild(this.copyBtn);

    this.csvBtn = this.makeButton('export csv');
    this.csvBtn.addEventListener('click', () => this.exportCSV());
    header.appendChild(this.csvBtn);

    this.container.appendChild(header);

    // Table wrapper (scrollable)
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      max-height: 260px; overflow-y: auto; overflow-x: auto;
      border: 1px solid #222; border-radius: 4px; background: #0d0d0d;
    `;

    const table = document.createElement('table');
    table.style.cssText = `
      width: 100%; border-collapse: collapse; font-size: 10px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    `;

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const col of COLUMNS) {
      const th = document.createElement('th');
      th.textContent = col.label(this._theme);
      th.style.cssText = `
        padding: 4px 6px; text-align: right; color: #666;
        border-bottom: 1px solid #222; position: sticky; top: 0;
        background: #0d0d0d; white-space: nowrap;
      `;
      headRow.appendChild(th);
      this.headerCells.push(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    this.tbody = document.createElement('tbody');
    table.appendChild(this.tbody);

    wrapper.appendChild(table);
    this.container.appendChild(wrapper);
    parent.appendChild(this.container);
  }

  private updateHeaders(): void {
    for (let i = 0; i < COLUMNS.length; i++) {
      this.headerCells[i].textContent = COLUMNS[i].label(this._theme);
    }
  }

  private makeButton(text: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      font-size: 9px; padding: 2px 8px; border-radius: 3px;
      border: 1px solid #333; background: #1a1a1a; color: #888;
      cursor: pointer; font-family: inherit;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#555'; btn.style.color = '#ccc'; });
    btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#333'; btn.style.color = '#888'; });
    return btn;
  }

  push(entry: LogEntry): void {
    this.entries.push(entry);

    const tr = document.createElement('tr');
    const isGood = entry.kills >= 3;
    for (const col of COLUMNS) {
      const td = document.createElement('td');
      td.textContent = col.fmt(entry);
      td.style.cssText = `
        padding: 3px 6px; text-align: right; white-space: nowrap;
        border-bottom: 1px solid #1a1a1a;
        color: ${isGood ? '#22c55e' : entry.kills > 0 ? '#f59e0b' : '#555'};
      `;
      tr.appendChild(td);
    }
    this.tbody.appendChild(tr);

    // Auto-scroll to bottom
    const wrapper = this.tbody.parentElement!.parentElement!;
    wrapper.scrollTop = wrapper.scrollHeight;
  }

  reset(): void {
    this.entries = [];
    this.tbody.innerHTML = '';
  }

  private copyJSONL(): void {
    const jsonl = this.entries.map(e => JSON.stringify(e)).join('\n');
    navigator.clipboard.writeText(jsonl).then(() => {
      this.flashButton(this.copyBtn, 'copied!');
    });
  }

  private exportCSV(): void {
    const rows = [CSV_HEADERS];
    for (const e of this.entries) {
      rows.push([
        e.episode, e.reward.toFixed(1), e.kills, e.steps,
        e.avgPeakHP.toFixed(0), e.avgPeakAmmo.toFixed(1),
        e.avgSteps.toFixed(0), e.actionsL, e.actionsR, e.actionsS, e.actionsF,
        ...e.probs.map(p => p.toFixed(4)),
      ].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `braindoom-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.flashButton(this.csvBtn, 'saved!');
  }

  private flashButton(btn: HTMLButtonElement, msg: string): void {
    const orig = btn.textContent;
    btn.textContent = msg;
    btn.style.color = '#22c55e';
    setTimeout(() => { btn.textContent = orig; btn.style.color = '#888'; }, 1500);
  }
}
