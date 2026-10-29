#!/usr/bin/env python3
"""
Local runner for the prep page (index.html + problems.json in this folder).

    python3 prep_server.py            # then open the printed URL

- Serves the page and its data, and runs your Java / Python code against the tests,
  using the javac/java/python3 already installed on this computer.
- Listens on 127.0.0.1 only. Nothing is sent anywhere else.
- Your code is also saved as files under ./solutions/ (one file per problem and language),
  and your progress (done / passing / attempted) in ./solutions/progress.json.
- When you open a problem, the full statement is fetched from LeetCode (like your browser would)
  and cached in ./cache/statements/ — local only, not committed to git. For Premium problems,
  put your LeetCode session cookie in ./.leetcode_session (see README).
- Requests must carry a per-session token that is only embedded in the page this
  server serves, so other websites can't use the runner.
Standard library only. Stop with Ctrl+C.
"""
import argparse, json, os, re, secrets, shutil, subprocess, sys, tempfile, threading, urllib.request, webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, "index.html")
STATIC = {  # url path -> (file, content type)
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/app.css": ("app.css", "text/css; charset=utf-8"),
    "/problems.json": ("problems.json", "application/json; charset=utf-8"),
    "/content/reference.json": (os.path.join("content", "reference.json"), "application/json; charset=utf-8"),
    "/content/techniques.json": (os.path.join("content", "techniques.json"), "application/json; charset=utf-8"),
    "/content/videos.json": (os.path.join("content", "videos.json"), "application/json; charset=utf-8"),
}
VENDOR = re.compile(r"^/vendor/([a-z-]+\.(js|css))$")
SOLUTIONS = os.path.join(HERE, "solutions")
TOKEN = secrets.token_hex(16)
RUN_TIMEOUT = 10
COMPILE_TIMEOUT = 60
JAVA_IMPORTS = "import java.util.*;\nimport java.util.function.*;\nimport java.util.stream.*;\n"
SAFE_ID = re.compile(r"^[a-z0-9-]{1,120}$")
PROGRESS = os.path.join(SOLUTIONS, "progress.json")
PROGRESS_FIELDS = {"done", "doneAt", "attempted", "last", "updated"}
_lock = threading.Lock()


def read_progress():
    try:
        with open(PROGRESS, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def write_progress(data):
    os.makedirs(SOLUTIONS, exist_ok=True)
    tmp = PROGRESS + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, PROGRESS)  # atomic: never leaves a half-written file


def solution_files():
    out = {}
    if os.path.isdir(SOLUTIONS):
        for name in os.listdir(SOLUTIONS):
            stem, ext = os.path.splitext(name)
            if ext in (".java", ".py") and SAFE_ID.match(stem):
                out.setdefault(stem, []).append("java" if ext == ".java" else "python")
    return out


def which(cmd):
    return shutil.which(cmd)


# ---------- full problem statements, fetched from LeetCode on demand ----------
CACHE = os.path.join(HERE, "cache", "statements")       # local only; kept out of git (.gitignore)
COOKIE_FILE = os.path.join(HERE, ".leetcode_session")     # optional: your LeetCode login, for Premium problems
LC_GRAPHQL = os.environ.get("PREP_LC_GRAPHQL", "https://leetcode.com/graphql")
LC_QUERY = ("query q($titleSlug: String!) { question(titleSlug: $titleSlug) "
            "{ questionFrontendId title content isPaidOnly } }")


def leetcode_cookies():
    """Reads LEETCODE_SESSION (and optional csrftoken) from env or ./.leetcode_session."""
    vals = {}
    if os.path.exists(COOKIE_FILE):
        for line in open(COOKIE_FILE, encoding="utf-8"):
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip().strip('"')
            elif line and not line.startswith("#"):
                vals["LEETCODE_SESSION"] = line
    for k in ("LEETCODE_SESSION", "csrftoken"):
        if os.environ.get(k):
            vals[k] = os.environ[k]
    return vals


