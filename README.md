# Coding Interview Prep: how to run it

This folder (`~/learn`) has a practice page for LeetCode problems that LinkedIn and NVIDIA asked in the
last 6 months, plus the Blind 75. You can read each problem, write Java or Python in the
browser, and run it against test cases on your own Mac.

| File | What it is |
|---|---|
| `coding_interview_prep.html` | The practice page: problem list, filters, editor, Java reference |
| `prep_server.py` | Small local runner that serves the page and runs your code |
| `solutions/` | Your code, saved as files (one per problem and language, e.g. `two-sum.java`) |
| `solutions/progress.json` | Your progress: done / passing / attempted, last test result per problem |
| `leetcode-company-wise-problems-main/` | The company question lists the page was built from (LinkedIn, Nvidia, …) |

## Requirements

- **Python 3** (already on most Macs): `python3 --version`
- **A JDK, for running Java** (11 or newer): `javac -version`
  If it's missing: `brew install openjdk`, then follow the `brew` instructions to put it on your PATH.
  Without a JDK you can still run Python.

No packages to install. `prep_server.py` uses only the Python standard library.

## Quick start

```bash
cd ~/learn
python3 prep_server.py
```

It prints something like this and opens the page in your browser:

```
Prep runner on http://127.0.0.1:8777/
  python: /usr/bin/python3
  javac:  /usr/bin/javac
  solutions saved to: .../solutions
Ctrl+C to stop.
```

Keep the Terminal window open while you practice. Press **Ctrl + C** to stop the server.

Options:

```bash
python3 prep_server.py --port 9000      # use another port if 8777 is busy
python3 prep_server.py --no-browser     # don't open the browser automatically
```

## Using the page

1. **Pick problems.** Use the Source filter (LinkedIn, NVIDIA, Blind 75, …) and the Pattern filter.
   The list is ordered by priority: asked by more companies, then most recent, then most frequent.
2. **Click a problem title.** A popup opens:
   - **Problem tab:** a short description, an example, a hidden hint, and the test cases.
   - **Reference tab:** a searchable Java API cheat sheet (String, HashMap, TreeMap, PriorityQueue,
     Deque, …) with Big-O and links to the official docs, plus snippets you can insert.
3. **Write code** in Java or Python (language picker above the editor).
   - Typing `.` after a variable lists its methods with signatures, e.g. `map.` → `get`, `getOrDefault`, …
   - **Ctrl + Space** shows suggestions anywhere. Autocomplete can be turned off with the checkbox.
4. **Run tests** with the button or **Cmd + Enter**. You'll see:
   - pass/fail for each test case, with *expected* vs *got*
   - compile errors, your `System.out` / `print` output, and runtime errors
   - a 10-second time limit (to stop infinite loops)
5. **Check Done** at the top of the popup when you've solved it. Use ‹ › to move between problems.
   **Esc** closes the popup.

### Tracking progress

Every problem shows its status next to the title:

| Label | Meaning |
|---|---|
| *(none)* | Not started |
| **Started** | You've written code but haven't run it |
| **Tried · 1/4** | Last run passed 1 of 4 tests |
| **✓ 4/4** | All tests passing, not yet marked done |
| **✓ Done** | You ticked Done |

- The **status menu** in the toolbar filters by status: *Not done yet*, *Not started*, *Attempted*,
  *Passing, not marked done*, or *Done*. It combines with the Source and Pattern filters.
- The **progress bar** and legend above the list count done / passing / attempted / not started for the
  current filter, e.g. "how much of NVIDIA's list is done".
- The popup header shows the last result, e.g. "last run 3/4 passed · Java · Oct 28".
- Passing all tests doesn't mark a problem done automatically. Tick **Done** when you can solve it
  confidently.

### Writing code: things to know

- Start from the given starter (class and method names must match, as on LeetCode).
- Helper classes such as `ListNode`, `TreeNode`, `NestedInteger`, `Node` and `read4` are
  **provided**. Don't redefine them (the popup lists what's provided).
- Java: `java.util.*` is imported for you, and `public class` is fine.
- Problems from the Blind 75 that no company asked recently have **no test cases**. Run just compiles
  and runs your code. To try an input, add this to your class:
  ```java
  public static void main(String[] args) {
      System.out.println(new Solution().climbStairs(5));
  }
  ```
  In Python, add a `print(...)` at the bottom.

## Where your code is saved

| How you opened the page | Saved in the browser | Saved as files in `solutions/` | Can run code |
|---|---|---|---|
| Through the server (`http://127.0.0.1:8777`) | Yes | Yes, e.g. `solutions/two-sum.java` | Yes |
| Double-clicking the HTML file | Yes | No | No |

- Browser copies survive closing the tab and restarting, but are lost if you clear browsing data or
  use a private window. They're also separate per browser, and per way of opening the page.
- **Recommended:** always open the page through `prep_server.py`, so your code is also kept as normal files.
- **Progress** (done / passing / attempted) is saved in `solutions/progress.json` when the runner is on,
  and in the browser either way. On load the page merges both, so a done problem stays done even if
  the browser copy is cleared.
- Problems are linked to files by their LeetCode URL name (slug): `https://leetcode.com/problems/two-sum`
  → `solutions/two-sum.java`, `solutions/two-sum.py`, and the `"two-sum"` entry in `progress.json`.
- Commit `solutions/` to git to keep your code and progress across machines.

## Troubleshooting

| Problem | Fix |
|---|---|
| Page says "Runner off" | You opened the HTML file directly. Start `python3 prep_server.py` and use the page it opens. |
| "Could not reach the local runner" | The server was stopped. Start it again and reload the page. |
| "No JDK found" / `javac not found` | Install a JDK (`brew install openjdk`) and restart the server. |
| `Address already in use` | Another copy is running, or the port is busy. Stop it, or use `--port 9000`. |
| My code isn't there after reopening | You probably opened the page the other way (file vs server), or in another browser. Files in `solutions/` are loaded when the browser has no copy. |
| `java.lang.StackOverflowError` | Very deep recursion. The runner already gives Java a large stack, so check for infinite recursion. |
| Tests time out | 10-second limit per run. Look for an infinite loop or an O(n²) where O(n) is expected. |

## How the runner works (and why it's safe)

When you click **Run tests**, the page sends your code and that problem's test harness to
`prep_server.py`. It writes a temporary file, compiles and runs it with your own `javac`/`java` or
`python3`, and sends the results back. The temporary files are deleted afterwards.

- **Local only:** it listens only on `127.0.0.1`, so other machines can't reach it, and nothing is uploaded.
- **Token check:** each start creates a random token that's only embedded in the page it serves, so
  other websites open in your browser can't ask it to run code.
- **Saves only to `solutions/`** (your code and `progress.json`): it doesn't write anywhere else.
- **Short and readable:** about 200 lines of plain Python. Read it before running if you like.

## Data source

Company lists come from the `liquidslr/leetcode-company-wise-problems` dataset (LeetCode company
tags), snapshot of **1 June 2025**. "Last 6 months" and the 30d / 3mo / 6mo tags are relative to that
date, not today. Problem descriptions on the page are short summaries, not LeetCode's text. Use
"Open on LeetCode" for the full statement.
