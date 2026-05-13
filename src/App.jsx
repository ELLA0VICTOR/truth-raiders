import { useMemo, useState } from 'react'
import TruthRaidersGame from './game/TruthRaidersGame'
import { AVATARS, CHAMBERS, RAID_PLAYERS, RAID_SEASON, scoreLocalSubmission } from './data/raidContent'
import './App.css'

function Sigil({ name = 'mark' }) {
  return (
    <svg className="sigil" viewBox="0 0 40 40" role="img" aria-label={name}>
      <path d="M20 4 34 12v16L20 36 6 28V12L20 4Z" />
      <path d="M20 10v20M11 16l9-5 9 5M11 24l9 5 9-5" />
      <circle cx="20" cy="20" r="3" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 19 6v5c0 4.7-2.7 8-7 10-4.3-2-7-5.3-7-10V6l7-3Z" />
      <path d="m8.8 12.1 2.1 2.1 4.5-5" />
    </svg>
  )
}

function ScrollIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h10a3 3 0 0 1 3 3v11H8a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3Z" />
      <path d="M8 8h8M8 12h7M8 16h5" />
    </svg>
  )
}

function TimerIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8v5l3 2" />
      <circle cx="12" cy="13" r="8" />
      <path d="M9 2h6" />
    </svg>
  )
}

function AvatarToken({ avatar, selected, onClick }) {
  return (
    <button className={`avatar-token ${selected ? 'is-selected' : ''}`} onClick={onClick} type="button">
      <span className="avatar-glyph">{avatar.name.slice(0, 2).toUpperCase()}</span>
      <strong>{avatar.name}</strong>
      <small>{avatar.role}</small>
    </button>
  )
}

function ChamberCard({ chamber, index, active, completed, onOpen }) {
  return (
    <button className={`chamber-card ${active ? 'is-active' : ''} ${completed ? 'is-complete' : ''}`} onClick={onOpen} type="button">
      <span className="chamber-index">0{index + 1}</span>
      <div>
        <strong>{chamber.label}</strong>
        <p>{chamber.monster}</p>
      </div>
      <span className="chamber-state">{completed ? 'scored' : active ? 'open' : 'sealed'}</span>
    </button>
  )
}

function Leaderboard({ players, submissions }) {
  const ranked = useMemo(() => {
    return players
      .map((player) => {
        const earned = submissions
          .filter((submission) => submission.playerId === player.id)
          .reduce((total, submission) => total + submission.score, 0)
        return { ...player, xp: player.xp + earned }
      })
      .sort((a, b) => b.xp - a.xp)
  }, [players, submissions])

  return (
    <div className="leaderboard">
      {ranked.map((player, index) => (
        <div className="leader-row" key={player.id}>
          <span className="rank">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <strong>{player.name}</strong>
            <small>{player.status}</small>
          </div>
          <b>{player.xp} XP</b>
        </div>
      ))}
    </div>
  )
}

function ContractPanel({ activeChamber, answer, sourceUrl, submissions }) {
  const payload = {
    room_id: RAID_SEASON.roomCode,
    weekly_seed: RAID_SEASON.code,
    chamber: activeChamber?.id ?? 'none',
    answer_preview: answer.trim().slice(0, 96) || 'waiting for player submission',
    source_url: sourceUrl.trim() || 'optional',
    scoring_fields: activeChamber?.scoring ?? [],
  }

  return (
    <aside className="contract-panel">
      <div className="panel-heading">
        <span>Intelligent Contract Packet</span>
        <ShieldIcon />
      </div>
      <pre>{JSON.stringify(payload, null, 2)}</pre>
      <div className="democracy-rail">
        <div>
          <span>01</span>
          <p>Leader evaluates answer + evidence.</p>
        </div>
        <div>
          <span>02</span>
          <p>Validators rerun the rubric independently.</p>
        </div>
        <div>
          <span>03</span>
          <p>XP enters weekly leaderboard after consensus.</p>
        </div>
      </div>
      <div className="packet-foot">
        <span>{submissions.length}/4 chambers submitted</span>
        <span>Optimistic Democracy referee</span>
      </div>
    </aside>
  )
}

