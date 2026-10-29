#!/usr/bin/env python3
"""
Add a YouTube video to content/videos.json.

  python3 add_video.py https://www.youtube.com/watch?v=Ak-fxEwAR14 --pattern Backtracking
  python3 add_video.py https://youtu.be/XXXX --pattern "Sliding Window" --problem longest-substring-without-repeating-characters
  python3 add_video.py URL --pattern Graphs --chapters "0:00 Intro" "2:15 BFS on a grid" "7:40 Dijkstra"
  python3 add_video.py URL --pattern Heap --link "Visualizer=https://algo.monster/..."
  python3 add_video.py --list

Title, channel and thumbnail are looked up with YouTube's public oEmbed endpoint (needs internet);
pass --title / --channel to set them yourself. Reload the page afterwards — no rebuild needed.
Standard library only.
"""
import argparse, datetime, json, os, re, subprocess, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEOS = os.path.join(HERE, "content", "videos.json")
PATTERNS = os.path.join(HERE, "content", "patterns.json")


def video_id(url):
    m = re.search(r"(?:v=|youtu\.be/|/shorts/|/embed/|/live/)([A-Za-z0-9_-]{11})", url)
    return m.group(1) if m else None


def oembed(url):
    api = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(url, safe="")
    try:
        with urllib.request.urlopen(urllib.request.Request(api, headers={"User-Agent": "Mozilla/5.0"}), timeout=15) as r:
            return json.loads(r.read())
    except Exception:
        try:  # python.org builds on macOS may lack CA certs
            out = subprocess.run(["curl", "-sSL", "-m", "15", api], capture_output=True, check=True).stdout
            return json.loads(out)
        except Exception as e:
            print(f"note: couldn't look up the title ({e}); use --title/--channel to set it.", file=sys.stderr)
            return {}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url", nargs="?")
    ap.add_argument("--pattern", action="append", default=[], help="pattern name (repeatable), e.g. 'Two Pointers'")
    ap.add_argument("--problem", action="append", default=[], help="LeetCode slug this video solves (repeatable)")
    ap.add_argument("--chapters", nargs="*", default=[], help='"m:ss Label" strings')
    ap.add_argument("--link", action="append", default=[], help='extra link as "Label=URL" (repeatable)')
    ap.add_argument("--title"); ap.add_argument("--channel"); ap.add_argument("--duration"); ap.add_argument("--notes", default="")
    ap.add_argument("--list", action="store_true", help="list saved videos")
    a = ap.parse_args()

    data = json.load(open(VIDEOS, encoding="utf-8")) if os.path.exists(VIDEOS) else {"videos": []}
    if a.list:
        for v in data["videos"]:
            print(f"- {v.get('title') or v['url']}  [{', '.join(v.get('patterns', []))}]  {v['url']}")
        return
    if not a.url:
        ap.error("give a YouTube URL (or --list)")
    vid = video_id(a.url)
    if not vid:
        sys.exit("That doesn't look like a YouTube video link.")
    known = json.load(open(PATTERNS, encoding="utf-8"))["order"]
    lower = {p.lower(): p for p in known}
    pats = []
    for p in a.pattern:
        if p.lower() not in lower:
            sys.exit(f"Unknown pattern {p!r}. Choose from: {', '.join(known)}")
        pats.append(lower[p.lower()])
    if not pats and not a.problem:
        sys.exit("Add at least one --pattern (or --problem) so the page knows where to show it.")
    for v in data["videos"]:
        if video_id(v["url"]) == vid:
            v["patterns"] = sorted(set(v.get("patterns", [])) | set(pats))
            v["problems"] = sorted(set(v.get("problems", [])) | set(a.problem))
            if a.chapters: v["chapters"] = a.chapters
            for l in a.link:
                lab, _, u = l.partition("=")
                if u and all(x.get("url") != u for x in v.setdefault("links", [])): v["links"].append({"label": lab, "url": u})
            print(f"Updated existing video: {v.get('title')}")
            break
    else:
        info = {} if (a.title and a.channel) else oembed(f"https://www.youtube.com/watch?v={vid}")
        v = {"url": f"https://www.youtube.com/watch?v={vid}", "title": a.title or info.get("title", ""),
             "channel": a.channel or info.get("author_name", ""), "duration": a.duration or "",
             "patterns": pats, "problems": a.problem, "chapters": a.chapters,
             "links": [{"label": l.partition("=")[0], "url": l.partition("=")[2]} for l in a.link if "=" in l], "notes": a.notes,
             "added": datetime.date.today().isoformat()}
        data["videos"].append(v)
        print(f"Added: {v['title'] or vid}  [{', '.join(pats)}]")
    tmp = VIDEOS + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, VIDEOS)
    print("Reload the page to see it.")


if __name__ == "__main__":
    main()
