# Multimedia Collage Maker

A browser-based collage tool for arranging videos and images on a full-screen workspace, revealing them one by one (optionally on the beat of a soundtrack), presenting them fullscreen, and exporting the result as an MP4 or WebM video. It is built with React and Vite, styled with plain CSS in a Frutiger Aero look, and runs entirely in the browser with no backend.

## Features

- **Video and image uploads.** Add several videos and images at once, from the file picker or by dropping files onto the workspace. Videos autoplay muted, loop, and play inline without controls. Images appear as static tiles. A dropped audio file becomes the soundtrack.
- **Separate background image.** Set an image behind the collage. The background is kept apart from the collage media. Without one, the workspace shows a sky, cloud, and bubble scene drawn in CSS.
- **Random layout, dragging, and resizing.** New media lands in random positions at random widths (240–480 px). Tiles keep their aspect ratio and always stay upright inside the workspace. **Randomize layout** shuffles every tile. You can drag a tile or resize it from its lower-right corner with a mouse, touch, or pen. Positions and sizes scale when the window is resized or goes fullscreen.
- **Tile style.** Click a tile to select it, then set its rotation (−180° to 180°), rounded corners (up to 30% of the shorter side), opacity (10–100%), and shadow from the panel. **Reset style** restores the defaults. Exports draw tiles with the same style.
- **Undo and redo.** Adding, moving, resizing, removing, randomizing, reordering, and styling tiles can be undone with **Undo** / **Redo** or `Ctrl/⌘ Z` and `Ctrl/⌘ Shift Z` (or `Ctrl Y`). Up to 50 steps are kept. Dragging a slider counts as one step. In Reveal mode, undoing or redoing a removal keeps the same items showing. The shortcuts also work while a slider, checkbox, or menu has focus; in a text field they undo the text instead.
- **Autosave.** The collage is saved in the browser as you work, including media, background, soundtrack (with your BPM and offset), layout, tile styles, and settings, and is restored when you reopen the page. **Clear all media** asks first, then clears the saved collage too. A file that fails to display stays in the saved collage (the failure may be temporary) until you remove it. If a saved collage can't be restored, it isn't deleted: nothing is saved until you change something, so reloading can try again.
- **Bring-to-front stacking.** Pressing a tile moves it to the top and it stays there. New uploads appear above existing media, and randomizing keeps the current stacking order.
- **Per-item removal.** Each tile has a remove button. **Clear all media** removes every item, the background, and the soundtrack.
- **Reveal mode and repeat reveal.** Shows items one at a time in the order listed under **Reveal order** (upload order unless you move items with ↑ / ↓), at 1, 3, 5, or 10 second intervals. Start, Pause, and Reset are available, and a counter reads "N of M media items revealed". With **Repeat reveal** on, the sequence loops (1 → 2 → … → all → none → 1 …) until it's paused, reset, or turned off.
- **Soundtrack.** Upload one MP3, WAV, M4A/AAC, or OGG file to play alongside the collage, with Play/Pause, a seek bar, **Loop soundtrack**, and **Remove soundtrack**. The soundtrack is separate from the collage: it never becomes a tile or replaces the background, and video tiles stay muted.
- **Tempo detection.** The soundtrack is decoded and analyzed in the browser with the Web Audio API to estimate its BPM and the time of the first beat. Analysis runs in a Web Worker and shows its progress. Low-confidence or failed results are flagged, and you can type or correct the BPM at any time (½× and 2× buttons fix half- or double-tempo guesses).
- **Music-synchronized reveal.** With **Sync reveal to music** on (off by default), reveals happen every 1, 2, or 4 beats, or **Auto**, instead of on a timer. Auto picks the widest spacing (up to 64 beats) that still shows every item before the song ends. They follow the audio's playback position, so pausing, resuming, and seeking stay in step with the music.
- **Presentation mode.** Hides the controls and uses the browser's Fullscreen API. If fullscreen is unavailable, it falls back to a full-window view. You can exit with Escape or the on-screen exit button.
- **Keyboard shortcuts.** These control reveal, layout, and help. Press `?` to show the shortcut card.
- **MP4 and WebM export.** Records the current collage, or the reveal sequence when Reveal mode is on, as an `.mp4` or `.webm` file in the browser, in the workspace's shape or as landscape 16:9, portrait 9:16, or square 1:1. Exports are five seconds by default. A music-synchronized reveal can instead record the full soundtrack, including Repeat reveal. MP4 is the default when the browser can record it, since it plays on most phones. The export includes the background, tile positions, sizes, and stacking order.
- **Upload validation and error messages.** Unsupported or empty files are listed by name and the reason they were skipped, while valid files in the same selection are still added. Media that the browser can't play or decode is flagged with a plain-language error. The tile is replaced by a placeholder, and the message can be dismissed or used to remove the file. If a new background image fails to load, the previous background is kept. Messages are announced to assistive technology (`role="alert"`).
- **About dialog and credit.** A short guide to the app, opened from the "Made by Julian M." bar.

