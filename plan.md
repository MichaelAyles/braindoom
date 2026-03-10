# plan.md — "It's Just Weights" (working title)

## Overview

An interactive blog post that demystifies the Cortical Labs "human brain cells play DOOM" story by reproducing the behaviour in a tiny conventional neural network, training it live in the reader's browser, and making the core argument: biological neurons adapting to stimulus is weight adjustment, the same thing your muscles do at the gym.

The project ships as both a standalone interactive page and an accompanying MDX blog post. The interactive demo is the centrepiece, the blog post provides the narrative framing.

## Core argument

The Cortical Labs CL1 architecture is: PPO encoder (silicon) → 200k biological neurons → CNN decoder (silicon). The neurons sit between two conventional ML systems. They receive a simplified signal (enemy bearing, distance), produce spike patterns, and a trained decoder maps those to game actions. The "playing DOOM" framing obscures that this is stimulus-response conditioning, not cognition.

We prove this by building an equivalent system in the browser and showing it learn the same behaviour in seconds.

## Repository structure

```
neurons-play-doom/
├── plan.md
├── README.md
├── LICENSE                    # MIT
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html                 # standalone demo page entry
├── src/
│   ├── main.ts                # entry point, wires everything together
│   ├── environment/
│   │   ├── arena.ts           # simplified DOOM-like environment logic
│   │   ├── renderer.ts        # canvas renderer for the arena
│   │   └── types.ts           # shared types (State, Action, etc)
│   ├── network/
│   │   ├── network.ts         # tiny feedforward neural network (from scratch, no deps)
│   │   ├── trainer.ts         # REINFORCE / simple policy gradient training loop
│   │   └── types.ts
│   ├── visualisation/
│   │   ├── network-viz.ts     # real-time weight heatmap / node-link diagram
│   │   ├── reward-chart.ts    # rolling reward plot
│   │   └── controls.ts        # play/pause, speed, ablation toggle, reset
│   ├── narration/
│   │   └── annotations.ts     # milestone-triggered text annotations ("notice the 'turn left' weight strengthening")
│   └── utils/
│       ├── math.ts            # activation functions, softmax, etc
│       └── random.ts          # seeded PRNG for reproducibility
├── blog/
│   ├── post.mdx               # the blog post (MDX, embeds or links to demo)
│   └── assets/
│       ├── cl1-architecture.svg  # diagram of actual CL1 pipeline
│       └── gym-analogy.svg       # visual for the muscle/neuron parallel
└── public/
    └── og-image.png           # social card
```

## Tech stack

- **Vite + TypeScript** — fast dev, zero-config, easy deploy to any static host
- **Canvas 2D** — for the arena renderer and network visualisation (no Three.js, no heavy deps)
- **No ML libraries** — the entire neural network is hand-rolled in ~150 lines. This is the point. If you need TensorFlow.js to match 200k neurons in a dish, something is wrong.
- **No framework for the demo page** — vanilla TS + canvas. Keeps bundle tiny, avoids React overhead for what is essentially a simulation loop.
- **MDX blog post** — lives in `blog/`, references the demo via iframe or link. Adapts to Mike's existing blog toolchain.

### Why no React for the demo

The demo is a tight render loop (environment step → network forward → render arena → render weights → repeat). React's reconciliation adds nothing here and the canvas API is the natural fit. The blog post itself can still be MDX with whatever framework the blog uses.

## Environment design

### Arena

Top-down 2D arena. Circular or square, doesn't matter much. Contains:

