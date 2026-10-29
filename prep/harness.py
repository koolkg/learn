"""Generates per-problem test harnesses (Python + Java) from content.SPECS."""
import json

# ---------------- shared canonicalisation (also embedded in the Python prelude) ----------------
CANON_SRC = r'''
import json as _json
def _norm(x):
    if x is None or isinstance(x, (bool, int, float, str)):
        return x
    if type(x).__name__ == "ListNode":
        out, n, seen = [], x, 0
        while n is not None and seen < 100000:
            out.append(n.val); n = n.next; seen += 1
        return out
    if isinstance(x, (list, tuple)):
        return [_norm(v) for v in x]
    if isinstance(x, (set, frozenset)):
        return sorted(_norm(v) for v in x)
    return repr(x)
def _key(v):
    if isinstance(v, bool): return (3, _json.dumps(v))
    if isinstance(v, (int, float)): return (0, v, "")
    if isinstance(v, str): return (1, 0, v)
    return (2, 0, _json.dumps(v, separators=(",", ":")))
def _canon(x, mode):
    x = _norm(x)
    if mode == "sort" and isinstance(x, list):
        x = sorted(x, key=_key)
    elif mode == "sortinner" and isinstance(x, list):
        x = sorted([sorted(v, key=_key) if isinstance(v, list) else v for v in x], key=_key)
    return _json.dumps(x, separators=(",", ":"))
'''
_ns = {}
exec(CANON_SRC, _ns)
canon = _ns["_canon"]

PY_PRELUDE = r'''from typing import *
import collections, heapq, math, bisect, functools, itertools, random, re, string
from collections import deque, defaultdict, Counter, OrderedDict
from heapq import heappush, heappop, heapify
from functools import lru_cache, cache

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
'''

PY_HELPERS = r'''
import traceback as _tb, sys as _sys
_sys.setrecursionlimit(100000)
''' + CANON_SRC + r'''
def L(arr):
    d = ListNode(); c = d
    for v in arr:
        c.next = ListNode(v); c = c.next
    return d.next
def LC(arr, pos):
    head = L(arr)
    if pos >= 0 and head:
        tail, target, i, n = None, None, 0, head
        while n:
            if i == pos: target = n
            tail = n; n = n.next; i += 1
        tail.next = target
    return head
def T(arr):
    if not arr or arr[0] is None: return None
    root = TreeNode(arr[0]); q = [root]; i = 1; qi = 0
    while i < len(arr):
        node = q[qi]; qi += 1
        if i < len(arr) and arr[i] is not None:
            node.left = TreeNode(arr[i]); q.append(node.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            node.right = TreeNode(arr[i]); q.append(node.right)
        i += 1
    return root
def _LA(x):
    return [] if x is None else x
def _ops(cls, ops, args):
    o = cls(*args[0]); out = [None]
    for op, a in zip(ops[1:], args[1:]):
        out.append(getattr(o, op)(*a))
    return out
def _t(label, fn, exp, mode):
    try:
        g = _canon(fn(), mode)
        print("@@R " + _json.dumps({"label": label, "ok": g == exp, "got": g, "exp": exp}), flush=True)
    except Exception:
        lines = _tb.format_exc().strip().splitlines()
        print("@@R " + _json.dumps({"label": label, "ok": False, "exp": exp, "err": "\n".join(lines[-4:])}), flush=True)
'''

