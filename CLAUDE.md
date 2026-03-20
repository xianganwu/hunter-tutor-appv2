# CLAUDE.md — Hunter Tutor App (Progressive Edition)

## Project Overview

A web-based adaptive tutoring app with a **progressive two-level curriculum** for students building toward the **Hunter College High School entrance exam**. Students start with **foundations** (rising 5th graders, ages 9-10) and progress to **Hunter prep** (6th graders, ages 11-12). Everything is in one app — students advance naturally from foundational skills to exam-level content. This is a **Socratic tutor**, not a test bank — it teaches through dialogue, worked examples, weakness identification, and dynamic difficulty adjustment.

### Target Users
- **Rising 5th graders** (ages 9–10): High-performing/gifted students building foundational skills
- **6th graders** (ages 11–12): Students in intensive Hunter entrance exam preparation
- Parents monitoring progress at either level
- Language must be encouraging, age-appropriate, and never condescending

### Two-Level Curriculum
**Level 1 — Foundations (Rising 5th Grade)**
- **Reading**: grade 4-5 passages, main idea, inference, vocabulary in context, basic author's purpose, figurative language
- **Math**: multiplication/division fluency, fractions/decimals foundations, basic geometry, word problems, number sense, patterns, early algebra
- **Writing**: paragraph and short essay structure, personal narratives, opinion writing, grammar basics

**Level 2 — Hunter Prep (6th Grade)**
- **Reading**: advanced inference, passage structure analysis, comparing viewpoints, advanced vocabulary
- **Math**: fraction/decimal operations, percents, ratios/proportions, coordinate geometry, algebraic expressions, multi-step word problems
- **Writing**: persuasive and expository essays, evidence-based arguments, sophisticated organization

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14, App Router |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Database | SQLite via Prisma (local dev) |
| AI Engine | Anthropic API (Claude Sonnet) |
| Validation | Zod |
| Testing | Vitest + React Testing Library |

### Key Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest
npm run db:push      # Push Prisma schema to SQLite
npm run db:studio    # Open Prisma Studio
npx prisma generate  # Regenerate Prisma client after schema changes
```

---

## Architecture

### Directory Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx
│   ├── page.tsx            # Landing / dashboard
│   ├── tutor/
│   │   ├── [subject]/      # /tutor/math, /tutor/reading, /tutor/writing
│   │   │   └── page.tsx
│   ├── progress/
│   │   └── page.tsx        # Student progress dashboard
│   └── api/
│       ├── chat/route.ts   # Tutoring conversation endpoint
│       ├── progress/route.ts
│       └── session/route.ts
├── components/
│   ├── chat/               # Chat UI components
│   ├── dashboard/          # Progress and analytics
│   ├── shared/             # Buttons, inputs, layout primitives
│   └── tutor/              # Subject-specific tutor UI
├── lib/
│   ├── ai/                 # Anthropic API integration
│   │   ├── client.ts       # Anthropic client singleton
│   │   ├── prompts/        # System prompts per subject
│   │   └── tutor-engine.ts # Core tutoring logic
│   ├── db/                 # Prisma client and helpers
│   ├── exam/               # Exam content, topic taxonomy, difficulty levels
│   └── types/              # Shared TypeScript types
├── hooks/                  # Custom React hooks
└── utils/                  # Pure utility functions
```

### Data Model (Prisma/SQLite)
Core entities:
- **Student**: profile, current skill levels per topic
- **Session**: a tutoring session with subject, start/end time
- **Message**: individual messages in a tutoring conversation (role, content, metadata)
- **TopicMastery**: per-topic skill tracking (topic, level, correct/attempts, last practiced)
- **ProblemAttempt**: individual problem attempts with difficulty, correctness, time spent

### API Routes
- `POST /api/chat` — send a message in a tutoring session, get AI tutor response
- `GET/POST /api/session` — create or retrieve tutoring sessions
- `GET /api/progress` — fetch student progress and mastery data

---

## Tutoring Engine Design

### Core Principles
1. **Socratic method**: Ask leading questions before giving answers. Guide the student to discover the solution.
2. **Worked examples**: When a student is stuck, show a similar problem solved step-by-step, then ask them to try the original again.
3. **Adaptive difficulty**: Start at grade level, adjust based on performance. Track mastery per topic using a simple skill model.
4. **Encouragement over correction**: Frame mistakes as learning opportunities. Never say "wrong" — say "not quite, let's think about it differently."
5. **Scaffolding**: Break complex problems into smaller steps. Remove scaffolding as mastery increases.

