import { useEffect, useMemo, useRef, useState } from 'react'
import TruthRaidersGame from './game/TruthRaidersGame'
import { useTruthRaidersContract } from './hooks/useTruthRaidersContract'
import { AVATARS, CHAMBERS, RAID_SEASON, buildAnswerKey, buildAnswerPacket, getReadiness } from './data/raidContent'
import { ensureGenLayerNetwork } from './config/genlayer'
import './App.css'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'play', label: 'Play' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'faq', label: 'FAQ' },
]

function shortAddress(address) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function normalizeWallet(value) {
  return String(value || '').replace(/^Address\("(.+)"\)$/, '$1').toLowerCase()
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

const RAID_DURATION_SECONDS = RAID_SEASON.durationMinutes * 60

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getTimerPhase(totalSeconds, raidEnded) {
  if (raidEnded || totalSeconds <= 0) return 'is-ended'
  if (totalSeconds <= 30) return 'is-critical'
  if (totalSeconds <= 90) return 'is-warning'
  return 'is-steady'
}

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

function Nav({ activeTab, onTabChange, walletAddress, onConnect, onDisconnect, isConnecting }) {
  return (
    <header className="site-nav">
      <button className="brand-button" type="button" onClick={() => onTabChange('overview')}>
        <Sigil name="Truth Raiders seal" />
        <span>Truth Raiders</span>
      </button>
      <nav>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'is-active' : ''}
            type="button"
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <button
        className={`wallet-button ${walletAddress ? 'is-connected' : ''}`}
        type="button"
        onClick={walletAddress ? onDisconnect : onConnect}
      >
        <span className="wallet-light" />
        {walletAddress ? shortAddress(walletAddress) : isConnecting ? 'Connecting...' : 'Connect wallet'}
      </button>
    </header>
  )
}

function ArtifactPanel({ artifact }) {
  if (!artifact) return null

  return (
    <div className="artifact-panel" aria-label={artifact.title}>
      <div className="artifact-glyph">
        <svg viewBox="0 0 260 170" role="img" aria-label="Poisoned evidence relic">
          <rect x="18" y="18" width="224" height="134" />
          <path d="M130 34 196 70v62H64V70l66-36Z" />
          <path d="M88 82h84M88 106h84M104 130h52" />
          <circle cx="130" cy="76" r="18" />
          <path d="m117 76 9 9 20-24" />
          <path d="M42 42h38M180 128h38M42 128h22M196 42h22" />
        </svg>
      </div>
      <div>
        <span className="kicker">{artifact.title}</span>
        <p>{artifact.caption}</p>
        <div className="artifact-flags">
          {artifact.flags.map((flag) => (
            <b key={flag}>{flag}</b>
          ))}
        </div>
      </div>
    </div>
  )
}

