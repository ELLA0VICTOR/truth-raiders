# Truth Raiders

Truth Raiders is a GenLayer community mini-game where players enter a pixel dungeon, defeat corrupted claims, and earn XP from AI-assisted validator consensus.

The browser game is built with React, Vite, Tailwind, Phaser, and Kenney CC0 sprite packs. The GenLayer Intelligent Contract handles the parts normal games cannot do fairly on their own: subjective answer judging, public evidence review, XP scoring, and leaderboard settlement.

## Game Loop

Players join a weekly raid room and pick a raider avatar. A match is designed to last 5-15 minutes.

Each room has four chambers:

- Claim Chamber: correct a false or misleading claim.
- Evidence Chamber: provide the strongest public source.
- Strategy Chamber: write a safe referee policy.
- Boss Verdict: submit the final XP/verdict reasoning.

The Phaser scene gives players a small top-down dungeon with chamber relics. Moving near a relic and pressing `Space` opens that chamber in the React UI.

## GenLayer Role

The contract in `contracts/truth_raiders.py` provides:

- `create_room(...)`
- `join_room(...)`
- `submit_round(...)`
- `score_round(...)`
- `finalize_room(...)`
- `get_leaderboard(...)`

`score_round(...)` uses `gl.vm.run_nondet_unsafe(...)`.

The leader fetches optional public evidence with `gl.nondet.web.get(...)`, judges the answer using `gl.nondet.exec_prompt(...)`, and returns structured JSON. Validators independently rerun the same rubric and accept the result when the core judgment fields are close enough.

This is the mission fit: the fun happens in a multiplayer room, while GenLayer and Optimistic Democracy act as the referee for subjective scoring and XP distribution.

## Frontend

Current prototype includes:

- Weekly raid landing panel.
- Room code and raid stats.
- Raider avatar selection.
- Multiplayer-style room roster.
- Phaser pixel dungeon board.
- Chamber interaction with keyboard movement.
- Answer and evidence submission panel.
- Local XP preview.
- Contract packet preview showing what would be sent to GenLayer.

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

## Next Steps

- Deploy `contracts/truth_raiders.py` on GenLayer Studio or Bradbury.
- Wire the React submission button to the deployed contract.
- Add real room presence through a lightweight realtime layer.
- Replace local XP preview with live `score_round(...)` transaction results.
