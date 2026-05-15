import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TruthRaidersGame from './game/TruthRaidersGame'
import { useTruthRaidersContract } from './hooks/useTruthRaidersContract'
import {
  AVATARS,
  CHAMBERS,
  RAID_SEASON,
  buildAnswerKey,
  buildAnswerPacket,
  getReadiness,
  preparePackLevel,
} from './data/raidContent'
import { ensureGenLayerNetwork } from './config/genlayer'
import './App.css'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'lobby', label: 'Lobby' },
  { id: 'play', label: 'Play' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'admin', label: 'Admin' },
  { id: 'faq', label: 'FAQ' },
]

const DEBUG_PREFIX = '[TruthRaiders:submit]'

function debugSubmit(stage, payload = {}) {
  console.info(`${DEBUG_PREFIX} ${stage}`, payload)
}

function debugSubmitError(stage, error, payload = {}) {
  console.error(`${DEBUG_PREFIX} ${stage}`, {
    ...payload,
    error,
    message: error?.message,
    stack: error?.stack,
  })
}

function getInitialRoomId() {
  if (typeof window === 'undefined') return 0
  const rawRoom = new URLSearchParams(window.location.search).get('room')
  const roomId = Number(rawRoom)
  return Number.isInteger(roomId) && roomId >= 0 ? roomId : 0
}

function roomCodeForId(roomId) {
  if (Number(roomId) === 0) return RAID_SEASON.roomCode
  return `TRUTH-${String(roomId).padStart(3, '0')}`
}

function buildRoomUrl(roomId) {
  if (typeof window === 'undefined') return `?room=${roomId}`
  const url = new URL(window.location.href)
  url.searchParams.set('room', String(roomId))
  return url.toString()
}

