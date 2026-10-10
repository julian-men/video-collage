# Multimedia Collage Maker

A browser-based collage tool for arranging videos and images on a full-screen workspace, revealing them one by one (optionally on the beat of an MP3 soundtrack), presenting them fullscreen, and exporting the result as a short WebM video. It is built with React and Vite, styled with plain CSS in a Frutiger Aero look, and runs entirely in the browser with no backend.

## Features

- **Video and image uploads.** Add several videos and images at once. Videos autoplay muted, loop, and play inline without controls. Images appear as static tiles.
- **Separate background image.** Set an image behind the collage. The background is kept apart from the collage media. Without one, the workspace shows a sky, cloud, and bubble scene drawn in CSS.
- **Random layout and manual dragging.** New media lands in random positions at random widths (240–480 px). Tiles keep their aspect ratio and always stay upright inside the workspace. **Randomize layout** shuffles every tile. You can drag any tile with a mouse, touch, or pen. Positions are stored relative to the workspace, so the layout scales when the window is resized or goes fullscreen.
- **Bring-to-front stacking.** Pressing a tile moves it to the top and it stays there. New uploads appear above existing media, and randomizing keeps the current stacking order.
- **Per-item removal.** Each tile has a remove button. **Clear all media** removes every item, the background, and the soundtrack.
- **Reveal mode and repeat reveal.** Shows items one at a time in upload order, at 1, 3, 5, or 10 second intervals. Start, Pause, and Reset are available, and a counter reads "N of M media items revealed". With **Repeat reveal** on, the sequence loops (1 → 2 → … → all → none → 1 …) until it's paused, reset, or turned off.
- **Soundtrack.** Upload one MP3 to play alongside the collage, with Play/Pause, a seek bar, and **Remove soundtrack**. The soundtrack is separate from the collage: it never becomes a tile or replaces the background, and video tiles stay muted.
- **Tempo detection.** The soundtrack is decoded and analyzed in the browser with the Web Audio API to estimate its BPM and the time of the first beat. Analysis runs in a Web Worker and shows its progress. Low-confidence or failed results are flagged, and you can type or correct the BPM at any time (½× and 2× buttons fix half- or double-tempo guesses).
- **Music-synchronized reveal.** With **Sync reveal to music** on (off by default), reveals happen every 1, 2, or 4 beats instead of on a timer. They follow the audio's playback position, so pausing, resuming, and seeking stay in step with the music.
- **Presentation mode.** Hides the controls and uses the browser's Fullscreen API. If fullscreen is unavailable, it falls back to a full-window view. You can exit with Escape or the on-screen exit button.
- **Keyboard shortcuts.** These control reveal, layout, and help. Press `?` to show the shortcut card.
- **WebM export.** Records the current collage as a five-second `.webm` file in the browser. The export includes the background, tile positions, sizes, and stacking order.
- **Upload validation and error messages.** Unsupported or empty files are listed by name and the reason they were skipped, while valid files in the same selection are still added. Media that the browser can't play or decode is flagged with a plain-language error. The tile is replaced by a placeholder, and the message can be dismissed or used to remove the file. If a new background image fails to load, the previous background is kept. Messages are announced to assistive technology (`role="alert"`).
- **About dialog and credit.** A short guide to the app, opened from the "Made by Julian M." bar.

## Supported formats

| Kind | Accepted |
| --- | --- |
| Images | PNG, JPG/JPEG, GIF, WebP |
| Videos | Any `video/*` file the browser reports (for example MP4, WebM, MOV, M4V, OGV) |
| Background | Image files |
| Soundtrack | MP3 (`audio/mpeg`, or a `.mp3` name when the browser reports no type) |

Files are first checked by MIME type. If the browser reports no MIME type, the file extension is used instead. Passing this check doesn't guarantee playback, because codec support differs between browsers. For example, HEVC/H.265 `.mov` or `.mp4` files may not play in some browsers. Each new file is test-loaded, and any file the browser can't render is shown as a failed tile with an explanation instead of failing silently. A soundtrack is only accepted once the browser has actually decoded it. Empty, non-MP3, or undecodable audio shows a dismissible alert, and a failed replacement keeps the current soundtrack.

## Getting started

Requires Node.js and npm.

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

### Lint and production build

```bash
npm run lint
npm run build
```

`npm run preview` serves the production build locally.

## Usage