PY_EXTRA = {
"NestedInteger": r'''
class NestedInteger:
    """Provided: isInteger(), getInteger(), getList()."""
    def __init__(self, v): self._v = v
    def isInteger(self) -> bool: return isinstance(self._v, int)
    def getInteger(self): return self._v if isinstance(self._v, int) else None
    def getList(self): return self._v if isinstance(self._v, list) else None
''',
"Read4": r'''
_file = {"s": "", "p": 0}
def read4(buf4) -> int:
    c = 0
    while c < 4 and _file["p"] < len(_file["s"]):
        buf4[c] = _file["s"][_file["p"]]; _file["p"] += 1; c += 1
    return c
''',
"RandomNode": r'''
class Node:
    def __init__(self, x: int, next: 'Node' = None, random: 'Node' = None):
        self.val = int(x)
        self.next = next
        self.random = random
''',
}
PY_EXTRA_HELPERS = {
"NestedInteger": r'''
def _ni(e): return NestedInteger(e) if isinstance(e, int) else NestedInteger([_ni(y) for y in e])
def NL(x): return [_ni(e) for e in x]
''',
"Read4": r'''
def read_calls(file, ns):
    _file["s"] = file; _file["p"] = 0
    s = Solution(); out = []
    for n in ns:
        buf = [""] * (n + 4)
        c = s.read(buf, n)
        out.append("".join(buf[:c]))
    return out
''',
"RandomNode": r'''
def RL(pairs):
    nodes = [Node(v) for v, _ in pairs]
    for i, n in enumerate(nodes):
        n.next = nodes[i + 1] if i + 1 < len(nodes) else None
        r = pairs[i][1]
        n.random = nodes[r] if r is not None else None
    return nodes[0] if nodes else None
def RA(head):
    nodes, n = [], head
    while n and len(nodes) < 100000:
        nodes.append(n); n = n.next
    idx = {id(x): i for i, x in enumerate(nodes)}
    return [[x.val, idx.get(id(x.random)) if x.random else None] for x in nodes]
def no_shared(a, b):
    seen, n = set(), a
    while n: seen.add(id(n)); n = n.next
    n = b
    while n:
        if id(n) in seen: return False
        n = n.next
    return True
''',
}

# Large inputs are described compactly and expanded at run time, e.g.
#   {"gen": "repeat", "value": 0, "n": 2000}        -> [0, 0, ...]          (int[])
#   {"gen": "alt", "a": 1, "b": 0, "n": 2000}        -> [1, 0, 1, 0, ...]    (int[])
#   {"gen": "range", "start": 1, "step": 1, "n": 5}  -> [1, 2, 3, 4, 5]      (int[])
#   {"gen": "grid", "value": "1", "rows": 60, "cols": 60}                      (char[][])
#   {"gen": "star", "n": 2200, "w": 1000000}         -> [[0,1,w],[0,2,w],...] (int[][], tree edges)
def expand(v):
    if not (isinstance(v, dict) and "gen" in v):
        return v
    g = v["gen"]
    if g == "repeat": return [v["value"]] * v["n"]
    if g == "alt": return [v["a"] if i % 2 == 0 else v["b"] for i in range(v["n"])]
    if g == "range": return [v["start"] + i * v.get("step", 1) for i in range(v["n"])]
    if g == "grid": return [[v["value"]] * v["cols"] for _ in range(v["rows"])]
    if g == "star": return [[0, i, v["w"]] for i in range(1, v["n"] + 1)]
    raise ValueError(g)

def gen_label(v):
    g = v["gen"]
    if g == "repeat": return f"<{v['n']} × {json.dumps(v['value'])}>"
    if g == "alt": return f"<{v['n']} alternating {v['a']},{v['b']}>"
    if g == "range": return f"<{v['n']} values from {v['start']} step {v.get('step', 1)}>"
    if g == "grid": return f"<{v['rows']}×{v['cols']} grid of {json.dumps(v['value'])}>"
    if g == "star": return f"<star tree: {v['n']} edges of weight {v['w']}>"
    return json.dumps(v)

PY_GEN = {"repeat": "[{value!r}] * {n}", "alt": "[{a!r} if i % 2 == 0 else {b!r} for i in range({n})]",
          "range": "[{start} + i * {step} for i in range({n})]", "grid": "[[{value!r}] * {cols} for _ in range({rows})]",
          "star": "[[0, i, {w}] for i in range(1, {n} + 1)]"}

def py_lit(v, t):
    if isinstance(v, dict) and "gen" in v:
        d = dict(v); d.setdefault("step", 1)
        return "(" + PY_GEN[v["gen"]].format(**d) + ")"
    return _py_lit(v, t)

def _py_lit(v, t):
    if t == "tree": return f"T({v!r})"
    if t == "list": return f"L({v!r})"
    if t == "list[]": return f"[L(x) for x in {v!r}]"
    if t == "nested": return f"NL({v!r})"
    if t == "cyclelist": return f"LC({v[0]!r}, {v[1]!r})"
    if t == "double": return repr(float(v))
    return repr(v)

