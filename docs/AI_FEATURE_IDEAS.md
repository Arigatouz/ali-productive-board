# AI Feature Ideas for the Productivity Dashboard

A backlog of 10 features tuned for a frontend lead who loves AI. All assume
bring-your-own-API-key (stored in IndexedDB alongside the existing HackMD
token), so the site stays static-hostable on GitHub Pages.

---

## 1. Morning Brief (AI daily standup)

One Claude call at first-load-of-the-day that reads your open tasks, today's
habits, yesterday's journal, and in-progress articles and produces a
30-second "here's your day" card pinned above the Kanban board. Includes a
suggested top-3 and one "don't forget" item. Cache the result per-date so it
only runs once.

**Why it helps:** replaces the 10 minutes of tab-scanning you already do
every morning.

**Implementation sketch**
- New module `js/ai/brief.js`.
- Collect context: `getOpenTasks()`, `getHabitsForDate()`, `getJournal(yesterday)`,
  `getInProgressArticles()`.
- Cache key: `brief:YYYY-MM-DD` in IndexedDB.
- Render a dismissible card above `#board`.

---

## 2. Natural-language command palette (`Cmd+K` v2)

Today the palette is substring fuzzy match. Upgrade it to intent parsing:

- *"move 'fix router bug' to In Progress and tag backend"*
- *"start a 50-min focus on the Stripe migration"*
- *"journal: today was rough because…"*

Claude returns a structured tool-call JSON that maps to existing functions
(`addTask`, `pomoStart`, `journalAppend`). Fall back to fuzzy match when
parse confidence is low.

**Why it helps:** turns the dashboard into a CLI for your life.

**Implementation sketch**
- Extend `js/cmdpalette.js` with an `aiDispatch(input)` path.
- Define a tool schema mirroring the existing `CMD_LIST`.
- Use Claude's tool-use API; require `confidence >= 0.7` to execute without
  confirmation.

---

## 3. Semantic search across everything

Generate embeddings (client-side with `@xenova/transformers` + WebGPU, no
server) for every task, memory section, article, and journal entry. New
shortcut `Cmd+Shift+F` → *"when did I last struggle with onboarding?"* jumps
to the right journal date or task. Store vectors in IndexedDB, re-index on
save.

**Why it helps:** your data is only valuable if you can find it. Good
showcase of modern in-browser ML too.

**Implementation sketch**
- Add `js/ai/embed.js` wrapping `transformers.js` (`all-MiniLM-L6-v2`).
- New IndexedDB store: `embeddings` keyed by `{kind, id}` → `Float32Array`.
- Hook into `saveTask`, `saveMemory`, `saveArticle`, `saveJournal` to
  re-embed on change.
- Cosine similarity in-browser; top 10 results in a new overlay.

---

## 4. Article → "Chat with this article"

Paste a URL on the Articles tab → fetch via the existing Cloudflare Worker
(add a `readability-extract` endpoint) → Claude returns a 3-bullet TL;DR,
estimated read time, and "why this matters for you" (seeded from your
task/memory context). Bonus: a per-article chat pane for Q&A so you can
interrogate long posts without leaving the dashboard.

**Why it helps:** your reading list becomes learnable, not just a
graveyard.

**Implementation sketch**
- Worker endpoint: `POST /extract` that runs Mozilla Readability.
- Extend Article schema with `summary`, `chat_thread`.
- New side panel rendered over the Articles tab.

---

## 5. Weekly Review (retrospective agent)

Every Sunday evening (or on-demand button in the Focus tab), run Claude over
the week's journal + completed tasks + habit log + focus minutes and produce
a structured retro: wins, recurring blockers, mood trend, suggested focus
for next week, and 2-3 candidate habits to try. Save the output as a Journal
entry for that Sunday.

**Why it helps:** the hardest part of journaling is re-reading. Make the
re-read free.

**Implementation sketch**
- New module `js/ai/weekly-review.js`.
- Trigger: button in Focus tab + auto-run on first Sunday load after 6pm.
- Writes back through `journalSave(date, markdown)`.

---

