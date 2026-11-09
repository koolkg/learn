"""Upserts the focus practice problems into content/custom_problems.json, keeping everything else."""
import json, os, sys, datetime
dst, src = sys.argv[1], sys.argv[2]
data = json.load(open(dst)) if os.path.exists(dst) else {"_note": "Problems you added. Edit here or with the page's form, then: python3 build_prep.py", "problems": []}
now = datetime.datetime.now().isoformat(timespec="seconds")
items = data["problems"]; by = {c.get("slug"): i for i, c in enumerate(items)}
for k, c in enumerate(json.load(open(src))):
    c = dict(c); c["origin"] = "focus"; c.setdefault("added", "2026-11-06T09:%02d:00" % (50 - k)); c["updated"] = now
    for f in ("source", "example", "hint", "signature", "tests"):
        c.setdefault(f, "")
    if c["slug"] in by:
        c["added"] = items[by[c["slug"]]].get("added", c["added"]); items[by[c["slug"]]] = c
    else:
        items.append(c)
tmp = dst + ".tmp"
json.dump(data, open(tmp, "w"), indent=2, ensure_ascii=False); open(tmp, "a").write("\n"); os.replace(tmp, dst)
print("custom problems:", len(items))
