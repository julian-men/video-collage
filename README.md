# Multimedia Collage Maker

A browser-based collage tool for arranging videos and images on a full-screen workspace, revealing them one by one (optionally on the beat of an MP3 soundtrack), presenting them fullscreen, and exporting the result as an MP4 or WebM video. It is built with React and Vite, styled with plain CSS in a Frutiger Aero look, and runs entirely in the browser with no backend.

## Features

- **Video and image uploads.** Add several videos and images at once. Videos autoplay muted, loop, and play inline without controls. Images appear as static tiles.
- **Separate background image.** Set an image behind the collage. The background is kept apart from the collage media. Without one, the workspace shows a sky, cloud, and bubble scene drawn in CSS.
- **Random layout, dragging, and resizing.** New media lands in random positions at random widths (240–480 px). Tiles keep their aspect ratio and always stay upright inside the workspace. **Randomize layout** shuffles every tile. You can drag a tile or resize it from its lower-right corner with a mouse, touch, or pen. Positions and sizes scale when the window is resized or goes fullscreen.
- **Bring-to-front stacking.** Pressing a tile moves it to the top and it stays there. New uploads appear above existing media, and randomizing keeps the current stacking order.
- **Per-item removal.** Each tile has a remove button. **Clear all media** removes every item, the background, and the soundtrack.
- **Reveal mode and repeat reveal.** Shows items one at a time in upload order, at 1, 3, 5, or 10 second intervals. Start, Pause, and Reset are available, and a counter reads "N of M media items revealed". With **Repeat reveal** on, the sequence loops (1 → 2 → … → all → none → 1 …) until it's paused, reset, or turned off.
- **Soundtrack.** Upload one MP3 to play alongside the collage, with Play/Pause, a seek bar, and **Remove soundtrack**. The soundtrack is separate from the collage: it never becomes a tile or replaces the background, and video tiles stay muted.
- **Tempo detection.** The soundtrack is decoded and analyzed in the browser with the Web Audio API to estimate its BPM and the time of the first beat. Analysis runs in a Web Worker and shows its progress. Low-confidence or failed results are flagged, and you can type or correct the BPM at any time (½× and 2× buttons fix half- or double-tempo guesses).
- **Music-synchronized reveal.** With **Sync reveal to music** on (off by default), reveals happen every 1, 2, or 4 beats instead of on a timer. They follow the audio's playback position, so pausing, resuming, and seeking stay in step with the music.
- **Presentation mode.** Hides the controls and uses the browser's Fullscreen API. If fullscreen is unavailable, it falls back to a full-window view. You can exit with Escape or the on-screen exit button.
- **Keyboard shortcuts.** These control reveal, layout, and help. Press `?` to show the shortcut card.
- **MP4 and WebM export.** Records the current collage, or the reveal sequence when Reveal mode is on, as an `.mp4` or `.webm` file in the browser. Exports are five seconds by default. A music-synchronized reveal can instead record the full soundtrack, including Repeat reveal. MP4 is the default when the browser can record it, since it plays on most phones. The export includes the background, tile positions, sizes, and stacking order.
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
3. Drag tiles to arrange them, resize them from the lower-right corner, or press **Randomize layout** to shuffle them.
4. Turn on **Reveal mode** to show items one by one. Choose an interval, then press **Start**. Turn on **Repeat reveal** to loop the sequence.
5. Press **Enter presentation mode** to show the collage fullscreen without the controls.
6. Pick an **Export format** and **Export quality** (High by default). With a music-synchronized reveal you can also pick **Export length** (five seconds, or the full soundtrack). Press **Export MP4** or **Export WebM**. The file downloads as `multimedia-collage-maker.mp4` or `multimedia-collage-maker.webm`. With Reveal mode on, the export records the reveal sequence from the beginning (see [Exporting a reveal](#exporting-a-reveal)).

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

### Exporting a reveal

With Reveal mode on, **Export** records the reveal sequence from the beginning instead of the collage as it currently looks. The line under the quality selector says what will be recorded:

| Mode | Export summary |
| --- | --- |
| Reveal mode off | `5 seconds · silent` |
| Timer reveal | `5-second reveal sequence · silent` |
| Reveal synced to music, 5 seconds | `5-second reveal sequence · soundtrack included` |
| Reveal synced to music, full soundtrack | `{song length} reveal sequence · full soundtrack included` (or `repeating reveal` when Repeat is on) |

- The sequence always starts from the beginning, whatever is showing on screen. Items appear in upload order, at their saved position, size, and stacking order, and each video starts from its first frame when it's revealed.
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
| `?` | Toggle the shortcut help card |
| `Esc` | Close dialogs or exit presentation mode |

Shortcuts are ignored while typing in a form field and when Ctrl, Cmd, or Alt is held. The reveal shortcuts only work while Reveal mode is on. Shortcuts also work in presentation mode, where the music keeps playing. Manual advancing is turned off while synced so that the music position alone decides what is shown, which keeps seeking predictable.

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

  The video keeps the workspace's own aspect ratio; it is scaled to the largest even-numbered size that fits inside the maximum, never stretched or cropped to 16:9. For example, a 1400×900 workspace exports at 1680×1080 on High. Videos and images are drawn from their original files at that size with high-quality smoothing, so detail beyond the on-screen tile size is kept. The bitrate is a target, and browsers may use less for simple scenes.
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

Everything stays in your browser. Uploaded files are opened locally with temporary object URLs, and nothing is sent to a server. Soundtrack decoding and tempo analysis also run locally. Those URLs are released when media is removed, cleared, or replaced. Exported videos are generated in the browser and saved straight to your device.

## Known limitations

- Nothing is saved. Reloading the page clears the collage.
- There's no undo.
- Tiles can overlap. They can be resized but can't be rotated by hand.
- Items hidden by Reveal mode restart from the beginning when they're revealed.
- While the browser is in true fullscreen, the browser uses Escape to exit fullscreen, so the shortcut help card may need its close button instead.
- Video playback depends on the browser and the file's codec, and MP4 or WebM export depends on which formats the browser can record.
- BPM detection is approximate and assumes one steady tempo. It does not reliably follow recordings whose tempo changes (live performances, rubato, tempo ramps, DJ transitions), and it can lock onto half or double the felt tempo. Long songs drift if the BPM is even slightly off, so correct it by hand when needed.
- Only one soundtrack is supported, and it doesn't loop.
- Synchronized reveals update on beat boundaries and playback events. In a background tab, browsers throttle timers, so reveals catch up when the tab is shown again.

## Credits

Designed and built by **Julian M.**

The credit text and app name are defined in `src/appInfo.js`.
