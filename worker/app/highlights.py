"""Highlight video.

With a licensed video source (games.video_source_url + game_events.video_offset_s):
cut 16-20 s around each goal and big save, rank the clips by crowd loudness,
keep the best under 110 s, and join them.

Without video rights (the default for the demo): make a vertical "data video"
from the Liiga events, one card per moment. No footage is used."""
from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile

import httpx

from . import config, db, storage
from .facts import game_clock

MAX_REEL_S = 110
POLICY_SKIP = {"fight"}  # editorial policy: no fights in highlights


def base_rank(e: dict) -> float:
    if e["type"] == "goal":
        r = 0.9
        if e["period"] >= 4 or (e.get("detail") or "").lower().startswith("ot"):
            r += 0.09
        return r
    if e["type"] == "save":
        return 0.75
    return 0.4


def ff_path(p: str) -> str:
    """A file path written safely inside an FFmpeg filter (Windows drive letters, spaces)."""
    return "'" + p.replace("\\", "/").replace(":", "\\:").replace("'", "") + "'"


def concat_line(p: str) -> str:
    return "file '" + p.replace("\\", "/").replace("'", "") + "'\n"


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {p.stderr[-800:]}")
    return p


def mean_volume(path: str) -> float:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = re.search(r"mean_volume:\s*(-?[\d.]+) dB", p.stderr)
    return float(m.group(1)) if m else -60.0


# ---------------------------------------------------------------- data video (no footage)
def _hex(color: str) -> str:
    return color.lstrip("#") if color else "1F6FEB"


def card(tmp: str, name: str, bg: str, lines: list[tuple[str, int, int]], dur: float) -> str:
    """lines = [(text, fontsize, y)]"""
    filters = []
    for i, (text, size, y) in enumerate(lines):
        tf = os.path.join(tmp, f"{name}-{i}.txt")
        with open(tf, "w", encoding="utf-8") as f:
            f.write(text)
        filters.append(f"drawtext=fontfile={ff_path(config.FONT_FILE)}:textfile={ff_path(tf)}:fontcolor=white:fontsize={size}:"
                       f"borderw=3:bordercolor=black@0.55:x=(w-text_w)/2:y={y}")
    filters.append(f"fade=t=in:st=0:d=0.3,fade=t=out:st={dur - 0.3:.2f}:d=0.3")
    out = os.path.join(tmp, f"{name}.mp4")
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi",
         "-i", f"color=c=0x{bg}:s=720x1280:d={dur}:r=30", "-vf", ",".join(filters),
         "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", out])
    return out


def data_video(g: dict, events: list[dict], colors: dict[str, str]) -> tuple[bytes, list[dict]]:
    with tempfile.TemporaryDirectory() as tmp:
        parts, clips, t = [], [], 0.0
        title = f"{g['home_name']} {g['home_score']}–{g['away_score']} {g['away_name']}"
        parts.append(card(tmp, "intro", "0B1F33",
                          [("HIGHLIGHTS", 40, 420), (title, 58, 520), (g.get("venue") or "", 34, 620)], 3.0))
        t += 3.0
        for i, e in enumerate(events):
            what = {"goal": "GOAL", "save": "BIG SAVE"}.get(e["type"], e["type"].upper())
            period = "OT" if e["period"] >= 4 else f"P{e['period']}"
            lines = [(f"{period} {e['clock']}", 40, 380), (what, 96, 470)]
            if e.get("score_after"):
                lines.append((e["score_after"], 120, 610))
            lines.append((e.get("player_name") or e.get("team_name") or "", 52, 790))
            if e.get("detail") and e["type"] == "goal":
                lines.append((e["detail"], 36, 870))
            dur = 3.5
            parts.append(card(tmp, f"e{i}", _hex(colors.get(e.get("team_id") or "", "")), lines, dur))
            clips.append({"event_id": e["id"], "start_s": t, "end_s": t + dur, "rank": base_rank(e),
                          "label": f"{period} {e['clock']} · {what.title()} · {e.get('player_name') or ''}".strip(" ·")})
            t += dur
        parts.append(card(tmp, "outro", "0B1F33", [("FinUrheilu", 64, 540), ("AI-made · editor-approved", 34, 640)], 2.0))
        lst = os.path.join(tmp, "list.txt")
        with open(lst, "w") as f:
            f.writelines(concat_line(p) for p in parts)
        out = os.path.join(tmp, "reel.mp4")
        run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
             "-c", "copy", "-movflags", "+faststart", out])
        with open(out, "rb") as f:
            return f.read(), clips


