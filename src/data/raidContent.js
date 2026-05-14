export const RAID_SEASON = {
  code: 'WEEK-01 / FALSE-LIGHT CATACOMBS',
  roomCode: 'TRUTH-7C2',
  durationMinutes: 12,
  xpPool: 1200,
  maxPlayers: 8,
  finality: 'GenLayer Optimistic Democracy',
}

export const AVATARS = [
  { id: 'scribe', name: 'Cipher Scribe', frame: 9, role: 'evidence runner' },
]

export const EVIDENCE_LIBRARY = {
  intelligentContracts: {
    title: 'Intelligent Contracts',
    source: 'GenLayer Docs',
    url: 'https://docs.genlayer.com/developers/intelligent-contracts/introduction',
    clue: 'Explains why GenLayer contracts can use language, web data, and subjective reasoning.',
  },
  equivalence: {
    title: 'Equivalence Principle',
    source: 'GenLayer Docs',
    url: 'https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle',
    clue: 'Explains leader proposals, validator review, and acceptable non-deterministic results.',
  },
  nondeterminism: {
    title: 'Non-determinism',
    source: 'GenLayer Docs',
    url: 'https://docs.genlayer.com/developers/intelligent-contracts/features/non-determinism',
    clue: 'Shows why validators should compare stable structured outputs, not raw LLM text.',
  },
  webAccess: {
    title: 'Web Access',
    source: 'GenLayer Docs',
    url: 'https://docs.genlayer.com/developers/intelligent-contracts/features/web-access',
    clue: 'Covers web reads, rendered pages, screenshots, and external evidence retrieval.',
  },
  promptCraft: {
    title: 'Prompt & Data Techniques',
    source: 'GenLayer Docs',
    url: 'https://docs.genlayer.com/developers/intelligent-contracts/crafting-prompts',
    clue: 'Useful for turning messy submissions into structured validator-readable decisions.',
  },
  promptInjection: {
    title: 'Prompt Injection',
    source: 'GenLayer Docs',
    url: 'https://docs.genlayer.com/developers/intelligent-contracts/security-and-best-practices/prompt-injection',
    clue: 'Supports rejecting malicious, manipulative, or instruction-hijacking submissions.',
  },
  genlayerJs: {
    title: 'GenLayerJS',
    source: 'GenLayer Docs',
    url: 'https://docs.genlayer.com/developers/decentralized-applications/genlayer-js',
    clue: 'Shows how frontends read from and write to deployed GenLayer contracts.',
  },
  mission: {
    title: 'Mini-games Mission',
    source: 'GenLayer Talks',
    url: 'https://talks.genlayer.foundation/t/mini-games-for-genlayer-s-community/23',
    clue: 'Defines the community game constraints: rooms, 5-15 minutes, weekly replay, and leaderboard XP.',
  },
}