### Difficulty Model
- Each topic has levels 1–5 (1 = foundational, 5 = exam-challenge level)
- Student starts at level 2 for new topics
- Move up after 3 consecutive correct answers at current level
- Move down after 2 consecutive incorrect answers
- Track rolling accuracy per topic to identify weak areas

### System Prompt Strategy
- Each subject (math, reading, writing) has its own system prompt in `src/lib/ai/prompts/`
- Prompts include: tutor persona, pedagogical instructions, topic taxonomy, difficulty guidelines, response format constraints
- Student context (mastery data, recent performance) is injected into the system prompt dynamically
- **Token budget**: Keep system prompts under 2000 tokens; keep conversation context under 8000 tokens by summarizing older messages

### Conversation Flow
1. Student selects a subject → new session starts
2. Tutor assesses current level with a diagnostic question
3. Based on response, tutor adjusts and continues with appropriate difficulty
4. Every 5–7 exchanges, tutor internally evaluates if topic should shift
5. Session ends with a brief summary of what was practiced and areas to review

---

## AI Integration Rules

### Anthropic API Usage
- Use `@anthropic-ai/sdk` — import from `src/lib/ai/client.ts` singleton
- Model: `claude-sonnet-4-20250514` (or latest Sonnet)
- **Always stream responses** for the chat interface — use `client.messages.stream()`
- Set `max_tokens` conservatively (1024 for tutoring responses)
- Validate all API responses with Zod before passing to the client
- Handle rate limits with exponential backoff (max 3 retries)
- **Never send student PII** in API calls — use anonymized session IDs only

### Prompt Engineering
- Tutor must stay in character — never break the 4th wall about being an AI
- Responses must be concise (2–4 sentences for dialogue, longer for worked examples)
- Math must use proper notation — render with KaTeX or similar
- Reading passages should be embedded in the prompt, not fetched dynamically
- Always include the student's current mastery context in the system prompt

---

## UI/UX Guidelines

### Design Principles
- **Clean and focused**: No clutter. The student's attention should be on the problem and the tutor's guidance.
- **Mobile-first**: Many students will use tablets or phones.
- **High contrast, readable typography**: Minimum 16px body text. Use a clear sans-serif font.
- **Immediate feedback**: Typing indicators while AI responds. No dead states.

### Chat Interface
- Message bubbles with clear student/tutor distinction
- Streaming text display for tutor responses
- Math rendering inline (KaTeX)
- Quick-action buttons for common responses ("I don't understand", "Show me an example", "Next question")
- Session timer visible but not prominent

### Progress Dashboard
- Per-subject mastery visualization (radar chart or bar chart)
- Recent session history with topics covered
- Weak area callouts with suggested practice
- Streak tracking for motivation

### Accessibility
- All interactive elements keyboard-navigable
- Screen reader compatible — proper ARIA labels on chat messages
- Reduced motion support via `prefers-reduced-motion`
- Color is never the sole indicator of state

---

## Environment Variables

```bash
# .env.local (NEVER commit this file)
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL="file:./dev.db"

# Optional
NEXT_PUBLIC_APP_NAME="Hunter Tutor"
```

- `ANTHROPIC_API_KEY` is server-side only — never expose to the client
- Validate all env vars at startup with Zod in `src/lib/env.ts`

---

## Development Rules

### Before Every PR
1. `npm run typecheck` passes
2. `npm run lint` passes
3. `npm run test` passes
4. Manual smoke test of affected tutoring flows
5. Check that AI responses are pedagogically appropriate

### Code Conventions
- File naming: `kebab-case.ts` for utilities, `PascalCase.tsx` for components
- One component per file
- Co-locate tests: `component.tsx` → `component.test.tsx` in same directory
- Use `server` / `client` component boundaries intentionally — default to server components
- API route handlers validate input with Zod schemas before processing

### Git
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Feature branches off `main`
- Squash merge to keep history clean

### Content Safety
- All AI-generated content targets 4th-5th grade reading level
- No violent, sexual, or otherwise inappropriate content can surface
- System prompts must include content guardrails
- Log and flag any AI response that bypasses content filters
