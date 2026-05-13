export const RAID_SEASON = {
  code: 'WEEK-01 / FALSE-LIGHT CATACOMBS',
  roomCode: 'TRUTH-7C2',
  durationMinutes: 12,
  xpPool: 1200,
}

export const AVATARS = [
  { id: 'scribe', name: 'Cipher Scribe', frame: 9, role: 'evidence runner' },
  { id: 'warden', name: 'Ledger Warden', frame: 17, role: 'risk reader' },
  { id: 'oracle', name: 'Signal Oracle', frame: 33, role: 'claim breaker' },
  { id: 'scout', name: 'Source Scout', frame: 41, role: 'web tracker' },
]

export const RAID_PLAYERS = [
  { id: 'you', name: 'You', avatar: 'scribe', xp: 0, status: 'ready' },
  { id: 'node-17', name: 'Node 17', avatar: 'warden', xp: 212, status: 'scouting' },
  { id: 'mira', name: 'Mira', avatar: 'oracle', xp: 188, status: 'drafting' },
  { id: 'tal', name: 'Tal', avatar: 'scout', xp: 164, status: 'waiting' },
]

export const CHAMBERS = [
  {
    id: 'claim',
    label: 'Claim Chamber',
    title: 'Break the false claim',
    prompt:
      'A corrupted oracle says: "Optimistic Democracy means validators blindly accept the leader output." Explain why this is wrong.',
    instruction: 'Submit a short correction and optional source URL.',
    monster: 'False-light Wisp',
    scoring: ['accuracy', 'source quality', 'clarity', 'no hallucination'],
  },
  {
    id: 'evidence',
    label: 'Evidence Chamber',
    title: 'Choose the strongest source',
    prompt:
      'The raid requires proof that GenLayer Intelligent Contracts can read web evidence and use AI-assisted consensus. Provide the best public source and summarize it.',
    instruction: 'A raw documentation URL or official source works best.',
    monster: 'Citation Mimic',
    scoring: ['source relevance', 'public accessibility', 'summary quality', 'scope match'],
  },
  {
    id: 'strategy',
    label: 'Strategy Chamber',
    title: 'Write the action',
    prompt:
      'A validator spirit blocks the exit and asks for a safe policy: when should a subjective game result be rejected instead of scored?',
    instruction: 'Answer as a game referee, not as a lawyer.',
    monster: 'Ambiguity Knight',
    scoring: ['policy strength', 'fairness', 'specificity', 'community safety'],
  },
  {
    id: 'boss',
    label: 'Boss Verdict',
    title: 'Defeat the Hallucination Hydra',
    prompt:
      'Final boss: write the best one-paragraph verdict explaining who deserves XP in a subjective mini-game and why validators should agree.',
    instruction: 'Be concise. Reward evidence, teamwork, and correctness.',
    monster: 'Hallucination Hydra',
    scoring: ['reasoning', 'consensus likelihood', 'XP fairness', 'style'],
  },
]

export function scoreLocalSubmission(answer, sourceUrl, chamberIndex) {
  const cleaned = answer.trim()
  const wordCount = cleaned ? cleaned.split(/\s+/).length : 0
  const hasSource = /^https?:\/\//i.test(sourceUrl.trim())
  const chamberWeight = 12 + chamberIndex * 5
  const lengthScore = Math.min(34, Math.max(0, wordCount * 2))
  const sourceScore = hasSource ? 22 : 4
  const clarityScore = cleaned.includes('.') ? 14 : 8
  const riskPenalty = /maybe|i guess|not sure|probably/i.test(cleaned) ? 8 : 0

  return Math.max(0, Math.min(100, chamberWeight + lengthScore + sourceScore + clarityScore - riskPenalty))
}