def arg_label(a):
    if isinstance(a, dict) and "gen" in a:
        return gen_label(a)
    j = json.dumps(a)
    return j if len(j) <= 160 else j[:150] + " …]"

def py_call_label(name, args, note=None):
    lab = f"{name}(" + ", ".join(arg_label(a) for a in args) + ")"
    return lab + (f"  — {note}" if note else "")

# ---------------- Java ----------------
JAVA_IMPORTS = "import java.util.*;\nimport java.util.function.*;\nimport java.util.stream.*;\n"

JAVA_EXTRA = {
"ListNode": '''
class ListNode {
    int val; ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}
''',
"TreeNode": '''
class TreeNode {
    int val; TreeNode left; TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}
''',
"NestedInteger": '''
class NestedInteger {
    private Integer v; private List<NestedInteger> l;
    NestedInteger(int v) { this.v = v; }
    NestedInteger(List<NestedInteger> l) { this.l = l; }
    public boolean isInteger() { return v != null; }
    public Integer getInteger() { return v; }
    public List<NestedInteger> getList() { return l; }
}
''',
"Read4": '''
abstract class Reader4 {
    static String __file = ""; static int __pos = 0;
    int read4(char[] buf4) {
        int c = 0;
        while (c < 4 && __pos < __file.length()) buf4[c++] = __file.charAt(__pos++);
        return c;
    }
}
''',
"RandomNode": '''
class Node {
    int val; Node next; Node random;
    Node(int val) { this.val = val; }
}
''',
}