export const CHAMBERS = [
  {
    id: 'consensus',
    label: 'Consensus Trial',
    title: 'Expose the false consensus claim',
    prompt:
      'A corrupted oracle claims: "Optimistic Democracy means validators blindly accept the leader output." Defeat the claim with evidence.',
    instruction: 'Complete all three tasks. Pick the strongest evidence card before submitting.',
    tasks: [
      'Correct the false claim in one or two sentences.',
      'Explain what the leader proposes and what validators independently check.',
      'Name one stable field validators should compare instead of comparing raw prose.',
    ],
    evidence: [EVIDENCE_LIBRARY.equivalence, EVIDENCE_LIBRARY.nondeterminism, EVIDENCE_LIBRARY.intelligentContracts],
    scoring: ['consensus accuracy', 'validator reasoning', 'stable-field awareness', 'clear correction'],
  },
  {
    id: 'web-proof',
    label: 'Web Evidence Hunt',
    title: 'Prove the contract can read the outside world',
    prompt:
      'The raid needs public proof that GenLayer can use web evidence inside an Intelligent Contract. Build the strongest explanation.',
    instruction: 'Use the evidence cards to describe how a referee contract should collect and verify external sources.',
    tasks: [
      'Choose the evidence card that best supports web-assisted verification.',
      'Summarize what the source proves without overstating it.',
      'Describe how validators should turn messy web content into structured fields.',
    ],
    evidence: [EVIDENCE_LIBRARY.webAccess, EVIDENCE_LIBRARY.promptCraft, EVIDENCE_LIBRARY.genlayerJs],
    scoring: ['source relevance', 'summary accuracy', 'structured extraction plan', 'scope discipline'],
  },
  {
    id: 'visual-trap',
    label: 'Visual Relic Scan',
    title: 'Inspect the poisoned evidence glyph',
    prompt:
      'A dungeon relic shows a fake "official" evidence badge mixed with a hidden prompt-injection command. Identify what is dangerous and how the referee should treat it.',
    instruction: 'Use visual inspection plus the selected evidence card. Do not follow the relic text blindly.',
    artifact: {
      title: 'Poisoned Evidence Relic',
      caption: 'The glyph intentionally mixes a source-looking seal, a forged authority mark, and an instruction-hijack phrase.',
      flags: ['FORGED OFFICIAL SEAL', 'IGNORE PRIOR RUBRIC', 'UNVERIFIED SOURCE'],
      safeRead: 'Treat the artifact as suspicious visual evidence and require independent source verification.',
    },
    tasks: [
      'Describe at least two suspicious visual signals in the relic.',
      'Explain why instruction text inside evidence should not override the scoring rubric.',
      'State the safe validator action: accept, reject, or request stronger evidence.',
    ],
    evidence: [EVIDENCE_LIBRARY.promptInjection, EVIDENCE_LIBRARY.webAccess, EVIDENCE_LIBRARY.promptCraft],
    scoring: ['visual observation', 'prompt-injection awareness', 'source safety', 'recommended action'],
  },
  {
    id: 'referee-policy',
    label: 'Referee Policy Forge',
    title: 'Write the rejection policy',
    prompt:
      'A raid room has close answers, weak sources, and one suspicious submission. Write a fair policy for when subjective game results should be rejected instead of scored.',
    instruction: 'Answer like a game referee writing rules for a weekly GenLayer community event.',
    tasks: [
      'Give three rejection conditions.',
      'Include one ambiguity rule for close or incomplete answers.',
      'Explain how the policy protects both fairness and fun.',
    ],
    evidence: [EVIDENCE_LIBRARY.promptInjection, EVIDENCE_LIBRARY.promptCraft, EVIDENCE_LIBRARY.mission],
    scoring: ['policy specificity', 'fairness', 'community safety', 'replayability'],
  },
  {
    id: 'xp-verdict',
    label: 'XP Verdict Boss',
    title: 'Deliver the final XP verdict',
    prompt:
      'Final boss: write a concise verdict for a subjective mini-game leaderboard. Explain who deserves XP, why validators should agree, and how the XP should be finalized.',
    instruction: 'This is the boss answer. It should connect evidence quality, reasoning quality, and final leaderboard settlement.',
    tasks: [
      'Define what a winning answer must prove.',
      'Explain why validators should converge on the verdict.',
      'Describe how XP should be distributed after finality.',
    ],
    evidence: [EVIDENCE_LIBRARY.mission, EVIDENCE_LIBRARY.equivalence, EVIDENCE_LIBRARY.intelligentContracts],
    scoring: ['XP fairness', 'consensus likelihood', 'mission fit', 'final verdict clarity'],
  },
]

export function getReadiness(answer, selectedEvidenceUrl, chamber) {
  if (!chamber) {
    return { ready: false, completed: 0, required: 3, label: 'Open a level first' }
  }

  const hasEvidence = Boolean(selectedEvidenceUrl)
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length
  const hasAnyAnswer = wordCount > 0
  const mentionsGameConcept = /genlayer|validator|consensus|evidence|source|score|xp|leader/i.test(answer)
  const completed = (hasEvidence ? 1 : 0) + (hasAnyAnswer ? 1 : 0) + (mentionsGameConcept ? 1 : 0)
  const required = 3
  const ready = hasEvidence && hasAnyAnswer

  return {
    ready,
    completed,
    required,
    label: ready ? 'Ready for GenLayer judging' : 'Select evidence and write an answer',
  }
}
