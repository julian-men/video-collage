# Collage upgrades — design (short)

**Why:** the owner uses the app with one looping soundtrack and wants work to survive reloads, be reversible, and export for phones/social. YAGNI: smallest version of each feature.

## Approaches
- Persistence: IndexedDB autosave (chosen) vs. project file export/import (more UI, not needed now) vs. localStorage (can't hold media blobs).
- Multiple soundtracks: rejected — beat sync and export assume one BPM; owner uses one looping track.

## Scope
Quick fixes: remove unused template assets; set package name/version 1.0.0; drag-and-drop files onto the workspace; accept MP3, WAV, M4A/AAC, OGG soundtracks.

Features:
- #5 Autosave media, background, soundtrack, layout, settings to IndexedDB; restore on load.
- #6 Undo/redo (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z / Ctrl+Y) for move, resize, remove, randomize, reorder, style.
- #7 Reveal order list with up/down buttons.
- #8 Selected-tile style: rotation, corner radius, opacity, shadow; drawn in exports too.
- #11 Export frame: Workspace / 16:9 / 9:16 / 1:1, collage letterboxed into the frame.
- #13 Soundtrack loop toggle (live playback, sync, and full-soundtrack export stay single-pass).
- #14 "Auto" beats-per-reveal: largest of 1/2/4/8/16/32/64 beats that still shows every item before the song ends, falling back to 1.

Code quality: Vitest tests for utils; split exportCollageVideo.js; move media state out of App.jsx into a hook.

Non-goals: multiple soundtracks, project files, drag-to-sort, undo of uploads/clear-all.