function App() {
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0])
  const [raidStarted, setRaidStarted] = useState(false)
  const [activeChamberIndex, setActiveChamberIndex] = useState(0)
  const [nearChamber, setNearChamber] = useState(null)
  const [answer, setAnswer] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [gameReady, setGameReady] = useState(false)

  const activeChamber = CHAMBERS[activeChamberIndex]
  const currentScore = scoreLocalSubmission(answer, sourceUrl, activeChamberIndex)

  const players = useMemo(() => {
    return RAID_PLAYERS.map((player) =>
      player.id === 'you'
        ? { ...player, avatar: selectedAvatar.id, status: raidStarted ? 'inside raid' : 'ready' }
        : player
    )
  }, [raidStarted, selectedAvatar.id])

  const completedChambers = new Set(submissions.map((submission) => submission.chamberId))

  function startRaid() {
    setRaidStarted(true)
    setActiveChamberIndex(0)
  }

  function submitChamber() {
    if (!answer.trim()) return

    const score = currentScore
    setSubmissions((current) => [
      ...current.filter((submission) => submission.chamberId !== activeChamber.id || submission.playerId !== 'you'),
      {
        playerId: 'you',
        chamberId: activeChamber.id,
        answer: answer.trim(),
        sourceUrl: sourceUrl.trim(),
        score,
      },
    ])
    setAnswer('')
    setSourceUrl('')
    setActiveChamberIndex((index) => Math.min(CHAMBERS.length - 1, index + 1))
  }

  return (
    <main className="raid-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="brand-row">
            <Sigil name="Truth Raiders seal" />
            <div>
              <span className="kicker">GenLayer community mini-game</span>
              <h1>Truth Raiders</h1>
            </div>
          </div>
          <p className="hero-lede">
            A 5-15 minute multiplayer dungeon where raiders defeat corrupted claims. Phaser handles the sprite-world;
            GenLayer judges subjective answers, evidence quality, and XP distribution.
          </p>
          <div className="hero-actions">
            <button className="primary-action" type="button" onClick={startRaid}>
              {raidStarted ? 'Raid running' : 'Enter weekly raid'}
            </button>
            <a className="secondary-action" href="#contract">
              Read consensus loop
            </a>
          </div>
        </div>

        <div className="raid-card">
          <span className="kicker">{RAID_SEASON.code}</span>
          <h2>{RAID_SEASON.roomCode}</h2>
          <div className="raid-stats">
            <span><TimerIcon /> {RAID_SEASON.durationMinutes} min</span>
            <span><ScrollIcon /> {CHAMBERS.length} chambers</span>
            <span><ShieldIcon /> {RAID_SEASON.xpPool} XP pool</span>
          </div>
          <p>Replayable weekly seed. New claims, new evidence traps, new leaderboard.</p>
        </div>
      </section>

      <section className="setup-grid">
        <div className="panel">
          <div className="panel-heading">
            <span>Choose your raider</span>
            <span className="fine">sprite identity</span>
          </div>
          <div className="avatar-grid">
            {AVATARS.map((avatar) => (
              <AvatarToken
                key={avatar.id}
                avatar={avatar}
                selected={avatar.id === selectedAvatar.id}
                onClick={() => setSelectedAvatar(avatar)}
              />
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <span>Room roster</span>
            <span className="fine">multiplayer lobby</span>
          </div>
          <Leaderboard players={players} submissions={submissions} />
        </div>
      </section>

      <section className="raid-board">
        <div className="game-frame">
          <div className="game-topbar">
            <span>{gameReady ? 'raid engine online' : 'loading raid engine'}</span>
            <span>{nearChamber !== null ? `near chamber 0${nearChamber + 1}` : 'move with WASD / arrows'}</span>
          </div>
          {raidStarted ? (
            <TruthRaidersGame
              avatarFrame={selectedAvatar.frame}
              onReady={() => setGameReady(true)}
              onChamber={(index) => setActiveChamberIndex(index)}
              onProximity={(index) => setNearChamber(index)}
            />
          ) : (
            <div className="sleeping-map">
              <Sigil name="sealed map" />
              <strong>Raid map sealed</strong>
              <p>Choose a raider and enter the weekly raid to activate the dungeon.</p>
            </div>
          )}
        </div>

        <div className="panel chamber-panel">
          <div className="panel-heading">
            <span>Raid chambers</span>
            <span className="fine">spacebar near relic to open</span>
          </div>
          <div className="chamber-list">
            {CHAMBERS.map((chamber, index) => (
              <ChamberCard
                key={chamber.id}
                chamber={chamber}
                index={index}
                active={index === activeChamberIndex}
                completed={completedChambers.has(chamber.id)}
                onOpen={() => setActiveChamberIndex(index)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="verdict-grid" id="contract">
        <div className="panel submission-panel">
          <div className="panel-heading">
            <span>{activeChamber.label}</span>
            <span className="fine">{activeChamber.monster}</span>
          </div>
          <h2>{activeChamber.title}</h2>
          <p className="prompt">{activeChamber.prompt}</p>
          <p className="instruction">{activeChamber.instruction}</p>

          <label>
            Raider answer
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Write a concise answer that validators can judge..."
            />
          </label>

          <label>
            Evidence URL
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://docs.genlayer.com/..."
            />
          </label>

          <div className="score-strip">
            <span>local preview score</span>
            <strong>{currentScore} XP</strong>
          </div>

          <button className="primary-action wide" type="button" onClick={submitChamber} disabled={!answer.trim()}>
            Seal answer for GenLayer judging
          </button>
        </div>

        <ContractPanel activeChamber={activeChamber} answer={answer} sourceUrl={sourceUrl} submissions={submissions} />
      </section>
    </main>
  )
}

export default App
