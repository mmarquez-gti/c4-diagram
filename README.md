# C4 Diagram Creator

An interactive web application for creating, editing, and visualising [C4 model](https://c4model.com) architecture diagrams. The editor offers a canvas-first experience (draw.io–style drag & drop via React Flow) with full project persistence, URL sharing, and multi-format export.

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

## Features

### Node types

The shape palette (left sidebar, hover to expand) provides all standard C4 element types plus two annotation helpers:

| Type | Description |
|---|---|
| **Person** | A human user of the system |
| **System** | An internal software system |
| **Ext. System** | An external software system (dashed border) |
| **Container** | An application or service |
| **Database** | A database or storage container |
| **Component** | An encapsulated component inside a container |
| **Boundary** | A logical or physical boundary |
| **Text Label** | Free-floating text annotation (no connection handles) |
| **Group Box** | Visual grouping box rendered behind other nodes |

### Edge capabilities

| Feature | Detail |
|---|---|
| **Direction** | `Source → Target`, `Target → Source`, `Bidirectional`, `No arrows` |
| **Path mode** | `Bezier` (curved), `Straight`, `Orthogonal` (right-angle segments) |
| **Bend points** | Drag the midpoint handle on any selected edge to add a waypoint; drag existing waypoints to reshape the path |
| **Label offset** | Drag an edge label to reposition it (X/Y offset from path midpoint) |
| **Reconnect** | Drag either endpoint of a selected edge to reconnect it to a different node |

### Canvas interactions

- **Add shapes** — Hover the shape palette on the left and click any shape to place it on the canvas.
- **Drag nodes** — Drag any node to reposition it; positions are persisted automatically.
- **Resize nodes** — Drag the resize handle (bottom-right corner) to change the node's dimensions.
- **Connect nodes** — Hover a node to reveal its connection handles, then drag to another node.
- **Select** — Click a node or edge to select it; its properties appear in the right panel.
- **Multi-select** — Hold `Ctrl` (or `Cmd` on Mac) and click, or drag a selection box, to select multiple items.
- **Delete** — Press `Delete` to remove selected nodes and/or edges.
- **Minimap & controls** — The built-in ReactFlow minimap and zoom controls are available at the bottom of the canvas.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Y` | Redo |
| `Ctrl/⌘ + C` | Copy selected nodes/edges |
| `Ctrl/⌘ + X` | Cut selected nodes/edges |
| `Ctrl/⌘ + V` | Paste (offset by 20 px per successive paste) |
| `Ctrl/⌘ + S` | Force-save to localStorage |
| `Delete` | Delete selected nodes/edges |

### Properties panel

Click any node or edge to open the **Properties** panel (right side). Collapsible via the `View` menu.

**Node properties:**

- Type (change to any C4 node type)
- Label
- Description
- Technology (not available for TextLabel / GroupBox)
- Custom accent color — color picker (TextLabel and GroupBox)
- Custom text color — color picker with auto-reset to WCAG-contrast default
- Hide icon — toggle the per-type SVG icon
- Hide type name — toggle the small uppercase type label (e.g. `BOUNDARY`)
- **↳ Enter Sub-diagram** — drill into a nested diagram for this node

**Edge properties:**

- Label
- Technology
- Direction (Source→Target, reverse, bidirectional, none)
- Path mode (Bezier / Straight / Orthogonal)

### Sub-diagram navigation

Each node (except TextLabel and GroupBox) can own a nested sub-diagram:

1. Select a node and click **↳ Enter Sub-diagram** in the Properties panel.
2. The canvas switches to the child diagram. A **breadcrumb** in the header shows the full path.
3. Click any breadcrumb segment or the **← Back** button to navigate up.
4. You can also jump to any diagram directly from the **Diagrams** panel (left sidebar).

Nesting is supported up to **10 levels** deep.

### Diagrams panel

The collapsible left panel shows a tree of all diagrams in the project. Click any entry to jump to that diagram instantly.

### Persistence

| Mechanism | Behaviour |
|---|---|
| **Auto-save** | Every state change is saved to `localStorage` automatically. Your work survives browser refreshes. |
| **Manual save** | `Ctrl/⌘ + S` triggers an explicit save. |
| **URL sharing** | Click **Share** in the header to copy a shareable URL. The entire project is LZ-compressed and embedded in the URL hash (`#share=…`). Loading the link restores the project and persists it to localStorage. |

### Export & import

| Format | How to access |
|---|---|
| **PNG** (current layer) | File → Export current layer as PNG |
| **Interactive PDF** (all diagrams) | File → Export all as interactive PDF |
| **Mermaid** (`.mmd`) | File → Export as Mermaid |
| **Project JSON** (`.c4m`) | File → Export as .c4m |
| **Import project** | File → Import .c4m… |

#### Interactive PDF export

The PDF export generates one page per diagram traversed in BFS order:

- Each page has a themed title bar with the diagram name.
- Sub-diagram pages include a **← Back** button (linked to the parent page).
- Nodes that have a child diagram are **clickable links** to that page.
- A progress bar is shown during export; please do not close the browser tab until it finishes.
- The output respects the current **dark/light mode** theme.

### Theme

Click the **☀/☾** icon in the header (or use View → Switch to Dark/Light Mode) to toggle between dark and light mode. The preference is persisted to `localStorage`.

---

## Editor Usage Quick-Start

1. **New Project** — `File → New project…` and enter a name.
2. **Add nodes** — Hover the shape palette on the left and click a shape.
3. **Connect nodes** — Hover a node, grab a handle, and drag to another node.
4. **Edit properties** — Click a node or edge and use the **Properties** panel on the right.
5. **Drill down** — Select a node and click **↳ Enter Sub-diagram**; navigate back via the breadcrumb or **← Back**.
6. **Undo / Redo** — `Ctrl/⌘+Z` / `Ctrl/⌘+Y` (also in Edit menu).
7. **Share** — Click **Share** in the header to copy a URL with the full project encoded.
8. **Export** — Use the **File** menu to export as PNG, interactive PDF, Mermaid, or `.c4m`.

---

## Architecture

```
src/
├── components/
│   ├── canvas/
│   │   ├── DiagramCanvas.tsx      # React island — interactive ReactFlow canvas
│   │   ├── C4FlowNode.tsx         # Custom ReactFlow node renderer for C4 shapes
│   │   ├── AnnotationNode.tsx     # TextLabel and GroupBox node renderers
│   │   └── CustomEdge.tsx         # Custom edge renderer (bend points, label offset)
│   ├── editor/
│   │   ├── EditorHeader.tsx       # Menu bar (File / Edit / View), breadcrumb, Share button
│   │   └── ShapePalette.tsx       # Collapsible left shape palette
│   └── panels/
│       ├── DiagramsPanel.tsx      # Collapsible left diagrams tree panel
│       └── PropertiesPanel.tsx    # Collapsible right properties panel
├── layouts/
│   └── AppLayout.astro            # Root HTML shell
├── lib/
│   ├── c4/
│   │   ├── types.ts               # TypeScript domain types (C4Level, C4Node, C4Diagram…)
│   │   ├── model.ts               # Immutable helpers (createNode, addNodeToDiagram, createSubdiagram…)
│   │   └── validation.ts          # Validation utilities (cycle detection, reference checks, depth checks)
│   ├── mermaid/
│   │   └── serializer.ts          # C4Diagram → Mermaid string (recursive, max depth 10)
│   ├── exportUtils.ts             # PNG and interactive PDF export (html-to-image + jsPDF)
│   ├── localState.ts              # localStorage auto-save / restore
│   └── urlState.ts                # URL hash share encoding / decoding (LZ-string)
├── pages/
│   ├── index.astro                # Landing page
│   └── editor.astro               # Main editor page
└── stores/
    ├── diagramStore.ts            # Project state + all mutating actions + undo/redo
    ├── historyStore.ts            # Undo/redo snapshots (past / future stacks)
    ├── selectionStore.ts          # Selected node / edge IDs
    └── uiStore.ts                 # UI state: panel visibility, dark mode
```

### Key design decisions

| Concern | Choice | Reason |
|---|---|---|
| Framework | **Astro 5** | Islands architecture, minimal JS by default |
| Interactivity | **React 19** (islands only) | Only used where stateful UI is needed |
| Canvas | **React Flow v12 (`@xyflow/react`)** | Drag & drop, custom nodes, lightweight |
| State | **Nano Stores** | ~1 kB, native Astro integration, no prop drilling |
| Styles | **Tailwind CSS 3** | Utility-first, aggressive tree-shaking |
| Persistence | **localStorage + URL hash** | Auto-save survives refreshes; URL sharing requires no backend |
| Export | **html-to-image + jsPDF** | Pixel-perfect PNG capture; interactive PDF with internal links |
| Testing | **Vitest** | Fast, Vite-native, works without a browser for unit tests |

### Data model

```
C4Project
  ├── id, name, version
  ├── rootDiagramId
  └── diagrams: Record<string, C4Diagram>
          └── C4Diagram
                ├── id, title, level, depth (0–10), parentNodeId?
                ├── createdAt, updatedAt
                ├── nodes: C4Node[]
                │       └── id, type, label, description?, technology?,
                │           position {x,y}, size {width,height},
                │           childDiagramId?, color?, textColor?,
                │           hideIcon?, hideTypeLabel?
                └── edges: C4Edge[]
                        └── id, source, target, direction?,
                            label?, technology?, pathMode?,
                            bendPoints?, labelOffsetX?, labelOffsetY?
```

### Nesting model

Each `C4Diagram` maps to one Mermaid block. A node can reference a child diagram via `childDiagramId`. `serializeProject()` recurses through the tree, wrapping each child in `%% [SUBSYSTEM:id]` / `%% [/SUBSYSTEM:id]` markers, up to a maximum depth of **10**.

### Undo / Redo

Before every mutating action, the current `C4Project` snapshot is pushed to a `past` stack. `undo` pops from `past` and pushes the current state to `future`; `redo` reverses this. Position and size updates during drag/resize are intentionally **not** snapshotted to avoid polluting history.

---

## Roadmap

- **Phase 1** ✅ — Scaffold: Astro + React + Tailwind, domain types, serialiser, stores, tests.
- **Phase 2** ✅ — Canvas: React Flow integration, custom C4 node rendering, drag & drop, edge creation.
- **Phase 3** ✅ — Navigation: drill-down between levels, breadcrumb bar, undo/redo, properties panel.
- **Phase 4** ✅ — Persistence: localStorage auto-save, URL sharing (LZ-compressed hash).
- **Phase 5** ✅ — Exports: PNG screenshot, interactive multi-page PDF, Mermaid, `.c4m` JSON.
- **Phase 6** ✅ — Advanced edges: bend points, label drag, orthogonal/straight path modes, reconnect.
- **Phase 7** ✅ — Customisation: custom node colors, text colors, hide icon/type label, GroupBox, TextLabel.
- **Phase 8** — UX: auto-layout (dagre), snap-to-grid, keyboard shortcuts for zoom.