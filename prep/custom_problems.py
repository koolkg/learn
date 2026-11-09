"""Problems you add yourself (from the page's "+ Add problem" form, or by editing content/custom_problems.json).

Used by prep_server.py (to check a problem before saving it) and build_prep.py (to put it in problems.json).

A stored problem looks like:
  {"slug": "custom-meeting-rooms-merge", "title": "Meeting rooms merge", "difficulty": "Medium",
   "pattern": "Intervals", "companies": ["LinkedIn"], "source": "LinkedIn phone screen, Nov 2026",
   "summary": "...", "statement": "...", "example": "...", "hint": "...",
   "signature": "int countRooms(int[][] intervals)",            # optional, Java
   "tests": "[[[0,30],[5,10],[15,20]]] -> 2   // overlapping\n...",   # optional, one per line
   "order": "exact" | "any" | "any-inner",
   "added": "2026-11-05T10:00:00", "updated": "..."}
"""
import html
import json
import re

FILE_NAME = "custom_problems.json"
PREFIX = "custom-"

# Java parameter type -> (harness type, Python hint)
PARAMS = {
    "int": ("int", "int"), "long": ("long", "int"), "double": ("double", "float"), "boolean": ("bool", "bool"),
    "char": ("char", "str"), "String": ("str", "str"),
    "int[]": ("int[]", "List[int]"), "int[][]": ("int[][]", "List[List[int]]"), "char[]": ("char[]", "List[str]"),
    "char[][]": ("char[][]", "List[List[str]]"), "String[]": ("str[]", "List[str]"),
    "List<Integer>": ("list<int>", "List[int]"), "List<String>": ("list<str>", "List[str]"),
    "List<List<Integer>>": ("list<list<int>>", "List[List[int]]"),
    "TreeNode": ("tree", "Optional[TreeNode]"), "ListNode": ("list", "Optional[ListNode]"),
    "ListNode[]": ("list[]", "List[Optional[ListNode]]"),
    "Robot": ("robot", "Robot"),
}
# Java return type -> (harness type, Python hint, can be checked by tests)
RETURNS = {
    "void": ("void", "None", False),
    "int": ("int", "int", True), "long": ("long", "int", True), "double": ("double", "float", True),
    "boolean": ("bool", "bool", True), "String": ("str", "str", True),
    "int[]": ("int[]", "List[int]", True), "int[][]": ("int[][]", "List[List[int]]", True),
    "boolean[]": ("bool[]", "List[bool]", True), "double[]": ("double[]", "List[float]", True),
    "String[]": ("str[]", "List[str]", True), "char[][]": ("char[][]", "List[List[str]]", True),
    "List<Integer>": ("list<int>", "List[int]", True), "List<String>": ("list<str>", "List[str]", True),
    "List<Boolean>": ("list<bool>", "List[bool]", True),
    "List<List<Integer>>": ("list<list<int>>", "List[List[int]]", True),
    "List<List<String>>": ("list<list<str>>", "List[List[str]]", True),
    "ListNode": ("list", "Optional[ListNode]", True),
    "TreeNode": ("treeret", "Optional[TreeNode]", False),
}
ORDERS = {"exact": "eq", "any": "sort", "any-inner": "sortinner"}
DIFFS = ("Easy", "Medium", "Hard")


class Invalid(ValueError):
    """errors: list of {"field": ..., "msg": ...}"""
    def __init__(self, errors):
        super().__init__("; ".join(e["msg"] for e in errors))
        self.errors = errors


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")[:60].strip("-")


def _norm_type(t):
    return re.sub(r"\s+", "", t).replace("Integer[]", "Integer[]")


def _split_top(s, sep=","):
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch in "<([":
            depth += 1
        elif ch in ">)]":
            depth -= 1
        if ch == sep and depth == 0:
            out.append(cur); cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return out


