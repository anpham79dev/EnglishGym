/**
 * Seed practice topics. Safe to re-run: existing ids are skipped.
 */
import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')

const { useDb, schema } = await import('../server/db')

type Seed = {
    id: string
    kind: 'speaking' | 'writing'
    title: string
    prompt: string
    level?: string
}

const TOPICS: Seed[] = [
    // --- Speaking (1–2 min) ---
    {
        id: 's-bug-report',
        kind: 'speaking',
        title: 'Describe a bug',
        prompt: 'Describe a bug you fixed recently: what users saw, the root cause, and how you fixed it.',
    },
    {
        id: 's-standup',
        kind: 'speaking',
        title: 'Daily stand-up',
        prompt: 'Give your stand-up update: what you did yesterday, what you will do today, and any blockers.',
    },
    {
        id: 's-explain-code',
        kind: 'speaking',
        title: 'Explain your code',
        prompt: 'Explain how a feature you built works to a new teammate, step by step.',
    },
    {
        id: 's-requirement',
        kind: 'speaking',
        title: 'Clarify a requirement',
        prompt: 'A client asks for a feature that is unclear. Ask clarifying questions and suggest a simpler option.',
    },
    {
        id: 's-estimate',
        kind: 'speaking',
        title: 'Give an estimate',
        prompt: 'Explain why a task will take longer than the PM expected, and propose what can be delivered first.',
    },
    {
        id: 's-code-review',
        kind: 'speaking',
        title: 'Code review feedback',
        prompt: 'Give polite feedback on a pull request that has a performance problem.',
    },
    {
        id: 's-incident',
        kind: 'speaking',
        title: 'Production incident',
        prompt: 'Report a production incident to your manager: impact, current status, and next steps.',
    },
    {
        id: 's-tech-choice',
        kind: 'speaking',
        title: 'Defend a tech choice',
        prompt: 'Explain why you chose Vue (or another tool) for a project and what the trade-offs were.',
    },
    {
        id: 's-demo',
        kind: 'speaking',
        title: 'Sprint demo',
        prompt: 'Demo a feature you finished this sprint to stakeholders who are not technical.',
    },
    {
        id: 's-intro',
        kind: 'speaking',
        title: 'Introduce yourself',
        prompt: 'Introduce yourself in a meeting with a new overseas client: your role, experience and current project.',
    },
    // --- Writing ---
    {
        id: 'w-bug-ticket',
        kind: 'writing',
        title: 'Write a bug ticket',
        prompt: 'Write a bug ticket: steps to reproduce, expected result, actual result, environment.',
    },
    {
        id: 'w-pr-desc',
        kind: 'writing',
        title: 'Pull request description',
        prompt: 'Write a PR description for a change you made: what, why, how to test.',
    },
    {
        id: 'w-progress',
        kind: 'writing',
        title: 'Weekly progress report',
        prompt: 'Write a short weekly progress report to your PM: done, in progress, risks.',
    },
    {
        id: 'w-slack-delay',
        kind: 'writing',
        title: 'Report a delay',
        prompt: 'Write a Slack message telling the team your task will be one day late and why.',
    },
    {
        id: 'w-question',
        kind: 'writing',
        title: 'Ask a technical question',
        prompt: 'Write a message asking a senior developer for help with a problem you are stuck on. Include what you have tried.',
    },
    {
        id: 'w-client-email',
        kind: 'writing',
        title: 'Email to a client',
        prompt: 'Write an email to a client explaining that a requested change is out of scope and offering options.',
    },
    {
        id: 'w-review-comment',
        kind: 'writing',
        title: 'Code review comments',
        prompt: 'Write three code review comments: one praise, one suggestion, one required change.',
    },
    {
        id: 'w-postmortem',
        kind: 'writing',
        title: 'Incident summary',
        prompt: 'Write a short post-mortem: what happened, root cause, what we will change.',
    },
    {
        id: 'w-readme',
        kind: 'writing',
        title: 'README section',
        prompt: 'Write the "Getting started" section of a README for a project you know.',
    },
    {
        id: 'w-retro',
        kind: 'writing',
        title: 'Sprint retrospective',
        prompt: 'Write your retro notes: what went well, what did not, one action item.',
    },
]

const rows = TOPICS.map((t) => ({ level: 'B1', active: true, ...t }))
const result = await useDb().insert(schema.topics).values(rows).onConflictDoNothing().returning()
console.log(`Đã thêm ${result.length}/${rows.length} đề.`)
