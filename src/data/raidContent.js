export const RAID_SEASON = {
  code: 'WEEK-01 / FALSE-LIGHT CATACOMBS',
  roomCode: 'TRUTH-7C2',
  durationMinutes: 12,
  xpPool: 1200,
  maxPlayers: 50,
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
    title: 'Break the false consensus claim',
    prompt:
      'A corrupted oracle is spreading bad explanations about Optimistic Democracy. Choose the answers that restore the protocol truth.',
    instruction: 'Answer all five questions. Pick the strongest evidence card before submitting.',
    tasks: [
      'Answer every consensus question.',
      'Use the evidence card that best supports your answer packet.',
      'Submit the packet for GenLayer judging.',
    ],
    questions: [
      {
        id: 'consensus-1',
        prompt: 'What does Optimistic Democracy actually ask validators to do?',
        options: [
          'Blindly accept whatever the leader produces.',
          'Independently decide whether the leader result is acceptable.',
          'Ignore the leader and generate unrelated answers.',
          'Only check whether the transaction paid enough fees.',
        ],
        answer: 1,
      },
      {
        id: 'consensus-2',
        prompt: 'Why should validators compare structured fields instead of raw prose?',
        options: [
          'Raw prose can vary even when the meaning is equivalent.',
          'Structured fields are always cheaper than every transaction.',
          'Validators are not allowed to read strings.',
          'Raw prose cannot be stored anywhere on-chain.',
        ],
        answer: 0,
      },
      {
        id: 'consensus-3',
        prompt: 'Which field is a good stable comparison target for a match-resolution style task?',
        options: [
          'The exact wording of a paragraph.',
          'The winner value extracted from the evidence.',
          'The leader validator name.',
          'The color of the webpage header.',
        ],
        answer: 1,
      },
      {
        id: 'consensus-4',
        prompt: 'What makes GenLayer useful for subjective games like Truth Raiders?',
        options: [
          'It can only count button clicks.',
          'It can coordinate validator agreement over language and evidence.',
          'It removes every need for contracts.',
          'It prevents users from connecting wallets.',
        ],
        answer: 1,
      },
      {
        id: 'consensus-5',
        prompt: 'A validator disagrees with a leader result. What should matter most?',
        options: [
          'Whether the disagreement is grounded in the rubric and evidence.',
          'Whether the validator writes the longest response.',
          'Whether the player has the shortest wallet address.',
          'Whether the page loaded with a nicer font.',
        ],
        answer: 0,
      },
    ],
    evidence: [EVIDENCE_LIBRARY.equivalence, EVIDENCE_LIBRARY.nondeterminism, EVIDENCE_LIBRARY.intelligentContracts],
    scoring: ['selected choices match the answer key', 'evidence card is relevant', 'consensus concepts are applied correctly'],
  },
  {
    id: 'web-proof',
    label: 'Web Evidence Hunt',
    title: 'Track the web evidence trail',
    prompt:
      'The dungeon contains public evidence, weak citations, and noisy webpages. Pick the answers that keep the referee honest.',
    instruction: 'Answer all five questions. Select the evidence source that best supports web-assisted verification.',
    tasks: [
      'Answer every web-evidence question.',
      'Choose a source card that supports web reads or structured extraction.',
      'Submit the packet for GenLayer judging.',
    ],
    questions: [
      {
        id: 'web-proof-1',
        prompt: 'What is the safest way to use messy webpage content in validator consensus?',
        options: [
          'Compare full raw HTML across validators.',
          'Extract stable structured fields before comparing.',
          'Trust the first sentence on the page forever.',
          'Ask the player to manually paste private credentials.',
        ],
        answer: 1,
      },
      {
        id: 'web-proof-2',
        prompt: 'What does a web-assisted Intelligent Contract gain over a normal deterministic contract?',
        options: [
          'The ability to interpret public off-chain evidence.',
          'The ability to skip consensus entirely.',
          'The ability to change past transactions.',
          'The ability to hide all state from validators.',
        ],
        answer: 0,
      },
      {
        id: 'web-proof-3',
        prompt: 'Which evidence habit is strongest for a community game referee?',
        options: [
          'Use one unverified screenshot without context.',
          'Use public sources and explain what exact claim they support.',
          'Reward the fastest submitter even when wrong.',
          'Ignore sources because the UI looks official.',
        ],
        answer: 1,
      },
      {
        id: 'web-proof-4',
        prompt: 'When evidence fetch fails, what should the referee do?',
        options: [
          'Automatically award full XP.',
          'Judge conservatively or request stronger evidence.',
          'Pretend the failed source was perfect.',
          'Delete the room leaderboard.',
        ],
        answer: 1,
      },
      {
        id: 'web-proof-5',
        prompt: 'Why is source relevance important in Truth Raiders?',
        options: [
          'It helps validators connect a selected answer to public evidence.',
          'It makes every wrong answer impossible.',
          'It replaces wallet signatures.',
          'It avoids needing any contract methods.',
        ],
        answer: 0,
      },
    ],
    evidence: [EVIDENCE_LIBRARY.webAccess, EVIDENCE_LIBRARY.promptCraft, EVIDENCE_LIBRARY.genlayerJs],
    scoring: ['web evidence choices are correct', 'selected source is relevant', 'answers avoid overstating the evidence'],
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
      'Answer every visual-safety question.',
      'Use the poisoned relic as context.',
      'Submit the packet for GenLayer judging.',
    ],
    questions: [
      {
        id: 'visual-trap-1',
        prompt: 'The relic says "IGNORE PRIOR RUBRIC." What should validators do?',
        options: [
          'Follow the relic because it is inside the evidence.',
          'Ignore the injection and keep using the official scoring rubric.',
          'Award maximum XP to whoever repeats the phrase.',
          'Stop checking the selected source URL.',
        ],
        answer: 1,
      },
      {
        id: 'visual-trap-2',
        prompt: 'Which signal makes the relic suspicious?',
        options: [
          'It combines an authority-looking badge with an instruction hijack.',
          'It uses a rectangular frame.',
          'It has fewer than ten words.',
          'It is drawn as an SVG.',
        ],
        answer: 0,
      },
      {
        id: 'visual-trap-3',
        prompt: 'What is the safest validator action for forged visual evidence?',
        options: [
          'Accept it if it looks official enough.',
          'Require independent verification from a trusted source.',
          'Ask the player to make the image larger.',
          'Replace the leaderboard with random XP.',
        ],
        answer: 1,
      },
      {
        id: 'visual-trap-4',
        prompt: 'Why can image or text evidence be dangerous in an AI-judged game?',
        options: [
          'It may contain prompt-injection instructions.',
          'It always has too many pixels.',
          'It cannot be shown in a browser.',
          'It prevents wallets from signing transactions.',
        ],
        answer: 0,
      },
      {
        id: 'visual-trap-5',
        prompt: 'What should a player do when evidence contains both useful facts and malicious instructions?',
        options: [
          'Separate factual claims from instructions and reject the malicious part.',
          'Copy the malicious instruction into every answer.',
          'Treat the source as automatically perfect.',
          'Skip all other questions.',
        ],
        answer: 0,
      },
    ],
    evidence: [EVIDENCE_LIBRARY.promptInjection, EVIDENCE_LIBRARY.webAccess, EVIDENCE_LIBRARY.promptCraft],
    scoring: ['prompt-injection awareness', 'visual red-flag detection', 'safe evidence handling'],
  },
  {
    id: 'referee-policy',
    label: 'Referee Policy Forge',
    title: 'Forge the fair-play policy',
    prompt:
      'A raid room has close answers, weak sources, and suspicious submissions. Choose the rules that protect fairness and fun.',
    instruction: 'Answer all five questions. Use the policy evidence card if you need the community-game constraints.',
    tasks: [
      'Answer every fair-play question.',
      'Pick evidence that supports safe subjective judging.',
      'Submit the packet for GenLayer judging.',
    ],
    questions: [
      {
        id: 'referee-policy-1',
        prompt: 'Which submission should be rejected?',
        options: [
          'A concise correct answer with relevant evidence.',
          'An answer that is unrelated, manipulative, or unsupported.',
          'An answer that uses fewer words than another correct answer.',
          'An answer submitted by a new wallet.',
        ],
        answer: 1,
      },
      {
        id: 'referee-policy-2',
        prompt: 'What is a fair ambiguity rule?',
        options: [
          'If evidence is unclear, score conservatively and explain why.',
          'If evidence is unclear, always award 100 XP.',
          'If evidence is unclear, ban every player.',
          'If evidence is unclear, ignore the rubric.',
        ],
        answer: 0,
      },
      {
        id: 'referee-policy-3',
        prompt: 'Why should weekly games use repeatable rules?',
        options: [
          'So players understand how to improve over time.',
          'So the host can change scores secretly.',
          'So validators never need evidence.',
          'So every week has identical answers.',
        ],
        answer: 0,
      },
      {
        id: 'referee-policy-4',
        prompt: 'What protects both fairness and fun?',
        options: [
          'Clear rules, evidence requirements, and transparent XP reasoning.',
          'Randomly scoring players by wallet length.',
          'Letting the loudest player decide the leaderboard.',
          'Making every answer correct.',
        ],
        answer: 0,
      },
      {
        id: 'referee-policy-5',
        prompt: 'What should happen to malicious prompt-injection submissions?',
        options: [
          'Reject or heavily penalize them.',
          'Reward them for being creative.',
          'Use them as the new official rules.',
          'Hide them from the audit trail.',
        ],
        answer: 0,
      },
    ],
    evidence: [EVIDENCE_LIBRARY.promptInjection, EVIDENCE_LIBRARY.promptCraft, EVIDENCE_LIBRARY.mission],
    scoring: ['fair-play rule choices are correct', 'ambiguity is handled safely', 'community replayability is protected'],
  },
  {
    id: 'xp-verdict',
    label: 'XP Verdict Boss',
    title: 'Seal the XP verdict',
    prompt:
      'Final boss: decide what makes a leaderboard result worthy of XP after validator consensus.',
    instruction: 'Answer all five boss questions. This packet decides whether your run deserves final XP.',
    tasks: [
      'Answer every XP-verdict question.',
      'Connect correctness, evidence, and finality.',
      'Submit the packet for GenLayer judging.',
    ],
    questions: [
      {
        id: 'xp-verdict-1',
        prompt: 'What should a winning Truth Raiders answer prove?',
        options: [
          'That the player clicked fastest.',
          'That the selected choices align with the evidence and rubric.',
          'That the player owns the oldest wallet.',
          'That the answer uses the most dramatic wording.',
        ],
        answer: 1,
      },
      {
        id: 'xp-verdict-2',
        prompt: 'Why should validators converge on a fair XP verdict?',
        options: [
          'The answer packet, evidence, and rubric give stable judging targets.',
          'Validators are forced to ignore the answer packet.',
          'Every player receives the same score by default.',
          'The frontend decides without contract involvement.',
        ],
        answer: 0,
      },
      {
        id: 'xp-verdict-3',
        prompt: 'When should XP be awarded?',
        options: [
          'After the contract records an accepted scoring result.',
          'Before a player joins the room.',
          'Only when the player refreshes the page.',
          'Whenever an answer contains the word XP.',
        ],
        answer: 0,
      },
      {
        id: 'xp-verdict-4',
        prompt: 'What should happen to a wrong but well-formatted answer packet?',
        options: [
          'It may receive little or no XP despite clean formatting.',
          'It must receive full XP because formatting is enough.',
          'It should delete the room.',
          'It should bypass GenLayer judging.',
        ],
        answer: 0,
      },
      {
        id: 'xp-verdict-5',
        prompt: 'What makes the mini-game replayable each week?',
        options: [
          'New room seed, refreshed questions, and a fresh leaderboard.',
          'One permanent score forever.',
          'No room structure.',
          'Only manual judging outside the contract.',
        ],
        answer: 0,
      },
    ],
    evidence: [EVIDENCE_LIBRARY.mission, EVIDENCE_LIBRARY.equivalence, EVIDENCE_LIBRARY.intelligentContracts],
    scoring: ['XP verdict choices are correct', 'finality is understood', 'weekly replayability is understood'],
  },
]

