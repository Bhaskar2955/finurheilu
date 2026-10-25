# Your own videos

Drop video files here and they show up in the app's **Video** section after a page refresh. You don't need to restart anything.

- `karpat/`, `tappara/`, `hifk/` and so on: one folder per team. The folder name is the team name in lower case, with ä/ö as a/o and spaces as `-` (for example `k-espoo`, `assat`, `kookoo`).
- `league/`: shown under every team.
- Formats: `.mp4` (H.264, best everywhere), `.webm`, `.m4v`, `.mov` (Safari only).
- Thumbnail (optional): an image with the same name, e.g. `kooste.mp4` + `kooste.jpg`.
- Titles (optional): a `videos.json` in the team folder:
  ```json
  { "kooste.mp4": { "title": "Kärpät – HIFK: maalikooste", "date": "2026-10-24" } }
  ```
  Without it, the title comes from the file name (`karpat-hifk-kooste.mp4` → "karpat hifk kooste").

Video files are not committed to git (see `.gitignore`), so they stay on this computer.