def parse_signature(sig):
    """'public int maxProfit(int[] prices)' -> dict(name, ptypes, pnames, rtype, java, py, testable)."""
    s = sig.strip().rstrip("{").strip().rstrip(";").strip()
    m = re.match(r"^(?:(?:public|private|protected|static|final)\s+)*(.+?)\s+([A-Za-z_]\w*)\s*\((.*)\)$", s, re.S)
    if not m:
        raise Invalid([{"field": "signature", "msg": "Couldn't read the signature. Write it like: int maxProfit(int[] prices)"}])
    rt, name, plist = _norm_type(m.group(1)), m.group(2), m.group(3).strip()
    errors = []
    if rt not in RETURNS:
        errors.append({"field": "signature", "msg": "Return type %s isn't supported. Use one of: %s" % (rt, ", ".join(RETURNS))})
    ptypes, pnames, jparams, pyparams = [], [], [], []
    for part in (_split_top(plist) if plist else []):
        part = part.strip()
        pm = re.match(r"^(?:final\s+)?(.+?)\s*([A-Za-z_]\w*)$", part, re.S)
        if not pm:
            errors.append({"field": "signature", "msg": "Couldn't read parameter '%s'" % part}); continue
        jt, pn = _norm_type(pm.group(1)), pm.group(2)
        if jt not in PARAMS:
            errors.append({"field": "signature", "msg": "Parameter type %s isn't supported. Use one of: %s" % (jt, ", ".join(PARAMS))}); continue
        ptypes.append(PARAMS[jt][0]); pnames.append(pn)
        jparams.append("%s %s" % (jt, pn)); pyparams.append("%s: %s" % (pn, PARAMS[jt][1]))
    if errors:
        raise Invalid(errors)
    hrt, pyrt, testable = RETURNS[rt]
    return {"name": name, "ptypes": ptypes, "pnames": pnames, "rtype": hrt, "testable": testable,
            "java": "public %s %s(%s)" % (rt, name, ", ".join(jparams)),
            "py": "def %s(self%s) -> %s:" % (name, "".join(", " + p for p in pyparams), pyrt)}


def _strip_comment(line):
    """split 'json -> json  // note' into (code, note); ignores // and # inside strings."""
    q, i = False, 0
    while i < len(line):
        c = line[i]
        if c == '"' and (i == 0 or line[i - 1] != "\\"):
            q = not q
        elif not q and (line.startswith("//", i) or c == "#"):
            return line[:i].rstrip(), line[i:].lstrip("/# ").strip()
        i += 1
    return line.rstrip(), ""


def _split_arrow(code):
    q, depth = False, 0
    for i, c in enumerate(code):
        if c == '"' and (i == 0 or code[i - 1] != "\\"):
            q = not q
        elif not q:
            if c in "[{":
                depth += 1
            elif c in "]}":
                depth -= 1
            elif depth == 0 and code.startswith(("->", "=>"), i):
                return code[:i].strip(), code[i + 2:].strip()
    return None


def _is_int(x):
    return isinstance(x, int) and not isinstance(x, bool)


def check_value(v, t):
    ints = lambda a: isinstance(a, list) and all(_is_int(x) for x in a)
    strs = lambda a: isinstance(a, list) and all(isinstance(x, str) for x in a)
    chars = lambda a: isinstance(a, list) and all(isinstance(x, str) and len(x) == 1 for x in a)
    return {
        "int": _is_int(v), "long": _is_int(v), "double": isinstance(v, (int, float)) and not isinstance(v, bool),
        "bool": isinstance(v, bool), "str": isinstance(v, str), "char": isinstance(v, str) and len(v) == 1,
        "int[]": ints(v), "list<int>": ints(v), "list": ints(v),
        "int[][]": isinstance(v, list) and all(ints(r) for r in v),
        "list<list<int>>": isinstance(v, list) and all(ints(r) for r in v),
        "list[]": isinstance(v, list) and all(ints(r) for r in v),
        "char[]": chars(v), "char[][]": isinstance(v, list) and all(chars(r) for r in v),
        "str[]": strs(v), "list<str>": strs(v),
        "tree": isinstance(v, list) and all(x is None or _is_int(x) for x in v),
        "robot": isinstance(v, list) and len(v) == 2 and isinstance(v[0], list) and all(ints(r) for r in v[0]) and ints(v[1]) and len(v[1]) == 2,
    }.get(t, True)


