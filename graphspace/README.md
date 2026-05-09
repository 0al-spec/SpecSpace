# GraphSpace

The new viewer for SpecGraph artifacts. Successor to `viewer/app/`, organised by
[Feature-Sliced Design v2.1](https://feature-sliced.design/).

## Status

Day 1 scaffold. Currently contains:

- FSD layer skeleton (`app / pages / widgets / features / entities / shared`).
- Design tokens extracted from the legacy `theme.css`.
- Three baseline `shared/ui` components used everywhere in the legacy viewer:
  `Panel`, `PanelBtn`, `Overlay`.
- A demo page that renders the three components together.

The legacy viewer at `viewer/app/` is untouched and remains the production
target until GraphSpace reaches parity.

## Run

```sh
cd graphspace
npm install
npm run dev          # http://localhost:5174
npm run lint:fsd     # Steiger architecture lint
```

## Layer rules (Steiger-enforced)

```
app → pages → widgets → features → entities → shared
```

Imports go top-down only. Slices on the same layer never import each other —
collect them one layer up. Every slice exposes a `index.ts` public API; never
reach into a slice's internals.

## Where to put code

| Question | Goes to |
|---|---|
| App-wide initialisation, providers, global styles | `app` |
| A whole screen / route | `pages` |
| A large self-contained UI block | `widgets` |
| A user action with business value (verb) | `features` |
| A business entity (noun: node, run, recent-change) | `entities` |
| UI kit, HTTP client, generic lib, config | `shared` |

When in doubt: keep it in `pages/` until something else needs it.