JAVA_MAIN_HELPERS = r'''
    // generated-input helpers are appended below (JAVA_GEN_HELPERS)
    static Object __norm(Object o) {
        if (o == null) return null;
        if (o instanceof Integer || o instanceof Long || o instanceof Short || o instanceof Byte) return ((Number) o).longValue();
        if (o instanceof Boolean || o instanceof String || o instanceof Double || o instanceof Float) return o;
        if (o instanceof Character) return String.valueOf(o);
        if (o instanceof int[]) { List<Object> r = new ArrayList<>(); for (int x : (int[]) o) r.add((long) x); return r; }
        if (o instanceof long[]) { List<Object> r = new ArrayList<>(); for (long x : (long[]) o) r.add(x); return r; }
        if (o instanceof boolean[]) { List<Object> r = new ArrayList<>(); for (boolean x : (boolean[]) o) r.add(x); return r; }
        if (o instanceof char[]) { List<Object> r = new ArrayList<>(); for (char x : (char[]) o) r.add(String.valueOf(x)); return r; }
        if (o instanceof double[]) { List<Object> r = new ArrayList<>(); for (double x : (double[]) o) r.add(x); return r; }
        if (o instanceof Object[]) { List<Object> r = new ArrayList<>(); for (Object x : (Object[]) o) r.add(__norm(x)); return r; }
        if (o instanceof Iterable) { List<Object> r = new ArrayList<>(); for (Object x : (Iterable<?>) o) r.add(__norm(x)); return r; }
        if (o.getClass().getSimpleName().equals("ListNode")) {
            List<Object> r = new ArrayList<>();
            try {
                Object n = o; int guard = 0;
                while (n != null && guard++ < 100000) {
                    r.add(((Number) n.getClass().getDeclaredField("val").get(n)).longValue());
                    n = n.getClass().getDeclaredField("next").get(n);
                }
            } catch (Exception e) { throw new RuntimeException(e); }
            return r;
        }
        return String.valueOf(o);
    }
    static Object __LA(Object o) { return o == null ? new ArrayList<Object>() : o; }
    static int __rank(Object v) { return v instanceof Long || v instanceof Double ? 0 : v instanceof String ? 1 : v instanceof Boolean ? 3 : 2; }
    static int __cmp(Object a, Object b) {
        int ra = __rank(a), rb = __rank(b);
        if (ra != rb) return Integer.compare(ra, rb);
        if (ra == 0) return Double.compare(((Number) a).doubleValue(), ((Number) b).doubleValue());
        if (ra == 1) return ((String) a).compareTo((String) b);
        return __json(a).compareTo(__json(b));
    }
    @SuppressWarnings("unchecked")
    static String __canon(Object o, String mode) {
        Object x = __norm(o);
        if (x instanceof List && mode.equals("sort")) { List<Object> l = new ArrayList<>((List<Object>) x); l.sort(Main::__cmp); x = l; }
        else if (x instanceof List && mode.equals("sortinner")) {
            List<Object> l = new ArrayList<>();
            for (Object v : (List<Object>) x) { if (v instanceof List) { List<Object> in = new ArrayList<>((List<Object>) v); in.sort(Main::__cmp); l.add(in); } else l.add(v); }
            l.sort(Main::__cmp); x = l;
        }
        return __json(x);
    }
    static String __json(Object x) {
        if (x == null) return "null";
        if (x instanceof String) {
            StringBuilder sb = new StringBuilder("\"");
            for (char c : ((String) x).toCharArray()) {
                if (c == '"') sb.append("\\\""); else if (c == '\\') sb.append("\\\\");
                else if (c == '\n') sb.append("\\n"); else if (c < 0x20 || c > 0x7e) sb.append(String.format("\\u%04x", (int) c));
                else sb.append(c);
            }
            return sb.append('"').toString();
        }
        if (x instanceof Double) { double d = (Double) x; return d == Math.rint(d) && !Double.isInfinite(d) ? String.valueOf((long) d) + ".0" : String.valueOf(d); }
        if (x instanceof List) {
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (Object v : (List<?>) x) { if (!first) sb.append(","); sb.append(__json(v)); first = false; }
            return sb.append("]").toString();
        }
        return String.valueOf(x);
    }
    static String __q(String s) { return __json(s); }
    static void __t(String label, java.util.concurrent.Callable<Object> fn, String exp, String mode) {
        try {
            String g = __canon(fn.call(), mode);
            System.out.println("@@R {\"label\":" + __q(label) + ",\"ok\":" + g.equals(exp) + ",\"got\":" + __q(g) + ",\"exp\":" + __q(exp) + "}");
        } catch (Throwable e) {
            StringBuilder sb = new StringBuilder(e.toString());
            StackTraceElement[] st = e.getStackTrace();
            for (int i = 0; i < Math.min(3, st.length); i++) sb.append("\n    at ").append(st[i]);
            System.out.println("@@R {\"label\":" + __q(label) + ",\"ok\":false,\"exp\":" + __q(exp) + ",\"err\":" + __q(sb.toString()) + "}");
        }
        System.out.flush();
    }
'''