TYPE_HELP = {"int[]": "[1,2,3]", "int[][]": "[[1,2],[3,4]]", "list": "[1,2,3] (the list's values)", "tree": "[3,9,20,null,null,15,7] (level order)",
             "str": '"abc"', "char": '"a"', "char[]": '["a","b"]', "char[][]": '[["1","0"],["0","1"]]', "str[]": '["a","b"]',
             "list<int>": "[1,2,3]", "list<str>": '["a","b"]', "list<list<int>>": "[[1,2],[3]]", "list[]": "[[1,4],[2,3]]",
             "robot": "[[[0,0,2],[0,1,0]], [1,0]] (grid: 0 free, 1 wall, 2 target; then the start [row, col])",
             "int": "5", "long": "5", "double": "2.5", "bool": "true"}


def parse_tests(text, sig):
    """one test per line: <arguments as a JSON list> -> <expected JSON>   // optional note"""
    tests, errors = [], []
    n = len(sig["ptypes"])
    for ln, raw in enumerate((text or "").splitlines(), 1):
        if not raw.strip() or raw.strip().startswith(("//", "#")):
            continue
        code, note = _strip_comment(raw.strip())
        parts = _split_arrow(code)
        if not parts:
            errors.append({"field": "tests", "msg": "Line %d: put -> between the arguments and the expected answer" % ln}); continue
        try:
            args = json.loads(parts[0])
        except ValueError as e:
            errors.append({"field": "tests", "msg": "Line %d: the arguments aren't valid JSON (%s)" % (ln, e)}); continue
        try:
            exp = json.loads(parts[1])
        except ValueError as e:
            errors.append({"field": "tests", "msg": "Line %d: the expected answer isn't valid JSON (%s)" % (ln, e)}); continue
        # one parameter: accept the bare value as well as [value]
        if n == 1 and not (isinstance(args, list) and len(args) == 1 and check_value(args[0], sig["ptypes"][0])):
            args = [args]
        if not isinstance(args, list) or len(args) != n:
            errors.append({"field": "tests", "msg": "Line %d: expected %d argument%s in a JSON list, like [%s]" % (
                ln, n, "" if n == 1 else "s", ", ".join(TYPE_HELP.get(t, "…") for t in sig["ptypes"]))}); continue
        bad = [i for i, (a, t) in enumerate(zip(args, sig["ptypes"])) if not check_value(a, t)]
        if bad:
            i = bad[0]
            errors.append({"field": "tests", "msg": "Line %d: argument %s should look like %s" % (ln, sig["pnames"][i], TYPE_HELP.get(sig["ptypes"][i], sig["ptypes"][i]))}); continue
        tests.append([args, exp, note] if note else [args, exp])
    if errors:
        raise Invalid(errors)
    return tests