- **Agent** — centre of arena, can rotate 360°, has a "facing" direction shown as a line/cone
- **Enemy** — spawns at random angle and distance from agent, stationary (matching CL1 setup where enemies don't move much)
- **Kill zone** — if agent is facing enemy within ±10° and presses shoot and enemy is within range, enemy dies, new one spawns

### Observation space (matching CL1)

| Input | Range | Description |
|-------|-------|-------------|
| `enemy_angle` | [-1, 1] | Normalised angle to enemy relative to agent facing. -1 = hard left, +1 = hard right, 0 = dead centre |
| `enemy_distance` | [0, 1] | Normalised distance. 0 = point blank, 1 = max arena radius |
| `enemy_visible` | {0, 1} | 1 if enemy is within agent's FOV (optional, could derive from angle) |

Three floats. That's what the biological neurons receive (as encoded electrical pulses via the PPO encoder). We give our network the same.

### Action space

| Action | Index | Description |
|--------|-------|-------------|
| Turn left | 0 | Rotate agent CCW by fixed step |
| Turn right | 1 | Rotate agent CW by fixed step |
| Shoot | 2 | Fire. Hit if enemy in kill zone. |
| Move forward | 3 | Optional. Move toward facing direction. |

Discrete, 3-4 actions. Network outputs a probability distribution over these (softmax).

### Reward signal

- **+10** — enemy killed
- **+0.5** — enemy angle reduced (getting closer to facing it), scaled by delta
- **-0.1** — per timestep (encourages efficiency)
- **-1.0** — shoot and miss (discourages spam)

Keep rewards simple. The network should converge in a few hundred episodes at most.

## Network architecture

```
Input (3) → Dense (16, tanh) → Dense (4, softmax) → Action
```

Total parameters: (3×16 + 16) + (16×4 + 4) = 48 + 16 + 64 + 4 = **132 parameters**.

That's it. 132 floats to match what 200k biological neurons do. This number is part of the argument.

### Implementation notes

- Hand-rolled forward pass, backprop not needed (policy gradient uses REINFORCE)
- Weights initialised with Xavier/He init
- Softmax output, sample action from distribution
- Store (state, action, reward) trajectories for REINFORCE update
- Learning rate ~0.01, discount factor γ ~0.99
- Baseline subtraction (mean reward) for variance reduction

### Training loop

```
for each episode (max ~200 steps):
    reset environment
    while not done:
        obs = environment.getObservation()
        action_probs = network.forward(obs)
        action = sample(action_probs)
        reward = environment.step(action)
        store (obs, action, reward)
    update network weights using REINFORCE
```

Run this in a requestAnimationFrame loop, one episode per frame at normal speed, or batch multiple episodes per frame at high speed. Web Worker is an option if we want to decouple training from rendering, but probably unnecessary given the tiny compute.

## Visualisation design

### Layout (desktop)

```
┌─────────────────────────────────────────────────────────┐
│  [Title / one-line explainer]                           │
├───────────────────────┬─────────────────────────────────┤
│                       │                                 │
│   ARENA               │   NETWORK DIAGRAM               │
│   (canvas, ~400x400)  │   (canvas, ~400x400)            │
│                       │                                 │
│   Agent in centre,    │   Input nodes → Hidden → Output │
│   enemy dot,          │   Connections coloured by weight │
│   facing direction,   │   Red = strong positive          │
│   FOV cone            │   Blue = strong negative         │
│                       │   Width = magnitude              │
│                       │                                 │
├───────────────────────┴─────────────────────────────────┤
│  REWARD CHART (rolling average, ~800x150)               │
├─────────────────────────────────────────────────────────┤
│  CONTROLS                                               │
│  [▶ Play] [⏸ Pause] [Speed: 1x ▾] [🔀 Ablate] [↺ Reset] │
│                                                         │
│  ANNOTATIONS                                            │
│  "Episode 12: notice the enemy_angle → turn_left         │
│   connection strengthening (red). This is the network    │
│   learning 'if enemy is left, turn left.'"              │
└─────────────────────────────────────────────────────────┘
```

### Mobile

Stack vertically: arena, network, chart, controls. Each ~100vw wide.

### Key visual moments to annotate

1. **Episode 0** — weights random, agent spins aimlessly. "This is the ablation condition. Random spikes in, random actions out."
2. **~Episode 5-10** — enemy_angle → turn direction weights start differentiating. "The 'go left' weight is forming. This is the same thing the biological neurons learn, just visible."
3. **~Episode 20-50** — agent reliably turns toward enemy. "It's learned orientation. The CL1 neurons took a week of continuous stimulation to get here."
4. **~Episode 50-100** — agent turns and shoots. "The full behaviour. 132 parameters, 30 seconds of browser compute."

### Ablation toggle

When pressed:
- Replace network output with random uniform distribution over actions (matching CL1 ablation: "set decoder output to random")
- Agent immediately degrades to random behaviour
- Annotation: "This is the ablation test. Same environment, same everything, but the network output is randomised. Performance drops to chance. This is what Cortical Labs showed to prove the neurons contribute. It proves the same thing here: the weights matter."

When released, restore the trained network. Agent immediately performs well again.

## Blog post outline (blog/post.mdx)

### Title options (pick one)

- "It's Just Weights: Why Brain Cells Playing DOOM Isn't What You Think"
- "132 Parameters: Demystifying the Brain-Cell DOOM Demo"
- "Your Biceps Learn the Same Way"

### Structure

1. **The headline and the reaction** (~200 words)
   - CL1 plays DOOM, HN loses its mind, people invoke "I Have No Mouth and I Must Scream"
   - Link to original, link to HN thread
   - "I think this is bloody cool. I also think the panic is completely unwarranted. Here's why."

2. **What's actually happening** (~400 words)
   - The real architecture: PPO encoder → neurons → CNN decoder
   - Diagram (cl1-architecture.svg)
   - The neurons don't see pixels. They get 3-4 encoded signals. They produce spikes. Silicon does the rest.
   - The developer (Shawn Cole) built this in a week, in Python
   - What the ablation tests actually show

3. **I reproduced it in 132 parameters** (~300 words)
   - Link/embed the interactive demo
   - "Watch it learn. Takes about 30 seconds."
   - Walk through what the weights mean
   - "Try the ablation toggle. Same result as the CL1 control condition."

4. **The gym analogy** (~300 words)
   - Hebbian learning = gradient descent = progressive overload
   - Your bicep doesn't "know" it's lifting a dumbbell. It adapts to stimulus.
   - These neurons don't "know" they're in DOOM. They adapt to stimulus.
   - Diagram (gym-analogy.svg)
   - "Nobody calls a bicep conscious for getting stronger. Nobody should call 200k neurons conscious for adjusting their spike patterns."

5. **What's actually cool** (~300 words)
   - Drug testing assay: measurable learning effects = measurable drug impacts
   - The CTO's comment about testing experimental compounds
   - This is a genuinely useful biotech tool, not a proto-Terminator
   - The Python SDK angle is interesting for accessibility

6. **Where the line actually is** (~200 words)
   - Acknowledge the ethical question is real, just premature here
   - 200k unstructured organoid neurons vs 140k structured fruit fly connectome
   - The important questions are about scaling, structure, and feedback loops, not about this demo
   - "The time to worry is when someone grows an organised cortical structure with sensory feedback loops. A dish of cells doing stimulus-response is not that."

7. **Closing** (~100 words)
   - "The coolest thing about this story isn't the consciousness debate. It's that we can now programmatically interface with biological neural tissue in Python and measure learning. That's a genuinely new capability. Let's talk about what to do with it instead of panicking about DOOM."

### Tone

Dev log. First person. Show the reasoning. Acknowledge competitors (Cortical Labs are doing genuinely interesting work, this isn't a takedown). Conversational asides. No em-dashes. Commas and full stops only.

## Implementation phases

### Phase 1: Environment + Network core
- [ ] Arena environment (state, step, reset, observation, reward)
- [ ] Feedforward network (forward pass, weight init)
- [ ] REINFORCE trainer (trajectory storage, policy gradient update)
- [ ] Verify training converges in terminal/console output
- Estimated: ~2 hours

### Phase 2: Arena renderer
- [ ] Canvas 2D arena view (agent, enemy, FOV cone, kill flash)
- [ ] Wire to training loop via requestAnimationFrame
- [ ] Speed control (1x, 5x, 20x, max)
- Estimated: ~1.5 hours

### Phase 3: Network visualisation
- [ ] Node-link diagram with weight-coloured connections
- [ ] Real-time updates each episode
- [ ] Highlight strongest connection per output node
- Estimated: ~1.5 hours

### Phase 4: Controls + annotations
- [ ] Play/pause/reset/speed controls
- [ ] Ablation toggle (random output mode)
- [ ] Milestone-triggered text annotations
- [ ] Rolling reward chart
- Estimated: ~1.5 hours

### Phase 5: Polish + responsive
- [ ] Mobile layout (stacked)
- [ ] Touch controls for mobile
- [ ] Loading state
- [ ] OG image / meta tags
- [ ] Performance pass (should be trivial given scope)
- Estimated: ~1 hour

### Phase 6: Blog post
- [ ] Write MDX post following outline above
- [ ] Create cl1-architecture.svg diagram
- [ ] Create gym-analogy.svg diagram
- [ ] Embed or link demo
- [ ] Proofread, cut anything that sounds "AI-generated"
- Estimated: ~2-3 hours

### Phase 7: Ship
- [ ] Deploy demo to static host (Vercel/Cloudflare Pages/GitHub Pages)
- [ ] Deploy blog post
- [ ] README with screenshots, motivation, link to post
- [ ] Submit to HN with title matching the core argument, not the clickbait
- Estimated: ~1 hour

## Deployment

The demo is a static site (Vite build → dist/). Deploy anywhere. Options:

- **GitHub Pages** — free, OSS native, good for the repo
- **Cloudflare Pages** — Mike's existing infra for Phaestus
- **Subdomain** — e.g. `doom.mikeayles.com` (already has `doom.mikeayles.com` for OpenSCAD-DOOM, maybe `neurons.mikeayles.com` or `weights.mikeayles.com`)

Blog post deploys via Mike's existing MDX blog pipeline.

## Open questions

1. **Hidden layer size**: 16 neurons is probably right for the argument (tiny but effective). Could offer a slider to let readers scale from 1 to 256 and watch how it affects training speed. This would reinforce "it's just weights" because even 4 hidden neurons would eventually learn this.
2. **First-person view**: A stretch goal could add a tiny first-person DOOM-like viewport alongside the top-down view, purely for vibes. Low priority but would be great for the social card.
3. **Side-by-side CL1 comparison**: If Cortical Labs' DOOM footage is available, a side-by-side "biological vs silicon, same behaviour" would be powerful. Need to check licensing.
4. **Network size slider**: Let readers adjust hidden layer size and watch training speed change. Reinforces that the architecture is trivially simple.
5. **"Your turn" mode**: Let the reader play the same simplified DOOM with keyboard controls, then show they perform identically to the trained network. Drives home "this task is trivial."

## Success criteria

- Reader watches the network train in real-time and has an "oh, that's all this is" moment
- The ablation toggle makes the contribution of weights viscerally obvious
- The gym analogy lands and reframes the conversation
- The post gets engagement on HN by being technically substantive rather than just opinionated
- The code is clean enough that someone could fork it and experiment