JAVA_EXTRA_HELPERS = {
"ListNode": '''
    static ListNode L(int[] a) { ListNode d = new ListNode(0), c = d; for (int v : a) { c.next = new ListNode(v); c = c.next; } return d.next; }
    static ListNode LC(int[] a, int pos) {
        ListNode h = L(a);
        if (pos >= 0 && h != null) { ListNode tail = h, target = null; int i = 0; for (ListNode n = h; n != null; n = n.next, i++) { if (i == pos) target = n; tail = n; } tail.next = target; }
        return h;
    }
''',
"TreeNode": '''
    static TreeNode T(Integer[] a) {
        if (a.length == 0 || a[0] == null) return null;
        TreeNode root = new TreeNode(a[0]); List<TreeNode> q = new ArrayList<>(); q.add(root); int i = 1, qi = 0;
        while (i < a.length) {
            TreeNode n = q.get(qi++);
            if (i < a.length && a[i] != null) { n.left = new TreeNode(a[i]); q.add(n.left); } i++;
            if (i < a.length && a[i] != null) { n.right = new TreeNode(a[i]); q.add(n.right); } i++;
        }
        return root;
    }
''',
"NestedInteger": '''
    static NestedInteger __ni(Object e) {
        if (e instanceof Integer) return new NestedInteger((Integer) e);
        List<NestedInteger> l = new ArrayList<>(); for (Object y : (Object[]) e) l.add(__ni(y)); return new NestedInteger(l);
    }
    static List<NestedInteger> NL(Object[] x) { List<NestedInteger> l = new ArrayList<>(); for (Object e : x) l.add(__ni(e)); return l; }
''',
"Read4": '''
    static List<String> readCalls(String file, int[] ns) {
        Reader4.__file = file; Reader4.__pos = 0;
        Solution s = new Solution(); List<String> out = new ArrayList<>();
        for (int n : ns) { char[] buf = new char[n + 4]; int c = s.read(buf, n); out.add(new String(buf, 0, c)); }
        return out;
    }
''',
"RandomNode": '''
    static Node RL(Integer[][] pairs) {
        Node[] nodes = new Node[pairs.length];
        for (int i = 0; i < pairs.length; i++) nodes[i] = new Node(pairs[i][0]);
        for (int i = 0; i < pairs.length; i++) { nodes[i].next = i + 1 < pairs.length ? nodes[i + 1] : null; nodes[i].random = pairs[i][1] == null ? null : nodes[pairs[i][1]]; }
        return pairs.length == 0 ? null : nodes[0];
    }
    static List<Object> RA(Node head) {
        List<Node> nodes = new ArrayList<>(); for (Node n = head; n != null && nodes.size() < 100000; n = n.next) nodes.add(n);
        IdentityHashMap<Node, Integer> idx = new IdentityHashMap<>(); for (int i = 0; i < nodes.size(); i++) idx.put(nodes.get(i), i);
        List<Object> r = new ArrayList<>();
        for (Node n : nodes) r.add(Arrays.asList(n.val, n.random == null ? null : idx.get(n.random)));
        return r;
    }
    static boolean noShared(Node a, Node b) {
        Set<Node> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (Node n = a; n != null; n = n.next) seen.add(n);
        for (Node n = b; n != null; n = n.next) if (seen.contains(n)) return false;
        return true;
    }
''',
}

def jstr(s): return json.dumps(s)

# Lets you add `public static void main(String[] args)` to your own class to try custom inputs.
JAVA_USER_MAIN = """        for (String __c : new String[]{"Solution", "Codec", "Trie", "WordDictionary", "MedianFinder", "MaxStack", "LRUCache", "MyCircularQueue", "WordDistance", "RandomizedCollection"}) {
            try { Class.forName(__c).getMethod("main", String[].class).invoke(null, (Object) new String[0]); }
            catch (ClassNotFoundException | NoSuchMethodException e) { }
            catch (java.lang.reflect.InvocationTargetException e) { e.getCause().printStackTrace(System.out); }
            catch (Exception e) { }
        }
"""

JAVA_GEN = {"repeat": "__repeat({value}, {n})", "alt": "__alt({a}, {b}, {n})", "range": "__range({start}, {step}, {n})",
            "grid": "__grid('{value}', {rows}, {cols})", "star": "__star({n}, {w})"}
JAVA_GEN_HELPERS = """
    static int[] __repeat(int v, int n) { int[] a = new int[n]; Arrays.fill(a, v); return a; }
    static int[] __alt(int x, int y, int n) { int[] a = new int[n]; for (int i = 0; i < n; i++) a[i] = i % 2 == 0 ? x : y; return a; }
    static int[] __range(int s, int st, int n) { int[] a = new int[n]; for (int i = 0; i < n; i++) a[i] = s + i * st; return a; }
    static char[][] __grid(char v, int r, int c) { char[][] g = new char[r][c]; for (char[] row : g) Arrays.fill(row, v); return g; }
    static int[][] __star(int n, int w) { int[][] e = new int[n][]; for (int i = 1; i <= n; i++) e[i - 1] = new int[]{0, i, w}; return e; }
"""
JAVA_MAIN_HELPERS = JAVA_MAIN_HELPERS + JAVA_GEN_HELPERS

def java_lit(v, t):
    if isinstance(v, dict) and "gen" in v:
        d = dict(v); d.setdefault("step", 1)
        return JAVA_GEN[v["gen"]].format(**d)
    return _java_lit(v, t)

