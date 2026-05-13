import { useEffect, useMemo, useState } from 'react'
import TruthRaidersGame from './game/TruthRaidersGame'
import { useTruthRaidersContract } from './hooks/useTruthRaidersContract'
import { AVATARS, CHAMBERS, RAID_SEASON, getReadiness } from './data/raidContent'
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

function Leaderboard({ walletAddress, handle, submissions }) {
  const ranked = useMemo(() => {
    if (!walletAddress || submissions.length === 0) return []

    const completed = submissions.filter((submission) => submission.wallet === walletAddress)
    return [
      {
        id: walletAddress,
        name: handle || shortAddress(walletAddress),
        status: `${completed.length}/${CHAMBERS.length} packets locked`,
        xp: 'pending',
      },
    ]
  }, [handle, submissions, walletAddress])

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
            <b>{player.xp === 'pending' ? 'XP pending' : `${player.xp} XP`}</b>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <strong>No finalized raiders yet</strong>
          <p>Leaderboard entries appear after a wallet submits level packets and GenLayer scoring is wired to the deployed contract.</p>
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

function PlayPage({
  raidStarted,
  startRaid,
  openedLevelIndex,
  openLevel,
  nearChamber,
  setNearChamber,
  walletAddress,
  onConnect,
  walletError,
  contract,
  handle,
  setHandle,
  roomCreated,
  createRoom,
  roomJoined,
  joinRoom,
  answer,
  setAnswer,
  selectedEvidenceUrl,
  setSelectedEvidenceUrl,
  submitChamber,
  gameReady,
  setGameReady,
  readiness,
}) {
  const activeChamber = openedLevelIndex === null ? null : CHAMBERS[openedLevelIndex]
  const levelNumber = openedLevelIndex === null ? '--' : String(openedLevelIndex + 1).padStart(2, '0')

  return (
    <section className="play-page page-reveal">
      <div className="play-header">
        <div>
          <span className="kicker">Level {levelNumber} / {CHAMBERS.length}</span>
          <h1>The False-Light Catacombs</h1>
        </div>
        <button className="primary-action" type="button" onClick={startRaid}>
          {raidStarted ? 'Raid running' : 'Start raid'}
        </button>
      </div>

      <div className="room-console">
        <div>
          <span className="kicker">Room {RAID_SEASON.roomCode}</span>
          <strong>{roomJoined ? 'Joined and ready' : contract.configured ? 'Join before submitting' : 'Deploy contract to join on-chain'}</strong>
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
          <button className="secondary-action" type="button" onClick={createRoom} disabled={!walletAddress || roomCreated || !contract.configured || contract.isLoading}>
            {roomCreated ? 'Room created' : 'Create room'}
          </button>
          <button className="secondary-action" type="button" onClick={joinRoom} disabled={!walletAddress || !handle.trim() || roomJoined || !roomCreated || !contract.configured || contract.isLoading}>
            {roomJoined ? 'Room joined' : contract.isLoading ? 'Working...' : 'Join room'}
          </button>
        </div>
      </div>

      <div className="game-frame game-frame-wide">
        <div className="game-topbar">
          <span>{gameReady ? 'raid engine online' : 'loading raid engine'}</span>
          <span>{nearChamber !== null ? `press space for level 0${nearChamber + 1}` : 'move with WASD / arrows'}</span>
        </div>
        {raidStarted ? (
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
        <div className="panel submission-panel">
          {activeChamber ? (
            <>
              <div className="panel-heading">
                <span>Level {levelNumber}</span>
                <span className="fine">{activeChamber.label}</span>
              </div>
              <h2>{activeChamber.title}</h2>
              <p className="prompt">{activeChamber.prompt}</p>
              <p className="instruction">{activeChamber.instruction}</p>

              <div className="task-list">
                {activeChamber.tasks.map((task, index) => (
                  <div className="rule-row" key={task}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <p>{task}</p>
                  </div>
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

              <label>
                Raider answer
                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Complete the level tasks using the selected evidence..."
                />
              </label>

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
                disabled={!walletAddress || !roomJoined || !readiness.ready || !contract.configured || contract.isLoading}
              >
                {contract.isLoading ? 'Submitting...' : walletAddress ? 'Submit to GenLayer judging' : 'Connect wallet to submit'}
              </button>
              {contract.error && <p className="contract-error">{contract.error}</p>}
            </>
          ) : (
            <div className="locked-challenge">
              <div className="panel-heading">
                <span>Challenge locked</span>
                <span className="fine">open a level</span>
              </div>
              <h2>Find a glowing marker</h2>
              <p className="prompt">Walk to a level marker in the dungeon and press Space to reveal the challenge.</p>
              <p className="instruction">Questions and evidence cards only appear after you open a level.</p>
            </div>
          )}
        </div>

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
            <p>Complete the task list, choose an evidence card, and write one strong answer.</p>
          </div>
          <div className="rule-row">
            <span>04</span>
            <p>Finish all levels to climb the weekly XP leaderboard.</p>
          </div>
        </div>
      </section>
    </section>
  )
}

function LeaderboardPage({ walletAddress, handle, submissions }) {
  return (
    <section className="leaderboard-page page-reveal">
      <div className="page-title">
        <span className="kicker">Weekly XP distribution</span>
        <h1>Leaderboard</h1>
        <p>No fake raiders. Final XP appears after GenLayer validator scoring finalizes submitted packets.</p>
      </div>
      <div className="leaderboard-shell">
        <Leaderboard walletAddress={walletAddress} handle={handle} submissions={submissions} />
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
  const [handle, setHandle] = useState('')
  const [roomCreated, setRoomCreated] = useState(false)
  const [roomJoined, setRoomJoined] = useState(false)
  const [, setActiveChamberIndex] = useState(0)
  const [openedLevelIndex, setOpenedLevelIndex] = useState(null)
  const [nearChamber, setNearChamber] = useState(null)
  const [answer, setAnswer] = useState('')
  const [selectedEvidenceUrl, setSelectedEvidenceUrl] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [gameReady, setGameReady] = useState(false)

  const contract = useTruthRaidersContract(walletAddress)
  const { configured: contractConfigured, getRoom } = contract
  const activeChamber = openedLevelIndex === null ? null : CHAMBERS[openedLevelIndex]
  const readiness = getReadiness(answer, selectedEvidenceUrl, activeChamber)

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
    if (!contractConfigured || !walletAddress) return undefined

    let cancelled = false
    getRoom()
      .then(() => {
        if (!cancelled) setRoomCreated(true)
      })
      .catch(() => {
        if (!cancelled) setRoomCreated(false)
      })

    return () => {
      cancelled = true
    }
  }, [contractConfigured, getRoom, walletAddress])

  function startRaid() {
    setRaidStarted(true)
    setActiveTab('play')
    setActiveChamberIndex(0)
    setOpenedLevelIndex(null)
    setAnswer('')
    setSelectedEvidenceUrl('')
  }

  function openLevel(index) {
    const chamber = CHAMBERS[index]
    setActiveChamberIndex(index)
    setOpenedLevelIndex(index)
    setAnswer('')
    setSelectedEvidenceUrl(chamber.evidence[0]?.url ?? '')
    window.setTimeout(() => {
      document.querySelector('.submission-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  async function createRoom() {
    if (!walletAddress || !contract.configured) return
    try {
      await contract.createRoom()
      setRoomCreated(true)
    } catch {
      setRoomCreated(false)
    }
  }

  async function joinRoom() {
    if (!walletAddress || !handle.trim() || !roomCreated || !contract.configured) return
    try {
      await contract.joinRoom(handle.trim())
      setRoomJoined(true)
    } catch {
      setRoomJoined(false)
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
    if (!activeChamber || openedLevelIndex === null || !walletAddress || !roomJoined || !readiness.ready || !contract.configured) return

    try {
      await contract.submitRound(openedLevelIndex, activeChamber.label, answer.trim(), selectedEvidenceUrl)
      await contract.scoreRound(
        openedLevelIndex,
        walletAddress,
        `${activeChamber.prompt}\nTasks:\n${activeChamber.tasks.join('\n')}`,
        activeChamber.scoring.join(',')
      )
    } catch {
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
        answer: answer.trim(),
        sourceUrl: selectedEvidenceUrl,
        tasks: activeChamber.tasks,
        scoring: activeChamber.scoring,
        status: 'ready_for_genlayer',
        createdAt: new Date().toISOString(),
      },
    ])
    setAnswer('')
    setSelectedEvidenceUrl('')
    setOpenedLevelIndex(null)
    setActiveChamberIndex((index) => Math.min(CHAMBERS.length - 1, index + 1))
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
          startRaid={startRaid}
          openedLevelIndex={openedLevelIndex}
          openLevel={openLevel}
          nearChamber={nearChamber}
          setNearChamber={setNearChamber}
          walletAddress={walletAddress}
          onConnect={connectWallet}
          walletError={walletError}
          contract={contract}
          handle={handle}
          setHandle={setHandle}
          roomCreated={roomCreated}
          createRoom={createRoom}
          roomJoined={roomJoined}
          joinRoom={joinRoom}
          answer={answer}
          setAnswer={setAnswer}
          selectedEvidenceUrl={selectedEvidenceUrl}
          setSelectedEvidenceUrl={setSelectedEvidenceUrl}
          submitChamber={submitChamber}
          gameReady={gameReady}
          setGameReady={setGameReady}
          readiness={readiness}
        />
      )}
      {activeTab === 'leaderboard' && <LeaderboardPage walletAddress={walletAddress} handle={handle} submissions={submissions} />}
      {activeTab === 'faq' && <FaqPage />}
    </main>
  )
}

export default App