1. Use **Videos & images** to choose one or more files. They appear in random positions.
2. Optionally choose a **Background image**.
3. Drag tiles to arrange them, or press **Randomize layout** to shuffle them.
4. Turn on **Reveal mode** to show items one by one. Choose an interval, then press **Start**. Turn on **Repeat reveal** to loop the sequence.
5. Press **Enter presentation mode** to show the collage fullscreen without the controls.
6. With Reveal mode off, press **Export WebM** to download `multimedia-collage-maker.webm`.

### Revealing on the beat

1. Choose an MP3 under **Soundtrack (MP3)** and wait for "Estimated tempo".
2. Check the **BPM**. If reveals feel twice as fast or slow as the music, use ½× or 2×. If detection failed, type the BPM yourself.
3. Turn on **Reveal mode**, then **Sync reveal to music**, and pick **Reveal every 1, 2, or 4 beats**.
4. Press **Start** (or **Play** in the soundtrack controls). Item 1 appears on the first beat, and one more appears at every reveal step after that.
5. If reveals land consistently early or late, adjust **Beat offset (ms)**. Positive values make reveals happen later; negative values make them earlier.

How synchronized reveal behaves:

- **Before the first beat** (or the first beat shifted by the offset), no items are shown. If a negative offset moves that beat before the start of the track, the first reveal happens on the next beat.
- **Pause** pauses the music and the reveals together. **Start** resumes from the same position.
- **Seeking** with the seek bar immediately shows the items for that point in the song.
- **Reset** pauses the music, rewinds to the beginning, and hides every item until playback starts again. Replacing the soundtrack does the same.
- With **Repeat reveal** on, the cycle is 1 → 2 → … → N → none → 1 …, one step per reveal. With it off, reveals stop once all items are shown while the music plays on.
- When the soundtrack ends, playback and reveals stop. The soundtrack does not loop.
- Adding or removing items during playback takes effect immediately; the count shown is always derived from the current music position.
- Without a soundtrack or a valid BPM, the ordinary timer reveal is used. Interval reveal behaves exactly as before when sync is off.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Start or pause reveal (plays or pauses the music when synced) |
| `→` or `N` | Reveal the next item (disabled while synced to music) |
| `R` | Reset reveal (also pauses and rewinds the music when synced) |
| `L` | Randomize layout |
| `?` | Toggle the shortcut help card |
| `Esc` | Close dialogs or exit presentation mode |

Shortcuts are ignored while typing in a form field and when Ctrl, Cmd, or Alt is held. The reveal shortcuts only work while Reveal mode is on. Shortcuts also work in presentation mode, where the music keeps playing. Manual advancing is turned off while synced so that the music position alone decides what is shown, which keeps seeking predictable.

## Export limitations

- Export length is fixed at **five seconds**. It records at 30 fps, at up to 1280×720 (scaled from the workspace's proportions), using the VP9 codec, or VP8 if VP9 isn't supported.
- Exports are silent: collage videos are muted, and the soundtrack is not included.
- Export is disabled while Reveal mode is on or when there's no media, and isn't available in presentation mode.
- The layout is captured when export starts. Videos are recorded from wherever they are in playback at that moment.
- Tiles that failed to load are left out of the export.
- Export relies on `MediaRecorder` and `canvas.captureStream`. If the browser doesn't support WebM recording, the app shows an error instead of exporting.

## Privacy

Everything stays in your browser. Uploaded files are opened locally with temporary object URLs, and nothing is sent to a server. Soundtrack decoding and tempo analysis also run locally. Those URLs are released when media is removed, cleared, or replaced. Exported videos are generated in the browser and saved straight to your device.

## Known limitations

- Nothing is saved. Reloading the page clears the collage.
- There's no undo.
- Tiles can overlap. Their size is set randomly and can't be resized or rotated by hand.
- Items hidden by Reveal mode restart from the beginning when they're revealed.
- While the browser is in true fullscreen, the browser uses Escape to exit fullscreen, so the shortcut help card may need its close button instead.
- Video playback and WebM export support depend on the browser and the file's codec.
- BPM detection is approximate and assumes one steady tempo. It does not reliably follow recordings whose tempo changes (live performances, rubato, tempo ramps, DJ transitions), and it can lock onto half or double the felt tempo. Long songs drift if the BPM is even slightly off, so correct it by hand when needed.
- Only one soundtrack is supported, and it doesn't loop or get saved.
- Synchronized reveals update on beat boundaries and playback events. In a background tab, browsers throttle timers, so reveals catch up when the tab is shown again.

## Credits

Designed and built by **Julian M.**

The credit text and app name are defined in `src/appInfo.js`.
