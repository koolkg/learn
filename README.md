# Coding Interview Prep

A local practice site for LeetCode problems by company (LinkedIn, NVIDIA, … — any company in the
dataset) plus the Blind 75. You can read each problem, write Java or Python in the browser with
autocomplete and a Java API reference, run it against test cases on your own Mac, and track progress.

Everything lives in `~/learn/prep/`:

| Path | What it is |
|---|---|
| `index.html`, `app.js`, `app.css` | The page. It renders everything from `problems.json` |
| `problems.json` | **Generated** list of problems for the companies you chose (don't edit by hand) |
| `build_prep.py` | Builds `problems.json` from the dataset + `content/` |
| `prep_server.py` | Local runner: serves the page, runs your code, saves your work |
| `harness.py` | Turns the test specs into Java/Python test code (used by `build_prep.py`) |
| `content/problems.json` | **Hand-written** summaries, hints, patterns and test cases, keyed by LeetCode slug |
| `content/blind75.json` | The Blind 75 list |
| `content/patterns.json` | Pattern names, plus how to guess a pattern from LeetCode topics |
| `content/companies.json` | Optional display names (e.g. `Nvidia` → `NVIDIA`) |
| `content/reference.json` | Java/Python API cheat sheet and snippets used by autocomplete |
| `content/techniques.json` | Data-structure and algorithm-pattern cards (idea, Java template, section) |
| `content/videos.json` | **Your video library** (add with `add_video.py`) |
| `add_video.py` | Adds a YouTube link to `videos.json` |
| `vendor/` | CodeMirror editor (MIT licence) |
| `solutions/` | **Your work:** code files (`two-sum.java`) and `progress.json` |

The company data comes from `~/learn/leetcode-company-wise-problems-main/` (the dataset you downloaded).

## Requirements

- **Python 3.8+** (`python3 --version`)
- **A JDK 11+ to run Java** (`javac -version`). If missing: `brew install openjdk`. Python runs without it.

No packages to install; everything uses the Python standard library.

## Quick start

```bash
cd ~/learn/prep
python3 prep_server.py
```

It opens `http://127.0.0.1:8777`. Keep the Terminal window open while you practice; **Ctrl + C** stops it.
Options: `--port 9000` (if 8777 is busy), `--no-browser`.

> The page needs the server: opened as a plain file it only shows how to start it.

## Choosing companies and the time window

```bash
cd ~/learn/prep
python3 build_prep.py --list-companies                       # what's in the dataset
python3 build_prep.py --companies LinkedIn Nvidia Google      # company folder names, any case
python3 build_prep.py --companies Uber --window 3mo           # 30d | 3mo | 6mo | all
python3 build_prep.py --no-blind75                            # only company problems
python3 build_prep.py                                         # rebuild with the same settings as last time
```

Then reload the page. Your code and progress are kept: they're stored by problem, not by build.

The list is ordered by priority: asked by more of your chosen companies first, then most recent
(30d → 3mo → 6mo), then most frequent. Blind 75 problems no company asked come last.

## Adding summaries, hints and tests

Problems from a newly added company show the title, tags, difficulty, a guessed pattern and a LeetCode
link, with an editor but no summary or tests. To see which ones:

```bash
python3 build_prep.py --missing
```

To fill one in, add an entry to `content/problems.json`, keyed by the slug from the LeetCode URL
(`https://leetcode.com/problems/add-two-numbers` → `add-two-numbers`), then run `build_prep.py` again:

```json
"add-two-numbers": {
  "title": "Add Two Numbers",
  "difficulty": "Medium",
  "pattern": "Linked List",
  "summary": "Two non-empty linked lists hold digits in reverse order. Return their sum as a linked list.",
  "example": "[2,4,3] + [5,6,4] → [7,0,8]",
  "idea": "Walk both lists with a carry; append (a + b + carry) % 10.",
  "spec": {
    "kind": "method", "name": "addTwoNumbers", "provided": ["ListNode"],
    "py": "def addTwoNumbers(self, l1: Optional[ListNode], l2: Optional[ListNode]) -> Optional[ListNode]:",
    "java": "public ListNode addTwoNumbers(ListNode l1, ListNode l2)",
    "ptypes": ["list", "list"], "rtype": "list",
    "tests": [[[[2,4,3], [5,6,4]], [7,0,8]], [[[0], [0]], [0]]]
  }
}
```

- Without `spec`, add `"signature": {"python": "...", "java": "..."}` to get proper starter code but no tests.
- Argument types (`ptypes`): `int`, `long`, `double`, `bool`, `str`, `int[]`, `int[][]`, `char[][]`, `str[]`,
  `tree` (level-order list with `null`s), `list` (linked list), `list[]`, `nested`, `cyclelist`.
- A test can carry a note as a third element, shown next to it in the popup:
  `[[[0, 0, 0], 2], true, "plant at both ends"]`.
- Large inputs can be generated instead of written out (keeps files small and Java under its method-size limit):
  `{"gen": "repeat", "value": 0, "n": 2000}`, `{"gen": "alt", "a": 1, "b": 0, "n": 2000}`,
  `{"gen": "range", "start": 1, "step": 1, "n": 500}`, `{"gen": "grid", "value": "1", "rows": 60, "cols": 60}`,
  `{"gen": "star", "n": 2200, "w": 1000000}`.
- `"mode": "sort"` compares results in any order; `"sortinner"` also sorts inner lists (e.g. Group Anagrams).
- Design problems use `"kind": "ops"` (see `max-stack` or `lru-cache` in the file for examples).

## Using the page

1. **Filter** by Source (company, Blind 75, asked by 2+ companies), Pattern and Status. Click any tag to filter by it.
2. **Click a problem title.** The popup shows:
   - **Problem tab:** summary, example, hidden hint, test cases, and a link to LeetCode.
   - **Reference tab:** searchable Java API cheat sheet (String, HashMap, TreeMap, PriorityQueue, Deque, …)
     with Big-O and official-docs links, plus snippets you can insert.
3. **Write code** in Java or Python. Typing `.` after a variable lists its methods (`map.` → `get`,
   `getOrDefault`, …); **Ctrl + Space** suggests anywhere.
4. **Run tests** (or **Cmd + Enter**). Each problem with tests has 14–32 of them: the basic cases, labelled
   **edge cases** (empty/single inputs, boundaries, overflow, duplicates, …) and about 10 **randomized tests**
   whose answers were computed by reference solutions. Failures are shown first with expected vs got;
   passing tests are folded away. You also get compile errors, your print output, and a 10-second time limit.
5. **Run ▷** (or **Cmd + Shift + Enter**) runs your code once without grading it, for debugging with prints.
   Pick what to run in **Run with**: any single test (shows returned vs expected), **Custom input**, where
   you type the arguments as a JSON list (e.g. `[[1,0,0,0,1], 1]`; trees in level order with `null`), or
   **No input** (runs your own `main` in Java, or top-level `print`s in Python). Your prints are shown first,
   then the return value. Progress isn't changed by Run, only by Run tests.
6. **Tick Done** when you can solve it confidently. ‹ › move between problems; **Esc** closes.

Notes: helper classes (`ListNode`, `TreeNode`, `NestedInteger`, `Node`, `read4`) are provided — don't
redefine them. Java gets `java.util.*` imported. For problems without tests, add
`public static void main(String[] args)` to your class (Java) or a `print(...)` at the bottom (Python).

## Full problem statements

When you open a problem, the popup shows **In short** (a summary I wrote) and **Full problem**: the
complete official statement with all examples and constraints, which the runner fetches from LeetCode
on your Mac the first time you open that problem. Click **Show full problem** to expand it (the page
remembers your choice); **Refresh** fetches it again.

- Statements are cached in `prep/cache/statements/`. That folder is in `.gitignore`: it's LeetCode's
  content, so keep it out of public repos.
- **Premium problems** (e.g. Max Stack, Nested List Weight Sum II, Meeting Rooms) are only returned to a
  logged-in LeetCode Premium account. To load them, copy your session cookie from the browser
  (leetcode.com → Developer tools → Application → Cookies → `LEETCODE_SESSION`, and `csrftoken`) into
  `prep/.leetcode_session`:
  ```
  LEETCODE_SESSION=eyJ0eXAi...
  csrftoken=AbC123...
  ```
  Then click **Refresh** in the popup. This file is also in `.gitignore`; treat it like a password.
  Without Premium you still get the summary, hint and test cases.

## Data Structures, Algorithm Patterns and Videos

Three sections sit next to Big-O:

- **Data Structures**: arrays and hash maps, linked lists, stacks and queues, heaps, trees, tries, graphs, matrices.
- **Algorithm Patterns**: two pointers, sliding window, binary search, intervals, backtracking, DP, greedy, and more.
- **Videos**: your whole video library in one list.

Each card shows when to use it, the core idea, a Java template, typical complexity, and a **Practice** button
that filters the problem list. Videos tagged with a pattern are embedded on its card. Click the thumbnail
or any chapter timestamp to play from that point. Problem popups link to their guide and show matching videos.

All videos live in **`prep/content/videos.json`**. To add one:

```bash
cd ~/learn/prep
python3 add_video.py https://www.youtube.com/watch?v=Ak-fxEwAR14 --pattern Backtracking
python3 add_video.py https://youtu.be/XXXXXXXXXXX --pattern "Sliding Window" \
    --problem longest-substring-without-repeating-characters \
    --chapters "0:00 Intro" "3:10 Shrinking the window" "8:45 Code"
python3 add_video.py --list
```

It looks up the title and channel automatically, then you reload the page; no rebuild needed. You can also
edit the JSON by hand: only `url` and `patterns` are required, and `problems` (LeetCode slugs), `chapters`
(`"m:ss Label"`), `links` and `notes` are optional. A video can belong to several patterns. Card text, templates and which
section a card is in (`group`) are in `content/techniques.json`.

## Progress and where your work is saved

Every problem shows a status: *(none)* not started · **Started** (code written) · **Tried · 1/4** (last run) ·
**✓ 4/4** (all tests passing) · **✓ Done**. The status menu filters by it; the bar shows totals for the current filter.

| What | Where |
|---|---|
| Your code | `prep/solutions/<slug>.java` / `.py` (plus a browser copy) |
| Progress | `prep/solutions/progress.json` (plus a browser copy) |

Problems are linked to files by their LeetCode slug: `two-sum` → `solutions/two-sum.java` and the
`"two-sum"` entry in `progress.json`. On load the page merges the file and the browser copy, so nothing
marked done is lost. **Commit `prep/solutions/` to git** to keep your work across machines.

## Troubleshooting

| Problem | Fix |
|---|---|
| Page says to start the runner | You opened `index.html` as a file. Run `python3 prep_server.py` and use the page it opens. |
| "Could not load problems.json" | Run `python3 build_prep.py`, then reload. |
| "Could not reach the local runner" | The server stopped. Start it again and reload. |
| `Company 'x' not found` | Use `--list-companies` for exact folder names. |
| "No JDK found" | `brew install openjdk`, then restart the server. |
| `Address already in use` | Another copy is running, or use `--port 9000`. |
| Tests time out | 10-second limit: look for an infinite loop or an O(n²) where O(n) is expected. |

## How the runner works (and why it's safe)

On **Run**, the page sends your code and that problem's test harness to `prep_server.py`, which writes a
temporary file, compiles/runs it with your own `javac`/`java` or `python3`, returns the results and deletes
the temporary files.

- Listens only on `127.0.0.1`; your code is never uploaded anywhere.
- A random token, embedded only in the page it serves, is required for every action, so other websites
  open in your browser can't use it.
- Writes only to `prep/solutions/` and `prep/cache/`. Its only outside connection is to leetcode.com, to fetch problem statements.

## Data source

Company lists: `liquidslr/leetcode-company-wise-problems` (LeetCode company tags), snapshot of
**1 June 2025**. "Last 6 months" and the 30d / 3mo / 6mo tags are relative to that date, not today.
To refresh, download a newer copy of the dataset into `~/learn/leetcode-company-wise-problems-main/`
and run `build_prep.py`. Problem summaries are short paraphrases, not LeetCode's text.
