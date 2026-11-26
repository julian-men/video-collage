# Collage Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quick fixes, then autosave, undo/redo, reveal order, tile style, export frame, soundtrack loop, auto beats-per-reveal, then tests and refactors.

**Architecture:** Pure logic goes in `src/utils/*` with Vitest tests; React hooks wire it up. Media state moves into `useMediaItems` (needed for undo). Export draws every tile from item data (position, style) so live and reveal exports share one drawing path.

**Tech Stack:** React 19, Vite 8, Vitest (new dev dep), IndexedDB (no library).

**Spec:** `docs/superpowers/specs/2026-11-25-collage-upgrades-design.md`

## Global Constraints

- No new runtime dependencies. Dev dependency allowed: `vitest`.
- Work on `main`, one commit per task, `npm run lint`, `npm test` and `npm run build` pass before each commit.
- Everything stays in the browser; nothing is sent to a server.
- README and About dialog reflect every user-visible change.

## Review Focus

- Reload while a soundtrack is still decoding or a tile is still probing: restore must not save an empty project over the saved one before restore completes.
- Undo after Remove: the removed tile's object URL must still be valid (no revoke while history references it).
- Rotated or translucent tile in export must match the screen (rotation about tile centre, opacity, rounded corners).
- 9:16 export from a landscape workspace: canvas is 1080×1920 on High, collage letterboxed, background fills the frame.
- Soundtrack loop with sync on: reveal cycle restarts at the loop point instead of freezing.

---

### Task 1: Quick fixes + Vitest

**Files:** delete `src/assets/{hero.png,react.svg,vite.svg}`, `public/icons.svg`; modify `package.json`, `src/utils/audioFiles.js`, `src/hooks/useSoundtrack.js`, `src/components/SoundtrackControls.jsx`, `src/components/Workspace.jsx`, `src/App.jsx`, `src/App.css`, `src/components/AboutDialog.jsx`, `README.md`; test `src/utils/audioFiles.test.js`.

- [ ] `package.json`: name `multimedia-collage-maker`, version `1.0.0`, script `"test": "vitest run"`, dev dep `vitest`.
- [ ] Failing tests: `validateSoundtrackFile` accepts `audio/mpeg`, `audio/wav`, `audio/x-wav`, `audio/mp4`, `audio/x-m4a`, `audio/aac`, `audio/ogg`; with empty type accepts names ending `.mp3 .wav .m4a .aac .ogg .oga`; rejects `video/mp4`, `a.txt`, empty file (`'the file is empty'`); rejection reason `'it is not a supported audio file'`.
- [ ] Implement; `SOUNDTRACK_ACCEPT` lists the MIME types and extensions; export `SOUNDTRACK_FORMATS_LABEL = 'MP3, WAV, M4A/AAC, or OGG'` and use it in useSoundtrack messages; panel label becomes "Soundtrack".
- [ ] Drag-and-drop: `Workspace` takes `onDropFiles(files: File[])`; `dragover` preventDefault + `workspace--drop` class while dragging files; App routes audio files (by `isSoundtrackFile`) to `soundtrack.load` (first one), everything else to `handleAddMedia`. Placeholder text mentions dropping.
- [ ] Commit `chore: quick fixes — drop files, more audio formats, cleanup`.

### Task 2: `useMediaItems` + undo/redo (#6)

**Files:** create `src/utils/history.js`, `src/utils/history.test.js`, `src/hooks/useMediaItems.js`; modify `src/App.jsx`, `src/components/MediaTile.jsx`, `src/hooks/useKeyboardShortcuts.js`, `src/components/ShortcutHelp.jsx`, `ControlPanel.jsx`.

**Interfaces (history.js, all pure):**
- `HISTORY_LIMIT = 50`, `MERGE_MS = 800`
- `emptyHistory() -> { past: [], future: [], lastTag: null, lastTime: 0 }`
- `checkpoint(history, items, tag, now) -> history` — pushes `items` onto `past` (cap 50, drops oldest), clears `future`; if `tag !== null && tag === lastTag && now - lastTime < MERGE_MS` returns history with only `lastTime` updated.
- `undo(history, items) -> { history, items } | null`, `redo(history, items) -> same`
- `referencedIds(history, items) -> Set<string>`

**useMediaItems(onLoadFailed)** returns `{ items, add(files) -> rejected[], move, resize, bringToFront, setAspectRatio, remove(id), randomize(), reorder(id, delta), setStyle(id, patch), markFailed(id, message), clear(), replaceAll(items, blobs), undo(), redo(), canUndo, canRedo, beginGesture(id), blobFor(id) }`. URLs and blobs of ids no longer in `referencedIds` are revoked/dropped after each change.

- [ ] Failing tests for history: push/undo/redo round-trip; merge window same tag; different tag not merged; limit 50; checkpoint clears future; `referencedIds` covers past+future+present.
- [ ] Implement history.js; tests pass.
- [ ] Implement useMediaItems; move item logic out of App.jsx. Checkpoints: `beginGesture` (tile pointerdown/resize start, tag null), remove, randomize, reorder (tag `reorder`), setStyle (tag `style:<id>:<key>`).
- [ ] `useKeyboardShortcuts`: key name gets `mod+` prefix when Ctrl/Meta held, plus `shift+` only when mod held; Alt still ignored. Shortcuts `mod+z` undo, `mod+shift+z` and `mod+y` redo. Undo/Redo buttons in the panel; ShortcutHelp rows.
- [ ] Commit `feat: undo and redo for layout changes`.

### Task 3: Reveal order (#7)

