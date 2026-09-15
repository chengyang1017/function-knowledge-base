# Function Knowledge Base

A personal, reusable knowledge base for collecting functions and code patterns in multiple implementations, then reviewing and reusing them efficiently.

## Current capabilities

- Hierarchical categories for languages, frameworks, and subcategories
- Function search, sorting, learning-status filtering, and favorites
- Multiple code variants with syntax highlighting
- Tags, related functions, notes, recent items, and popular items
- Learning status: unlearned / learning / mastered
- Review page for revisiting saved knowledge
- Admin pages for managing functions, categories, and tags
- Light / dark theme
- Android packaging through Capacitor

## Tech stack

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- react-syntax-highlighter
- Capacitor 8

### Backend

- Node.js
- Express 5
- Prisma 7
- PostgreSQL

## Project structure

```text
.
├─ src/                 React application
│  ├─ components/       Reusable UI and knowledge-detail components
│  ├─ pages/            Library, review, and admin pages
│  ├─ lib/              API/auth helpers
│  └─ types/            Shared frontend types
├─ server/              Express + Prisma backend
│  ├─ prisma/           Schema and migrations
│  └─ src/              API server
├─ android/             Capacitor Android project
└─ scripts/             Project setup scripts
```

## Local development

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
npm --prefix server install
```

Start the frontend:

```bash
npm run dev
```

Start the backend:

```bash
npm --prefix server run dev
```

## Quality checks

Frontend lint and production build:

```bash
npm run lint
npm run build
```

Backend type check:

```bash
npm --prefix server run typecheck
```

## Android

Sync the current web build into the Capacitor Android project:

```bash
npm run android:sync
```

Open Android Studio:

```bash
npm run android:open
```