## 6. Voice → Journal / Quick Capture

Web Speech API `SpeechRecognition` for dictation, then a Claude pass to
clean filler words, split into paragraphs, and (for Quick Capture)
auto-extract actionable tasks into the right Kanban column. Tap-to-hold mic
button next to the `+` FAB.

**Why it helps:** frictionless capture while pacing / driving / on a walk.
Journal frequency goes up.

**Implementation sketch**
- `js/ai/voice.js` — thin wrapper around `webkitSpeechRecognition`.
- Post-process with Claude: `clean_transcript` + `extract_tasks`.
- Fallback to raw transcript on API failure.

---

## 7. Vision task intake (screenshot / photo → tasks)

Drag an image onto the Kanban (Slack thread screenshot, whiteboard photo,
Figma export). Claude vision extracts to-dos, owners, and deadlines, then
offers a diff ("I'll add these 4 cards, OK?"). Handles the common friction
point for PMs-turned-EMs.

**Why it helps:** you already screenshot Slack; now the dashboard ingests
it.

**Implementation sketch**
- Drop-zone listener on `#board` and `#listView`.
- Base64-encode image, send to Claude with a JSON-schema tool.
- Diff-review modal before committing to the board.

---

## 8. Memory Curator (AI housekeeping)

The Memory tab is structured markdown. Add a "Tidy with AI" button that
runs Claude on each section to: dedupe, cluster similar items, propose
tags, suggest cross-links between Memory ↔ Tasks ↔ Articles, and surface
stale/contradictory entries. Present as a reviewable diff before writing
back to HackMD.

**Why it helps:** the usual personal-wiki rot problem — solved once a
month in one click.

**Implementation sketch**
- Button in the memory toolbar.
- Claude receives the full parsed structure + a shape-preserving schema.
- Render a two-pane diff (before / after) using a minimal markdown diff
  renderer.

---

## 9. Prompt Library tab

A 6th tab for managing your own prompt library: reusable prompt templates
with `{{variables}}`, version history, a "run" button that opens a
lightweight chat against Claude, tags, and a "used in" backlink to which
feature above consumes them. Syncs to a HackMD note like the other data.

**Why it helps:** every AI enthusiast ends up with prompts scattered in
Notes, Raycast, and Notion. Make *your* dashboard the canonical store.

**Implementation sketch**
- New `PROMPTS_NOTE_ID` in settings.
- Schema: `{id, name, body, variables[], tags[], versions[]}`.
- Reuse the existing modal + marked.js for rendering.

---

## 10. Frontend-lead self-audit dashboard

A small dev-only card in the Focus tab that runs `web-vitals` + `axe-core`
against the dashboard on demand and charts LCP / CLS / INP / a11y-violations
over time (stored in IndexedDB). Pair with a Lighthouse CI GitHub Action on
PRs to the repo.

**Why it helps:** dogfood your craft, and it's a great talking point in
interviews / your blog.

**Implementation sketch**
- Add `web-vitals` + `axe-core` via CDN ES modules.
- New IndexedDB store: `perf_log` keyed by timestamp.
- Sparkline chart using inline SVG (no chart lib).

---

## Honorable mentions

- **Offline local LLM** via WebLLM (Llama-3.2-1B in WebGPU) for the
  natural-language palette when you're on a plane.
- **AI "pair focus" coach** — during a Pomodoro, a side chat bound to the
  current task; post-session auto-writes what you accomplished into the
  task card.
- **Sentiment-aware habit suggestions** — Claude reads the last 14 journal
  entries and proposes one habit to add or drop.
- **End-of-day auto-journal draft** — seeded from the day's completed
  tasks + focus minutes; you just edit.

---

## Suggested rollout order

1. **#2 Natural-language command palette** — highest leverage, smallest
   surface area, makes every later feature feel connected.
2. **#1 Morning Brief** — reuses the Claude client + context-gathering from
   #2.
3. **#5 Weekly Review** — reuses the same context pipeline.
4. **#3 Semantic search** — unlocks #4, #8 by giving them a retrieval
   layer.
5. Everything else, in any order.
