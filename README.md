# Truth Raiders

Truth Raiders is a GenLayer community mini-game where players enter a pixel dungeon, open weekly raid levels, answer multiple-choice evidence challenges, and earn XP through Intelligent Contract judging.

The browser game is built with React, Vite, Tailwind, Phaser, GenLayerJS, and Kenney CC0 sprite packs. The GenLayer contract handles the parts normal games cannot fairly settle alone: subjective answer judging, public evidence review, prompt-injection awareness, XP scoring, and leaderboard finalization.

## Game Loop

Players connect a wallet, create or join a room, start a timed raid, and move through five levels:

- Consensus Trial: correct a false claim about Optimistic Democracy.
- Web Evidence Hunt: prove how GenLayer can use public web evidence.
- Visual Relic Scan: inspect a poisoned visual artifact and identify prompt-injection risk.
- Referee Policy Forge: write fair rejection rules for subjective game scoring.
- XP Verdict Boss: deliver the final leaderboard and XP settlement reasoning.

Each level contains five multiple-choice questions. Moving near a glowing marker and pressing `Space` opens the level modal. Players answer the questions, optionally attach an evidence URL, and submit for GenLayer scoring. The raid timer ends the session if the room runs out of time.

Hosts can also publish official question packs from the Admin tab. A pack has exactly five levels and each level has five questions with four choices. Evidence URLs are optional: if a host does not provide one, the Intelligent Contract can judge from the official answer key and the question context.

## GenLayer Role

The contract in `contracts/truth_raiders.py` provides:

- `create_question_pack(...)`
- `set_pack_level(...)`
- `publish_question_pack(...)`
- `create_room_from_pack(...)`
- `create_room(...)`
- `join_room(...)`
- `submit_round(...)`
- `score_round(...)`
- `finalize_room(...)`
- `admin_add_moderator(...)`
- `admin_remove_moderator(...)`
- `get_leaderboard(...)`

`score_round(...)` uses `gl.vm.run_nondet_unsafe(...)`. For official rooms, the contract loads the published question pack on-chain, uses the pack's answer key and scoring rubric, optionally fetches public evidence with `gl.nondet.web.get(...)`, judges the answer with `gl.nondet.exec_prompt(...)`, and returns structured JSON. Validators independently rerun the same rubric and accept the result when the core fields are close enough.

## Frontend

The frontend includes:

- Wallet connection.
- Contract room creation and joining through GenLayerJS.
- Lobby with room cards, room-code search, and shareable room links.
- Admin console for moderator management, question-pack upload, publishing, and official room creation.
- Phaser pixel dungeon with five interactive level markers.
- Multiple-choice level modals.
- Optional official GenLayer evidence cards.
- Visual artifact inspection challenge.
- GenLayer submission and scoring transaction flow.
- Leaderboard page with no fake players or fake XP.

## Environment

Create `.env` from `.env.example` after deploying the contract:

```bash
VITE_TRUTH_RAIDERS_CONTRACT_ADDRESS=0x1530cdd48d1c7BD5Fa702d690446d65f50290d11
VITE_GENLAYER_NETWORK=studionet
VITE_GENLAYER_RPC_URL=https://studio.genlayer.com/api
```

The frontend is currently configured for StudioNet only. After redeploying `contracts/truth_raiders.py`, replace the address in `.env` and `.env.example`.

Current StudioNet deployment:

```text
0x1530cdd48d1c7BD5Fa702d690446d65f50290d11
```

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