## Supported formats

| Kind | Accepted |
| --- | --- |
| Images | PNG, JPG/JPEG, GIF, WebP |
| Videos | Any `video/*` file the browser reports (for example MP4, WebM, MOV, M4V, OGV) |
| Background | Image files |
| Soundtrack | MP3, WAV, M4A/AAC, OGG (by MIME type, or by `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.oga` name when the browser reports no type) |

Files are first checked by MIME type. If the browser reports no MIME type, the file extension is used instead. Passing this check doesn't guarantee playback, because codec support differs between browsers. For example, HEVC/H.265 `.mov` or `.mp4` files may not play in some browsers. Each new file is test-loaded, and any file the browser can't render is shown as a failed tile with an explanation instead of failing silently. A soundtrack is only accepted once the browser has actually decoded it. Empty, unsupported, or undecodable audio shows a dismissible alert, and a failed replacement keeps the current soundtrack.

## Getting started

Requires Node.js and npm.

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

### Lint, tests, and production build

```bash
npm run lint
npm test
npm run build
```

Tests use [Vitest](https://vitest.dev) and cover the pure logic in `src/utils/`.

`npm run preview` serves the production build locally.

## Usage

1. Use **Videos & images** to choose one or more files, or drop them onto the workspace. They appear in random positions.
2. Optionally choose a **Background image**.
3. Drag tiles to arrange them, resize them from the lower-right corner, or press **Randomize layout** to shuffle them. Click a tile to rotate or style it. Use **Undo** if you change your mind.
4. Turn on **Reveal mode** to show items one by one. Choose an interval, then press **Start**. Turn on **Repeat reveal** to loop the sequence. Change the order under **Reveal order**.
5. Press **Enter presentation mode** to show the collage fullscreen without the controls.
6. Pick an **Export format**, **Export quality** (High by default), and **Export shape**. With a music-synchronized reveal you can also pick **Export length** (five seconds, or the full soundtrack). Press **Export MP4** or **Export WebM**. The file downloads as `multimedia-collage-maker.mp4` or `multimedia-collage-maker.webm`. With Reveal mode on, the export records the reveal sequence from the beginning (see [Exporting a reveal](#exporting-a-reveal)).

### Revealing on the beat

1. Choose an audio file under **Soundtrack** and wait for "Estimated tempo".
2. Check the **BPM**. If reveals feel twice as fast or slow as the music, use ½× or 2×. If detection failed, type the BPM yourself.
3. Turn on **Reveal mode**, then **Sync reveal to music**, and pick **Reveal every 1, 2, or 4 beats**, or **Auto** to spread every item across the song.
4. Press **Start** (or **Play** in the soundtrack controls). Item 1 appears on the first beat, and one more appears at every reveal step after that.
5. If reveals land consistently early or late, adjust **Beat offset (ms)**. Positive values make reveals happen later; negative values make them earlier.

How synchronized reveal behaves:

- **Before the first beat** (or the first beat shifted by the offset), no items are shown. If a negative offset moves that beat before the start of the track, the first reveal happens on the next beat.
- **Pause** pauses the music and the reveals together. **Start** resumes from the same position.
- **Seeking** with the seek bar immediately shows the items for that point in the song.
- **Reset** pauses the music, rewinds to the beginning, and hides every item until playback starts again. Replacing the soundtrack does the same.
- With **Repeat reveal** on, the cycle is 1 → 2 → … → N → none → 1 …, one step per reveal. With it off, reveals stop once all items are shown while the music plays on.
- When the soundtrack ends, playback and reveals stop, unless **Loop soundtrack** is on. Then the song starts over and the reveal starts over with it: nothing shows before the first beat, then items appear again from item 1.
- Adding or removing items during playback takes effect immediately; the count shown is always derived from the current music position.
- Without a soundtrack or a valid BPM, the ordinary timer reveal is used. Interval reveal behaves exactly as before when sync is off.

### Exporting a reveal

With Reveal mode on, **Export** records the reveal sequence from the beginning instead of the collage as it currently looks. The line under the quality selector says what will be recorded:

| Mode | Export summary |
| --- | --- |
| Reveal mode off | `5 seconds · silent` |
| Timer reveal | `5-second reveal sequence · silent` |
| Reveal synced to music, 5 seconds | `5-second reveal sequence · soundtrack included` |
| Reveal synced to music, full soundtrack | `{song length} reveal sequence · full soundtrack included` (or `repeating reveal` when Repeat is on) |

- The sequence always starts from the beginning, whatever is showing on screen. Items appear in reveal order, at their saved position, size, style, and stacking order, and each video starts from its first frame when it's revealed.
- **Timer reveal:** item 1 shows at the start, and one more appears every interval, exactly as in the live reveal. The file is silent and always five seconds long.
- **Synced reveal:** the soundtrack is recorded from time 0, and reveals follow the same BPM, first beat, beat offset, and **Reveal every** setting as the live reveal. Nothing shows before the first beat. Timing comes from the recorded audio itself, so reveals land on the beats in the file.
- **Export length** appears once Reveal mode, music sync, a decoded soundtrack, and a valid BPM are all active. **5 seconds** (the default) matches the previous five-second export, including silence after a shorter track. **Full soundtrack** records from audio time 0 to the soundtrack's exact duration, with no extra silence.
- Full-soundtrack export runs **in real time**: a four-minute song takes about four minutes to record. Keep the page open until it finishes. Progress is shown on the Export button (`Exporting MP4… 1:42 / 3:58 (43%)`), and **Cancel export** stops the recording, saves no file, and releases every resource.
- Before a full-soundtrack export, the panel shows an estimated file size from the selected video bitrate (8 or 16 Mbps) plus soundtrack audio (128 kbps). That is an upper bound; simple scenes usually encode smaller. If the song is longer than five minutes or the estimate is over 250 MB, a warning is shown. Standard quality is recommended for long exports, but the current quality setting is not changed.
- If the song is too short for every item to appear at least once, a warning says how many items can appear and suggests fewer beats per reveal. The export still runs.
- With Repeat reveal off, items appear through N and then stay visible for the rest of the recording. With Repeat reveal on, a **full-soundtrack** export loops `1 → 2 → … → N → none → 1 …`, including the empty step, until the song ends. A repeating **timer** reveal still cannot be exported, because it has no natural ending. A repeating five-second synced export is also disabled; choose Full soundtrack or turn Repeat off.
- Exporting doesn't touch the live reveal: the music keeps playing or stays paused at the same position, and the items on screen don't change. The export decodes its own copy of the soundtrack and never plays it through the speakers.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Start or pause reveal (plays or pauses the music when synced) |
| `→` or `N` | Reveal the next item (disabled while synced to music) |
| `R` | Reset reveal (also pauses and rewinds the music when synced) |
| `L` | Randomize layout |
| `Ctrl/⌘ Z` | Undo |
| `Ctrl/⌘ Shift Z` or `Ctrl Y` | Redo |
| `?` | Toggle the shortcut help card |
| `Esc` | Close dialogs or exit presentation mode |

Shortcuts are ignored while typing in a form field (where Undo works on the text instead) and when Alt is held. Ctrl or Cmd is only used for Undo and Redo. The reveal shortcuts only work while Reveal mode is on. Shortcuts also work in presentation mode, where the music keeps playing. Manual advancing is turned off while synced so that the music position alone decides what is shown, which keeps seeking predictable.

## Export limitations

- Export length is **five seconds** by default, recorded at 30 fps. For a music-synchronized reveal, **Export length** can be **Full soundtrack**, which records the whole song in real time and therefore takes as long as the track. A four-minute song at High quality can be several hundred megabytes; the panel shows an estimate before you start. Cancel stops the recording and does not save a file.
- **Export format** offers two choices:

  | Format | Codec (first one the browser supports) | Best for |
  | --- | --- | --- |
  | **MP4** | H.264/AVC: `avc1.42E01E` (Baseline), then `avc1.4D4028` (Main), then the browser's default MP4 codec | Phones, messaging apps, most video players |
  | **WebM** | VP9, then VP8, then the browser's default WebM codec | Desktop browsers |

  MP4 uses the browser's own built-in encoder through `MediaRecorder`. The app adds no encoder or conversion library, so whether MP4 is available depends entirely on the browser. Support is checked with `MediaRecorder.isTypeSupported()` when the page loads. If MP4 isn't supported, WebM is selected and the MP4 option is disabled with an explanation. The file is always saved with the type the recorder actually produced, and WebM data is never renamed to `.mp4`.
- MP4 browser support varies. Recent Chrome, Edge, and Safari can record MP4. At the time of writing, Firefox records WebM only, and older browsers may offer only one of the two formats. The exact H.264 profile and level are chosen by the browser, so the codec string in the file can differ from the one requested.
- If MP4 recording fails partway through, the app shows an error suggesting WebM instead of switching formats on its own.
- **Export quality** is chosen under the format, and the selected setting is shown under the selector:

  | Quality | Maximum size | Bitrate |
  | --- | --- | --- |
  | **High** (default) | 1920×1080 | 16 Mbps |
  | Standard | 1280×720 | 8 Mbps |

  The maximum size is for a landscape frame; a portrait frame swaps it (1080×1920 on High). **Export shape** picks the frame:

  | Shape | High | Standard |
  | --- | --- | --- |
  | Match workspace (default) | Workspace's aspect ratio, up to 1920×1080 | up to 1280×720 |
  | Landscape 16:9 | 1920×1080 | 1280×720 |
  | Portrait 9:16 | 1080×1920 | 720×1280 |
  | Square 1:1 | 1080×1080 | 720×720 |

  The frame is the largest even-numbered size that fits inside the maximum. With **Match workspace**, a 1400×900 workspace exports at 1680×1080 on High. With any other shape, the whole collage is scaled to fit inside the frame and centred, never stretched or cropped, and the background (or the default sky scene) fills the space around it. Videos and images are drawn from their original files at that size with high-quality smoothing, so detail beyond the on-screen tile size is kept. The bitrate is a target, and browsers may use less for simple scenes.
- Collage videos are always muted in the export. Only a music-synchronized reveal includes sound, and that sound is the soundtrack.
- **Soundtrack audio** uses the browser's built-in audio encoder:

  | Format | Container and codecs (first one the browser supports) |
  | --- | --- |
  | **MP4** | `avc1.42E01E` + AAC (`mp4a.40.2`), then `avc1.4D4028` + AAC, then the browser's default MP4 |
  | **WebM** | VP9 + Opus, then VP8 + Opus, then the browser's default WebM |

  Some browsers can record MP4 video but not MP4 with AAC audio. In that case, MP4 is disabled for synced exports with an explanation, and you need to select WebM. The app never falls back to a silent video when the soundtrack was expected, and it never renames one container as another. If the browser drops the audio during recording, the export fails with an error instead of saving a silent file.
- Synced export needs the Web Audio API (`AudioContext` and `createMediaStreamDestination`). If the browser blocks audio from starting, the app asks you to press Export again.
- Export is disabled when there's no media, and isn't available in presentation mode. Repeat reveal only blocks export for a timer reveal, or for a five-second synced export; a full-soundtrack synced export can repeat until the song ends.
- With Reveal mode off, the layout is captured when export starts, and videos are recorded from wherever they are in playback at that moment.
- Tiles that failed to load are left out of the export.
- Export relies on `MediaRecorder` and `canvas.captureStream`. If the browser can't record the selected format, the app shows an error instead of exporting.
- Keep the tab visible while exporting. Frames are drawn on a clock in a Web Worker, so the video still lasts the chosen length when the window is unfocused or the tab is in the background, but some browsers capture a hidden page less smoothly. Full-soundtrack export must run in real time, so the page has to stay open until it finishes.

## Privacy

Everything stays in your browser. Uploaded files are opened locally with temporary object URLs, and nothing is sent to a server. The autosaved collage, including copies of your media files, is kept in the browser's IndexedDB storage for this site; **Clear all media** removes it after you confirm. Large videos use browser storage space; if the browser refuses to save, a warning says so and the collage keeps working without autosave. Soundtrack decoding and tempo analysis also run locally. Those URLs are released when media is removed, cleared, or replaced. Exported videos are generated in the browser and saved straight to your device.

## Known limitations

- Undo covers the collage tiles. Changing the background or soundtrack, changing settings, and **Clear all media** can't be undone.
- Autosave keeps one collage per browser. Private windows may not keep it after they close.
- Tiles can overlap. A rotated tile can extend past the edge of the workspace.
- Items hidden by Reveal mode restart from the beginning when they're revealed.
- While the browser is in true fullscreen, the browser uses Escape to exit fullscreen, so the shortcut help card may need its close button instead.
- Video playback depends on the browser and the file's codec, and MP4 or WebM export depends on which formats the browser can record.
- BPM detection is approximate and assumes one steady tempo. It does not reliably follow recordings whose tempo changes (live performances, rubato, tempo ramps, DJ transitions), and it can lock onto half or double the felt tempo. Long songs drift if the BPM is even slightly off, so correct it by hand when needed.
- Only one soundtrack is supported. **Loop soundtrack** applies to live playback; a full-soundtrack export records the song once.
- Synchronized reveals update on beat boundaries and playback events. In a background tab, browsers throttle timers, so reveals catch up when the tab is shown again.

## Credits

Designed and built by **Julian M.**

The credit text and app name are defined in `src/appInfo.js`.