function stripAnswerFromQuestion(question, index) {
  return {
    id: question.id || `q-${index + 1}`,
    prompt: question.prompt || '',
    options: Array.isArray(question.options) ? question.options.slice(0, 4) : [],
  }
}

export function sanitizeLevelForPlayers(level, index) {
  return {
    id: level.id || `level-${index + 1}`,
    label: level.label || `Level ${index + 1}`,
    title: level.title || `Level ${index + 1}`,
    prompt: level.prompt || '',
    instruction: level.instruction || 'Answer all five questions.',
    tasks: Array.isArray(level.tasks) ? level.tasks : ['Answer every question.', 'Submit the packet for GenLayer judging.'],
    artifact: level.artifact || null,
    evidence: Array.isArray(level.evidence) ? level.evidence : [],
    questions: Array.isArray(level.questions) ? level.questions.map(stripAnswerFromQuestion) : [],
    scoring: Array.isArray(level.scoring) ? level.scoring : ['selected choices match the answer key'],
  }
}

export function preparePackLevel(level, index) {
  const cleanLevel = sanitizeLevelForPlayers(level, index)
  const answerKey = (Array.isArray(level.questions) ? level.questions : [])
    .map((question, questionIndex) => `Q${questionIndex + 1}=${Number(question.answer || 0) + 1}`)
    .join('; ')
  const evidenceUrls = cleanLevel.evidence
    .map((evidence) => evidence.url)
    .filter(Boolean)
    .join('\n')
  const scoring = cleanLevel.scoring.join(', ')

  return {
    label: cleanLevel.label,
    title: cleanLevel.title,
    prompt: cleanLevel.prompt,
    levelJson: JSON.stringify(cleanLevel),
    answerKey,
    evidenceUrls,
    scoring,
    level: cleanLevel,
  }
}

