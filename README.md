# C4 Diagram Creator

An interactive web application for creating, editing, and visualising [C4 model](https://c4model.com) architecture diagrams. Data is stored internally as nested Mermaid blocks (up to 10 levels deep), with a canvas-first editing experience (draw.io–style drag & drop via React Flow).

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

## Editor Usage

1. **New Project** — Click `+ New` in the toolbar to create a project.
2. **Add nodes** — Use the toolbar buttons (`+ Person`, `+ System`, etc.) to add C4 nodes to the canvas.
3. **Drag nodes** — Drag any node to reposition it; positions persist in memory.
4. **Connect nodes** — Hover a node, grab a handle, and drag to another node to create an edge.
5. **Select & edit** — Click a node or edge to select it; the **Properties** panel (right) lets you edit its label, description, technology, and type.
6. **Sub-diagrams** — Select a node and click **↳ Enter Sub-diagram** to drill into (or create) a nested diagram.
7. **Navigate** — Use the breadcrumb in the toolbar or the **← Back** button to return to the parent diagram.
8. **Undo / Redo** — Use `↩ Undo` / `↪ Redo` in the toolbar.
9. **Export** — `Export Mermaid` downloads a `.mmd` file; `Export .c4m` downloads the full project JSON.
10. **Import** — `Import` loads a `.c4m` file back into the editor.

---

## Architecture

```
src/
├── components/
│   ├── canvas/
│   │   └── DiagramCanvas.tsx      # React island — interactive canvas (React Flow)
│   └── panels/
│       ├── PropertiesPanel.tsx    # React island — selected entity editor
│       └── Toolbar.tsx            # React island — toolbar with all actions
├── layouts/
│   └── AppLayout.astro            # Root HTML shell
├── lib/
│   ├── c4/
│   │   ├── types.ts               # TypeScript domain types (C4Level, C4Node, C4Diagram…)
│   │   ├── model.ts               # Immutable helper utilities (createNode, addNodeToDiagram, createSubdiagram…)
│   │   └── validation.ts          # Validation utilities (cycle detection, reference checks, depth checks)
│   └── mermaid/
│       ├── serializer.ts          # C4Diagram → Mermaid string (recursive, max depth 10)
│       ├── deserializer.ts        # TODO: Mermaid string → C4Diagram
│       └── validator.ts           # TODO: validation helpers
├── pages/
│   ├── index.astro                # Landing page
│   └── editor.astro               # Main editor page
└── stores/
    ├── diagramStore.ts            # Project state + all mutating actions + undo/redo
    ├── historyStore.ts            # Undo/redo snapshots (past / future stacks)
    └── selectionStore.ts          # Selected node / edge IDs
```

### Key design decisions

| Concern | Choice | Reason |
|---|---|---|
| Framework | **Astro 5** | Islands architecture, minimal JS by default |
| Interactivity | **React 19** (islands only) | Only used where stateful UI is needed |
| Canvas | **React Flow v12 (`@xyflow/react`)** | Drag & drop, custom nodes, lightweight |
| State | **Nano Stores** | ~1 kB, native Astro integration, no prop drilling |
| Styles | **Tailwind CSS 3** | Utility-first, aggressive tree-shaking |
| Storage format | **C4Project JSON + nested Mermaid** | JSON for positions/metadata; Mermaid for interop/export |
| Testing | **Vitest** | Fast, Vite-native, works without a browser for unit tests |

### Data model

```
C4Project
  ├── id, name, version
  ├── rootDiagramId
  └── diagrams: Record<string, C4Diagram>
          └── C4Diagram
                ├── id, title, level, depth (0–10), parentNodeId?
                ├── nodes: C4Node[]
                │       └── id, type, label, description?, technology?,
                │           position {x,y}, size {width,height}, childDiagramId?
                └── edges: C4Edge[]
                        └── id, source, target, label?, technology?
```

### Nesting model

Each `C4Diagram` maps to one Mermaid block. A node can reference a child diagram via `childDiagramId`. `serializeProject()` recurses through the tree, wrapping each child in `%% [SUBSYSTEM:id]` / `%% [/SUBSYSTEM:id]` markers, up to a maximum depth of **10**.

### Undo / Redo

Before every mutating action, the current `C4Project` snapshot is pushed to a `past` stack. `undo` pops from `past` and pushes the current state to `future`; `redo` reverses this. Position updates during drag are intentionally **not** snapshotted to avoid polluting history.

---

## Roadmap

- **Phase 1** ✅ — Scaffold: Astro + React + Tailwind, domain types, serialiser, stores, tests.
- **Phase 2** ✅ — Canvas: React Flow integration, custom C4 node rendering, drag & drop, edge creation.
- **Phase 3** ✅ — Navigation: drill-down between levels, breadcrumb bar, undo/redo, properties panel.
- **Phase 4** — Persistence: localStorage auto-save, export/import `.svg` / `.png`.
- **Phase 5** — UX: auto-layout (dagre), keyboard shortcuts, snap-to-grid, minimap improvements.