def clean(raw, existing_slugs, editing=None):
    """Validates form fields. Returns the record to store. Raises Invalid."""
    g = lambda k: str(raw.get(k) or "").strip()
    errors = []
    title = g("title")
    if not title:
        errors.append({"field": "title", "msg": "Give the problem a title."})
    if len(title) > 120:
        errors.append({"field": "title", "msg": "Title is too long (120 characters max)."})
    diff = g("difficulty").title() or "Medium"
    if diff not in DIFFS:
        diff = "Medium"
    order = g("order") or "exact"
    if order not in ORDERS:
        order = "exact"
    comps = raw.get("companies") or []
    if isinstance(comps, str):
        comps = comps.split(",")
    comps = [c.strip()[:40] for c in comps if str(c).strip()][:8]
    rec = {"title": title, "difficulty": diff, "pattern": g("pattern")[:60] or "Other", "companies": comps,
           "source": g("source")[:200], "summary": g("summary")[:2000], "statement": g("statement")[:20000],
           "example": g("example")[:2000], "hint": g("hint")[:2000], "signature": g("signature")[:300],
           "tests": str(raw.get("tests") or "").strip()[:100000], "order": order}
    if raw.get("origin") == "focus":
        rec["origin"] = "focus"
    if rec["signature"]:
        try:
            sig = parse_signature(rec["signature"])
            if rec["tests"]:
                if not sig["testable"]:
                    errors.append({"field": "tests", "msg": "Tests can't check a %s return value. Leave tests empty, or change the return type." % sig["java"].split()[1]})
                else:
                    parse_tests(rec["tests"], sig)
        except Invalid as e:
            errors += e.errors
    elif rec["tests"]:
        errors.append({"field": "signature", "msg": "Tests need a method signature, e.g. int maxProfit(int[] prices)."})
    if editing:
        rec["slug"] = editing
    elif title:
        base = PREFIX + (slugify(title) or "problem")
        slug, i = base, 2
        while slug in existing_slugs:
            slug, i = "%s-%d" % (base, i), i + 1
        rec["slug"] = slug
    if errors:
        raise Invalid(errors)
    return rec


def statement_html(text):
    """Plain text -> safe HTML: blank line = new paragraph, `code`, ``` fenced blocks ```, lines starting '- ' = bullets."""
    out, para, bullets, fence = [], [], [], None

    def inline(s):
        s = html.escape(s)
        s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
        return re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)

    def flush():
        if para:
            out.append("<p>" + "<br>".join(inline(x) for x in para) + "</p>"); para.clear()
        if bullets:
            out.append("<ul>" + "".join("<li>" + inline(x) + "</li>" for x in bullets) + "</ul>"); bullets.clear()

    for line in (text or "").splitlines():
        if line.strip().startswith("```"):
            if fence is None:
                flush(); fence = []
            else:
                out.append("<pre>" + html.escape("\n".join(fence)) + "</pre>"); fence = None
            continue
        if fence is not None:
            fence.append(line); continue
        if not line.strip():
            flush(); continue
        if re.match(r"^\s*[-*]\s+", line):
            if para:
                flush()
            bullets.append(re.sub(r"^\s*[-*]\s+", "", line)); continue
        if bullets:
            flush()
        para.append(line.strip())
    if fence is not None:
        out.append("<pre>" + html.escape("\n".join(fence)) + "</pre>")
    flush()
    return "\n".join(out)


def to_entry(rec):
    """A stored custom problem -> the same shape as an entry in content/problems.json (for harness_for)."""
    e = {"title": rec["title"], "difficulty": rec.get("difficulty", "Medium"), "pattern": rec.get("pattern") or "Other",
         "summary": rec.get("summary", ""), "example": rec.get("example", ""), "idea": html.escape(rec.get("hint", "")),
         "full": statement_html(rec.get("statement", ""))}
    e["starters"] = {"python": "class Solution:\n    # Write your solution here.\n    pass\n",
                     "java": "class Solution {\n    // Write your solution here.\n\n}\n"}
    if isinstance(rec.get("spec"), dict):      # advanced: a full harness spec written by hand (e.g. a class-design problem)
        e["spec"] = rec["spec"]
        return e
    if rec.get("signature"):
        try:
            sig = parse_signature(rec["signature"])
        except Invalid:
            return e
        tests = parse_tests(rec.get("tests", ""), sig) if rec.get("tests") and sig["testable"] else []
        provided = (["Robot"] if "robot" in sig["ptypes"] else []) + [p for p, t in (("TreeNode", "tree"), ("ListNode", "list")) if t in sig["ptypes"] or sig["rtype"] == t
                    or (p == "ListNode" and "list[]" in sig["ptypes"]) or (p == "TreeNode" and sig["rtype"] == "treeret")]
        e["spec"] = {"kind": "method", "name": sig["name"], "py": sig["py"], "java": sig["java"], "ptypes": sig["ptypes"],
                     "rtype": sig["rtype"], "mode": ORDERS.get(rec.get("order"), "eq"), "tests": tests, "provided": provided}
    return e