# ---------------------------------------------------------------- real footage
def footage_reel(source_url: str, events: list[dict]) -> tuple[bytes, list[dict]]:
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "source.mp4")
        with httpx.stream("GET", source_url, timeout=600, follow_redirects=True) as r:
            r.raise_for_status()
            with open(src, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
        cut = []
        for i, e in enumerate(events):
            if e.get("video_offset_s") is None:
                continue
            length = 20 if base_rank(e) > 0.95 else 16
            start = max(0, e["video_offset_s"] - 8)
            p = os.path.join(tmp, f"c{i}.mp4")
            run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", str(start), "-i", src, "-t", str(length),
                 "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-ar", "48000", "-pix_fmt", "yuv420p", p])
            loud = mean_volume(p)  # crowd noise: about -40 dB quiet .. -10 dB roaring
            rank = round(base_rank(e) * 0.7 + max(0.0, min(1.0, (loud + 40) / 30)) * 0.3, 3)
            cut.append({"path": p, "event": e, "len": length, "rank": rank})
        chosen, total = [], 0
        for c in sorted(cut, key=lambda x: -x["rank"]):
            if total + c["len"] <= MAX_REEL_S:
                chosen.append(c)
                total += c["len"]
        chosen.sort(key=lambda x: x["event"]["game_seconds"])
        lst = os.path.join(tmp, "list.txt")
        with open(lst, "w") as f:
            f.writelines(concat_line(c["path"]) for c in chosen)
        out = os.path.join(tmp, "reel.mp4")
        run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
             "-c", "copy", "-movflags", "+faststart", out])
        clips, t = [], 0.0
        for c in chosen:
            e = c["event"]
            clips.append({"event_id": e["id"], "start_s": t, "end_s": t + c["len"], "rank": c["rank"],
                          "label": f"{game_clock(e['game_seconds'])} · {e['type']} · {e.get('player_name') or ''}"})
            t += c["len"]
        with open(out, "rb") as f:
            return f.read(), clips


def run_highlights(game_id: str) -> str:
    with db.conn() as c:
        job = db.job_start(c, game_id, "highlight", "ffmpeg")
        try:
            g = db.fetch_game(c, game_id)
            if g["status"] != "final":
                raise RuntimeError("Highlights are made after the final whistle")
            colors = {r["id"]: r["color"] for r in c.execute("select id, color from teams").fetchall()}
            moments = [e for e in g["events"] if e["type"] in ("goal", "save", "fight")]
            skipped = [e for e in moments if e["type"] in POLICY_SKIP]
            use = [e for e in moments if e["type"] not in POLICY_SKIP]

            if g.get("video_source_url"):
                mp4, clips = footage_reel(g["video_source_url"], use)
                mode = "footage"
            else:
                mp4, clips = data_video(g, use, colors)
                mode = "data video"

            title = f"Highlights · {g['home_name']} {g['home_score']}–{g['away_score']} {g['away_name']}"
            item_id = db.upsert_item(c, game_id, "highlight", title)
            vid = db.new_version(c, item_id, "ai:highlight-cutter", job, {"mode": mode})
            url = storage.save(f"highlights/{item_id}/{vid}.mp4", mp4, "video/mp4")
            total = (clips[-1]["end_s"] + (2 if mode == "data video" else 0)) if clips else 0
            c.execute("update content_versions set payload = payload || %s::jsonb where id=%s",
                      (json.dumps({"video_url": url, "duration_s": round(total)}), vid))
            for i, cl in enumerate(clips):
                c.execute("""insert into video_clips (version_id,item_id,event_id,label,start_s,end_s,rank,included,position)
                             values (%s,%s,%s,%s,%s,%s,%s,true,%s)""",
                          (vid, item_id, cl["event_id"], cl["label"], cl["start_s"], cl["end_s"], cl["rank"], i))
            for e in skipped:
                c.execute("""insert into video_clips (version_id,item_id,event_id,label,start_s,end_s,rank,included,position)
                             values (%s,%s,%s,%s,0,0,%s,false,999)""",
                          (vid, item_id, e["id"], f"{game_clock(e['game_seconds'])} · left out by policy: no fights",
                           base_rank(e)))
            db.set_current(c, item_id, vid, "needs_review")
            c.commit()
            db.job_finish(c, job, None, f"{mode}, {len(clips)} moments")
            return item_id
        except Exception as e:  # noqa: BLE001
            db.job_fail(c, job, f"{type(e).__name__}: {e}")
            raise
