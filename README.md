# C4 Diagram Creator

An interactive web application for creating, editing, and visualising [C4 model](https://c4model.com) architecture diagrams. Data is stored internally as nested Mermaid blocks (up to 10 levels deep), with a canvas-first editing experience (draw.io–style drag & drop — Phase 2).

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Open <http://localhost:4321> in your browser. Navigate to `/editor` to open the diagram editor.

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

### Run unit tests

```bash
npm test
```

---

## Architecture

```
src/
├── components/
│   └── canvas/
│       └── DiagramCanvas.tsx   # React island — main canvas (Phase 2: React Flow)
├── layouts/
│   └── AppLayout.astro         # Root HTML shell
├── lib/
│   ├── c4/
│   │   └── types.ts            # TypeScript domain types (C4Level, C4Node, C4Diagram…)
│   └── mermaid/
│       ├── serializer.ts       # C4Diagram → Mermaid string (recursive, max depth 10)
│       ├── deserializer.ts     # TODO: Mermaid string → C4Diagram
│       └── validator.ts        # TODO: validation helpers
├── pages/
│   ├── index.astro             # Landing page
│   └── editor.astro            # Main editor page
└── stores/
    └── diagramStore.ts         # Nano Stores: $project, $activeDiagramId, $navigationStack
```

### Key design decisions

| Concern | Choice | Reason |
|---|---|---|
| Framework | **Astro 5** | Islands architecture, minimal JS by default |
| Interactivity | **React 19** (islands only) | Only used where stateful UI is needed |
| State | **Nano Stores** | ~1 kB, native Astro integration, no prop drilling |
| Styles | **Tailwind CSS 3** | Utility-first, aggressive tree-shaking |
| Storage format | **C4Project JSON + nested Mermaid** | JSON for positions/metadata; Mermaid for interop/export |
| Testing | **Vitest** | Fast, Vite-native, works without a browser for unit tests |

### Nesting model

Each `C4Diagram` maps to one Mermaid block. A node can reference a child diagram via `childDiagramId`. `serializeProject()` recurses through the tree, wrapping each child in `%% [SUBSYSTEM:id]` / `%% [/SUBSYSTEM:id]` markers, up to a maximum depth of **10**.

---

## Roadmap

- **Phase 1 (current)** — Scaffold: Astro + React + Tailwind, domain types, serialiser, stores, tests.
- **Phase 2** — Canvas: React Flow integration, custom C4 node components, drag & drop.
- **Phase 3** — Navigation: drill-down between levels, breadcrumb bar.
- **Phase 4** — Persistence & I/O: localStorage auto-save, export/import (`.c4m`, `.mmd`, `.svg`, `.png`).
- **Phase 5** — UX: undo/redo, auto-layout (dagre), minimap, keyboard shortcuts.