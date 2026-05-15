# Truth Raiders

Truth Raiders is a multiplayer GenLayer mini-game built for community raid sessions. Players enter a pixel dungeon, join shared rooms, clear five timed challenge levels, and earn XP on-chain through a GenLayer Intelligent Contract.

The project is designed around the GenLayer mission brief: short multiplayer rooms, replayable weekly content, subjective or evidence-based challenge validation, and a public leaderboard that can be used for XP distribution.

## Current Deployment

The frontend is configured for GenLayer StudioNet.

```text
Contract: 0x3Da7B1728b30c7eeba65BbafA3Cb9C188fFdAa0D
Network:  StudioNet
RPC:      https://studio.genlayer.com/api
```

Only the contract address is expected as a Vite environment variable. StudioNet and the Studio RPC are fixed in `src/config/genlayer.js`.

## What The Game Demonstrates

- Multiplayer raid rooms with wallet-based player identity.
- Weekly or moderator-created five-level question packs.
- Multiple-choice challenge packs that score immediately inside `submit_round`.
- Natural-language packs that can use GenLayer's nondeterministic AI judging path.
- Optional evidence URLs for validators and players.
- Admin and moderator controls for publishing community packs.
- On-chain XP, progression state, room metadata, submissions, and leaderboard reads.
- A Phaser-powered pixel raid map connected to React modals and GenLayer transactions.

## Gameplay

1. Connect a wallet.
2. Open the Lobby tab and create or join a room.
3. Enter a raider handle.
4. Start the raid from the Play tab.
5. Move the sprite with `WASD` or arrow keys.
6. Walk to a level relic and press `Space`.
7. Answer the five questions in the level modal.
8. Submit the packet to GenLayer.
9. Clear each level to unlock the next one.
10. Check the Leaderboard tab for finalized XP.

There are five default raid levels:

- Consensus Trial
- Evidence Hunt
- Visual Relic Scan
- Referee Policy Forge
- XP Verdict Boss

Each level is intentionally short so a full room can finish in the 5-15 minute window requested by the mission.

## Scoring Model

Truth Raiders supports two scoring paths.

### Multiple-Choice Packs

MCQ packs are the production-fast path. The answer key is stored with the pack, and `submit_round(...)` calculates XP during the same contract execution. This avoids a second judging transaction and makes the game usable during live demos.

Players do not need to pass a level to unlock the next level. Completion unlocks progression, but wrong answers receive lower or zero XP.

### Natural-Language Packs

Natural-language packs are available for subjective challenges. The player submits a written answer and `score_round(...)` uses GenLayer nondeterministic execution to evaluate the response against the prompt, rubric, answer key, and optional evidence URLs.

This path better showcases AI consensus, but it is slower than MCQ scoring on StudioNet. It is best for special rooms or moderator-led sessions where richer answers matter more than speed.

## Admin And Moderator Flow

The Admin tab lets the contract admin:

- Add moderator addresses.
- Remove moderator addresses.
- Create question packs.
- Choose MCQ or natural-language mode.
- Fill five levels with five questions each.
- Publish a complete pack.
- Create a public room from a published pack.

For MCQ packs, moderators can enter a question and the correct answer. Optional wrong answers can be provided manually. If they are left blank, the frontend creates simple distractor options and shuffles the final choices before publishing.

For natural-language packs, moderators provide prompts, expected answer guidance, rubrics, and optional evidence URLs.

## Contract Surface

The main contract lives at `contracts/truth_raiders.py`.

Important write methods:

- `create_room(season_code, room_code, round_count, xp_pool)`
- `create_question_pack(title, season_code)`
- `set_pack_level(pack_id, level_index, title, intro, prompt, rubric_csv, evidence_urls_csv, answer_key, question_block, scoring_mode)`
- `publish_question_pack(pack_id)`
- `create_room_from_pack(pack_id, room_code, xp_pool)`
- `join_room(room_id, handle, avatar)`
- `submit_round(room_id, round_id, chamber, answer, evidence_url)`
- `score_round(room_id, round_id, player, prompt, rubric_csv)`
- `finalize_room(room_id)`
- `admin_add_moderator(user)`
- `admin_remove_moderator(user)`

Important read methods:

- `get_room(room_id)`
- `get_room_count()`
- `get_leaderboard(room_id)`
- `get_submission(room_id, round_id, player)`
- `get_submission_status(room_id, round_id, player)`
- `get_question_pack(pack_id)`
- `get_pack_level(pack_id, level_index)`
- `get_pack_count()`
- `get_admin()`
- `get_audit_log()`

## Frontend Architecture

The frontend is a Vite React app with Phaser embedded for the raid map.

Key folders:

- `src/App.jsx`: main React state, tabs, room flow, admin flow, submission flow, and leaderboard UI.
- `src/App.css`: full visual system and responsive layout rules.
- `src/config/genlayer.js`: StudioNet chain config and deployed contract address fallback.
- `src/hooks/useTruthRaidersContract.js`: GenLayerJS read/write helpers and transaction waiting.
- `src/game/TruthRaidersGame.jsx`: Phaser map, sprite movement, level markers, and `Space` interactions.
- `src/data/raidContent.js`: default level content and built-in evidence cards.
- `src/assets/sprites`: imported sprite packs and license files.

## Environment

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Then set:

```bash
VITE_TRUTH_RAIDERS_CONTRACT_ADDRESS=0x3Da7B1728b30c7eeba65BbafA3Cb9C188fFdAa0D
```

If you redeploy the contract, update:

- `.env`
- `.env.example`
- `src/config/genlayer.js` default contract address
- Vercel environment variable `VITE_TRUTH_RAIDERS_CONTRACT_ADDRESS`

## Local Development

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Build production assets:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Vercel Deployment

Use these Vercel settings:

```text
Framework Preset: Vite
Build Command:    npm run build
Output Directory: dist
Install Command:  npm install
```

Environment variable:

```text
VITE_TRUTH_RAIDERS_CONTRACT_ADDRESS=0x3Da7B1728b30c7eeba65BbafA3Cb9C188fFdAa0D
```

No serverless backend is required. The browser talks directly to GenLayer StudioNet through `genlayer-js`.

## Contract Deployment Checklist

1. Deploy `contracts/truth_raiders.py` in GenLayer Studio.
2. Confirm the constructor succeeds.
3. Copy the new contract address.
4. Update frontend environment values.
5. Run `npm run build`.
6. Create a fresh room from the UI.
7. Join the room with at least one wallet.
8. Submit level 1 and confirm XP appears on the leaderboard.
9. Test that level 2 unlocks after level 1 completion.
10. If using moderator packs, publish a pack and create a room from it.

If `genvm-lint` is available locally, run it before redeploying contract changes.

## Testing Checklist

Recommended manual test:

- Test in one browser profile first with one wallet.
- Create room.
- Join room with a handle.
- Start raid.
- Submit level 1.
- Confirm progression unlocks level 2 quickly.
- Wait for StudioNet reads to catch up and confirm XP on the leaderboard.
- Repeat with a second wallet in another browser profile.
- Confirm both wallets appear separately on the leaderboard.
- Confirm a duplicate join is handled as "already joined" instead of breaking the flow.

StudioNet can be slow or temporarily busy. The UI keeps local progression responsive and syncs contract state in the background, but leaderboard XP still depends on the contract read becoming available.

## Mobile Responsiveness

The app is built to work on desktop, tablet, and phones:

- Navigation collapses into touch-sized rows.
- Room controls stack cleanly on narrow screens.
- Admin pack forms become single-column.
- The Phaser map switches to a mobile-safe aspect ratio.
- Challenge modals use internal scrolling so the submit area remains reachable.
- Leaderboard and prize cards collapse into readable single-column layouts.

For the best game feel on mobile, landscape mode is recommended for the Phaser raid map, but portrait mode remains usable.

## Assets

Sprite and UI assets are from Kenney packs:

- Roguelike Characters
- Roguelike Caves & Dungeons
- Roguelike/RPG Pack
- UI Pack Pixel Adventure
- Input Prompts Pixel
- Pattern Pack Pixel
- Top-down Shooter

Kenney assets are distributed with their original license files under `src/assets/sprites`.

## Known Network Notes

- Multiple wallet extensions can produce browser console warnings about `window.ethereum`. These are extension conflicts, not app errors.
- StudioNet may return "server busy" or slow receipt/read updates during heavy use.
- MCQ rooms are recommended for live demos because scoring is handled during submission.
- Natural-language rooms are slower because they intentionally exercise GenLayer AI consensus.