function Leaderboard({ players }) {
  const ranked = useMemo(() => {
    if (!Array.isArray(players)) return []
    return players
      .map((player) => ({
        id: normalizeWallet(player.wallet),
        name: player.handle || shortAddress(normalizeWallet(player.wallet)),
        status: `${shortAddress(normalizeWallet(player.wallet))} / on-chain XP`,
        xp: Number(player.xp || 0),
      }))
      .sort((left, right) => right.xp - left.xp)
  }, [players])

  return (
    <div className="leaderboard">
      {ranked.length > 0 ? (
        ranked.map((player, index) => (
          <div className="leader-row" key={player.id}>
            <span className="rank">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <strong>{player.name}</strong>
              <small>{player.status}</small>
            </div>
            <b>{player.xp} XP</b>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <strong>No finalized raiders yet</strong>
          <p>Leaderboard entries appear after wallets join the room and GenLayer scoring writes XP on-chain.</p>
        </div>
      )}
    </div>
  )
}

function OverviewPage({ onPlay, walletAddress, onConnect }) {
  return (
    <section className="overview-page page-reveal">
      <div className="landing-hero">
        <div className="hero-copy">
          <span className="kicker">GenLayer community mini-game</span>
          <h1>Truth Raiders</h1>
          <p className="hero-lede">
            A weekly multiplayer dungeon where players defeat corrupted claims, submit evidence, and let GenLayer validators score the run.
          </p>
          <div className="hero-actions">
            <button className="primary-action" type="button" onClick={onPlay}>
              Enter the raid room
            </button>
            {!walletAddress && (
              <button className="secondary-action" type="button" onClick={onConnect}>
                Connect first
              </button>
            )}
            <a className="secondary-action" href="#how-it-works">
              See the loop
            </a>
          </div>
          <div className="mode-chip">
            <span className="wallet-light" />
            <b>{walletAddress ? 'Wallet ready' : 'Wallet required for scored runs'}</b>
            <small>Final XP requires the deployed Truth Raiders contract and GenLayer validator scoring.</small>
          </div>
        </div>

        <button className="try-orb" type="button" onClick={onPlay} aria-label="Open game">
          <span>Wanna try it out?</span>
          <Sigil name="hovering raid seal" />
        </button>
      </div>

      <div id="how-it-works" className="overview-grid">
        <article className="feature-card">
          <TimerIcon />
          <h2>5-15 minute rooms</h2>
          <p>Players join a short weekly raid with five evidence-heavy levels and a final leaderboard.</p>
        </article>
        <article className="feature-card">
          <ScrollIcon />
          <h2>Subjective challenges</h2>
          <p>Claims, evidence, and referee policies are judged by quality, not button spam.</p>
        </article>
        <article className="feature-card">
          <ShieldIcon />
          <h2>GenLayer referee</h2>
          <p>Intelligent Contracts score answers and distribute XP through validator agreement.</p>
        </article>
      </div>

      <div className="season-banner">
        <div>
          <span className="kicker">{RAID_SEASON.code}</span>
          <h2>{RAID_SEASON.roomCode}</h2>
        </div>
        <div className="raid-stats">
          <span><TimerIcon /> {RAID_SEASON.durationMinutes} min</span>
          <span><ScrollIcon /> {CHAMBERS.length} levels</span>
          <span><ShieldIcon /> {RAID_SEASON.xpPool} XP pool</span>
        </div>
      </div>
    </section>
  )
}

function ChallengeModal({
  activeChamber,
  levelNumber,
  onClose,
  walletAddress,
  onConnect,
  walletError,
  contract,
  roomJoined,
  selectedAnswers,
  setSelectedAnswers,
  selectedEvidenceUrl,
  setSelectedEvidenceUrl,
  submitChamber,
  judgingStatus,
  readiness,
  canSubmit,
  submitDisabledReason,
  clockLabel,
  timerPhase,
}) {
  useEffect(() => {
    if (!activeChamber) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleEscape(event) {
      if (event.key === 'Escape' && !contract.isLoading) onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [activeChamber, contract.isLoading, onClose])

  if (!activeChamber) return null

  return (
    <div className="challenge-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !contract.isLoading) onClose()
    }}>
      <section className="challenge-modal" role="dialog" aria-modal="true" aria-labelledby="challenge-title">
        <div className={`modal-command-strip ${timerPhase}`}>
          <span>Level {levelNumber} / {clockLabel}</span>
          <button type="button" onClick={onClose} aria-label="Close challenge">
            Close
          </button>
        </div>

        <div className="modal-scroll">
          <div className="panel-heading">
            <span>{activeChamber.label}</span>
            <span className="fine">validator packet</span>
          </div>
          <h2 id="challenge-title">{activeChamber.title}</h2>
          <p className="prompt">{activeChamber.prompt}</p>
          <p className="instruction">{activeChamber.instruction}</p>

          <div className="question-stack">
            {activeChamber.questions.map((question, index) => (
              <article className="mcq-card" key={question.id}>
                <div className="mcq-question">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{question.prompt}</h3>
                </div>
                <div className="mcq-options">
                  {question.options.map((option, optionIndex) => (
                    <button
                      className={selectedAnswers[question.id] === optionIndex ? 'is-selected' : ''}
                      key={option}
                      type="button"
                      onClick={() => setSelectedAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                    >
                      <b>{String.fromCharCode(65 + optionIndex)}</b>
                      <span>{option}</span>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <ArtifactPanel artifact={activeChamber.artifact} />

          <div className="evidence-grid">
            {activeChamber.evidence.map((evidence) => (
              <button
                className={`evidence-card ${selectedEvidenceUrl === evidence.url ? 'is-selected' : ''}`}
                key={evidence.url}
                type="button"
                onClick={() => setSelectedEvidenceUrl(evidence.url)}
              >
                <span>{evidence.source}</span>
                <strong>{evidence.title}</strong>
                <small>{evidence.clue}</small>
              </button>
            ))}
          </div>

          <div className="score-strip readiness-strip">
            <span>{readiness.label}</span>
            <strong>{readiness.completed}/{readiness.required}</strong>
          </div>

          {!walletAddress && (
            <div className="wallet-gate">
              <strong>Wallet needed for scored submissions</strong>
              <p>Connect before sealing answers so XP can belong to a player address.</p>
              <button className="secondary-action" type="button" onClick={onConnect}>
                Connect wallet
              </button>
              {walletError && <small>{walletError}</small>}
            </div>
          )}
          {walletAddress && !roomJoined && (
            <div className="wallet-gate">
              <strong>Join the room first</strong>
              <p>{contract.configured ? 'Add a handle in the room console so the contract can register your run.' : 'Deploy and configure the contract address before final scoring.'}</p>
            </div>
          )}

          <button
            className="primary-action wide"
            type="button"
            onClick={submitChamber}
            disabled={!canSubmit}
            title={submitDisabledReason || 'Submit to GenLayer judging'}
          >
            {contract.isLoading ? 'Working on-chain...' : walletAddress ? 'Submit / run judging' : 'Connect wallet to submit'}
          </button>
          {judgingStatus && <p className="judging-status">{judgingStatus}</p>}
          {submitDisabledReason && <small className="submit-hint">{submitDisabledReason}</small>}
          {contract.error && <p className="contract-error">{contract.error}</p>}
        </div>
      </section>
    </div>
  )
}

function PlayPage({
  raidStarted,
  raidEnded,
  startRaid,
  timeLeftSeconds,
  timerToast,
  openedLevelIndex,
  closeLevel,
  openLevel,
  nearChamber,
  setNearChamber,
  unlockedLevelIndex,
  levelNotice,
  walletAddress,
  onConnect,
  walletError,
  contract,
  handle,
  setHandle,
  roomCreated,
  roomJoined,
  chainSyncStatus,
  createRoom,
  joinRoom,
  selectedAnswers,
  setSelectedAnswers,
  selectedEvidenceUrl,
  setSelectedEvidenceUrl,
  submitChamber,
  judgingStatus,
  gameReady,
  setGameReady,
  readiness,
}) {
  const activeChamber = openedLevelIndex === null ? null : CHAMBERS[openedLevelIndex]
  const levelNumber = openedLevelIndex === null ? '--' : String(openedLevelIndex + 1).padStart(2, '0')
  const clockLabel = formatClock(timeLeftSeconds)
  const timerPhase = getTimerPhase(timeLeftSeconds, raidEnded)
  const joinDisabledReason = !contract.configured
    ? 'Contract is not configured.'
    : !walletAddress
      ? 'Connect a wallet first.'
      : roomJoined
        ? 'This wallet is already joined from on-chain state.'
      : chainSyncStatus !== 'ready'
        ? 'Syncing room and player state from GenLayer...'
      : !roomCreated
        ? 'Room was not found on the deployed contract.'
        : !handle.trim()
          ? 'Enter a raider handle first.'
          : contract.isLoading
            ? 'Transaction in progress.'
            : ''
  const canJoinRoom = joinDisabledReason === ''
  const createDisabledReason = !contract.configured
    ? 'Contract is not configured.'
    : !walletAddress
      ? 'Connect a wallet first.'
      : chainSyncStatus !== 'ready'
        ? 'Checking whether room already exists.'
      : roomCreated
        ? 'Room already exists.'
        : contract.isLoading
          ? 'Transaction in progress.'
          : ''
  const canCreateRoom = createDisabledReason === ''
  const submitDisabledReason = (() => {
    if (!contract.configured) return 'Contract is not configured.'
    if (!walletAddress) return 'Connect a wallet first.'
    if (!roomJoined) return 'Join the room first.'
    if (raidEnded) return 'Raid timer ended. Game over.'
    if (!raidStarted) return 'Start the raid first.'
    if (!activeChamber) return 'Open a level first.'
    if (!readiness.ready) return readiness.label
    if (contract.isLoading) return 'Transaction in progress.'
    return ''
  })()
  const canSubmit = submitDisabledReason === ''

  return (
    <section className="play-page page-reveal">
      <div className="play-header">
        <div>
          <span className="kicker">Level {levelNumber} / {CHAMBERS.length}</span>
          <h1>The False-Light Catacombs</h1>
        </div>
        <div className="play-controls">
          <div className={`raid-clock ${timerPhase}`}>
            <TimerIcon />
            <span>Raid clock</span>
            <strong>{clockLabel}</strong>
          </div>
          <button className="primary-action" type="button" onClick={startRaid}>
            {raidStarted || raidEnded ? 'Restart raid' : 'Start raid'}
          </button>
        </div>
      </div>

      {timerToast && <div className={`timer-toast ${timerPhase}`}>{timerToast}</div>}

      <div className="room-console">
        <div>
          <span className="kicker">Room {RAID_SEASON.roomCode}</span>
          <strong>
            {roomJoined
              ? 'Joined and ready'
              : contract.configured
                ? roomCreated
                  ? 'Room live - join to submit'
                  : chainSyncStatus === 'ready'
                    ? 'Room not found on-chain'
                    : 'Syncing room from GenLayer'
                : 'Deploy contract to join on-chain'}
          </strong>
          {contract.configured ? (
            <small>Contract room #{contract.roomId}</small>
          ) : (
            <small>Set VITE_TRUTH_RAIDERS_CONTRACT_ADDRESS after deployment.</small>
          )}
        </div>
        <label>
          Raider handle
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="Your display name"
            disabled={roomJoined}
          />
        </label>
        <div className="room-actions">
          <button
            className="secondary-action"
            type="button"
            onClick={createRoom}
            disabled={!canCreateRoom}
            title={createDisabledReason || 'Create the weekly raid room on-chain'}
          >
            {roomCreated ? 'Room live' : contract.isLoading ? 'Working...' : 'Create room'}
          </button>
          <button className="secondary-action" type="button" onClick={joinRoom} disabled={!canJoinRoom} title={joinDisabledReason || 'Join this room'}>
            {roomJoined ? 'Room joined' : contract.isLoading ? 'Working...' : 'Join room'}
          </button>
        </div>
        {joinDisabledReason && <small className="join-hint">{joinDisabledReason}</small>}
        {contract.error && <small className="join-error">{contract.error}</small>}
      </div>

      <div className="game-frame game-frame-wide">
        <div className="game-topbar">
          <span>{raidEnded ? 'raid complete: game over' : gameReady ? 'raid engine online' : raidStarted ? 'loading raid engine' : 'raid engine standby'}</span>
          <span>
            {raidEnded
              ? 'timer expired'
              : nearChamber !== null
              ? nearChamber <= unlockedLevelIndex
                ? `press space for level 0${nearChamber + 1}`
                : `level 0${nearChamber + 1} locked`
              : 'move with WASD / arrows'}
          </span>
        </div>
        {levelNotice && <div className="level-notice">{levelNotice}</div>}
        {raidEnded ? (
          <div className="game-over-map">
            <Sigil name="game over seal" />
            <strong>Game over</strong>
            <p>The raid clock reached zero. Check the leaderboard or restart the room run.</p>
          </div>
        ) : raidStarted ? (
          <TruthRaidersGame
            avatarFrame={AVATARS[0].frame}
            onReady={() => setGameReady(true)}
            onChamber={(index) => openLevel(index)}
            onProximity={(index) => setNearChamber(index)}
          />
        ) : (
          <div className="sleeping-map">
            <Sigil name="sealed map" />
            <strong>Raid map sealed</strong>
            <p>Start the weekly raid to activate the dungeon.</p>
          </div>
        )}
      </div>

      <section className="play-main">
        <div className="panel how-to-play">
          <div className="panel-heading">
            <span>How to play</span>
            <span className="fine">{CHAMBERS.length} levels</span>
          </div>
          <div className="rule-row">
            <span>01</span>
            <p>Connect wallet, add a handle, join the room, then click Start raid.</p>
          </div>
          <div className="rule-row">
            <span>02</span>
            <p>Walk near a glowing level marker and press Space to load that challenge.</p>
          </div>
          <div className="rule-row">
            <span>03</span>
            <p>Answer five fast questions, choose an evidence card, and submit the packet.</p>
          </div>
          <div className="rule-row">
            <span>04</span>
            <p>Finish all levels to climb the weekly XP leaderboard.</p>
          </div>
        </div>
      </section>

      <ChallengeModal
        activeChamber={activeChamber}
        levelNumber={levelNumber}
        onClose={closeLevel}
        walletAddress={walletAddress}
        onConnect={onConnect}
        walletError={walletError}
        contract={contract}
        roomJoined={roomJoined}
        selectedAnswers={selectedAnswers}
        setSelectedAnswers={setSelectedAnswers}
        selectedEvidenceUrl={selectedEvidenceUrl}
        setSelectedEvidenceUrl={setSelectedEvidenceUrl}
        submitChamber={submitChamber}
        judgingStatus={judgingStatus}
        readiness={readiness}
        canSubmit={canSubmit}
        submitDisabledReason={submitDisabledReason}
        clockLabel={clockLabel}
        timerPhase={timerPhase}
      />
    </section>
  )
}

function LeaderboardPage({ leaderboardPlayers }) {
  return (
    <section className="leaderboard-page page-reveal">
      <div className="page-title">
        <span className="kicker">Weekly XP distribution</span>
        <h1>Leaderboard</h1>
        <p>No fake raiders. Final XP appears after GenLayer validator scoring finalizes submitted packets.</p>
      </div>
      <div className="leaderboard-shell">
        <Leaderboard players={leaderboardPlayers} />
        <div className="panel">
          <div className="panel-heading">
            <span>Prize logic</span>
            <span className="fine">after consensus</span>
          </div>
          <div className="prize-grid">
            <div><b>1st</b><span>40% XP pool</span></div>
            <div><b>2nd</b><span>25% XP pool</span></div>
            <div><b>3rd</b><span>15% XP pool</span></div>
            <div><b>Raiders</b><span>participation XP</span></div>
          </div>
        </div>
      </div>
    </section>
  )
}

function FaqPage() {
  const faqs = [
    ['Is this multiplayer?', 'Yes. The MVP shows a room roster and shared raid structure; the next layer adds realtime room presence while GenLayer remains the scoring authority.'],
    ['Why GenLayer?', 'The game needs subjective judging: answer quality, evidence strength, safety, and XP fairness. That is where Intelligent Contracts and Optimistic Democracy fit.'],
    ['How long is a match?', 'The intended community format is 5-15 minutes with five evidence-heavy levels and one final leaderboard reveal.'],
    ['Can it replay weekly?', 'Yes. Each week can use a new raid seed, new claims, new evidence tasks, and a fresh XP leaderboard.'],
  ]

  return (
    <section className="faq-page page-reveal">
      <div className="page-title">
        <span className="kicker">Raid manual</span>
        <h1>FAQ</h1>
      </div>
      <div className="faq-list">
        {faqs.map(([question, answer]) => (
          <article className="faq-card" key={question}>
            <h2>{question}</h2>
            <p>{answer}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [walletAddress, setWalletAddress] = useState('')
  const [walletError, setWalletError] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [raidStarted, setRaidStarted] = useState(false)
  const [raidEnded, setRaidEnded] = useState(false)
  const [raidEndsAt, setRaidEndsAt] = useState(0)
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(RAID_DURATION_SECONDS)
  const [timerToast, setTimerToast] = useState('')
  const [handle, setHandle] = useState('')
  const [roomCreated, setRoomCreated] = useState(false)
  const [roomJoined, setRoomJoined] = useState(false)
  const [, setActiveChamberIndex] = useState(0)
  const [openedLevelIndex, setOpenedLevelIndex] = useState(null)
  const [nearChamber, setNearChamber] = useState(null)
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const [selectedEvidenceUrl, setSelectedEvidenceUrl] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [gameReady, setGameReady] = useState(false)
  const [levelNotice, setLevelNotice] = useState('')
  const [judgingStatus, setJudgingStatus] = useState('')
  const [leaderboardPlayers, setLeaderboardPlayers] = useState([])
  const [progressRefreshKey, setProgressRefreshKey] = useState(0)
  const [chainSyncStatus, setChainSyncStatus] = useState('idle')
  const [pendingJudgingKeys, setPendingJudgingKeys] = useState([])
  const timerWarningRef = useRef({ warning: false, danger: false, final: false })

  const contract = useTruthRaidersContract(walletAddress)
  const { configured: contractConfigured, getRoom, getLeaderboard, getRoomCount, getSubmission } = contract
  const connectedPlayer = useMemo(
    () => leaderboardPlayers.find((player) => normalizeWallet(player.wallet) === normalizeWallet(walletAddress)),
    [leaderboardPlayers, walletAddress]
  )
  const isJoined = roomJoined || Boolean(connectedPlayer)
  const completedLevelIds = useMemo(
    () => {
      const completed = new Set(
      submissions
        .filter((submission) => normalizeWallet(submission.wallet) === normalizeWallet(walletAddress) && submission.status === 'scored')
        .map((submission) => submission.chamberId)
      )

      if (Number(connectedPlayer?.xp || 0) > 0) {
        completed.add(CHAMBERS[0].id)
      }

      return completed
    },
    [connectedPlayer, submissions, walletAddress]
  )
  const nextLevelIndex = CHAMBERS.findIndex((chamber) => !completedLevelIds.has(chamber.id))
  const unlockedLevelIndex = nextLevelIndex === -1 ? CHAMBERS.length - 1 : nextLevelIndex
  const activeChamber = openedLevelIndex === null ? null : CHAMBERS[openedLevelIndex]
  const readiness = getReadiness(selectedAnswers, selectedEvidenceUrl, activeChamber)

  useEffect(() => {
    if (!window.ethereum) return undefined

    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts) => setWalletAddress(accounts?.[0] ?? ''))
      .catch(() => undefined)

    function handleAccountsChanged(accounts) {
      setWalletAddress(accounts?.[0] ?? '')
      setWalletError('')
    }

    window.ethereum.on?.('accountsChanged', handleAccountsChanged)
    return () => window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged)
  }, [])

  useEffect(() => {
    if (!contractConfigured) return undefined

    let cancelled = false

    async function syncContractState() {
      if (cancelled) return
      setChainSyncStatus((status) => (status === 'ready' ? 'ready' : 'syncing'))

      const [roomResult, leaderboardResult, roomCountResult] = await Promise.allSettled([
        getRoom(),
        getLeaderboard(),
        getRoomCount(),
      ])

      if (cancelled) return

      if (roomResult.status === 'fulfilled') {
        setRoomCreated(true)
      }

      if (leaderboardResult.status === 'fulfilled' && Array.isArray(leaderboardResult.value)) {
        setRoomCreated(true)
        setLeaderboardPlayers(leaderboardResult.value)
      }

      if (roomCountResult.status === 'fulfilled' && Number(roomCountResult.value || 0) <= Number(contract.roomId || 0)) {
        setRoomCreated(false)
        setLeaderboardPlayers([])
      }

      if (roomResult.status === 'fulfilled' || leaderboardResult.status === 'fulfilled' || roomCountResult.status === 'fulfilled') {
        setChainSyncStatus('ready')
      } else {
        setRoomCreated(false)
        setChainSyncStatus('ready')
      }
    }

    syncContractState()
    const interval = window.setInterval(syncContractState, 8000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [contract.roomId, contractConfigured, getLeaderboard, getRoom, getRoomCount])

  useEffect(() => {
    if (!contractConfigured) {
      setRoomCreated(false)
      setLeaderboardPlayers([])
      setChainSyncStatus('idle')
    }
  }, [contractConfigured])

  useEffect(() => {
    if (!walletAddress) {
      setRoomJoined(false)
      return
    }

    if (connectedPlayer) {
      setRoomJoined(true)
      setHandle(connectedPlayer.handle || '')
      return
    }

    if (chainSyncStatus === 'ready') {
      setRoomJoined(false)
    }
  }, [chainSyncStatus, connectedPlayer, walletAddress])

  useEffect(() => {
    if (!contractConfigured || !walletAddress || !isJoined) return undefined

    let cancelled = false
    Promise.allSettled(CHAMBERS.map((chamber, index) => getSubmission(index, walletAddress).then((submission) => ({ chamber, submission }))))
      .then((results) => {
        if (cancelled) return
        const restored = results
          .filter((result) => result.status === 'fulfilled' && result.value.submission?.scored_at)
          .map((result) => ({
            playerId: 'you',
            wallet: walletAddress,
            handle: handle.trim() || 'Raider',
            chamberId: result.value.chamber.id,
            chamberLabel: result.value.chamber.label,
            answer: result.value.submission.answer,
            sourceUrl: result.value.submission.evidence_url,
            tasks: result.value.chamber.tasks,
            scoring: result.value.chamber.scoring,
            status: 'scored',
            score: result.value.submission.score,
            xpAward: result.value.submission.xp_award,
            createdAt: result.value.submission.scored_at,
          }))

        setSubmissions((current) => [
          ...current.filter((submission) => normalizeWallet(submission.wallet) !== normalizeWallet(walletAddress)),
          ...restored,
        ])
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [contractConfigured, getSubmission, handle, isJoined, progressRefreshKey, walletAddress])

  useEffect(() => {
    if (!contractConfigured || !walletAddress || !isJoined) return undefined

    const interval = window.setInterval(() => {
      setProgressRefreshKey((key) => key + 1)
    }, 12000)

    return () => window.clearInterval(interval)
  }, [contractConfigured, isJoined, walletAddress])

  useEffect(() => {
    if (!raidStarted || !raidEndsAt) return undefined

    const toastTimeouts = []

    function flashTimerToast(message) {
      setTimerToast(message)
      const timeout = window.setTimeout(() => setTimerToast(''), 4200)
      toastTimeouts.push(timeout)
    }

    function tick() {
      const remaining = Math.max(0, Math.ceil((raidEndsAt - Date.now()) / 1000))
      setTimeLeftSeconds(remaining)

      if (remaining <= 180 && remaining > 90 && !timerWarningRef.current.warning) {
        timerWarningRef.current.warning = true
        flashTimerToast(`${formatClock(remaining)} left. Keep moving.`)
      }

      if (remaining <= 90 && remaining > 30 && !timerWarningRef.current.danger) {
        timerWarningRef.current.danger = true
        flashTimerToast(`${formatClock(remaining)} left. Raid clock is turning hot.`)
      }

      if (remaining <= 30 && remaining > 0 && !timerWarningRef.current.final) {
        timerWarningRef.current.final = true
        flashTimerToast(`${formatClock(remaining)} left. Final answers now.`)
      }

      if (remaining <= 0) {
        setRaidStarted(false)
        setRaidEnded(true)
        setOpenedLevelIndex(null)
        setJudgingStatus('')
        setTimerToast('Game over. The raid clock reached zero.')
        setLevelNotice('Raid clock hit zero. Game over.')
      }
    }

    tick()
    const interval = window.setInterval(tick, 1000)

    return () => {
      window.clearInterval(interval)
      toastTimeouts.forEach((timeout) => window.clearTimeout(timeout))
    }
  }, [raidEndsAt, raidStarted])

  function startRaid() {
    const endsAt = Date.now() + RAID_DURATION_SECONDS * 1000
    timerWarningRef.current = { warning: false, danger: false, final: false }
    setRaidStarted(true)
    setRaidEnded(false)
    setRaidEndsAt(endsAt)
    setTimeLeftSeconds(RAID_DURATION_SECONDS)
    setTimerToast(`Raid clock started: ${formatClock(RAID_DURATION_SECONDS)}`)
    setActiveTab('play')
    setActiveChamberIndex(0)
    setOpenedLevelIndex(null)
    setLevelNotice('')
    setJudgingStatus('')
    setGameReady(false)
    setSelectedAnswers({})
    setSelectedEvidenceUrl('')
  }

  function openLevel(index) {
    if (raidEnded || timeLeftSeconds <= 0) {
      setLevelNotice('The raid is over. Restart the raid to open levels again.')
      window.setTimeout(() => setLevelNotice(''), 2800)
      return
    }

    if (!raidStarted) {
      setLevelNotice('Start the raid clock before opening a level.')
      window.setTimeout(() => setLevelNotice(''), 2800)
      return
    }

    if (index > unlockedLevelIndex) {
      setLevelNotice(`Level ${index + 1} is locked. Finish level ${unlockedLevelIndex + 1} first.`)
      window.setTimeout(() => setLevelNotice(''), 2800)
      return
    }

    const chamber = CHAMBERS[index]
    setLevelNotice('')
    setActiveChamberIndex(index)
    setOpenedLevelIndex(index)
    setSelectedAnswers({})
    setSelectedEvidenceUrl(chamber.evidence[0]?.url ?? '')
    setJudgingStatus('')
  }

  function closeLevel() {
    if (contract.isLoading) return
    setOpenedLevelIndex(null)
    setJudgingStatus('')
  }

  async function joinRoom() {
    if (!walletAddress || !handle.trim() || !roomCreated || !contract.configured) return
    try {
      await contract.joinRoom(handle.trim())
      setRoomJoined(true)
      const players = await getLeaderboard()
      if (Array.isArray(players)) setLeaderboardPlayers(players)
    } catch {
      setRoomJoined(false)
    }
  }

  async function createRaidRoom() {
    if (!walletAddress || roomCreated || !contract.configured) return
    try {
      await contract.createRoom(RAID_SEASON.code, RAID_SEASON.roomCode, CHAMBERS.length, RAID_SEASON.xpPool)
      setRoomCreated(true)
      setChainSyncStatus('ready')
      getLeaderboard()
        .then((players) => {
          if (Array.isArray(players)) setLeaderboardPlayers(players)
        })
        .catch(() => undefined)
    } catch {
      setRoomCreated(false)
    }
  }

  async function connectWallet() {
    setWalletError('')

    if (!window.ethereum) {
      setWalletError('No EVM wallet was detected in this browser.')
      return
    }

    setIsConnecting(true)
    try {
      await ensureGenLayerNetwork(window.ethereum)
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setWalletAddress(accounts?.[0] ?? '')
    } catch (error) {
      setWalletError(error?.message || 'Wallet connection was rejected.')
    } finally {
      setIsConnecting(false)
    }
  }

  function disconnectWallet() {
    setWalletAddress('')
    setWalletError('')
    setRoomCreated(false)
    setRoomJoined(false)
  }

  async function submitChamber() {
    if (raidEnded || !raidStarted || timeLeftSeconds <= 0) {
      setJudgingStatus('Raid timer ended. Game over.')
      return
    }

    if (!activeChamber || openedLevelIndex === null || !walletAddress || !isJoined || !readiness.ready || !contract.configured) return

    const roundId = openedLevelIndex
    const pendingKey = `${normalizeWallet(walletAddress)}:${roundId}`
    const answerPacket = buildAnswerPacket(activeChamber, selectedAnswers, selectedEvidenceUrl)
    const prompt = `${activeChamber.prompt}\nQuestion count: ${activeChamber.questions.length}\nEvidence choices:\n${activeChamber.evidence.map((item) => `- ${item.title}: ${item.url}`).join('\n')}`
    const rubric = `${activeChamber.scoring.join(',')}\nAnswer key:\n${buildAnswerKey(activeChamber)}`

    async function waitForSubmission() {
      for (let attempt = 0; attempt < 45; attempt += 1) {
        try {
          return await contract.getSubmission(roundId, walletAddress)
        } catch {
          await sleep(4000)
        }
      }
      return null
    }

    try {
      let submission = null
      const isPendingJudging = pendingJudgingKeys.includes(pendingKey)
      setJudgingStatus('Checking whether this level already has a saved answer...')

      try {
        submission = await contract.getSubmission(roundId, walletAddress)
      } catch {
        if (isPendingJudging) {
          setJudgingStatus('Your answer is already saved. GenLayer has not exposed it to reads yet; click this button again in a moment to run judging.')
          return
        }

        setJudgingStatus('Saving your answer on GenLayer...')
        await contract.submitRound(roundId, activeChamber.label, answerPacket, selectedEvidenceUrl)
        setPendingJudgingKeys((keys) => (keys.includes(pendingKey) ? keys : [...keys, pendingKey]))
        setJudgingStatus('Answer saved. Waiting for accepted state before judging...')
        submission = await waitForSubmission()

        if (!submission) {
          setJudgingStatus('Answer saved on-chain. GenLayer is still catching up; click this button again shortly to run judging.')
          return
        }
      }

      if (!submission?.scored_at) {
        setJudgingStatus('Running GenLayer judging. This can take 30-60 seconds.')
        await contract.scoreRound(roundId, walletAddress, prompt, rubric)
        setPendingJudgingKeys((keys) => keys.filter((key) => key !== pendingKey))
      } else {
        setJudgingStatus('This level was already judged. Unlocking the next level...')
        setPendingJudgingKeys((keys) => keys.filter((key) => key !== pendingKey))
      }
      const players = await getLeaderboard()
      if (Array.isArray(players)) setLeaderboardPlayers(players)
      setProgressRefreshKey((key) => key + 1)
    } catch (error) {
      setJudgingStatus(error?.message || 'The answer was saved, but judging did not finish. Click the button again in a moment.')
      return
    }

    setSubmissions((current) => [
      ...current.filter((submission) => submission.chamberId !== activeChamber.id || submission.playerId !== 'you'),
      {
        playerId: 'you',
        wallet: walletAddress,
        handle: handle.trim(),
        chamberId: activeChamber.id,
        chamberLabel: activeChamber.label,
        answer: answerPacket,
        sourceUrl: selectedEvidenceUrl,
        tasks: activeChamber.tasks,
        scoring: activeChamber.scoring,
        status: 'scored',
        createdAt: new Date().toISOString(),
      },
    ])
    setSelectedAnswers({})
    setSelectedEvidenceUrl('')
    setOpenedLevelIndex(null)
    setActiveChamberIndex((index) => Math.min(CHAMBERS.length - 1, index + 1))
    setLevelNotice(`Level ${openedLevelIndex + 1} cleared. Level ${Math.min(CHAMBERS.length, openedLevelIndex + 2)} unlocked.`)
    setJudgingStatus('Judging complete. XP has been written on-chain.')
  }

  return (
    <main className="raid-shell">
      <Nav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        walletAddress={walletAddress}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
        isConnecting={isConnecting}
      />

      {activeTab === 'overview' && <OverviewPage onPlay={startRaid} walletAddress={walletAddress} onConnect={connectWallet} />}
      {activeTab === 'play' && (
        <PlayPage
          raidStarted={raidStarted}
          raidEnded={raidEnded}
          startRaid={startRaid}
          timeLeftSeconds={timeLeftSeconds}
          timerToast={timerToast}
          openedLevelIndex={openedLevelIndex}
          closeLevel={closeLevel}
          openLevel={openLevel}
          nearChamber={nearChamber}
          setNearChamber={setNearChamber}
          unlockedLevelIndex={unlockedLevelIndex}
          levelNotice={levelNotice}
          walletAddress={walletAddress}
          onConnect={connectWallet}
          walletError={walletError}
          contract={contract}
          handle={handle}
          setHandle={setHandle}
          roomCreated={roomCreated}
          roomJoined={isJoined}
          chainSyncStatus={chainSyncStatus}
          createRoom={createRaidRoom}
          joinRoom={joinRoom}
          selectedAnswers={selectedAnswers}
          setSelectedAnswers={setSelectedAnswers}
          selectedEvidenceUrl={selectedEvidenceUrl}
          setSelectedEvidenceUrl={setSelectedEvidenceUrl}
          submitChamber={submitChamber}
          judgingStatus={judgingStatus}
          gameReady={gameReady}
          setGameReady={setGameReady}
          readiness={readiness}
        />
      )}
      {activeTab === 'leaderboard' && <LeaderboardPage leaderboardPlayers={leaderboardPlayers} />}
      {activeTab === 'faq' && <FaqPage />}
    </main>
  )
}

export default App
