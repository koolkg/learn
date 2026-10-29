#!/usr/bin/env python3
"""
Build problems.json for the prep page.

Combines
  - the company-wise LeetCode dataset (../leetcode-company-wise-problems-main by default)
  - hand-written content in ./content/ (summaries, hints, patterns, test cases, Blind 75 list)
into ./problems.json, which index.html renders.

Examples
  python3 build_prep.py                                   # rebuild with the same settings as last time
  python3 build_prep.py --companies LinkedIn Nvidia Google
  python3 build_prep.py --companies Uber --window 3mo     # 30d | 3mo | 6mo | all
  python3 build_prep.py --no-blind75
  python3 build_prep.py --list-companies                  # what's in the dataset
  python3 build_prep.py --missing                         # problems without a summary / tests yet
  python3 build_prep.py --update-numbers                  # refresh LeetCode problem numbers (needs internet)

Standard library only.
"""
import argparse, csv, datetime, json, os, re, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import harness  # noqa: E402  (test-harness generator, same folder)

CONTENT = os.path.join(HERE, "content")
OUT = os.path.join(HERE, "problems.json")
DEFAULT_DATASET = os.path.normpath(os.path.join(HERE, "..", "leetcode-company-wise-problems-main"))
WINDOWS = [("30d", "1. Thirty Days"), ("3mo", "2. Three Months"), ("6mo", "3. Six Months"), ("all", "5. All")]
WRANK = {w: i for i, (w, _) in enumerate(WINDOWS)}
WLABEL = {"30d": "30 days", "3mo": "3 months", "6mo": "6 months", "all": "all time"}


def load(name):
    with open(os.path.join(CONTENT, name), encoding="utf-8") as f:
        return json.load(f)


def slugify(text):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def slug_from_link(link):
    return link.rstrip("/").rsplit("/", 1)[-1]


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def dataset_companies(dataset):
    return sorted((d for d in os.listdir(dataset) if os.path.isdir(os.path.join(dataset, d)) and not d.startswith(".")), key=str.lower)


def resolve_company(dataset, name):
    folders = {d.lower(): d for d in dataset_companies(dataset)}
    hit = folders.get(name.lower())
    if hit:
        return hit
    close = [d for k, d in folders.items() if name.lower() in k]
    sys.exit(f"Company {name!r} not found in dataset." + (f" Did you mean: {', '.join(close[:8])}?" if close else " Use --list-companies."))


NUMBERS = os.path.join(CONTENT, "leetcode_numbers.json")
LC_API = "https://leetcode.com/api/problems/all/"