def _java_lit(v, t):
    if t == "int": return str(v)
    if t == "long": return f"{v}L"
    if t == "double": return repr(float(v))
    if t == "bool": return "true" if v else "false"
    if t == "str": return jstr(v)
    if t == "int[]": return "new int[]{" + ", ".join(map(str, v)) + "}"
    if t == "int[][]": return "new int[][]{" + ", ".join("{" + ", ".join(map(str, r)) + "}" for r in v) + "}"
    if t == "char[][]": return "new char[][]{" + ", ".join("{" + ", ".join(f"'{c}'" for c in r) + "}" for r in v) + "}"
    if t == "str[]": return "new String[]{" + ", ".join(jstr(s) for s in v) + "}"
    if t == "tree": return "T(new Integer[]{" + ", ".join("null" if x is None else str(x) for x in v) + "})"
    if t == "list": return "L(" + java_lit(v, "int[]") + ")"
    if t == "list[]": return "new ListNode[]{" + ", ".join(java_lit(x, "list") for x in v) + "}"
    if t == "cyclelist": return f"LC({java_lit(v[0], 'int[]')}, {v[1]})"
    if t == "nested":
        def obj(e): return str(e) if isinstance(e, int) else "new Object[]{" + ", ".join(obj(y) for y in e) + "}"
        return "NL(" + obj(v) + ")"
    raise ValueError(t)

JTYPE = {"int": "int", "str": "String", "str[]": "String[]", "bool": "boolean", "long": "long", "int[]": "int[]"}

