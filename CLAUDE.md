# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"It's Just Weights" — an interactive blog post demystifying the Cortical Labs CL1 "brain cells play DOOM" demo. Reproduces the behaviour with a 132-parameter neural network training live in the browser. Ships as a standalone interactive page (vanilla TS + Canvas 2D) and an accompanying MDX blog post.

## Build & Dev Commands

```bash
npm install          # install dependencies
npm run dev          # start Vite dev server
npm run build        # production build → dist/
npm run preview      # preview production build locally
```

## Architecture

**No frameworks, no ML libraries.** The neural network is hand-rolled (~150 lines). The demo is a tight requestAnimationFrame render loop, not a React app.

### Key modules (under src/)

- **environment/** — simplified DOOM-like top-down arena. Agent rotates, faces enemies, shoots. Observation space: 3 floats (enemy_angle, enemy_distance, enemy_visible). Action space: 4 discrete (turn left, turn right, shoot, move forward).
- **network/** — feedforward network `Input(3) → Dense(16, tanh) → Dense(4, softmax)`. REINFORCE policy gradient trainer (no backprop, trajectory-based updates).
- **visualisation/** — Canvas 2D renderers: arena view, real-time weight heatmap/node-link diagram, rolling reward chart, play/pause/speed/ablation controls.
- **narration/** — milestone-triggered text annotations that explain what the network is learning.
- **utils/** — activation functions, softmax, seeded PRNG.
- **main.ts** — entry point, wires everything together.

### Blog (under blog/)

MDX post with embedded/linked demo. SVG diagrams for CL1 architecture and gym analogy.

## Tech Stack

- Vite + TypeScript
- Canvas 2D (no Three.js)
- No React, no ML libraries
- MDX for blog post

## CL1 Reference (from github.com/SeanCole02/doom-neuron)

The real CL1 pipeline: PPO encoder (CNN+MLP, 128-dim hidden) → 8 Beta-distributed stim channels (freq 4-40Hz, amp 1-2.5uA) → 64-channel MEA with ~200k biological neurons → 8 spike count groups → linear decoder (zero-bias, softplus weights) → factored action space (forward 3-way, strafe 3-way, camera 3-way, attack binary). Our demo simplifies this to the essential signal path: observation → tiny network → action. The ablation mode matches CL1's `decoder_ablation_mode='random'`.

## Blog Integration

The blog at michaelayles-github-io is Astro + MDX + React. Blog posts live in `src/content/blog/<slug>/index.mdx` with frontmatter: title, description, date, tags, draft, project. Interactive components are JSX in `src/components/blog/`, imported into MDX with `client:visible` hydration. Components use CSS vars (`--background`, `--surface`, `--border`, `--text-primary`, `--text-secondary`, `--text-dim`) and monospace font `'JetBrains Mono', 'Fira Code', 'SF Mono', monospace`. No external chart libs required for canvas-based work.

## Design Decisions

- The entire point is that the network is trivially small (132 parameters). Don't add complexity or dependencies that undermine this argument.
- Ablation toggle replaces network output with random uniform distribution to match CL1's `decoder_ablation_mode='random'`.
- Seeded PRNG for reproducible demos.
- Tone: dev log, first person, conversational. No em-dashes. Commas and full stops only.
