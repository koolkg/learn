#!/usr/bin/env python3
"""
Local runner for coding_interview_prep.html.

    python3 prep_server.py            # then open the printed URL

- Serves the prep page and runs your Java / Python code against the tests,
  using the javac/java/python3 already installed on this computer.
- Listens on 127.0.0.1 only. Nothing is sent anywhere else.
- Your code is also saved as files under ./solutions/ (one file per problem and language).
- Requests must carry a per-session token that is only embedded in the page this
  server serves, so other websites can't use the runner.
Standard library only. Stop with Ctrl+C.
"""
import argparse, json, os, re, secrets, shutil, subprocess, sys, tempfile, webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, "coding_interview_prep.html")
SOLUTIONS = os.path.join(HERE, "solutions")
TOKEN = secrets.token_hex(16)
RUN_TIMEOUT = 10
COMPILE_TIMEOUT = 60
JAVA_IMPORTS = "import java.util.*;\nimport java.util.function.*;\nimport java.util.stream.*;\n"
SAFE_ID = re.compile(r"^[a-z0-9-]{1,120}$")


def which(cmd):
    return shutil.which(cmd)


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
        if u.path in ("/", "/index.html", "/coding_interview_prep.html"):
            try:
                html = open(PAGE, encoding="utf-8").read()
            except FileNotFoundError:
                return self._send(404, "coding_interview_prep.html not found next to prep_server.py", "text/plain")
            html = html.replace("__PREP_TOKEN__", TOKEN)
            return self._send(200, html, "text/html; charset=utf-8")
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