def build(spec):
    """Returns dict with py_pre, py_post, java_post, starters, display tests."""
    kind = spec["kind"]
    provided = spec.get("provided", [])
    py_pre = PY_PRELUDE + "".join(PY_EXTRA[p] for p in provided if p in PY_EXTRA)
    py_post = [PY_HELPERS] + [PY_EXTRA_HELPERS[p] for p in provided if p in PY_EXTRA_HELPERS]
    jt = []           # java test lines
    display = []      # (input label, expected json)
    mode = spec.get("mode", "eq")
    if kind == "method":
        name = spec["name"]
        for t_ in spec["tests"]:
            args, exp = t_[0], t_[1]
            note = t_[2] if len(t_) > 2 else None
            e = canon(exp, mode)
            label = py_call_label(name, args, note)
            pyargs = ", ".join(py_lit(a, t) for a, t in zip(args, spec["ptypes"]))
            wrap = "_LA" if spec["rtype"] == "list" else ""
            py_post.append(f"_t({label!r}, lambda: {wrap}(Solution().{name}({pyargs})), {e!r}, {mode!r})")
            jargs = ", ".join(java_lit(a, t) for a, t in zip(args, spec["ptypes"]))
            jwrap = "__LA" if spec["rtype"] == "list" else ""
            jt.append(f"        __t({jstr(label)}, () -> {jwrap}(new Solution().{name}({jargs})), {jstr(e)}, {jstr(mode)});")
            display.append((label, e))
        py_starter = f"class Solution:\n    {spec['py']}\n        pass\n"
        java_starter = f"class Solution {{\n    {spec['java']} {{\n\n    }}\n}}\n"
    elif kind == "ops":
        cls = spec["cls"]
        for t_ in spec["tests"]:
            ops, args, exp = t_[0], t_[1], t_[2]
            note = t_[3] if len(t_) > 3 else None
            e = canon(exp, "eq")
            label = f"{json.dumps(ops)}  {json.dumps(args)}" + (f"  — {note}" if note else "")
            py_post.append(f"_t({label!r}, lambda: _ops({cls}, {ops!r}, {args!r}), {e!r}, 'eq')")
            body = [f"List<Object> out = new ArrayList<>();",
                    f"{cls} o = new {cls}({', '.join(java_lit(a, t) for a, t in zip(args[0], spec['ctor']))});", "out.add(null);"]
            for op, a in zip(ops[1:], args[1:]):
                pt, rt = spec["methods"][op]
                call = f"o.{op}({', '.join(java_lit(x, t) for x, t in zip(a, pt))})"
                body.append(f"{call}; out.add(null);" if rt == "void" else f"out.add({call});")
            body.append("return out;")
            jt.append(f"        __t({jstr(label)}, () -> {{ {' '.join(body)} }}, {jstr(e)}, \"eq\");")
            display.append((label, e))
        # starters
        pyctor = ", ".join(f"p{i}: {'int' if t=='int' else 'List[str]' if t=='str[]' else 'str'}" for i, t in enumerate(spec["ctor"]))
        jctor = ", ".join(f"{JTYPE[t]} p{i}" for i, t in enumerate(spec["ctor"]))
        PYT = {"int": "int", "str": "str", "bool": "bool", "void": "None"}
        ctor_names = {"LRUCache": ["capacity"], "MyCircularQueue": ["k"], "WordDistance": ["wordsDict"]}.get(cls, [])
        for i, nm in enumerate(ctor_names):
            pyctor = pyctor.replace(f"p{i}:", f"{nm}:"); jctor = jctor.replace(f" p{i}", f" {nm}")
        argnames = {"push": ["x"], "get": ["key"], "put": ["key", "value"], "enQueue": ["value"], "shortest": ["word1", "word2"]}
        py_lines = [f"class {cls}:", "", f"    def __init__(self{', ' + pyctor if pyctor else ''}):", "        pass", ""]
        j_lines = [f"class {cls} {{", "", f"    public {cls}({jctor}) {{", "", "    }", ""]
        for m, (pt, rt) in spec["methods"].items():
            nm = argnames.get(m, [f"a{i}" for i in range(len(pt))])
            pyp = "".join(f", {n}: {PYT[t]}" for n, t in zip(nm, pt))
            jp = ", ".join(f"{JTYPE[t]} {n}" for n, t in zip(nm, pt))
            py_lines += [f"    def {m}(self{pyp}) -> {PYT[rt]}:", "        pass", ""]
            jr = {"void": "void", "int": "int", "bool": "boolean", "str": "String"}[rt]
            j_lines += [f"    public {jr} {m}({jp}) {{", "", "    }", ""]
        py_starter = "\n".join(py_lines).rstrip() + "\n"
        java_starter = "\n".join(j_lines).rstrip() + "\n}\n"
    else:  # custom
        for label, pysn, jsn, exp in spec["tests"]:
            e = canon(exp, "eq")
            fn = "_f%d" % len(display)
            body = "\n".join("    " + l for l in pysn.splitlines())
            py_post.append(f"def {fn}():\n{body}\n    return got\n_t({label!r}, {fn}, {e!r}, 'eq')")
            jbody = " ".join(jsn.splitlines())
            jt.append(f"        __t({jstr(label)}, () -> {{ Object got; {jbody} return got; }}, {jstr(e)}, \"eq\");")
            display.append((label, e))
        py_starter, java_starter = spec["py_starter"], spec["java_starter"]
    if "List[" in py_starter or "Optional[" in py_starter:
        pass
    java_helpers = "".join(JAVA_EXTRA[p] for p in provided if p in JAVA_EXTRA)
    if "ListNode" in provided and "TreeNode" not in provided:
        pass
    main = ("public class Main {\n" + JAVA_MAIN_HELPERS + "".join(JAVA_EXTRA_HELPERS[p] for p in provided if p in JAVA_EXTRA_HELPERS) +
            "    public static void main(String[] args) {\n" + "\n".join(jt) + "\n" + JAVA_USER_MAIN + "    }\n}\n")
    return dict(py_pre=py_pre, py_post="\n".join(py_post) + "\n", java_post=java_helpers + "\n" + main,
                py_starter=py_starter, java_starter=java_starter, display=display)

def generic(py_sig=None, java_sig=None, cls=None):
    """Starters + run-only harness for problems without tests."""
    if cls:
        py_starter, java_starter = cls
    else:
        py_starter = f"class Solution:\n    {py_sig}\n        pass\n"
        java_starter = f"class Solution {{\n    {java_sig} {{\n\n    }}\n}}\n"
    provided = []
    for p in ("ListNode", "TreeNode"):
        if p in (py_starter + java_starter): provided.append(p)
    java_helpers = "".join(JAVA_EXTRA[p] for p in provided)
    main = "public class Main {\n    public static void main(String[] args) {\n" + JAVA_USER_MAIN + "    }\n}\n"
    return dict(py_pre=PY_PRELUDE, py_post="", java_post=java_helpers + "\n" + main,
                py_starter=py_starter, java_starter=java_starter, display=[])