- [ ] Create `src/components/RevealOrderList.jsx`: ordered list of item names with ↑/↓ buttons (`aria-label="Move <name> earlier|later"`), disabled at ends; shown when 2+ items. Calls `media.reorder(id, -1|1)`. Pure `moveItem(items, id, delta)` in `src/utils/itemOrder.js` with tests (moves, clamps at ends, unknown id returns same array).
- [ ] Commit `feat: reorder reveal sequence`.

### Task 4: Tile style (#8)

**Interfaces (`src/utils/tileStyle.js`):** `DEFAULT_TILE_STYLE = { rotation: 0, radius: 0, opacity: 1, shadow: true }`, `MAX_RADIUS = 0.3`, `radiusPx(style, width, height) = style.radius * Math.min(width, height)`, `normalizeStyle(style?) -> full style`.

- [ ] Tests for `radiusPx`, `normalizeStyle` (fills defaults, clamps rotation to [-180,180], radius [0,0.3], opacity [0.1,1]).
- [ ] Items get `style`. App tracks `selectedId` (set on tile pointerdown, cleared on Clear/remove). Tile gets `media-tile--selected` outline, inline `transform: rotate()`, `opacity`, `borderRadius`, `boxShadow: none` when shadow off. `src/components/TileStyleControls.jsx`: rotation slider −180…180, corners 0…30%, opacity 10…100%, shadow checkbox, "Reset style" button.
- [ ] Commit `feat: per-tile rotation, corners, opacity, shadow`.

### Task 5: Export draws from items, styles, and frame shape (#8 export, #11)

**Interfaces (`exportCollageVideo.js`):** `EXPORT_FRAMES = { workspace: {label:'Match workspace', aspect:null}, landscape:{label:'Landscape 16:9', aspect:16/9}, portrait:{label:'Portrait 9:16', aspect:9/16}, square:{label:'Square 1:1', aspect:1} }`; `exportFrameLayout(workspaceWidth, workspaceHeight, frame, quality) -> { width, height, scale, offsetX, offsetY }` — bounds are preset max (long side) × max (short side), swapped when the frame is portrait; workspace fitted (contain) and centred.

- [ ] Tests: workspace 1400×900 high → 1680×1080, offset 0; landscape workspace portrait frame high → 1080×1920, offsetY>0, offsetX 0; square standard → 720×720; even sizes.
- [ ] Collage-mode export uses `items` (visible ones) and finds each live media via `[data-item-id]`; one `drawTile(ctx, tile)` draws background-black rounded rect with shadow, clip, contain-fit media, rotation about centre, `globalAlpha`. Background/scene drawn over the whole frame; tiles drawn through the frame transform.
- [ ] "Export shape" select in panel, persisted with other settings later.
- [ ] Commit `feat: export frame shapes and styled tiles`.

### Task 6: Soundtrack loop (#13) and Auto beats (#14)

- [ ] `useSoundtrack`: `loop` state + `setLoop`, applied to `audio.loop` (kept across track replacement). "Loop" checkbox in SoundtrackControls. Full export stays one pass.
- [ ] `beatSync.js`: `BEATS_PER_REVEAL_OPTIONS = [1, 2, 4, 'auto']`, `AUTO_BEAT_CANDIDATES = [1,2,4,8,16,32,64]`, `autoBeatsPerReveal({ duration, anchor, bpm, total }) -> number`: largest candidate whose `itemsShownBefore` ≥ total; 1 if none. Tests: 10 items, 120 bpm, 200 s, anchor 0 → 16 (steps of 8 s ⇒ 25 reveals ≥10; 32 ⇒ 16 s ⇒ 13 ≥10 → 32 actually; compute in test from itemsShownBefore); short song → 1; 0 items → 64.
- [ ] `useMusicSync` keeps `beatsSetting` (number|'auto'); `beatsPerReveal` is the effective number; exposes `beatsSetting`, `setBeatsPerReveal`. Select shows "Auto (every N beats)".
- [ ] Commit `feat: soundtrack loop and auto reveal spacing`.

### Task 7: Autosave (#5)

**Interfaces (`src/utils/projectStore.js`):** `loadProject() -> Promise<record|null>`, `saveProject(record) -> Promise`, `clearProject()`; DB `multimedia-collage-maker`, store `project`, key `current`. Pure `toRecord({ items, blobFor, background, soundtrack, settings })` and `fromRecord(record) -> { items, blobs, background, soundtrack, settings }` with tests (blobs omitted for unknown ids; style normalized; missing fields default).

- [ ] Tests for toRecord/fromRecord.
- [ ] `useProjectPersistence({ ... })`: on mount load + restore (items via `media.replaceAll`, background, soundtrack via `soundtrack.load(new File([blob], name))` then BPM/offset/loop), sets `restored=true`; saves 500 ms after changes only when `restored`. Settings saved: export quality/format/frame/length, syncEnabled, reveal enabled/interval/repeat, beats setting. Failures show one warning notice.
- [ ] Background and soundtrack keep their source blob (`background.blob`, `soundtrack.track.file`).
- [ ] Commit `feat: autosave the project in the browser`.

### Task 8: Code quality

- [ ] Tests for `revealTimeline`, `beatSync` (`revealAnchor`, `revealStepAt`, `visibleCountForStep`), `tileLayout`, `mediaFiles.validateMediaFile`, `tempoAnalysis` on a synthetic click track at 120 BPM (±1).
- [ ] Split `exportCollageVideo.js` into `src/utils/export/formats.js` (formats, qualities, frames, support, estimates, layout), `src/utils/export/drawing.js` (scene, cover, drawTile), `src/utils/exportCollageVideo.js` (orchestration, re-exports).
- [ ] README/About final pass; remove "Nothing is saved"/"no undo"/"can't be rotated" limitations.
- [ ] Commit `refactor: split export module, add util tests`.
