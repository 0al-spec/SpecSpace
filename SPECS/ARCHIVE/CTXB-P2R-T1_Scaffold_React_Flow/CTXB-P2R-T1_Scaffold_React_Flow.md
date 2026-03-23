# CTXB-P2R-T1 — Scaffold Vite + React + React Flow project in viewer

## Objective Summary

Set up a Vite + React + TypeScript project inside `viewer/` with React Flow installed. The dev server proxies API calls to the Python backend. A minimal App component renders a React Flow canvas with a single hardcoded node.

## Deliverables

1. `viewer/app/` directory with Vite + React + TypeScript project (separate from Python server files).
2. React Flow renders a canvas with a hardcoded test node.
3. Vite dev server proxies `/api/*` to the Python backend (port 8001).
4. Legacy `index.html` remains functional.
5. Build produces a production bundle.

## Technical Approach

- Create `viewer/app/` to house the React project (keeps Python files `server.py`, `schema.py`, `__init__.py` at `viewer/` level).
- `viewer/app/package.json` with dependencies: `react`, `react-dom`, `@xyflow/react`, `@types/react`, `@types/react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`.
- `viewer/app/vite.config.ts` with proxy: `/api` → `http://localhost:8001`.
- `viewer/app/src/main.tsx` entry point, `viewer/app/src/App.tsx` with React Flow.
- `viewer/app/tsconfig.json` for TypeScript config.
- `viewer/app/index.html` as Vite entry HTML.
- The old `viewer/index.html` stays untouched — it's the legacy viewer.

## Acceptance Tests

1. `cd viewer/app && npm install && npm run dev` starts a dev server.
2. The dev server renders a React Flow canvas with a test node.
3. API calls proxy to the Python backend.
4. `npm run build` produces `viewer/app/dist/` output.
5. Legacy `viewer/index.html` still works.