def fetch_numbers():
    """Download LeetCode's public problem list and return {slug: number}."""
    raw = None
    try:
        req = urllib.request.Request(LC_API, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://leetcode.com/problemset/"})
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
    except Exception as e:
        # python.org builds on macOS sometimes lack CA certificates; curl uses the system ones
        try:
            raw = subprocess.run(["curl", "-sSL", "-m", "30", "-A", "Mozilla/5.0", LC_API],
                                 capture_output=True, check=True).stdout
        except Exception:
            print(f"warning: couldn't download LeetCode problem numbers ({e}).", file=sys.stderr)
            return None
    try:
        data = json.loads(raw)
        out = {}
        for pair in data["stat_status_pairs"]:
            st = pair["stat"]
            num = str(st.get("frontend_question_id", "")).strip()
            if st.get("question__title_slug") and num:
                out[st["question__title_slug"]] = int(num) if num.isdigit() else num
        return out
    except Exception as e:
        print(f"warning: unexpected response from LeetCode ({e}).", file=sys.stderr)
        return None


def load_numbers(update):
    cached = {}
    if os.path.exists(NUMBERS):
        try:
            cached = json.load(open(NUMBERS, encoding="utf-8")).get("numbers", {})
        except Exception:
            cached = {}
    if update or not cached:
        fresh = fetch_numbers()
        if fresh:
            with open(NUMBERS, "w", encoding="utf-8") as f:
                json.dump({"_note": "slug -> LeetCode problem number. Refresh with: python3 build_prep.py --update-numbers",
                           "fetched": datetime.date.today().isoformat(), "numbers": dict(sorted(fresh.items()))}, f, indent=0)
            print(f"Saved {len(fresh)} LeetCode problem numbers to content/leetcode_numbers.json")
            return fresh
        if not cached:
            print("  (problem numbers will be missing until --update-numbers succeeds)", file=sys.stderr)
    return cached


def snapshot_date(dataset):
    for name in ("Readme.md", "README.md", "readme.md"):
        p = os.path.join(dataset, name)
        if os.path.exists(p):
            m = re.search(r"updated as of ([^.\n]+)", open(p, encoding="utf-8").read(), re.I)
            if m:
                return m.group(1).strip()
    return "unknown date"


def pattern_for(entry, topics, patterns):
    if entry and entry.get("pattern"):
        return entry["pattern"]
    tl = [t.strip() for t in (topics or "").split(",")]
    for topic, pat in patterns["topic_map"]:
        if topic in tl:
            return pat
    return "Other"


def harness_for(entry):
    """Returns (harness dict, provided list)."""
    if entry and entry.get("spec"):
        spec = entry["spec"]
        h = harness.build(spec)
        prov = [{"RandomNode": "Node"}.get(x, x) for x in spec.get("provided", []) if x != "Read4"]
        if "Read4" in spec.get("provided", []):
            prov.append("read4")
    elif entry and entry.get("starters"):
        h = harness.generic(cls=(entry["starters"]["python"], entry["starters"]["java"]))
        prov = []
    elif entry and entry.get("signature"):
        h = harness.generic(entry["signature"]["python"], entry["signature"]["java"])
        prov = []
    else:
        h = harness.generic(cls=(
            "class Solution:\n    # Write your solution here. Check \"Open on LeetCode\" for the exact method signature.\n    pass\n",
            "class Solution {\n    // Write your solution here. Check \"Open on LeetCode\" for the exact method signature.\n\n}\n"))
        prov = []
    if not prov:
        prov = [x for x in ("ListNode", "TreeNode") if x in h["java_starter"] + h["py_starter"]]
    return h, prov


def shrink(h):
    out = {}
    for k in ("py_pre", "py_post", "java_post"):
        v = h[k].replace(harness.PY_HELPERS, "@@PYHELPERS@@").replace(harness.PY_PRELUDE, "@@PYPRELUDE@@")
        v = v.replace(harness.JAVA_MAIN_HELPERS, "@@JHELPERS@@").replace(harness.JAVA_USER_MAIN, "@@JUSERMAIN@@")
        out[k] = v
    return out


def main():
    prev = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT, encoding="utf-8")).get("config", {})
        except Exception:
            prev = {}
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    prev_ds = os.path.normpath(os.path.join(HERE, prev["dataset"])) if prev.get("dataset") else None
    ap.add_argument("--dataset", default=prev_ds if prev_ds and os.path.isdir(prev_ds) else DEFAULT_DATASET,
                    help="path to leetcode-company-wise-problems (default: ../leetcode-company-wise-problems-main)")
    ap.add_argument("--companies", nargs="+", default=prev.get("companies", ["LinkedIn", "Nvidia"]), help="dataset folder names (case-insensitive)")
    ap.add_argument("--window", choices=[w for w, _ in WINDOWS], default=prev.get("window", "6mo"), help="how far back to include (default 6mo)")
    ap.add_argument("--no-blind75", action="store_true", default=not prev.get("blind75", True), help="leave out Blind 75 problems no company asked")
    ap.add_argument("--blind75", dest="no_blind75", action="store_false", help="include the Blind 75 again")
    ap.add_argument("--list-companies", action="store_true")
    ap.add_argument("--missing", action="store_true", help="list problems without a summary or tests, then exit")
    ap.add_argument("--update-numbers", action="store_true", help="re-download LeetCode problem numbers (cached in content/)")
    a = ap.parse_args()

    dataset = os.path.abspath(os.path.expanduser(a.dataset))
    if not os.path.isdir(dataset):
        sys.exit(f"Dataset folder not found: {dataset}\nPass --dataset /path/to/leetcode-company-wise-problems-main")
    if a.list_companies:
        names = dataset_companies(dataset)
        print(f"{len(names)} companies in {dataset}:")
        print(", ".join(names))
        return

    content = load("problems.json")
    numbers = load_numbers(a.update_numbers)
    blind = load("blind75.json")
    patterns = load("patterns.json")
    display = load("companies.json").get("display_names", {})
    folders = [resolve_company(dataset, c) for c in a.companies]
    max_rank = WRANK[a.window]

    problems = {}   # slug -> record

    def get(slug, title, difficulty, link, topics=""):
        if slug not in problems:
            problems[slug] = {"slug": slug, "title": title, "d": difficulty.title(), "link": link, "topics": topics,
                              "companies": {}, "blind75": False}
        elif topics and not problems[slug]["topics"]:
            problems[slug]["topics"] = topics
        return problems[slug]

    company_meta = []
    for folder in folders:
        name = display.get(folder, folder)
        found = False
        for w, fn in WINDOWS[: max_rank + 1]:
            path = os.path.join(dataset, folder, fn + ".csv")
            if not os.path.exists(path):
                continue
            found = True
            for r in read_csv(path):
                slug = slug_from_link(r["Link"])
                p = get(slug, r["Title"], r["Difficulty"], r["Link"], r.get("Topics", ""))
                c = p["companies"].setdefault(name, {"window": w})
                if WRANK[w] < WRANK[c["window"]]:
                    c["window"] = w
                if w == a.window:
                    try:
                        c["freq"] = round(float(r["Frequency"]), 1)
                    except (ValueError, KeyError):
                        pass
        if not found:
            print(f"warning: no {WLABEL[a.window]} files for {folder}", file=sys.stderr)
        company_meta.append({"folder": folder, "name": name, "slug": slugify(name)})

    if not a.no_blind75:
        for b in blind:
            e = content.get(b["slug"], {})
            p = get(b["slug"], b["title"], e.get("difficulty", "Medium"), f"https://leetcode.com/problems/{b['slug']}")
            p["blind75"] = True
    else:
        for b in blind:
            if b["slug"] in problems:
                problems[b["slug"]]["blind75"] = True

    blind_pos = {b["slug"]: i for i, b in enumerate(blind)}

    def order_key(p):
        if p["companies"]:
            best_w = min(WRANK[c["window"]] for c in p["companies"].values())
            best_f = max(c.get("freq", 0) for c in p["companies"].values())
            return (0, -len(p["companies"]), best_w, -best_f, p["title"])
        return (1, 0, 0, blind_pos.get(p["slug"], 9999), p["title"])

    ordered = sorted(problems.values(), key=order_key)
    out_problems, missing = [], []
    for p in ordered:
        e = content.get(p["slug"])
        h, prov = harness_for(e)
        pat = pattern_for(e, p["topics"], patterns)
        rec = {
            "slug": p["slug"], "num": numbers.get(p["slug"]), "title": p["title"], "d": p["d"], "link": p["link"],
            "pattern": pat, "pattern_slug": slugify(pat),
            "companies": p["companies"], "blind75": p["blind75"],
            "summary": (e or {}).get("summary", ""), "example": (e or {}).get("example", ""), "idea": (e or {}).get("idea", ""),
            "full": (e or {}).get("full", ""),
            "topics": p["topics"],
            "tests": [[x, y] for x, y in h["display"]], "provided": prov,
            "py_starter": h["py_starter"], "java_starter": h["java_starter"],
        }
        rec.update(shrink(h))
        out_problems.append(rec)
        if not e or not e.get("summary") or not e.get("spec"):
            missing.append((p["title"], p["slug"], "no summary" if not e or not e.get("summary") else "no tests"))

    if a.missing:
        print(f"{len(missing)} of {len(out_problems)} problems are missing content:")
        for t, s, why in missing:
            print(f"  {why:10}  {s:60}  {t}")
        return

    for cm in company_meta:
        n = cm["name"]
        cm["count"] = sum(1 for p in out_problems if n in p["companies"])
        cm["by_window"] = {w: sum(1 for p in out_problems if n in p["companies"] and p["companies"][n]["window"] == w) for w, _ in WINDOWS}

    data = {
        "generated": datetime.datetime.now().isoformat(timespec="seconds"),
        "snapshot": snapshot_date(dataset),
        "window": a.window, "window_label": WLABEL[a.window],
        "companies": company_meta,
        "blind75_total": len(blind),
        "patterns": patterns["order"] + (["Other"] if "Other" not in patterns["order"] else []),
        "config": {"dataset": os.path.relpath(dataset, HERE), "companies": folders, "window": a.window, "blind75": not a.no_blind75},
        "shared": {"py_helpers": harness.PY_HELPERS, "py_prelude": harness.PY_PRELUDE,
                   "java_main_helpers": harness.JAVA_MAIN_HELPERS, "java_user_main": harness.JAVA_USER_MAIN},
        "problems": out_problems,
    }
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)

    with_tests = sum(1 for p in out_problems if p["tests"])
    counts = ", ".join("%s %d" % (c["name"], c["count"]) for c in company_meta)
    print(f"Wrote {os.path.relpath(OUT)}: {len(out_problems)} problems "
          f"({counts}"
          f"{', Blind 75' if not a.no_blind75 else ''}; window {WLABEL[a.window]}; dataset snapshot {data['snapshot']})")
    print(f"  {with_tests} have test cases; {sum(1 for _, _, w in missing if w == 'no summary')} have no summary yet "
          f"(run with --missing to list them).")
    nonum = [p["title"] for p in out_problems if p["num"] is None]
    if nonum:
        print(f"  {len(nonum)} without a LeetCode number" + (" (run with --update-numbers)" if len(nonum) > 3 else f": {', '.join(nonum)}"))
    print("Reload the page to see the changes.")


if __name__ == "__main__":
    main()