function shortAddress(address) {
  const normalized = normalizeWallet(address)
  if (!normalized) return ''
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`
}

function normalizeWallet(value) {
  const text = String(value || '')
  const match = text.match(/0x[a-fA-F0-9]{40}/)
  return (match?.[0] || text).toLowerCase()
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

const RAID_DURATION_SECONDS = RAID_SEASON.durationMinutes * 60
const PACK_MODES = {
  short: 'short',
  mcq: 'mcq',
}

function createBlankQuestion() {
  return { prompt: '', answer: '', distractors: ['', '', ''] }
}

function createBlankPackBuilder() {
  return Array.from({ length: 5 }, (_, levelIndex) => ({
    title: `Level ${levelIndex + 1}`,
    prompt: 'Answer these community questions in your own words.',
    evidenceUrl: '',
    questions: Array.from({ length: 5 }, createBlankQuestion),
  }))
}

function createBuilderFromChambers(chambers = CHAMBERS) {
  return chambers.slice(0, 5).map((chamber, levelIndex) => ({
    title: chamber.title || `Level ${levelIndex + 1}`,
    prompt: chamber.prompt || 'Answer these community questions in your own words.',
    evidenceUrl: chamber.evidence?.[0]?.url || '',
    questions: Array.from({ length: 5 }, (_, questionIndex) => {
      const question = chamber.questions?.[questionIndex] || {}
      const correctOption = Array.isArray(question.options) ? question.options[question.answer] : ''
      return {
        prompt: question.prompt || '',
        answer: correctOption || question.answerText || question.answer || '',
        distractors: Array.isArray(question.options)
          ? question.options.filter((_, optionIndex) => optionIndex !== question.answer).slice(0, 3)
          : ['', '', ''],
      }
    }),
  }))
}

function deterministicOffset(seed) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index) * (index + 1)) % 4
  }
  return hash
}

function uniqueOptionList(options) {
  const seen = new Set()
  return options
    .map((option) => String(option || '').trim())
    .filter((option) => {
      const key = option.toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function generateMcqOptions(questionPrompt, correctAnswer, customDistractors = []) {
  const cleanPrompt = questionPrompt.trim()
  const cleanAnswer = correctAnswer.trim()
  const fallbackDistractors = [
    'A related claim that misses the key condition.',
    'An unsupported shortcut that skips verification.',
    'A statement that sounds plausible but does not answer the question.',
    'A UI detail rather than the protocol rule.',
    'A result that depends on trusting one actor blindly.',
  ]
  const distractors = uniqueOptionList([...customDistractors, ...fallbackDistractors])
    .filter((option) => option.toLowerCase() !== cleanAnswer.toLowerCase())
    .slice(0, 3)

  if (distractors.length < 3) {
    throw new Error(`Question "${cleanPrompt.slice(0, 36)}..." needs a correct answer that can produce three unique options.`)
  }

  const options = [cleanAnswer, ...distractors]
  const offset = deterministicOffset(`${cleanPrompt}:${cleanAnswer}`)
  return {
    options: [...options.slice(offset), ...options.slice(0, offset)],
    answer: offset === 0 ? 0 : 4 - offset,
  }
}

function buildLevelsFromPackBuilder(packBuilder, packMode) {
  if (!Array.isArray(packBuilder) || packBuilder.length !== 5) {
    throw new Error('Question pack must contain exactly 5 levels.')
  }

  const isMcq = packMode === PACK_MODES.mcq

  return packBuilder.map((level, levelIndex) => {
    const title = level.title.trim() || `Level ${levelIndex + 1}`
    const prompt = level.prompt.trim() || (isMcq ? 'Answer all five multiple-choice questions.' : 'Answer these community questions in your own words.')
    const evidenceUrl = level.evidenceUrl.trim()
    const questions = level.questions.map((question, questionIndex) => {
      const questionPrompt = question.prompt.trim()
      const answerText = question.answer.trim()
      if (!questionPrompt || !answerText) {
        throw new Error(`Level ${levelIndex + 1}, question ${questionIndex + 1} needs both a question and an answer.`)
      }

      if (isMcq) {
        const generated = generateMcqOptions(questionPrompt, answerText, question.distractors || [])
        return {
          id: `host-l${levelIndex + 1}-q${questionIndex + 1}`,
          type: 'mcq',
          prompt: questionPrompt,
          options: generated.options,
          answer: generated.answer,
        }
      }

      return {
        id: `host-l${levelIndex + 1}-q${questionIndex + 1}`,
        type: 'short',
        prompt: questionPrompt,
        answerText,
      }
    })

    return {
      id: `host-level-${levelIndex + 1}`,
      label: `Level ${levelIndex + 1}`,
      title,
      prompt,
      instruction: isMcq ? 'Choose one answer for each question.' : 'Answer all five questions in your own words. Exact wording is not required.',
      tasks: isMcq
        ? ['Read each question.', 'Choose the best answer.', 'Submit for deterministic XP scoring.']
        : ['Read each question.', 'Write a concise answer.', 'Submit for GenLayer judging.'],
      artifact: null,
      evidence: evidenceUrl
        ? [
            {
              title: 'Moderator reference',
              source: 'Optional source',
              url: evidenceUrl,
              clue: 'Reference material supplied by the host.',
            },
          ]
        : [],
      questions,
      scoring: isMcq
        ? ['selected choices match the moderator answer key']
        : ['semantic match to the official answer key', 'clear reasoning', 'no hallucinated or unrelated claims'],
    }
  })
}

function isMcqChamber(chamber) {
  return Boolean(chamber?.questions?.length) && chamber.questions.every((question) => Array.isArray(question.options) && question.options.length > 0)
}

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
              Browse raid rooms
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

function LobbyPage({
  rooms,
  roomsStatus,
  selectedRoomId,
  roomSearch,
  setRoomSearch,
  lobbyNotice,
  onSearchRoom,
  onCreateRoom,
  onSelectRoom,
  onCopyRoom,
  contract,
  walletAddress,
  onConnect,
}) {
  const hasRooms = rooms.length > 0

  return (
    <section className="lobby-page page-reveal">
      <div className="page-title lobby-title">
        <div>
          <span className="kicker">Raid lobby</span>
          <h1>Rooms</h1>
          <p>Choose a public room card, create a fresh room, or paste a room ID from a shared community link.</p>
        </div>
        <div className="lobby-actions">
          {!walletAddress && (
            <button className="secondary-action" type="button" onClick={onConnect}>
              Connect wallet
            </button>
          )}
          <button className="primary-action" type="button" onClick={onCreateRoom} disabled={!walletAddress || contract.isLoading}>
            {contract.isLoading ? 'Working...' : 'Create room'}
          </button>
        </div>
      </div>

      <div className="room-search-panel">
        <label>
          Find room
          <input
            value={roomSearch}
            onChange={(event) => setRoomSearch(event.target.value)}
            placeholder="Room ID like 2, or code like TRUTH-002"
          />
        </label>
        <button className="secondary-action" type="button" onClick={onSearchRoom}>
          Open room
        </button>
      </div>

      {lobbyNotice && <div className="level-notice">{lobbyNotice}</div>}

      {roomsStatus === 'loading' && (
        <div className="empty-state room-empty">
          <strong>Loading raid rooms</strong>
          <p>Reading room count and room metadata from the StudioNet contract.</p>
        </div>
      )}

      {roomsStatus === 'ready' && !hasRooms && (
        <div className="empty-state room-empty">
          <strong>No rooms yet</strong>
          <p>Create the first room to start this week&apos;s Truth Raiders run.</p>
        </div>
      )}

      <div className="room-card-grid">
        {rooms.map((room) => (
          <article className={`room-card ${Number(room.id) === Number(selectedRoomId) ? 'is-selected' : ''}`} key={room.id}>
            <div className="room-card-top">
              <span className="kicker">Room #{room.id}</span>
              <b>{room.status}</b>
            </div>
            <h2>{room.room_code}</h2>
            <p>{room.season_code}</p>
            <div className="room-meta">
              <span>{room.player_count} / {RAID_SEASON.maxPlayers} players</span>
              <span>{room.round_count} levels</span>
              <span>{room.xp_pool} XP</span>
            </div>
            <div className="room-card-actions">
              <button className="primary-action" type="button" onClick={() => onSelectRoom(room.id, 'play')}>
                Enter room
              </button>
              <button className="secondary-action" type="button" onClick={() => onCopyRoom(room.id)}>
                Copy link
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function AdminPage({
  walletAddress,
  onConnect,
  adminAddress,
  isHost,
  moderatorAddress,
  setModeratorAddress,
  questionPacks,
  packTitle,
  setPackTitle,
  packSeason,
  setPackSeason,
  packMode,
  setPackMode,
  packBuilder,
  setPackBuilder,
  packNotice,
  onLoadDefaultPack,
  onClearPack,
  onCreatePack,
  onAddModerator,
  onRemoveModerator,
  onCreateRoomFromPack,
  contract,
}) {
  const hostDisabledReason = !walletAddress
    ? 'Connect wallet first'
    : !isHost
      ? 'Only the contract admin or an added moderator can publish packs'
      : contract.isLoading
        ? 'Contract transaction in progress'
        : ''

  function updateLevel(levelIndex, patch) {
    setPackBuilder((current) =>
      current.map((level, index) => (index === levelIndex ? { ...level, ...patch } : level))
    )
  }

  function updateQuestion(levelIndex, questionIndex, patch) {
    setPackBuilder((current) =>
      current.map((level, index) => {
        if (index !== levelIndex) return level
        return {
          ...level,
          questions: level.questions.map((question, qIndex) => (qIndex === questionIndex ? { ...question, ...patch } : question)),
        }
      })
    )
  }

  return (
    <section className="admin-page page-reveal">
      <div className="page-title lobby-title">
        <div>
          <span className="kicker">Host console</span>
          <h1>Admin</h1>
          <p>Upload official five-level MCQ or natural-language packs, publish them, and create rooms for community play.</p>
        </div>
        {!walletAddress && (
          <button className="primary-action" type="button" onClick={onConnect}>
            Connect wallet
          </button>
        )}
      </div>

      <div className="admin-grid">
        <section className="panel">
          <div className="panel-heading">
            <span>Access</span>
            <span className="fine">{isHost ? 'host enabled' : 'read only'}</span>
          </div>
          <div className="rule-row">
            <span>AD</span>
            <p>Admin: {adminAddress ? shortAddress(adminAddress) : 'loading'}</p>
          </div>
          <div className="rule-row">
            <span>YOU</span>
            <p>{walletAddress ? shortAddress(walletAddress) : 'No wallet connected'} / {isHost ? 'admin or moderator' : 'not a host'}</p>
          </div>
          <label>
            Moderator address
            <input
              value={moderatorAddress}
              onChange={(event) => setModeratorAddress(event.target.value)}
              placeholder="0x..."
              disabled={!isHost}
            />
          </label>
          <div className="admin-actions">
            <button className="secondary-action" type="button" onClick={onAddModerator} disabled={!isHost || contract.isLoading}>
              Add moderator
            </button>
            <button className="secondary-action" type="button" onClick={onRemoveModerator} disabled={!isHost || contract.isLoading}>
              Remove moderator
            </button>
          </div>
        </section>

        <section className="panel pack-editor">
          <div className="panel-heading">
            <span>Question pack</span>
            <span className="fine">{packMode === PACK_MODES.mcq ? 'multiple choice / deterministic xp' : 'plain questions / semantic answers'}</span>
          </div>
          <label>
            Pack title
            <input value={packTitle} onChange={(event) => setPackTitle(event.target.value)} disabled={!isHost} />
          </label>
          <label>
            Season code
            <input value={packSeason} onChange={(event) => setPackSeason(event.target.value)} disabled={!isHost} />
          </label>
          <label>
            Pack format
            <select value={packMode} onChange={(event) => setPackMode(event.target.value)} disabled={!isHost}>
              <option value={PACK_MODES.short}>Natural language answers</option>
              <option value={PACK_MODES.mcq}>Multiple choice answers</option>
            </select>
          </label>
          <div className="simple-pack-builder">
            {packBuilder.map((level, levelIndex) => (
              <details className="builder-level" key={`level-${levelIndex}`} open={levelIndex === 0}>
                <summary>
                  <span>Level {levelIndex + 1}</span>
                  <small>{level.questions.filter((question) => question.prompt.trim() && question.answer.trim()).length}/5 ready</small>
                </summary>
                <label>
                  Level title
                  <input
                    value={level.title}
                    onChange={(event) => updateLevel(levelIndex, { title: event.target.value })}
                    disabled={!isHost}
                  />
                </label>
                <label>
                  Level intro
                  <input
                    value={level.prompt}
                    onChange={(event) => updateLevel(levelIndex, { prompt: event.target.value })}
                    disabled={!isHost}
                  />
                </label>
                <label>
                  Evidence URL optional
                  <input
                    value={level.evidenceUrl}
                    onChange={(event) => updateLevel(levelIndex, { evidenceUrl: event.target.value })}
                    disabled={!isHost}
                    placeholder="https://docs.genlayer.com/... or leave empty"
                  />
                </label>
                <div className="builder-questions">
                  {level.questions.map((question, questionIndex) => (
                    <div className="builder-question" key={`level-${levelIndex}-question-${questionIndex}`}>
                      <span>Q{questionIndex + 1}</span>
                      <input
                        value={question.prompt}
                        onChange={(event) => updateQuestion(levelIndex, questionIndex, { prompt: event.target.value })}
                        disabled={!isHost}
                        placeholder="Question players will answer"
                      />
                      <textarea
                        value={question.answer}
                        onChange={(event) => updateQuestion(levelIndex, questionIndex, { answer: event.target.value })}
                        disabled={!isHost}
                        placeholder={packMode === PACK_MODES.mcq ? 'Correct answer. Options are generated around this.' : 'Ideal answer. Validators judge meaning, not exact wording.'}
                      />
                      {packMode === PACK_MODES.mcq && (
                        <div className="distractor-grid">
                          {(question.distractors || ['', '', '']).map((distractor, distractorIndex) => (
                            <input
                              key={`distractor-${levelIndex}-${questionIndex}-${distractorIndex}`}
                              value={distractor}
                              onChange={(event) => {
                                const distractors = [...(question.distractors || ['', '', ''])]
                                distractors[distractorIndex] = event.target.value
                                updateQuestion(levelIndex, questionIndex, { distractors })
                              }}
                              disabled={!isHost}
                              placeholder={`Optional wrong option ${distractorIndex + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
          <div className="admin-actions">
            <button className="secondary-action" type="button" onClick={onLoadDefaultPack}>
              Load default pack
            </button>
            <button className="secondary-action" type="button" onClick={onClearPack} disabled={!isHost || contract.isLoading}>
              Clear builder
            </button>
            <button className="primary-action" type="button" onClick={onCreatePack} disabled={Boolean(hostDisabledReason)}>
              Create + publish pack
            </button>
          </div>
          {hostDisabledReason && <small className="submit-hint">{hostDisabledReason}</small>}
          {packNotice && <p className="judging-status">{packNotice}</p>}
        </section>
      </div>

      <section className="panel pack-list-panel">
        <div className="panel-heading">
          <span>Published packs</span>
          <span className="fine">{questionPacks.length} loaded</span>
        </div>
        <div className="pack-list">
          {questionPacks.length > 0 ? (
            questionPacks.map((pack) => (
              <article className="pack-card" key={pack.id}>
                <span className="kicker">Pack #{pack.id}</span>
                <h2>{pack.title}</h2>
                <p>{pack.season_code}</p>
                <div className="room-meta">
                  <span>{pack.status}</span>
                  <span>{pack.level_count} levels</span>
                </div>
                <button className="primary-action" type="button" onClick={() => onCreateRoomFromPack(pack.id)} disabled={!isHost || pack.status !== 'published' || contract.isLoading}>
                  Create room from pack
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <strong>No packs yet</strong>
              <p>Create and publish a pack before creating official mod-hosted rooms.</p>
            </div>
          )}
        </div>
      </section>
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
  const modalRef = useRef(null)

  useEffect(() => {
    if (!activeChamber) return undefined

    function handleEscape(event) {
      if (event.key === 'Escape' && !contract.isLoading) onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [activeChamber, contract.isLoading, onClose])

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.scrollTop = 0
    }
  }, [activeChamber?.id])

  if (!activeChamber) return null

  return createPortal(
    <div className="challenge-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !contract.isLoading) onClose()
    }}>
      <section ref={modalRef} className="challenge-modal" role="dialog" aria-modal="true" aria-labelledby="challenge-title">
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
                {Array.isArray(question.options) && question.options.length > 0 ? (
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
                ) : (
                  <textarea
                    className="short-answer-box"
                    value={selectedAnswers[question.id] || ''}
                    maxLength={220}
                    onChange={(event) => setSelectedAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                    placeholder="Write a concise answer. Same meaning is enough; it does not need to match the host wording."
                  />
                )}
              </article>
            ))}
          </div>

          <ArtifactPanel artifact={activeChamber.artifact} />

          {Array.isArray(activeChamber.evidence) && activeChamber.evidence.length > 0 ? (
            <div className="evidence-grid">
              {activeChamber.evidence.map((evidence) => (
                <button
                  className={`evidence-card ${selectedEvidenceUrl === evidence.url ? 'is-selected' : ''}`}
                  key={evidence.url || evidence.title}
                  type="button"
                  onClick={() => setSelectedEvidenceUrl(evidence.url || '')}
                >
                  <span>{evidence.source || 'Source'}</span>
                  <strong>{evidence.title}</strong>
                  <small>{evidence.clue || evidence.url}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="optional-evidence-note">
              <strong>No evidence URL required</strong>
              <p>This official pack relies on the moderator answer key. GenLayer can still judge the packet without a player-selected source.</p>
            </div>
          )}

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
        </div>
        <div className="modal-submit-bar">
          <div className="score-strip readiness-strip">
            <span>{readiness.label}</span>
            <strong>{readiness.completed}/{readiness.required}</strong>
          </div>
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
    </div>,
    document.body
  )
}

function PlayPage({
  chambers,
  selectedRoom,
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
  roomSettings,
  setRoomSettings,
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
  const activeChamber = openedLevelIndex === null ? null : chambers[openedLevelIndex]
  const roomLabel = selectedRoom?.room_code || `Room #${contract.roomId}`
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
      : !roomSettings.seasonCode.trim()
        ? 'Enter a season code.'
      : !roomSettings.roomCode.trim()
        ? 'Enter a room code.'
      : Number(roomSettings.xpPool) <= 0
        ? 'XP pool must be greater than 0.'
      : chainSyncStatus !== 'ready'
        ? 'Checking whether room already exists.'
      : roomCreated
        ? 'Room already exists.'
        : contract.isLoading
          ? 'Transaction in progress.'
          : ''
  const canCreateRoom = createDisabledReason === ''
  const startDisabledReason = (() => {
    if (!contract.configured) return 'Contract is not configured.'
    if (!walletAddress) return 'Connect a wallet first.'
    if (chainSyncStatus !== 'ready') return 'Syncing room and player state from GenLayer...'
    if (!roomCreated) return 'Create or select a live room first.'
    if (!roomJoined) return 'Join the room before starting the raid.'
    if (contract.isLoading) return 'Transaction in progress.'
    return ''
  })()
  const canStartRaid = startDisabledReason === ''
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
          <span className="kicker">Level {levelNumber} / {chambers.length}</span>
          <h1>The False-Light Catacombs</h1>
        </div>
        <div className="play-controls">
          <div className={`raid-clock ${timerPhase}`}>
            <TimerIcon />
            <span>Raid clock</span>
            <strong>{clockLabel}</strong>
          </div>
          <button
            className="primary-action"
            type="button"
            onClick={startRaid}
            disabled={!canStartRaid}
            title={startDisabledReason || 'Start the raid clock'}
          >
            {raidStarted || raidEnded ? 'Restart raid' : 'Start raid'}
          </button>
          {startDisabledReason && <small className="submit-hint">{startDisabledReason}</small>}
        </div>
      </div>

      {timerToast && <div className={`timer-toast ${timerPhase}`}>{timerToast}</div>}

      <div className="room-console">
        <div>
          <span className="kicker">{roomLabel}</span>
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
            <small>Contract room #{contract.roomId}{selectedRoom?.player_count !== undefined ? ` / ${selectedRoom.player_count} players` : ''}</small>
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
        {!roomCreated && (
          <div className="room-setup-fields">
            <label>
              Season code
              <input
                value={roomSettings.seasonCode}
                onChange={(event) => setRoomSettings((current) => ({ ...current, seasonCode: event.target.value }))}
                placeholder="WEEK-01 / FALSE-LIGHT CATACOMBS"
                disabled={contract.isLoading}
              />
            </label>
            <label>
              Room code
              <input
                value={roomSettings.roomCode}
                onChange={(event) => setRoomSettings((current) => ({ ...current, roomCode: event.target.value }))}
                placeholder="TRUTH-7C2"
                disabled={contract.isLoading}
              />
            </label>
            <label>
              XP pool
              <input
                value={roomSettings.xpPool}
                onChange={(event) => setRoomSettings((current) => ({ ...current, xpPool: event.target.value.replace(/[^\d]/g, '') }))}
                placeholder="1200"
                inputMode="numeric"
                disabled={contract.isLoading}
              />
            </label>
            <div className="readonly-room-field">
              <span>Rounds</span>
              <strong>{chambers.length}</strong>
            </div>
          </div>
        )}
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
        {!roomJoined && joinDisabledReason && <small className="join-hint">{joinDisabledReason}</small>}
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
            <span className="fine">{chambers.length} levels</span>
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

function LeaderboardPage({ leaderboardPlayers, selectedRoom }) {
  return (
    <section className="leaderboard-page page-reveal">
      <div className="page-title">
        <span className="kicker">Weekly XP distribution</span>
        <h1>Leaderboard</h1>
        <p>{selectedRoom ? `${selectedRoom.room_code} / room #${selectedRoom.id}` : 'Select or create a room to track XP.'} Final XP appears after GenLayer validator scoring finalizes submitted packets.</p>
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
  const [selectedRoomId, setSelectedRoomId] = useState(getInitialRoomId)
  const [rooms, setRooms] = useState([])
  const [roomChambers, setRoomChambers] = useState(CHAMBERS)
  const [roomsStatus, setRoomsStatus] = useState('idle')
  const [questionPacks, setQuestionPacks] = useState([])
  const [adminAddress, setAdminAddress] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [moderatorAddress, setModeratorAddress] = useState('')
  const [packTitle, setPackTitle] = useState('Truth Raiders Weekly Pack')
  const [packSeason, setPackSeason] = useState(RAID_SEASON.code)
  const [packMode, setPackMode] = useState(PACK_MODES.mcq)
  const [packBuilder, setPackBuilder] = useState(createBuilderFromChambers)
  const [packNotice, setPackNotice] = useState('')
  const [roomSettings, setRoomSettings] = useState({
    seasonCode: RAID_SEASON.code,
    roomCode: RAID_SEASON.roomCode,
    xpPool: String(RAID_SEASON.xpPool),
  })
  const [roomSearch, setRoomSearch] = useState('')
  const [lobbyNotice, setLobbyNotice] = useState('')
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
  const [isRoundFlowActive, setIsRoundFlowActive] = useState(false)
  const timerWarningRef = useRef({ warning: false, danger: false, final: false })

  const contract = useTruthRaidersContract(walletAddress, selectedRoomId)
  const {
    configured: contractConfigured,
    getRoom,
    getRoomById,
    getLeaderboard,
    getRoomCount,
    getSubmissionStatus,
    getAdmin,
    isModerator,
    getPackCount,
    getQuestionPack,
    getPackLevel,
  } = contract
  const selectedRoom = useMemo(
    () => rooms.find((room) => Number(room.id) === Number(selectedRoomId)) || null,
    [rooms, selectedRoomId]
  )
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

      if (Number(connectedPlayer?.xp || 0) > 0 && roomChambers[0]) {
        completed.add(roomChambers[0].id)
      }

      return completed
    },
    [connectedPlayer, roomChambers, submissions, walletAddress]
  )
  const nextLevelIndex = roomChambers.findIndex((chamber) => !completedLevelIds.has(chamber.id))
  const unlockedLevelIndex = nextLevelIndex === -1 ? roomChambers.length - 1 : nextLevelIndex
  const activeChamber = openedLevelIndex === null ? null : roomChambers[openedLevelIndex]
  const readiness = getReadiness(selectedAnswers, selectedEvidenceUrl, activeChamber)

  const refreshRooms = useCallback(async () => {
    if (!contractConfigured) {
      setRooms([])
      setRoomsStatus('idle')
      return []
    }

    setRoomsStatus((status) => (status === 'ready' ? 'ready' : 'loading'))
    try {
      const count = Number(await getRoomCount())
      const ids = Array.from({ length: Math.max(0, count) }, (_, index) => index)
      const results = await Promise.allSettled(ids.map((roomId) => getRoomById(roomId)))
      const loadedRooms = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value)

      setRooms(loadedRooms)
      setRoomsStatus('ready')
      return loadedRooms
    } catch {
      setRoomsStatus('error')
      return []
    }
  }, [contractConfigured, getRoomById, getRoomCount])

  const refreshPacks = useCallback(async () => {
    if (!contractConfigured) {
      setQuestionPacks([])
      return []
    }

    try {
      const count = Number(await getPackCount())
      const ids = Array.from({ length: Math.max(0, count) }, (_, index) => index)
      const results = await Promise.allSettled(ids.map((packId) => getQuestionPack(packId)))
      const packs = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value)
      setQuestionPacks(packs)
      return packs
    } catch {
      setQuestionPacks([])
      return []
    }
  }, [contractConfigured, getPackCount, getQuestionPack])

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
    function handlePopState() {
      setSelectedRoomId(getInitialRoomId())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('room') === String(selectedRoomId)) return
    url.searchParams.set('room', String(selectedRoomId))
    window.history.replaceState({}, '', url)
  }, [selectedRoomId])

  useEffect(() => {
    if (!contractConfigured) return undefined

    let cancelled = false
    if (!isRoundFlowActive) {
      refreshRooms()
      refreshPacks()
    }

    const interval = window.setInterval(() => {
      if (!cancelled && !isRoundFlowActive) refreshRooms()
    }, 30000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [contractConfigured, isRoundFlowActive, refreshPacks, refreshRooms])

  useEffect(() => {
    if (!contractConfigured) return undefined
    if (isRoundFlowActive) return undefined

    let cancelled = false

    async function loadHostStatus() {
      try {
        const [adminResult, hostResult] = await Promise.allSettled([
          getAdmin(),
          walletAddress ? isModerator(walletAddress) : Promise.resolve(false),
        ])

        if (cancelled) return
        const adminValue = adminResult.status === 'fulfilled' ? adminResult.value : ''
        const isAdminWallet = Boolean(walletAddress && adminValue && normalizeWallet(adminValue) === normalizeWallet(walletAddress))
        const isModeratorWallet = hostResult.status === 'fulfilled' ? Boolean(hostResult.value) : false

        if (adminResult.status === 'fulfilled') setAdminAddress(adminValue)
        setIsHost(isAdminWallet || isModeratorWallet)
      } catch {
        if (!cancelled) setIsHost(false)
      }
    }

    loadHostStatus()
    return () => {
      cancelled = true
    }
  }, [contractConfigured, getAdmin, isModerator, walletAddress])

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
    const interval = window.setInterval(syncContractState, 30000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [contract.roomId, contractConfigured, getLeaderboard, getRoom, getRoomCount, isRoundFlowActive])

  useEffect(() => {
    if (!contractConfigured) {
      setRoomCreated(false)
      setLeaderboardPlayers([])
      setChainSyncStatus('idle')
      setQuestionPacks([])
      setIsHost(false)
      setAdminAddress('')
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
    if (isRoundFlowActive) return undefined
    if (progressRefreshKey === 0 && Number(connectedPlayer?.xp || 0) <= 0) return undefined

    let cancelled = false
    Promise.allSettled(roomChambers.map((chamber, index) => getSubmissionStatus(index, walletAddress).then((submission) => ({ chamber, submission }))))
      .then((results) => {
        if (cancelled) return
        const restored = results
          .filter((result) => result.status === 'fulfilled' && result.value.submission?.scored)
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
  }, [connectedPlayer, contractConfigured, getSubmissionStatus, handle, isJoined, isRoundFlowActive, progressRefreshKey, roomChambers, walletAddress])

  useEffect(() => {
    if (!contractConfigured || !walletAddress || !isJoined) return undefined
    if (isRoundFlowActive) return undefined

    const interval = window.setInterval(() => {
      setProgressRefreshKey((key) => key + 1)
    }, 30000)

    return () => window.clearInterval(interval)
  }, [contractConfigured, isJoined, isRoundFlowActive, walletAddress])

  useEffect(() => {
    setRoomCreated(false)
    setRoomJoined(false)
    setLeaderboardPlayers([])
    setSubmissions([])
    setOpenedLevelIndex(null)
    setSelectedAnswers({})
    setSelectedEvidenceUrl('')
    setJudgingStatus('')
    setLevelNotice('')
    setRaidStarted(false)
    setRaidEnded(false)
    setRaidEndsAt(0)
    setTimeLeftSeconds(RAID_DURATION_SECONDS)
    setTimerToast('')
  }, [selectedRoomId])

  useEffect(() => {
    let cancelled = false

    async function loadRoomPack() {
      if (!selectedRoom?.has_pack) {
        setRoomChambers(CHAMBERS)
        return
      }

      const levelCount = Number(selectedRoom.round_count || 5)
      const results = await Promise.allSettled(
        Array.from({ length: levelCount }, (_, index) => getPackLevel(selectedRoom.pack_id, index))
      )

      if (cancelled) return

      const levels = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => {
          try {
            return JSON.parse(result.value.level_json)
          } catch {
            return null
          }
        })
        .filter(Boolean)

      setRoomChambers(levels.length > 0 ? levels : CHAMBERS)
    }

    loadRoomPack()
    return () => {
      cancelled = true
    }
  }, [getPackLevel, selectedRoom])

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

  function selectRoom(roomId, tab = 'play') {
    const nextRoomId = Number(roomId)
    if (!Number.isInteger(nextRoomId) || nextRoomId < 0) {
      setLobbyNotice('Enter a valid room ID.')
      return
    }

    setSelectedRoomId(nextRoomId)
    setActiveTab(tab)
    setLobbyNotice(`Room #${nextRoomId} selected.`)
    window.setTimeout(() => setLobbyNotice(''), 2600)
  }

  function showPlayNotice(message, duration = 3000) {
    setActiveTab('play')
    setLevelNotice(message)
    window.setTimeout(() => setLevelNotice(''), duration)
  }

  function startRaid() {
    if (!contractConfigured) {
      showPlayNotice('Contract is not configured. Set the deployed Truth Raiders address first.')
      return
    }

    if (!walletAddress) {
      showPlayNotice('Connect your wallet before starting the raid.')
      return
    }

    if (chainSyncStatus !== 'ready') {
      showPlayNotice('Waiting for the deployed room to finish syncing from GenLayer.')
      return
    }

    if (!roomCreated) {
      showPlayNotice('Create or select a live room before starting the raid.')
      return
    }

    if (!isJoined) {
      showPlayNotice('Join the room with this wallet before starting the raid.')
      return
    }

    if (contract.isLoading) {
      showPlayNotice('A contract transaction is still in progress.')
      return
    }

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
    if (!walletAddress) {
      showPlayNotice('Connect your wallet before opening a level.')
      return
    }

    if (!isJoined) {
      showPlayNotice('Join the room with this wallet before opening a level.')
      return
    }

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

    const chamber = roomChambers[index]
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
      const receipt = await contract.joinRoom(handle.trim())
      setRoomJoined(true)
      if (receipt?.pendingSync) {
        setLevelNotice('Join transaction sent. GenLayer is still syncing the room, but this wallet should appear shortly.')
      }
      try {
        const players = await getLeaderboard()
        if (Array.isArray(players)) setLeaderboardPlayers(players)
      } catch {
        setLevelNotice('Join transaction sent. Leaderboard is still syncing from GenLayer.')
      }
    } catch (error) {
      setRoomJoined(false)
      setLevelNotice(error?.message || 'Join failed. Try again in a moment.')
    }
  }

  async function createRaidRoom() {
    if (!walletAddress || !contract.configured) return
    try {
      const nextRoomId = Number(await getRoomCount().catch(() => rooms.length))
      const roomCode = roomSettings.roomCode.trim() || roomCodeForId(nextRoomId)
      const seasonCode = roomSettings.seasonCode.trim() || RAID_SEASON.code
      const xpPool = Math.max(1, Number(roomSettings.xpPool || RAID_SEASON.xpPool))
      const receipt = await contract.createRoom(seasonCode, roomCode, roomChambers.length, xpPool)
      await refreshRooms()
      selectRoom(nextRoomId, 'play')
      setRoomCreated(true)
      setChainSyncStatus('ready')
      if (receipt?.pendingSync) {
        setLevelNotice('Room transaction sent. GenLayer is still syncing it from chain.')
      }
    } catch {
      setLobbyNotice('Room creation failed. Try again in a moment.')
    }
  }

  async function createRoomFromPack(packId) {
    if (!walletAddress || !contract.configured) return
    try {
      const nextRoomId = Number(await getRoomCount().catch(() => rooms.length))
      const roomCode = roomCodeForId(nextRoomId)
      const receipt = await contract.createRoomFromPack(packId, roomCode, RAID_SEASON.xpPool)
      await refreshRooms()
      selectRoom(nextRoomId, 'play')
      setPackNotice(
        receipt?.pendingSync
          ? `Room ${roomCode} was sent from pack #${packId}. GenLayer is still syncing it.`
          : `Room ${roomCode} created from pack #${packId}.`
      )
    } catch (error) {
      setPackNotice(error?.message || 'Room creation from pack failed.')
    }
  }

  async function addModerator() {
    if (!moderatorAddress.trim()) return
    try {
      await contract.addModerator(moderatorAddress.trim())
      setPackNotice('Moderator added.')
      setModeratorAddress('')
    } catch (error) {
      setPackNotice(error?.message || 'Moderator add failed.')
    }
  }

  async function removeModerator() {
    if (!moderatorAddress.trim()) return
    try {
      await contract.removeModerator(moderatorAddress.trim())
      setPackNotice('Moderator removed.')
      setModeratorAddress('')
    } catch (error) {
      setPackNotice(error?.message || 'Moderator remove failed.')
    }
  }

  async function createAndPublishPack() {
    try {
      const levels = buildLevelsFromPackBuilder(packBuilder, packMode)
      const nextPackId = Number(await contract.getPackCount())
      setPackNotice('Creating question pack...')
      await contract.createQuestionPack(packTitle.trim(), packSeason.trim())

      for (let index = 0; index < levels.length; index += 1) {
        const prepared = preparePackLevel(levels[index], index)
        setPackNotice(`Uploading level ${index + 1} of ${levels.length}...`)
        await contract.setPackLevel(
          nextPackId,
          index,
          prepared.label,
          prepared.title,
          prepared.prompt,
          prepared.levelJson,
          prepared.answerKey,
          prepared.evidenceUrls,
          prepared.scoring
        )
      }

      setPackNotice('Publishing question pack...')
      await contract.publishQuestionPack(nextPackId)
      await refreshPacks()
      setPackNotice(`Question pack #${nextPackId} published.`)
    } catch (error) {
      setPackNotice(error?.message || 'Question pack creation failed.')
    }
  }

  function searchRoom() {
    const query = roomSearch.trim()
    if (!query) {
      setLobbyNotice('Enter a room ID or code.')
      return
    }

    if (/^\d+$/.test(query)) {
      selectRoom(Number(query), 'play')
      return
    }

    const match = rooms.find((room) => room.room_code.toLowerCase() === query.toLowerCase())
    if (!match) {
      setLobbyNotice('No matching room code was found in the lobby.')
      return
    }

    selectRoom(match.id, 'play')
  }

  async function copyRoomLink(roomId) {
    const link = buildRoomUrl(roomId)
    try {
      await navigator.clipboard.writeText(link)
      setLobbyNotice(`Copied room #${roomId} link.`)
    } catch {
      setLobbyNotice(link)
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
    debugSubmit('click', {
      walletAddress,
      roomId: contract.roomId,
      openedLevelIndex,
      raidStarted,
      raidEnded,
      timeLeftSeconds,
      isJoined,
      configured: contract.configured,
      readiness,
      activeChamber: activeChamber
        ? {
            id: activeChamber.id,
            label: activeChamber.label,
            title: activeChamber.title,
            questionCount: activeChamber.questions?.length || 0,
          }
        : null,
      selectedAnswers,
      selectedEvidenceUrl,
    })

    if (raidEnded || !raidStarted || timeLeftSeconds <= 0) {
      setJudgingStatus('Raid timer ended. Game over.')
      debugSubmit('blocked:timer-ended', { raidEnded, raidStarted, timeLeftSeconds })
      return
    }

    if (!activeChamber || openedLevelIndex === null || !walletAddress || !isJoined || !readiness.ready || !contract.configured) {
      debugSubmit('blocked:preflight', {
        hasActiveChamber: Boolean(activeChamber),
        openedLevelIndex,
        walletAddress,
        isJoined,
        readiness,
        configured: contract.configured,
      })
      return
    }

    const roundId = openedLevelIndex
    const pendingKey = `${normalizeWallet(walletAddress)}:${roundId}`
    const usesInlineScoring = isMcqChamber(activeChamber)
    const answerPacket = buildAnswerPacket(activeChamber, selectedAnswers, selectedEvidenceUrl)
    const prompt = `${activeChamber.prompt}\nQuestion count: ${activeChamber.questions.length}\nEvidence choices:\n${activeChamber.evidence.map((item) => `- ${item.title}: ${item.url}`).join('\n')}`
    const rubric = `${activeChamber.scoring.join(',')}\nAnswer key:\n${buildAnswerKey(activeChamber)}`

    console.groupCollapsed(`${DEBUG_PREFIX} level ${roundId + 1} flow`)
    debugSubmit('packet-built', {
      roundId,
      pendingKey,
      answerPacket,
      selectedEvidenceUrl,
      usesInlineScoring,
      promptPreview: prompt.slice(0, 500),
      rubricPreview: rubric.slice(0, 500),
    })

    async function waitForSubmissionExists() {
      for (let attempt = 0; attempt < 24; attempt += 1) {
        try {
          const latestSubmission = await contract.getSubmissionStatus(roundId, walletAddress)
          debugSubmit('submission-readback', { attempt: attempt + 1, latestSubmission })
          if (latestSubmission?.exists) return latestSubmission
        } catch (readError) {
          if (attempt === 0 || (attempt + 1) % 6 === 0) {
            debugSubmit('submission-readback-not-ready', {
              attempt: attempt + 1,
              message: readError?.message,
            })
          }
        }
        await sleep(5000)
      }
      return null
    }

    async function waitForScoredSubmission() {
      for (let attempt = 0; attempt < 24; attempt += 1) {
        try {
          const latestSubmission = await contract.getSubmissionStatus(roundId, walletAddress)
          debugSubmit('score-readback', { attempt: attempt + 1, latestSubmission })
          if (latestSubmission?.scored) return latestSubmission
        } catch (readError) {
          if (attempt === 0 || (attempt + 1) % 6 === 0) {
            debugSubmit('score-readback-not-ready', {
              attempt: attempt + 1,
              message: readError?.message,
            })
          }
        }
        await sleep(5000)
      }
      return null
    }

    setIsRoundFlowActive(true)
    let submission = null
    try {
      const isPendingJudging = pendingJudgingKeys.includes(pendingKey)
      setJudgingStatus('Checking whether this level already has a saved answer...')
      debugSubmit('checking-existing-submission', { roundId, player: walletAddress, isPendingJudging })

      try {
        submission = await contract.getSubmissionStatus(roundId, walletAddress)
        debugSubmit('existing-submission-found', { submission })
        if (!submission?.exists) {
          submission = null
          if (isPendingJudging) {
            setJudgingStatus('Answer was already sent. Running GenLayer judging now...')
            debugSubmit('pending-read-skipped:direct-score', { pendingKey })
          } else {
            setJudgingStatus('Saving your answer on GenLayer...')
            debugSubmit('submit-round:start', {
              roundId,
              chamber: activeChamber.label,
              evidenceUrl: selectedEvidenceUrl,
            })
            await contract.submitRound(roundId, activeChamber.label, answerPacket, selectedEvidenceUrl)
            debugSubmit('submit-round:executed')
            setPendingJudgingKeys((keys) => (keys.includes(pendingKey) ? keys : [...keys, pendingKey]))
          }
        }
      } catch (submissionError) {
        debugSubmit('no-existing-submission', { message: submissionError?.message })
        if (isPendingJudging) {
          setJudgingStatus('Answer was already sent. Running GenLayer judging now...')
          debugSubmit('pending-read-skipped:direct-score', { pendingKey })
        } else {
          setJudgingStatus('Saving your answer on GenLayer...')
          debugSubmit('submit-round:start', {
            roundId,
            chamber: activeChamber.label,
            evidenceUrl: selectedEvidenceUrl,
          })
          await contract.submitRound(roundId, activeChamber.label, answerPacket, selectedEvidenceUrl)
          debugSubmit('submit-round:executed')
          setPendingJudgingKeys((keys) => (keys.includes(pendingKey) ? keys : [...keys, pendingKey]))
        }
      }

      if (!submission?.scored && usesInlineScoring) {
        setJudgingStatus('MCQ answer accepted. Unlocking next level while XP syncs in the background.')
        debugSubmit('inline-score:background-sync', { roundId, player: walletAddress })
        submission = {
          exists: true,
          scored: false,
          score: undefined,
          xp_award: undefined,
        }
        setPendingJudgingKeys((keys) => keys.filter((key) => key !== pendingKey))
      } else if (!submission?.scored) {
        if (!submission?.exists) {
          setJudgingStatus('Answer saved. Waiting for GenLayer state before judging...')
          submission = await waitForSubmissionExists()
        }
        if (!submission?.exists) {
          setJudgingStatus('Answer transaction was sent, but StudioNet has not exposed the saved answer yet. Try judging again shortly.')
          debugSubmit('submission-readback-timeout', { roundId, player: walletAddress })
          setPendingJudgingKeys((keys) => (keys.includes(pendingKey) ? keys : [...keys, pendingKey]))
        } else {
          setJudgingStatus('Running GenLayer judging. This can take 30-60 seconds.')
          debugSubmit('score-round:start', {
            roundId,
            player: walletAddress,
            promptLength: prompt.length,
            rubricLength: rubric.length,
          })
          await contract.scoreRound(roundId, walletAddress, prompt, rubric)
          debugSubmit('score-round:executed')
          setJudgingStatus('Judging transaction accepted. Waiting for XP readback...')
          submission = await waitForScoredSubmission()
          if (!submission?.scored) {
            setJudgingStatus('Judging was submitted, but StudioNet has not exposed the scored result yet. Check leaderboard again shortly.')
            debugSubmit('score-readback-timeout', { roundId, player: walletAddress })
          }
          setPendingJudgingKeys((keys) => keys.filter((key) => key !== pendingKey))
        }
      } else {
        setJudgingStatus('This level was already judged. Unlocking the next level...')
        debugSubmit('score-round:already-scored', { scoredAt: submission.scored_at })
        setPendingJudgingKeys((keys) => keys.filter((key) => key !== pendingKey))
      }
      const players = submission?.scored ? await getLeaderboard() : []
      debugSubmit('leaderboard-refreshed', { players, submission })
      if (Array.isArray(players) && players.length > 0) setLeaderboardPlayers(players)
      window.setTimeout(() => setProgressRefreshKey((key) => key + 1), usesInlineScoring ? 15000 : 0)
    } catch (error) {
      debugSubmitError('flow-failed', error, { roundId, pendingKey })
      console.groupEnd()
      setJudgingStatus(error?.message || 'The answer was saved, but judging did not finish. Click the button again in a moment.')
      return
    } finally {
      setIsRoundFlowActive(false)
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
        score: submission?.score,
        xpAward: submission?.xp_award,
        createdAt: new Date().toISOString(),
      },
    ])
    setSelectedAnswers({})
    setSelectedEvidenceUrl('')
    setOpenedLevelIndex(null)
    setActiveChamberIndex((index) => Math.min(roomChambers.length - 1, index + 1))
    setLevelNotice(`Level ${openedLevelIndex + 1} cleared. Level ${Math.min(roomChambers.length, openedLevelIndex + 2)} unlocked.`)
    setJudgingStatus(
      submission?.scored
        ? `Judging complete. Score ${submission.score}/100, XP +${submission.xp_award}.`
        : usesInlineScoring
          ? 'Level complete. Continue playing while StudioNet syncs XP in the background.'
          : 'Level complete. XP is still syncing from StudioNet; check leaderboard again shortly.'
    )
    debugSubmit('flow-complete', { nextLevelIndex: Math.min(roomChambers.length - 1, openedLevelIndex + 1) })
    console.groupEnd()
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

      {activeTab === 'overview' && <OverviewPage onPlay={() => setActiveTab('lobby')} walletAddress={walletAddress} onConnect={connectWallet} />}
      {activeTab === 'lobby' && (
        <LobbyPage
          rooms={rooms}
          roomsStatus={roomsStatus}
          selectedRoomId={selectedRoomId}
          roomSearch={roomSearch}
          setRoomSearch={setRoomSearch}
          lobbyNotice={lobbyNotice}
          onSearchRoom={searchRoom}
          onCreateRoom={createRaidRoom}
          onSelectRoom={selectRoom}
          onCopyRoom={copyRoomLink}
          contract={contract}
          walletAddress={walletAddress}
          onConnect={connectWallet}
        />
      )}
      {activeTab === 'play' && (
        <PlayPage
          chambers={roomChambers}
          selectedRoom={selectedRoom}
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
          roomSettings={roomSettings}
          setRoomSettings={setRoomSettings}
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
      {activeTab === 'leaderboard' && <LeaderboardPage leaderboardPlayers={leaderboardPlayers} selectedRoom={selectedRoom} />}
      {activeTab === 'admin' && (
        <AdminPage
          walletAddress={walletAddress}
          onConnect={connectWallet}
          adminAddress={adminAddress}
          isHost={isHost}
          moderatorAddress={moderatorAddress}
          setModeratorAddress={setModeratorAddress}
          questionPacks={questionPacks}
          packTitle={packTitle}
          setPackTitle={setPackTitle}
          packSeason={packSeason}
          setPackSeason={setPackSeason}
          packMode={packMode}
          setPackMode={setPackMode}
          packBuilder={packBuilder}
          setPackBuilder={setPackBuilder}
          packNotice={packNotice}
          onLoadDefaultPack={() => {
            setPackMode(PACK_MODES.mcq)
            setPackBuilder(createBuilderFromChambers())
          }}
          onClearPack={() => setPackBuilder(createBlankPackBuilder())}
          onCreatePack={createAndPublishPack}
          onAddModerator={addModerator}
          onRemoveModerator={removeModerator}
          onCreateRoomFromPack={createRoomFromPack}
          contract={contract}
        />
      )}
      {activeTab === 'faq' && <FaqPage />}
    </main>
  )
}

export default App
