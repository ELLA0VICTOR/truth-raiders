# Truth Raiders

Truth Raiders is a GenLayer community mini-game where players enter a pixel dungeon, open weekly raid levels, answer evidence-based challenges, and earn XP through Intelligent Contract judging.

The browser game is built with React, Vite, Tailwind, Phaser, GenLayerJS, and Kenney CC0 sprite packs. The GenLayer contract handles the parts normal games cannot fairly settle alone: subjective answer judging, public evidence review, prompt-injection awareness, XP scoring, and leaderboard finalization.

## Game Loop

Players connect a wallet, create or join the weekly room, start a 5-15 minute raid, and move through five levels:

- Consensus Trial: correct a false claim about Optimistic Democracy.
- Web Evidence Hunt: prove how GenLayer can use public web evidence.
- Visual Relic Scan: inspect a poisoned visual artifact and identify prompt-injection risk.
- Referee Policy Forge: write fair rejection rules for subjective game scoring.
- XP Verdict Boss: deliver the final leaderboard and XP settlement reasoning.

Each level has multiple tasks, official evidence cards, and a single final answer. Moving near a glowing marker and pressing `Space` reveals the level.

## GenLayer Role

The contract in `contracts/truth_raiders.py` provides:

- `create_room(...)`
- `join_room(...)`
- `submit_round(...)`
- `score_round(...)`
- `finalize_room(...)`
- `get_leaderboard(...)`

`score_round(...)` uses `gl.vm.run_nondet_unsafe(...)`. The leader fetches public evidence with `gl.nondet.web.get(...)`, judges the answer using `gl.nondet.exec_prompt(...)`, and returns structured JSON. Validators independently rerun the same rubric and accept the result when the core fields are close enough.

## Frontend

The frontend includes:

- Wallet connection.
- Contract room creation and joining through GenLayerJS.
- Phaser pixel dungeon with five interactive level markers.
- Multi-task level prompts.
- Official GenLayer evidence cards.
- Visual artifact inspection challenge.
- GenLayer submission and scoring transaction flow.
- Leaderboard page with no fake players or fake XP.

## Environment

Create `.env` from `.env.example` after deploying the contract:

```bash
VITE_TRUTH_RAIDERS_CONTRACT_ADDRESS=0x...
VITE_TRUTH_RAIDERS_ROOM_ID=0
VITE_GENLAYER_NETWORK=studionet
```

Supported `VITE_GENLAYER_NETWORK` values are `localnet`, `studionet`, `asimov`, and `bradbury`.

## Assets

Sprites are from Kenney asset packs:

- Roguelike Characters
- Roguelike Caves & Dungeons
- Roguelike/RPG Pack
- UI Pack Pixel Adventure
- Input Prompts Pixel
- Pattern Pack Pixel
- Top-down Shooter

Kenney assets are included with their original license files inside `src/assets/sprites`.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
