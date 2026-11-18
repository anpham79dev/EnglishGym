const CORE = `You are an English coach for a Vietnamese web developer.
You are NOT an authority on what was actually spoken.
For audio: transcribe as faithfully as possible, including repetitions,
false starts, fillers and grammatical mistakes. Never silently improve it.
For writing: preserve the student's original text.
Suggest only HIGH-CONFIDENCE, actionable grammar or word-choice issues.
For each issue, quote the exact source phrase and suggest one correction,
with a brief Vietnamese explanation. Do not invent a source quotation.
Do not rewrite the whole answer. Do not assign an exam score.
"original_quote" must be copied character-for-character from the source.
"pattern_key_suggestion" is a short kebab-case key for the error pattern,
e.g. "past-simple-time-marker", "missing-article-singular-noun".
Return JSON matching the supplied schema.`

export const buildSpeakingPrompt = (topic: string) =>
    `${CORE}\nThe source is the attached audio recording. Put the faithful transcript in "transcript".\nTopic: ${topic}`

export const buildWritingPrompt = (topic: string, text: string) =>
    `${CORE}\nThe source is the student's text below.\nTopic: ${topic}\n\n<student_text>\n${text}\n</student_text>`

const MANUAL_HEADER = 'Answer with JSON only, in this shape:\n{'
const MANUAL_ISSUES = `"issues": [{"original_quote": "...", "suggested_correction": "...",
"reason_vi": "...", "category": "grammar|tense|article|preposition|word_choice|collocation|plural|subject_verb_agreement|word_order|spelling|other",
"pattern_key_suggestion": "..."}], "focus_pattern_suggestion": "..."}`

export const MANUAL_FORMAT_SPEAKING = `${MANUAL_HEADER}"transcript": "...", ${MANUAL_ISSUES}`
export const MANUAL_FORMAT_WRITING = `${MANUAL_HEADER}${MANUAL_ISSUES}`

/** Topic description sent to the AI; one place so graded and manual prompts never drift. */
export const topicToText = (topic: { title: string; prompt: string } | null | undefined) =>
    topic ? `${topic.title}. ${topic.prompt}` : 'Free topic'

/** Prompt to paste into another AI when Gemini fails. */
export const buildManualPrompt = (kind: 'speaking' | 'writing', topic: string, text = '') =>
    kind === 'speaking'
        ? `${buildSpeakingPrompt(topic)}\n\n${MANUAL_FORMAT_SPEAKING}\n(Đính kèm file audio cùng prompt này.)`
        : `${buildWritingPrompt(topic, text)}\n\n${MANUAL_FORMAT_WRITING}`
