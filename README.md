# The Project Planning Project

A small collaborative web app for planning projects: a shared kanban board, a linked notebook, and a project chat, all editable by multiple people at once in real time.

Instructions for running it locally are below, but you can also view it at: https://theprojectplanningproject.vercel.app/

## What it does

- **Kanban board** — columns and cards with drag-and-drop, rich-text card descriptions.
- **Notes** — a per-project notebook with a full rich-text editor (headings, lists, code, colours, alignment, links).
- **Cross-linking** — type `@` in a card description to link a note, or in a note to link a card. Mentions are clickable and stay in sync if the target is renamed; they go visually stale if it's deleted. Notes show a backlinks panel listing cards that mention them.
- **Chat** — a persistent group chat per project. Messages are stored in Supabase and delivered in real time via broadcast. Supports replies (with scroll-to-original), edit and delete of your own messages, a typing indicator, and optimistic sends with retry on failure. Older history loads automatically as you scroll up.
- **Realtime collaboration** — multiple people can edit the same board or note simultaneously and see each other's cursors and selections.
- **Share by link** — projects are created locally; invite links carry a member token (and optionally an admin token) in the URL fragment, so no accounts or sign-up.

## Stack

- **React + TypeScript + Vite** on the frontend.
- **Tiptap** (ProseMirror) for the rich-text editors.
- **Yjs** as the CRDT, with **y-protocols/awareness** for presence.
- **Supabase** for snapshot persistence (Postgres) and realtime channels (broadcast).
- **Zustand** for view-layer state, **dnd-kit** for drag-and-drop, **Tailwind** for styling.

The kanban board and notes metadata share a single Y.Doc per project; each note's body is its own Y.Doc. A custom `SupabaseYjsProvider` handles the bridging: initial snapshot fetch, live updates over a realtime channel, debounced snapshot uploads, and awareness exchange. Chat uses plain Supabase broadcast and Postgres directly.

## Running it locally

```bash
npm install
npm run dev
```

You'll need a Supabase project with the expected tables (`projects`, `board_documents`, `note_documents`, `chat_messages`) and RLS policies that gate access on the `x-member-token` / `x-admin-token` request headers. Then set:

```
VITE_SUPABASE_PUBLISHABLE_KEY=<your anon key>
```

in a `.env.local` file. The Supabase URL is currently hardcoded in `src/lib/supabase.ts` — swap it for your own.

## Layout

```
src/
  components/        React components, grouped by feature (common, kanban, notes, chat)
  pages/             Route-level components
  store/             Zustand stores (projects, kanban, notes, chat, sync status)
  sync/              Y.Doc <-> Supabase provider and the useSyncedYDoc hook
  tiptap/            Custom Tiptap extensions (mentions, suggestion factory)
  types/             Shared TypeScript types
  utils/             Y.Doc helpers, content extraction, project IDs, colours
  lib/               Supabase client factory
```

## Status

Working but unpolished: no tests, no error tracking, and a number of rough edges around offline behaviour and access revocation.

## Commit Message Format

This project uses a very small, consistent commit style:

```text
files (type): what changed
```

### Common types

- `feat` - new feature
- `fix` - bug fix
- `refactor` - code cleanup or restructuring
- `docs` - documentation changes
- `style` - formatting or visual tweaks
- `chore` - maintenance, dependencies, config

### Examples

```text
feat: add kanban drag and drop
fix: stop blank project page on refresh
refactor: simplify auth state handling
style: improve mobile spacing
docs: update setup instructions
chore: upgrade react-router
```

### Guidelines

- Use lowercase
- Write in the present tense
- Keep it short and specific
- Make one logical change per commit

#### AI Disclaimer
AI was used in this project primarily for documentation and styling (mainly just in the editor.css file, although some other sections required some assistance). 
This was done as the primary purpose was to get the project up and running without having to pay too much attention to the visual style of it.