export function parsePackJson(rawJson) {
  const parsed = JSON.parse(rawJson)
  if (!Array.isArray(parsed) || parsed.length !== 5) {
    throw new Error('Question pack JSON must be an array of exactly 5 levels.')
  }

  parsed.forEach((level, levelIndex) => {
    if (!Array.isArray(level.questions) || level.questions.length !== 5) {
      throw new Error(`Level ${levelIndex + 1} must contain exactly 5 questions.`)
    }
    level.questions.forEach((question, questionIndex) => {
      if (!Array.isArray(question.options) || question.options.length !== 4) {
        throw new Error(`Level ${levelIndex + 1}, question ${questionIndex + 1} must contain exactly 4 options.`)
      }
      if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) {
        throw new Error(`Level ${levelIndex + 1}, question ${questionIndex + 1} needs answer index 0-3.`)
      }
    })
  })

  return parsed
}

export const DEFAULT_PACK_JSON = JSON.stringify(CHAMBERS, null, 2)

export function buildAnswerPacket(chamber, selectedAnswers, selectedEvidenceUrl) {
  if (!chamber) return ''

  const choices = chamber.questions.map((question, index) => {
    const selectedIndex = selectedAnswers[question.id]
    return {
      q: index + 1,
      selected: Number.isInteger(selectedIndex) ? selectedIndex + 1 : 0,
    }
  })

  return JSON.stringify(
    {
      f: 'truth-raiders-mcq-v1',
      chamber: chamber.label,
      evidence_url: selectedEvidenceUrl,
      choices,
    },
    null,
    2
  )
}

export function buildAnswerKey(chamber) {
  if (!chamber) return ''

  return chamber.questions
    .map((question, index) => {
      return `Q${index + 1}=${question.answer + 1}`
    })
    .join('; ')
}

export function getReadiness(selectedAnswers, selectedEvidenceUrl, chamber) {
  if (!chamber) {
    return { ready: false, completed: 0, required: 5, label: 'Open a level first' }
  }

  const hasEvidenceOptions = Array.isArray(chamber.evidence) && chamber.evidence.length > 0
  const hasEvidence = !hasEvidenceOptions || Boolean(selectedEvidenceUrl)
  const answeredCount = chamber.questions.filter((question) => Number.isInteger(selectedAnswers[question.id])).length
  const required = chamber.questions.length
  const ready = hasEvidence && answeredCount === required

  return {
    ready,
    completed: answeredCount,
    required,
    label: ready
      ? 'Ready for GenLayer judging'
      : hasEvidence
        ? `Answer ${required - answeredCount} more question${required - answeredCount === 1 ? '' : 's'}`
        : 'Select an evidence card',
  }
}