def fetch_statement(slug, refresh=False):
    path = os.path.join(CACHE, slug + ".json")
    if os.path.exists(path) and not refresh:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        if d.get("html"):
            d["cached"] = True
            return d
    cookies = leetcode_cookies()
    headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0",
               "Referer": f"https://leetcode.com/problems/{slug}/", "Origin": "https://leetcode.com"}
    if cookies:
        headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in cookies.items())
        if cookies.get("csrftoken"):
            headers["x-csrftoken"] = cookies["csrftoken"]
    body = json.dumps({"query": LC_QUERY, "variables": {"titleSlug": slug}}).encode()
    raw, err = None, None
    try:
        req = urllib.request.Request(LC_GRAPHQL, data=body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read()
    except Exception as e:
        err = str(e)
        if LC_GRAPHQL.startswith("https://"):
            try:  # python.org builds on macOS may lack CA certs; curl uses the system store
                cmd = ["curl", "-sS", "-m", "20", "-X", "POST", LC_GRAPHQL, "--data-binary", body.decode()]
                for k, v in headers.items():
                    cmd += ["-H", f"{k}: {v}"]
                raw = subprocess.run(cmd, capture_output=True, check=True).stdout
                err = None
            except subprocess.CalledProcessError as e2:
                msg = (e2.stderr or b"").decode(errors="replace").strip().splitlines()
                err = f"{err}; curl: {msg[-1] if msg else 'failed'}"
            except Exception as e2:
                err = f"{err}; curl: {e2}"
    if raw is None:
        short = err if len(err) < 160 else err[:150] + "…"
        return {"ok": False, "error": f"Couldn't reach LeetCode — offline or blocked by your network ({short})."}
    try:
        q = (json.loads(raw).get("data") or {}).get("question")
    except json.JSONDecodeError:
        return {"ok": False, "error": "LeetCode returned an unexpected response (maybe a bot check). Try again later."}
    if not q:
        return {"ok": False, "error": "LeetCode has no problem with this slug."}
    d = {"ok": True, "title": q.get("title"), "num": q.get("questionFrontendId"), "paid": bool(q.get("isPaidOnly")),
         "html": q.get("content") or "", "fetched": __import__("datetime").date.today().isoformat(),
         "logged_in": bool(cookies.get("LEETCODE_SESSION"))}
    if d["html"]:
        os.makedirs(CACHE, exist_ok=True)
        with open(path + ".tmp", "w", encoding="utf-8") as f:
            json.dump(d, f)
        os.replace(path + ".tmp", path)
    return d


def tool_status():
    return {"python": sys.executable, "javac": which("javac"), "java": which("java")}


def run_proc(cmd, cwd, timeout):
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        err = "\n".join(l for l in p.stderr.splitlines() if not l.startswith("Picked up JAVA_TOOL_OPTIONS"))
        return p.returncode, p.stdout, err, False
    except subprocess.TimeoutExpired as e:
        out = e.stdout.decode() if isinstance(e.stdout, bytes) else (e.stdout or "")
        return -1, out, f"Timed out after {timeout}s (infinite loop or very slow solution?)", True


def assemble_java(code, post):
    imports, body = [], []
    for line in code.splitlines():
        if re.match(r"^\s*import\s+[\w.*]+\s*;\s*$", line):
            imports.append(line.strip())
        elif re.match(r"^\s*package\s", line):
            continue
        else:
            body.append(line)
    body = "\n".join(body)
    # Only Main may be public in Main.java
    body = re.sub(r"(?m)^(\s*)public\s+((?:final\s+|abstract\s+)*(?:class|interface|enum|record)\s)", r"\1\2", body)
    return JAVA_IMPORTS + "\n".join(imports) + "\n" + body + "\n" + post


def run_code(lang, code, pre, post):
    work = tempfile.mkdtemp(prefix="prep_")
    try:
        if lang == "python":
            path = os.path.join(work, "solution.py")
            with open(path, "w") as f:
                f.write(pre + "\n" + code + "\n" + post)
            rc, out, err, to = run_proc([sys.executable, path], work, RUN_TIMEOUT)
            return {"stdout": out, "stderr": err, "timeout": to, "rc": rc}
        if lang == "java":
            if not which("javac") or not which("java"):
                return {"compile_error": "javac/java not found on PATH. Install a JDK (e.g. `brew install openjdk`) and restart prep_server.py."}
            with open(os.path.join(work, "Main.java"), "w") as f:
                f.write(assemble_java(code, post))
            rc, out, err, to = run_proc(["javac", "-encoding", "UTF-8", "-nowarn", "-d", work, "Main.java"], work, COMPILE_TIMEOUT)
            if rc != 0:
                return {"compile_error": (err or out or "compile failed").replace(work + os.sep, "")}
            rc, out, err, to = run_proc(["java", "-Xss256m", "-cp", work, "Main"], work, RUN_TIMEOUT)
            return {"stdout": out, "stderr": err, "timeout": to, "rc": rc}
        return {"compile_error": f"Unknown language {lang!r}"}
    finally:
        shutil.rmtree(work, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "PrepRunner/1.0"

    def log_message(self, fmt, *args):
        pass

    def _host_ok(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("127.0.0.1", "localhost")

    def _send(self, code, body, ctype="application/json"):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _auth(self):
        return self._host_ok() and secrets.compare_digest(self.headers.get("X-Prep-Token", ""), TOKEN)

    def do_GET(self):
        if not self._host_ok():
            return self._send(403, '{"error":"forbidden"}')
        u = urlparse(self.path)
        if u.path in ("/", "/index.html"):
            try:
                html = open(PAGE, encoding="utf-8").read()
            except FileNotFoundError:
                return self._send(404, "index.html not found next to prep_server.py", "text/plain")
            html = html.replace("__PREP_TOKEN__", TOKEN)
            return self._send(200, html, "text/html; charset=utf-8")
        vm = VENDOR.match(u.path)
        if u.path in STATIC or vm:
            rel, ctype = STATIC[u.path] if u.path in STATIC else (os.path.join("vendor", vm.group(1)),
                                                                   "text/javascript; charset=utf-8" if vm.group(2) == "js" else "text/css; charset=utf-8")
            path = os.path.join(HERE, rel)
            if not os.path.exists(path):
                msg = "problems.json not found — run: python3 build_prep.py" if rel == "problems.json" else rel + " not found"
                return self._send(404, json.dumps({"error": msg}))
            with open(path, "rb") as f:
                return self._send(200, f.read(), ctype)
        if u.path == "/load":
            if not self._auth():
                return self._send(403, '{"error":"forbidden"}')
            q = parse_qs(u.query)
            pid, lang = q.get("id", [""])[0], q.get("lang", [""])[0]
            if not SAFE_ID.match(pid) or lang not in ("java", "python"):
                return self._send(400, '{"error":"bad request"}')
            path = os.path.join(SOLUTIONS, f"{pid}.{'java' if lang == 'java' else 'py'}")
            code = open(path, encoding="utf-8").read() if os.path.exists(path) else None
            return self._send(200, json.dumps({"code": code}))
        if u.path == "/statement":
            if not self._auth():
                return self._send(403, '{"error":"forbidden"}')
            q = parse_qs(u.query)
            slug = q.get("slug", [""])[0]
            if not SAFE_ID.match(slug):
                return self._send(400, '{"error":"bad request"}')
            return self._send(200, json.dumps(fetch_statement(slug, q.get("refresh", ["0"])[0] == "1")))
        if u.path == "/progress":
            if not self._auth():
                return self._send(403, '{"error":"forbidden"}')
            with _lock:
                return self._send(200, json.dumps({"progress": read_progress(), "files": solution_files()}))
        if u.path == "/status":
            if not self._auth():
                return self._send(403, '{"error":"forbidden"}')
            return self._send(200, json.dumps(tool_status()))
        return self._send(404, '{"error":"not found"}')

    def do_POST(self):
        if not self._auth():
            return self._send(403, '{"error":"forbidden"}')
        n = int(self.headers.get("Content-Length") or 0)
        if n > 2_000_000:
            return self._send(413, '{"error":"too large"}')
        try:
            req = json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            return self._send(400, '{"error":"bad json"}')
        u = urlparse(self.path)
        if u.path == "/run":
            res = run_code(req.get("lang"), req.get("code", ""), req.get("pre", ""), req.get("post", ""))
            return self._send(200, json.dumps(res))
        if u.path == "/progress":
            pid, patch = req.get("id", ""), req.get("patch")
            if not SAFE_ID.match(pid) or not isinstance(patch, dict):
                return self._send(400, '{"error":"bad request"}')
            patch = {k: v for k, v in patch.items() if k in PROGRESS_FIELDS}
            with _lock:
                data = read_progress()
                entry = data.get(pid, {})
                entry.update(patch)
                entry["updated"] = patch.get("updated") or __import__("datetime").datetime.now().isoformat(timespec="seconds")
                data[pid] = entry
                write_progress(data)
            return self._send(200, json.dumps(entry))
        if u.path == "/save":
            pid, lang = req.get("id", ""), req.get("lang", "")
            if not SAFE_ID.match(pid) or lang not in ("java", "python"):
                return self._send(400, '{"error":"bad request"}')
            os.makedirs(SOLUTIONS, exist_ok=True)
            with open(os.path.join(SOLUTIONS, f"{pid}.{'java' if lang == 'java' else 'py'}"), "w", encoding="utf-8") as f:
                f.write(req.get("code", ""))
            return self._send(200, '{"ok":true}')
        return self._send(404, '{"error":"not found"}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8777)
    ap.add_argument("--no-browser", action="store_true")
    a = ap.parse_args()
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    url = f"http://127.0.0.1:{a.port}/"
    t = tool_status()
    print(f"Prep runner on {url}")
    print(f"  python: {t['python']}")
    print(f"  javac:  {t['javac'] or 'NOT FOUND — Java runs disabled (install a JDK)'}")
    print(f"  solutions saved to: {SOLUTIONS}")
    print("Ctrl+C to stop.")
    if not a.no_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
