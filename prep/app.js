/* Prep page app: loads problems.json + content/reference.json from prep_server.py and renders everything. */
(function(){
  var meta = document.querySelector('meta[name="prep-token"]');
  var TOKEN = meta ? meta.getAttribute('content') : '';
  var SERVER = /^[0-9a-f]{32}$/.test(TOKEN);
  window.PREP = { TOKEN: TOKEN, SERVER: SERVER };

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function slugify(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  if (!SERVER) {
    document.getElementById('appRoot').innerHTML =
      '<div class="card offline"><b>Start the local runner to load the problems.</b>' +
      '<p>This page reads <code>problems.json</code> through <code>prep_server.py</code>. In Terminal:</p>' +
      '<pre>cd ~/learn/prep\npython3 prep_server.py</pre>' +
      '<p>It opens the page at <code>http://127.0.0.1:8777</code>. The rest of this page (Java toolkit, system design, behavioral) works without it.</p></div>';
    var b = document.getElementById('runnerBadge'); if (b) { b.className = 'runner off'; b.querySelector('span').textContent = 'Runner off'; }
    return;
  }

  function get(path){
    return fetch(path, { headers: { 'X-Prep-Token': TOKEN }, cache: 'no-store' }).then(function(r){
      if (!r.ok) throw new Error(path + ': HTTP ' + r.status); return r.json();
    });
  }
  function opt(path){ return get(path).catch(function(){ return null; }); }
  Promise.all([get('problems.json'), get('content/reference.json'), opt('content/techniques.json'), opt('content/videos.json')]).then(function(res){
    boot(res[0], res[1], res[2], res[3]);
  }).catch(function(e){
    document.getElementById('appRoot').innerHTML = '<div class="card offline"><b>Could not load problems.json.</b><p>' + esc(e.message) +
      '</p><p>Run <code>python3 build_prep.py</code> in <code>~/learn/prep</code>, then reload.</p></div>';
  });

  function boot(D, REF, TECHS, VIDS){
    var cos = D.companies, wl = D.window_label;
    var when = D.window === 'all' ? 'all time' : 'the last ' + wl;   // e.g. "asked in the last 6 months"
    var whenShort = D.window === 'all' ? 'all time' : 'last ' + wl;
    var names = cos.map(function(c){ return c.name; });
    var hasBlind = D.problems.some(function(p){ return p.blind75; });
    // header text
    document.getElementById('subText').textContent = 'LeetCode problems ' + (names.length ? names.join(', ').replace(/, ([^,]*)$/, ' and $1') + (D.window === 'all' ? ' have asked' : ' asked in ' + when) : '') +
      (hasBlind ? (names.length ? ', plus the Blind 75' : 'The Blind 75') : '') + ' — tagged by company and pattern. Also: a Java toolkit, Big-O cheat sheet, system design and behavioral prep.';

    // study plan cards
    var cards = cos.map(function(c){
      var bw = c.by_window || {};
      var detail = D.window === '30d' ? '' : (bw['30d'] || 0) + ' in the last 30 days' + (D.window !== '3mo' && bw['3mo'] ? ', ' + bw['3mo'] + ' more in 3 months' : (D.window === '3mo' ? ', ' + (bw['3mo'] || 0) + ' more in 3 months' : '')) + '.';
      return '<div class="tier"><div class="k">' + esc(c.name) + ' · ' + esc(whenShort) + '</div><div class="n">' + c.count + '</div><div class="d">' + esc(detail) + '</div></div>';
    }).join('');
    var nBlindCo = D.problems.filter(function(p){ return p.blind75 && Object.keys(p.companies).length; }).length;
    if (hasBlind) cards += '<div class="tier"><div class="k">Blind 75</div><div class="n">' + D.blind75_total + '</div><div class="d">' + nBlindCo + ' of them are also asked by these companies. The rest are for pattern coverage.</div></div>';
    document.getElementById('planCards').innerHTML = cards;
    document.getElementById('dataNote').innerHTML = '<b>Data:</b> company lists come from the liquidslr/leetcode-company-wise-problems dataset (LeetCode company tags), snapshot of <b>' + esc(D.snapshot) +
      '</b>. "' + esc(whenShort.charAt(0).toUpperCase() + whenShort.slice(1)) + '" and the 30d / 3mo / 6mo tags are relative to that snapshot, not to today. Hover a company tag to see its frequency. Click any tag to filter by it. ' +
      'Built ' + esc(D.generated.replace('T', ' ')) + ' — change companies or window with <code>python3 build_prep.py --companies …</code>.';
    document.getElementById('nProblems').textContent = '(' + D.problems.length + ')';

    // filter options
    var nAny = D.problems.filter(function(p){ return Object.keys(p.companies).length; }).length;
    var nMulti = D.problems.filter(function(p){ return Object.keys(p.companies).length >= 2; }).length;
    var src = '<option value="">All sources (' + D.problems.length + ')</option>';
    if (cos.length > 1) src += '<option value="anyco">Any company, ' + esc(whenShort) + ' (' + nAny + ')</option>';
    cos.forEach(function(c){ src += '<option value="co:' + c.slug + '">' + esc(c.name) + ' (' + c.count + ')</option>'; });
    if (nMulti) src += '<option value="multi">Asked by 2+ companies (' + nMulti + ')</option>';
    var nB = D.problems.filter(function(p){ return p.blind75; }).length;
    if (nB) src += '<option value="blind75">Blind 75 (' + nB + ')</option>';
    document.getElementById('src').innerHTML = src;
    var pc = {}; D.problems.forEach(function(p){ pc[p.pattern] = (pc[p.pattern] || 0) + 1; });
    var pat = '<option value="">All patterns</option>';
    D.patterns.forEach(function(g){ if (pc[g]) pat += '<option value="' + slugify(g) + '">' + esc(g) + ' (' + pc[g] + ')</option>'; });
    document.getElementById('pat').innerHTML = pat;

    // rows
    var order = {}; cos.forEach(function(c, i){ order[c.name] = i; });
    var html = D.problems.map(function(p, i){
      var cn = Object.keys(p.companies).sort(function(a, b){ return (order[a] || 0) - (order[b] || 0); });
      var srcs = cn.map(function(n){ return 'co:' + slugify(n); }); if (p.blind75) srcs.push('blind75');
      var freqs = {}; cn.forEach(function(n){ freqs[slugify(n)] = p.companies[n].freq || 0; });
      var tags = cn.map(function(n){
        var c = p.companies[n], w = c.window;
        var tip = 'Asked at ' + n + ' within the last ' + ({ '30d': '30 days', '3mo': '3 months', '6mo': '6 months', 'all': 'all time' }[w] || w) + (c.freq != null ? '; ' + wl + ' frequency ' + Math.round(c.freq) + '%' : '');
        return '<button type="button" class="tag co" data-f="co:' + slugify(n) + '" title="' + esc(tip) + '">' + esc(n) + '<span class="win w' + w + '">' + w + '</span></button>';
      }).join('');
      if (p.blind75) tags += '<button type="button" class="tag b75" data-f="blind75" title="In the Blind 75">Blind 75</button>';
      var idea = p.idea ? '<div class="idea">' + p.idea + '</div>' : '';
      var t = esc(p.title), g = esc(p.pattern);
      var nt = (p.num != null ? '<span class="lcnum">' + esc(p.num) + '.</span> ' : '') + t;   // "146. LRU Cache"
      var st = (p.num != null ? p.num + '. ' : '') + t;
      return '<tr data-id="p' + i + '" data-pid="' + esc(p.slug) + '" data-order="' + i + '" data-src="' + srcs.join(' ') + '" data-freq=\'' + esc(JSON.stringify(freqs)) + '\' data-pattern="' + p.pattern_slug + '" data-title="' + st.toLowerCase() + '">' +
        '<td class="chk"><input type="checkbox" aria-label="Done: ' + t + '"></td>' +
        '<td><button type="button" class="ptitle" data-pid="' + esc(p.slug) + '">' + nt + '</button><span class="st" hidden></span>' + idea +
        '<div class="tags">' + tags + '<button type="button" class="pchip mobonly" data-p="' + p.pattern_slug + '">' + g + '</button></div></td>' +
        '<td><span class="diff ' + esc(p.d.toLowerCase()) + '">' + esc(p.d) + '</span></td>' +
        '<td class="pat"><button type="button" class="pchip" data-p="' + p.pattern_slug + '" title="Show only ' + g + '">' + g + '</button></td></tr>';
    }).join('');
    document.querySelector('#ptable tbody').innerHTML = html;

    initFilters();

    // modal data in the shape the modal code expects
    var PD = {};
    D.problems.forEach(function(p){ PD[p.slug] = p; });
    var DATA = {
      problems: PD,
      shared: { py_helpers: D.shared.py_helpers, py_prelude: D.shared.py_prelude, java_main_helpers: D.shared.java_main_helpers,
                java_user_main: D.shared.java_user_main, folder_hint: '~/learn/prep' },
      javaRef: REF.java, javaSnippets: REF.javaSnippets, pyRef: REF.python
    };
    renderTechniques(D, TECHS, VIDS);
    initModal(DATA);
  }

  // ---------- Techniques & videos (content/techniques.json + content/videos.json) ----------
  function ytId(url){ var m = String(url || '').match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : null; }
  function toSec(t){ var p = String(t).split(':').map(Number); return p.reduce(function(a, b){ return a * 60 + b; }, 0); }
  function parseChapter(c){ var m = String(c).match(/^\s*((?:\d+:)?\d{1,2}:\d{2})\s+(.*)$/); return m ? { t: m[1], s: toSec(m[1]), label: m[2] } : null; }

  function videoCard(v){
    var id = ytId(v.url); if (!id) return '';
    var chapters = (v.chapters || []).map(parseChapter).filter(Boolean);
    return '<div class="vcard" data-vid="' + id + '">' +
      '<div class="vplayer"><button type="button" class="vthumb" data-start="0" aria-label="Play ' + esc(v.title || 'video') + '">' +
        '<img src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt="" loading="lazy"><span class="vplay">▶</span></button></div>' +
      '<div class="vmeta"><b>' + esc(v.title || v.url) + '</b><div class="note">' + esc([v.channel, v.duration].filter(Boolean).join(' · ')) +
        ' · <a href="https://www.youtube.com/watch?v=' + id + '" target="_blank" rel="noopener">YouTube ↗</a></div>' +
        (v.notes ? '<div class="note">' + esc(v.notes) + '</div>' : '') +
        (chapters.length ? '<ol class="chapters">' + chapters.map(function(c){
          return '<li><button type="button" class="chap" data-start="' + c.s + '"><span class="ct">' + esc(c.t) + '</span> ' + esc(c.label) + '</button></li>';
        }).join('') + '</ol>' : '') +
        ((v.links || []).length ? '<div class="note">' + v.links.map(function(l){ return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + ' ↗</a>'; }).join(' · ') + '</div>' : '') +
      '</div></div>';
  }
  function playIn(card, start){
    var id = card.getAttribute('data-vid'), box = card.querySelector('.vplayer');
    box.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&start=' + (start | 0) +
      '" title="YouTube video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  }
  function wireVideos(root){
    root.querySelectorAll('.vcard').forEach(function(card){
      card.addEventListener('click', function(e){
        var b = e.target.closest('[data-start]'); if (!b) return;
        playIn(card, +b.getAttribute('data-start'));
      });
    });
  }

  // Two sections built from content/techniques.json ("group": "Data Structures" | "Algorithm Patterns")
  // plus the full video library from content/videos.json.
  var GROUPS = [{ name: 'Data Structures', root: 'dsRoot',
                  intro: 'The core structures: what each is good at, the operations and their cost, and a Java starting point.' },
                { name: 'Algorithm Patterns', root: 'techRoot',
                  intro: 'Problem-solving techniques: how to recognise when to use each, the core idea, and a Java template.' }];
  function renderTechniques(D, TECHS, VIDS){
    var techs = (TECHS && TECHS.techniques) || [], vids = (VIDS && VIDS.videos) || [];
    var counts = {}; D.problems.forEach(function(p){ counts[p.pattern] = (counts[p.pattern] || 0) + 1; });
    var byPat = {}; vids.forEach(function(v){ (v.patterns || []).forEach(function(p){ (byPat[p] = byPat[p] || []).push(v); }); });
    window.PREP.tech = { byPattern: byPat, videos: vids, has: {} };
    techs.forEach(function(t){ window.PREP.tech.has[t.pattern] = true; });

    function card(t){
      var s = slugify(t.pattern), vs = byPat[t.pattern] || [];
      return '<details class="tech" id="tech-' + s + '"' + (vs.length ? ' open' : '') + '><summary><span>' + esc(t.title || t.pattern) + '</span>' +
        (vs.length ? '<span class="vcount">▶ ' + vs.length + ' video' + (vs.length > 1 ? 's' : '') + '</span>' : '') +
        '<span class="note">' + (counts[t.pattern] || 0) + ' problems in your list</span></summary><div class="techbody">' +
        '<div class="techgrid"><div><h4>Use it when…</h4><ul>' + (t.spot || []).map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<h4>Core idea</h4><p>' + esc(t.idea) + '</p><p class="note"><b>Typical complexity:</b> ' + esc(t.complexity || '') + '</p>' +
        (counts[t.pattern] ? '<button type="button" class="btn ghost practice" data-p="' + s + '">Practice ' + counts[t.pattern] + ' ' + esc(t.pattern) + ' problems →</button>' : '') +
        '</div><div><h4>Java template</h4><pre><code>' + esc(t.template || '') + '</code></pre></div></div>' +
        (vs.length ? '<h4>Videos</h4><div class="vlist">' + vs.map(videoCard).join('') + '</div>' : '') +
        '</div></details>';
    }
    function chips(list){
      return '<div class="techchips">' + list.map(function(t){
        var n = (byPat[t.pattern] || []).length;
        return '<a href="#tech-' + slugify(t.pattern) + '" class="techchip">' + esc(t.title || t.pattern) + (n ? ' <span class="vcount">▶ ' + n + '</span>' : '') + '</a>';
      }).join('') + '</div>';
    }
    GROUPS.forEach(function(g){
      var root = document.getElementById(g.root); if (!root) return;
      var list = techs.filter(function(t){ return (t.group || 'Algorithm Patterns') === g.name; });
      root.innerHTML = '<p class="note">' + esc(g.intro) + '</p>' + chips(list) + list.map(card).join('');
    });

    // video library
    var vroot = document.getElementById('vidRoot');
    if (vroot) {
      var orphan = vids.filter(function(v){ return !(v.patterns || []).some(function(p){ return window.PREP.tech.has[p]; }); });
      vroot.innerHTML = '<p class="note">' + (vids.length ? vids.length + ' video' + (vids.length > 1 ? 's' : '') + ' saved.' : 'No videos yet.') +
        ' Add more with <code>python3 add_video.py &lt;youtube-url&gt; --pattern "Sliding Window"</code>, or edit <code>content/videos.json</code>. ' +
        'Each video also appears on the card for its pattern and in matching problem popups.</p>' +
        (vids.length ? '<ul class="vlibl">' + vids.map(function(v){
          var id = ytId(v.url);
          return '<li><a href="https://www.youtube.com/watch?v=' + id + '" target="_blank" rel="noopener">' + esc(v.title || v.url) + '</a> <span class="note">' +
            esc([v.channel, v.duration].filter(Boolean).join(' · ')) + '</span> ' + (v.patterns || []).map(function(pn){
              return window.PREP.tech.has[pn] ? '<a class="techchip sm" href="#tech-' + slugify(pn) + '">' + esc(pn) + '</a>' : '<span class="techchip sm">' + esc(pn) + '</span>'; }).join(' ') + '</li>';
        }).join('') + '</ul>' : '') +
        (orphan.length ? '<h4>Videos without a guide card</h4><div class="vlist">' + orphan.map(videoCard).join('') + '</div>' : '');
    }

    document.querySelectorAll('#dsRoot, #techRoot, #vidRoot').forEach(function(root){
      wireVideos(root);
      root.querySelectorAll('.practice').forEach(function(b){
        b.addEventListener('click', function(){
          var pat = document.getElementById('pat'); pat.value = b.getAttribute('data-p');
          pat.dispatchEvent(new Event('change'));
          document.getElementById('problems').scrollIntoView({ block: 'start' });
        });
      });
      root.querySelectorAll('a.techchip').forEach(function(a){
        a.addEventListener('click', function(){ var d = document.getElementById(a.getAttribute('href').slice(1)); if (d) d.open = true; });
      });
    });
  }
  window.PREP.videoCard = videoCard; window.PREP.wireVideos = wireVideos;

  function initFilters(){
  var tbody = document.querySelector('#ptable tbody');
  var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr[data-id]'));
  var q = document.getElementById('q'), src = document.getElementById('src'), pat = document.getElementById('pat');
  var hide = document.getElementById('hideDone'), empty = document.getElementById('empty');
  var ptext = document.getElementById('ptext'), pbar = document.getElementById('pbar');

  function srcMatch(r, s){
    if (!s) return true;
    var list = r.getAttribute('data-src').split(' ');
    if (s === 'anyco') return list.some(function(x){ return x.indexOf('co:') === 0; });
    if (s === 'multi') return list.filter(function(x){ return x.indexOf('co:') === 0; }).length >= 2;
    return list.indexOf(s) !== -1;
  }
  function sortRows(){
    var s = src.value, co = s.indexOf('co:') === 0 ? s.slice(3) : null;
    var sorted = rows.slice().sort(function(a, b){
      if (co) {
        var fa = JSON.parse(a.getAttribute('data-freq'))[co] || 0, fb = JSON.parse(b.getAttribute('data-freq'))[co] || 0;
        if (fa !== fb) return fb - fa;
      }
      return a.getAttribute('data-order') - b.getAttribute('data-order');
    });
    sorted.forEach(function(r){ tbody.appendChild(r); });
  }
  var stat = document.getElementById('stat'), legend = document.getElementById('plegend');
  function statMatch(st, f){
    if (!f) return true;
    if (f === 'todo') return st !== 'done';
    if (f === 'none') return !st;
    return st === f;
  }
  function update(){
    var term = q.value.trim().toLowerCase(), s = src.value, p = pat.value, f = stat.value;
    var c = { done: 0, passed: 0, attempted: 0 }, total = 0, shown = 0;
    rows.forEach(function(r){
      var cb = r.querySelector('input[type=checkbox]'), st = r.getAttribute('data-status') || '';
      var inScope = srcMatch(r, s) && (!p || r.getAttribute('data-pattern') === p);
      r.classList.toggle('done', cb.checked);
      if (inScope) { total++; if (c[st] !== undefined) c[st]++; }
      var show = inScope && statMatch(st, f) && (!term || r.getAttribute('data-title').indexOf(term) !== -1) && !(hide.checked && cb.checked);
      r.style.display = show ? '' : 'none';
      if (show) shown++;
    });
    document.querySelector('#ptable').parentNode.style.display = shown ? '' : 'none';
    empty.style.display = shown ? 'none' : 'block';
    var parts = [];
    if (s) parts.push(src.options[src.selectedIndex].text.replace(/\s*\(\d+\)$/, ''));
    if (p) parts.push(pat.options[pat.selectedIndex].text.replace(/\s*\(\d+\)$/, ''));
    ptext.textContent = c.done + ' / ' + total + ' done' + (parts.length ? ' · ' + parts.join(' · ') : '');
    function pct(n){ return (total ? 100 * n / total : 0) + '%'; }
    pbar.style.width = pct(c.done);
    document.getElementById('pbar2').style.width = pct(c.passed);
    document.getElementById('pbar3').style.width = pct(c.attempted);
    legend.innerHTML = '<span><i class="dot" style="background:var(--accent)"></i><b>' + c.done + '</b> done</span>' +
      '<span><i class="dot" style="background:var(--easy)"></i><b>' + c.passed + '</b> passing, not marked done</span>' +
      '<span><i class="dot" style="background:var(--med)"></i><b>' + c.attempted + '</b> attempted</span>' +
      '<span><i class="dot" style="background:var(--surface-2);border:1px solid var(--border)"></i><b>' + (total - c.done - c.passed - c.attempted) + '</b> not started</span>';
  }
  window.prepUpdate = update;
  function jump(){ document.getElementById('problems').scrollIntoView({block:'start'}); }
  rows.forEach(function(r){ r.querySelector('input[type=checkbox]').addEventListener('change', update); });
  document.querySelectorAll('.pchip').forEach(function(b){
    b.addEventListener('click', function(){
      pat.value = (pat.value === b.getAttribute('data-p')) ? '' : b.getAttribute('data-p'); update(); jump();
    });
  });
  document.querySelectorAll('.tag').forEach(function(b){
    b.addEventListener('click', function(){
      src.value = (src.value === b.getAttribute('data-f')) ? '' : b.getAttribute('data-f'); sortRows(); update(); jump();
    });
  });
  q.addEventListener('input', update);
  hide.addEventListener('change', update);
  stat.addEventListener('change', update);
  pat.addEventListener('change', update);
  src.addEventListener('change', function(){ sortRows(); update(); });
  update();
  }

  function initModal(DATA){
  var PD = DATA.problems, SH = DATA.shared, JREF = DATA.javaRef, JSNIP = DATA.javaSnippets, PYREF = DATA.pyRef;
  var TOKEN = window.PREP.TOKEN, SERVER = window.PREP.SERVER;

  // ---------- storage (best effort) ----------
  function sget(k){ try { return window.localStorage.getItem(k); } catch(e){ return null; } }
  function sset(k, v){ try { window.localStorage.setItem(k, v); } catch(e){} }
  function api(path, body){
    var opt = { method: body ? 'POST' : 'GET', headers: { 'X-Prep-Token': TOKEN } };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(path, opt).then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  // ---------- runner badge ----------
  var badge = document.getElementById('runnerBadge');
  function setBadge(on, text){ if (!badge) return; badge.className = 'runner ' + (on ? 'on' : 'off'); badge.querySelector('span').textContent = text; }
  if (SERVER) {
    api('/status').then(function(s){
      setBadge(true, 'Local runner connected' + (s.javac ? ' · Java + Python' : ' · Python only (no JDK found)'));
      SH.hasJava = !!s.javac;
    }).catch(function(){ setBadge(false, 'Local runner not responding — restart prep_server.py'); });
  } else {
    setBadge(false, 'Runner off — start prep_server.py to run code (editing still works)');
  }

  // ---------- progress: solutions/progress.json (via runner) + browser copy ----------
  // entry: { done, doneAt, attempted, last: { lang, ok, total, at }, updated }
  var rows = Array.prototype.slice.call(document.querySelectorAll('#ptable tr[data-pid]'));
  var rowBy = {};
  rows.forEach(function(r){ rowBy[r.getAttribute('data-pid')] = r; });
  var PROG = {};
  try { PROG = JSON.parse(sget('prep:progress') || '{}') || {}; } catch(e) { PROG = {}; }
  // migrate older per-key done flags
  rows.forEach(function(r){
    var pid = r.getAttribute('data-pid');
    if (sget('prep:done:' + pid) === '1') { PROG[pid] = PROG[pid] || {}; PROG[pid].done = true; }
  });
  function today(){ return new Date().toISOString().slice(0, 10); }
  function saveLocal(){ sset('prep:progress', JSON.stringify(PROG)); }
  function patch(pid, ch){
    var e = PROG[pid] = PROG[pid] || {};
    for (var k in ch) e[k] = ch[k];
    e.updated = new Date().toISOString();
    saveLocal();
    if (SERVER) api('/progress', { id: pid, patch: ch }).catch(function(){});
    render(pid);
    if (window.prepUpdate) window.prepUpdate();
  }
  function statusOf(pid){
    var e = PROG[pid] || {};
    if (e.done) return 'done';
    if (e.last && e.last.total > 0 && e.last.ok === e.last.total) return 'passed';
    if (e.attempted || e.last) return 'attempted';
    return '';
  }
  function fmtDate(iso){ try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch(e){ return ''; } }
  function statusText(pid){
    var e = PROG[pid] || {}, st = statusOf(pid), l = e.last;
    var res = l ? (l.total ? l.ok + '/' + l.total + ' passed' : 'ran') + ' · ' + (l.lang === 'python' ? 'Python' : 'Java') + ' · ' + fmtDate(l.at) : '';
    if (st === 'done') return { chip: '✓ Done', tip: 'Done' + (e.doneAt ? ' on ' + e.doneAt : '') + (res ? ' — last run ' + res : '') };
    if (st === 'passed') return { chip: '✓ ' + l.ok + '/' + l.total, tip: 'All tests passed — last run ' + res + '. Mark it done when you are confident.' };
    if (st === 'attempted') return { chip: l && l.total ? 'Tried · ' + l.ok + '/' + l.total : 'Started', tip: l ? 'Last run ' + res : 'Code saved, not run yet' };
    return { chip: '', tip: '' };
  }
  function render(pid){
    var r = rowBy[pid]; if (!r) return;
    var st = statusOf(pid), t = statusText(pid);
    r.setAttribute('data-status', st);
    r.querySelector('input[type=checkbox]').checked = !!(PROG[pid] && PROG[pid].done);
    var chip = r.querySelector('.st');
    chip.className = 'st' + (st ? ' st-' + st : '');
    chip.textContent = t.chip; chip.title = t.tip; chip.hidden = !st;
  }
  rows.forEach(function(r){
    var pid = r.getAttribute('data-pid'), cb = r.querySelector('input[type=checkbox]');
    cb.addEventListener('change', function(){ patch(pid, { done: cb.checked, doneAt: cb.checked ? today() : null }); });
    render(pid);
  });
  if (window.prepUpdate) window.prepUpdate();
  if (SERVER) {
    api('/progress').then(function(srv){
      var fileP = srv.progress || {}, files = srv.files || {}, toPush = {};
      Object.keys(rowBy).forEach(function(pid){
        var a = fileP[pid] || {}, b = PROG[pid] || {}, m = {};
        m.done = !!(a.done || b.done);
        m.doneAt = a.doneAt || b.doneAt || (m.done ? today() : null);
        m.attempted = !!(a.attempted || b.attempted || files[pid]);
        var la = a.last, lb = b.last;
        m.last = la && lb ? (la.at >= lb.at ? la : lb) : (la || lb || null);
        if (!m.done && !m.attempted && !m.last) { delete PROG[pid]; return; }
        m.updated = a.updated || b.updated || new Date().toISOString();
        PROG[pid] = m;
        if (JSON.stringify([!!a.done, !!a.attempted, a.last || null]) !== JSON.stringify([m.done, m.attempted, m.last])) toPush[pid] = m;
      });
      saveLocal();
      Object.keys(toPush).forEach(function(pid){ api('/progress', { id: pid, patch: toPush[pid] }).catch(function(){}); });
      Object.keys(rowBy).forEach(render);
      if (window.prepUpdate) window.prepUpdate();
      if (cur) showModalStatus();
    }).catch(function(){});
  }

  // ---------- modal elements ----------
  var modal = document.getElementById('modal');
  var $ = function(id){ return document.getElementById(id); };
  var cur = null, lastFocus = null, saveTimer = null;
  var lang = sget('prep:lang') || 'java';
  $('mLang').value = lang;
  $('mAuto').checked = sget('prep:auto') !== '0';

  var cm = CodeMirror.fromTextArea($('mCode'), {
    lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false, matchBrackets: true, autoCloseBrackets: true,
    mode: lang === 'java' ? 'text/x-java' : 'python',
    extraKeys: {
      'Ctrl-Space': function(c){ showHints(c, true); },
      'Tab': function(c){ if (c.somethingSelected()) c.indentSelection('add'); else c.replaceSelection('    ', 'end'); },
      'Shift-Tab': function(c){ c.indentSelection('subtract'); },
      'Ctrl-Enter': function(){ run(); }, 'Cmd-Enter': function(){ run(); }
    }
  });

  function key(pid, l){ return 'prep:code:' + pid + ':' + l; }
  function starter(p, l){ return l === 'java' ? p.java_starter : p.py_starter; }

  function loadCode(){
    var p = PD[cur], l = lang, pid = cur;
    var local = sget(key(pid, l));
    cm.setValue(local != null ? local : starter(p, l));
    cm.clearHistory();
    if (SERVER) {
      api('/load?id=' + encodeURIComponent(pid) + '&lang=' + l).then(function(r){
        if (r.code != null && cur === pid && lang === l && r.code !== cm.getValue() && local == null) { cm.setValue(r.code); cm.clearHistory(); }
      }).catch(function(){});
    }
  }
  cm.on('change', function(c, ch){
    if (!cur || ch.origin === 'setValue') return;
    var pid = cur, l = lang, v = cm.getValue();
    sset(key(pid, l), v);
    if (!(PROG[pid] && PROG[pid].attempted)) patch(pid, { attempted: true });
    clearTimeout(saveTimer);
    if (SERVER) saveTimer = setTimeout(function(){ api('/save', { id: pid, lang: l, code: v }).catch(function(){}); }, 700);
  });

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }

  function visiblePids(){
    return Array.prototype.slice.call(document.querySelectorAll('#ptable tbody tr[data-pid]'))
      .filter(function(r){ return r.style.display !== 'none'; }).map(function(r){ return r.getAttribute('data-pid'); });
  }

  function open(pid){
    cur = pid; var p = PD[pid];
    if (modal.hidden) { lastFocus = document.activeElement; }
    modal.hidden = false; document.body.classList.add('modal-open');
    $('mTitle').textContent = (p.num != null ? p.num + '. ' : '') + p.title;
    var row = rowBy[pid];
    var meta = '<span class="diff ' + p.d.toLowerCase() + '">' + p.d + '</span>' + (row ? row.querySelector('.tags').innerHTML.replace(/<button[^>]*class="pchip mobonly"[^>]*>.*?<\/button>/, '') : '') +
               '<span class="pchip">' + esc(p.pattern) + '</span>';
    $('mMeta').innerHTML = meta;
    $('mMeta').querySelectorAll('button').forEach(function(b){ b.disabled = true; b.style.cursor = 'default'; });
    if (p.summary) { $('mSummary').textContent = p.summary; }
    else { $('mSummary').innerHTML = 'No summary written for this one yet — use <b>Open on LeetCode</b> below for the full statement and method signature. (You can add a summary, hint and tests in <code>content/problems.json</code>.)'; }
    $('mExample').textContent = p.example || '';
    $('mExample').parentNode.style.display = p.example ? '' : 'none';
    loadStatement(pid, false);
    renderModalTech(p, pid);
    $('mIdea').innerHTML = p.idea || 'No hint written for this one yet — check the pattern tag.';
    $('mIdea').parentNode.open = false;
    $('mIdea').parentNode.style.display = p.idea ? '' : 'none';
    $('mLink').href = p.link;
    $('mDone').checked = !!(PROG[pid] && PROG[pid].done);
    showModalStatus();
    var ol = $('mTests'); ol.innerHTML = '';
    if (p.tests.length) {
      var isRand = function(t){ return /random #\d+/.test(t[0]); };
      var shown = p.tests.filter(function(t){ return !isRand(t); }), nRand = p.tests.length - shown.length;
      function fmtTest(t){
        var lab = String(t[0]), m = lab.match(/^(.*?)\s+— (.*)$/);
        var call = m ? m[1] : lab, note = m ? m[2] : '';
        var exp = String(t[1]); if (exp.length > 120) exp = exp.slice(0, 110) + ' …';
        return '<code>' + esc(call) + '</code> → <code>' + esc(exp) + '</code>' + (note ? '<div class="tnote">' + esc(note) + '</div>' : '');
      }
      shown.forEach(function(t){ var li = document.createElement('li'); li.innerHTML = fmtTest(t); ol.appendChild(li); });
      if (nRand) { var li = document.createElement('li'); li.className = 'trand'; li.innerHTML = '+ ' + nRand + ' randomized tests (inputs generated, answers checked against a reference solution)'; ol.appendChild(li); }
      $('mTestsWrap').style.display = '';
      $('mRun').textContent = 'Run tests ▶';
    } else {
      $('mTestsWrap').style.display = 'none';
      $('mRun').textContent = 'Run ▶';
    }
    $('mProvided').textContent = p.provided.length ? 'Provided for you (don\'t redefine): ' + p.provided.join(', ') + '.' : (p.tests.length ? '' : 'No test cases for this one: Run compiles and runs your code. In Java add public static void main(String[] args) to your class; in Python, print at the bottom.');
    var nav = visiblePids(), i = nav.indexOf(pid);
    $('mPrev').disabled = i <= 0; $('mNext').disabled = i < 0 || i >= nav.length - 1;
    $('mOut').innerHTML = '<div class="outhint">' + (SERVER ? 'Press <b>' + ($('mRun').textContent.replace(' ▶','')) + '</b> (or Ctrl/Cmd + Enter).' : 'To run code, start the local runner: in Terminal, <code>cd</code> to this folder and run <code>python3 prep_server.py</code>, then use the page it opens. Your code here is still kept in this browser.') +
      ' <b>Ctrl + Space</b> shows suggestions; typing <code>.</code> after a variable lists its methods.</div>';
    loadCode();
    renderRef($('refQ').value);
    setTimeout(function(){ cm.refresh(); cm.focus(); }, 30);
  }
  function close(){
    if (cur && SERVER) { api('/save', { id: cur, lang: lang, code: cm.getValue() }).catch(function(){}); }
    modal.hidden = true; document.body.classList.remove('modal-open'); cur = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.querySelectorAll('.ptitle').forEach(function(b){
    b.addEventListener('click', function(){ open(b.getAttribute('data-pid')); });
  });
  $('mClose').addEventListener('click', close);
  modal.addEventListener('mousedown', function(e){ if (e.target === modal) close(); });
  var lastHintClose = 0;
  cm.on('endCompletion', function(){ lastHintClose = Date.now(); });
  document.addEventListener('keydown', function(e){
    if (modal.hidden || e.key !== 'Escape') return;
    if (cm.state.completionActive || document.querySelector('.CodeMirror-hints') || Date.now() - lastHintClose < 150) return;
    close();
  });
  $('mPrev').addEventListener('click', function(){ var n = visiblePids(), i = n.indexOf(cur); if (i > 0) open(n[i - 1]); });
  $('mNext').addEventListener('click', function(){ var n = visiblePids(), i = n.indexOf(cur); if (i >= 0 && i < n.length - 1) open(n[i + 1]); });
  $('mDone').addEventListener('change', function(){
    if (!cur) return;
    patch(cur, { done: $('mDone').checked, doneAt: $('mDone').checked ? today() : null });
    showModalStatus();
  });
  function showModalStatus(){
    if (!cur) return;
    var t = statusText(cur), st = statusOf(cur);
    $('mStatus').textContent = st ? t.tip.replace(/^Last run /, 'Last run: ') : 'Not started';
    $('mStatus').className = 'mstatus' + (st ? ' st-' + st : '');
  }
  $('mLang').addEventListener('change', function(){
    lang = $('mLang').value; sset('prep:lang', lang);
    cm.setOption('mode', lang === 'java' ? 'text/x-java' : 'python');
    loadCode(); renderRef($('refQ').value);
  });
  $('mAuto').addEventListener('change', function(){ sset('prep:auto', $('mAuto').checked ? '1' : '0'); });
  var resetArmed = false;
  $('mReset').addEventListener('click', function(){
    if (!resetArmed) { resetArmed = true; $('mReset').textContent = 'Click again to reset'; setTimeout(function(){ resetArmed = false; $('mReset').textContent = 'Reset code'; }, 2500); return; }
    resetArmed = false; $('mReset').textContent = 'Reset code';
    cm.setValue(starter(PD[cur], lang)); sset(key(cur, lang), cm.getValue());
    if (SERVER) api('/save', { id: cur, lang: lang, code: cm.getValue() }).catch(function(){});
  });
  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click', function(){
      document.querySelectorAll('.tab').forEach(function(x){ x.classList.toggle('on', x === t); });
      $('paneProb').hidden = t.getAttribute('data-tab') !== 'prob';
      $('paneRef').hidden = t.getAttribute('data-tab') !== 'ref';
    });
  });

  function renderModalTech(p, pid){
    var T = window.PREP.tech, box = $('mTech'); if (!T) { box.innerHTML = ''; return; }
    var direct = T.videos.filter(function(v){ return (v.problems || []).indexOf(pid) !== -1; });
    var pat = (T.byPattern[p.pattern] || []).filter(function(v){ return direct.indexOf(v) === -1; });
    var html = T.has[p.pattern] ? '<p class="note">Pattern guide: <a href="#tech-' + p.pattern_slug + '" class="techlink">' + esc(p.pattern) + ' — how to spot it, Java template' + (pat.length + direct.length ? ', videos' : '') + '</a></p>' : '';
    var vs = direct.concat(pat);
    if (vs.length) {
      html += '<details class="mvideos"' + (direct.length ? ' open' : '') + '><summary>▶ ' + vs.length + ' video' + (vs.length > 1 ? 's' : '') +
        (direct.length ? ' for this problem' : ' on ' + esc(p.pattern)) + '</summary><div class="vlist">' + vs.map(window.PREP.videoCard).join('') + '</div></details>';
    }
    box.innerHTML = html;
    window.PREP.wireVideos(box);
    var l = box.querySelector('.techlink');
    if (l) l.addEventListener('click', function(){ close(); var d = document.getElementById('tech-' + p.pattern_slug); if (d) d.open = true; });
  }

  // ---------- full statement (fetched by the local runner from LeetCode, cached on disk) ----------
  var ALLOWED = { P:1, DIV:1, SPAN:1, PRE:1, CODE:1, STRONG:1, B:1, EM:1, I:1, U:1, UL:1, OL:1, LI:1, SUP:1, SUB:1, BR:1, IMG:1,
                  TABLE:1, THEAD:1, TBODY:1, TR:1, TD:1, TH:1, H3:1, H4:1, BLOCKQUOTE:1, FONT:1 };
  function sanitize(html){
    var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
    function clean(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(n){
        if (n.nodeType === 3) return;
        if (n.nodeType !== 1 || !ALLOWED[n.tagName]) {
          if (n.nodeType === 1 && !/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META)$/.test(n.tagName)) {
            clean(n); while (n.firstChild) node.insertBefore(n.firstChild, n);
          }
          node.removeChild(n); return;
        }
        var src = n.tagName === 'IMG' ? n.getAttribute('src') : null;
        Array.prototype.slice.call(n.attributes).forEach(function(a){ n.removeAttribute(a.name); });
        if (n.tagName === 'IMG') {
          if (src && /^https:\/\//.test(src)) { n.setAttribute('src', src); n.setAttribute('loading', 'lazy'); n.setAttribute('alt', 'figure'); }
          else { node.removeChild(n); return; }
        }
        clean(n);
      });
    }
    var root = doc.body.firstChild; clean(root);
    return root.innerHTML;
  }
  var fullOpen = sget('prep:fullOpen') === '1';
  function setFullOpen(open){
    fullOpen = open; sset('prep:fullOpen', open ? '1' : '0');
    $('mFullBody').classList.toggle('collapsed', !open);
    $('mFullMore').textContent = open ? 'Show less ▴' : 'Show full problem ▾';
    $('mFullMore').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function fitMore(){
    var body = $('mFullBody');
    var needs = body.scrollHeight > 230;
    $('mFullMore').hidden = !needs;
    if (!needs) body.classList.remove('collapsed'); else body.classList.toggle('collapsed', !fullOpen);
  }
  function loadStatement(pid, refresh){
    var body = $('mFullBody'), srcEl = $('mFullSrc');
    if (!SERVER) { body.innerHTML = PD[pid] && PD[pid].full ? sanitize(PD[pid].full) : '<p class="msg">Start <code>prep_server.py</code> to load the full problem.</p>'; srcEl.textContent = ''; fitMore(); return; }
    body.innerHTML = '<p class="msg">Loading the full problem from LeetCode…</p>'; srcEl.textContent = ''; fitMore();
    api('/statement?slug=' + encodeURIComponent(pid) + (refresh ? '&refresh=1' : '')).then(function(r){
      if (cur !== pid) return;
      if (r.ok && r.html) {
        body.innerHTML = sanitize(r.html);
        srcEl.textContent = '· from LeetCode' + (r.cached ? ', saved ' + (r.fetched || '') : '');
        $('mExample').parentNode.style.display = 'none';   // the full statement has all the examples
        body.querySelectorAll('img').forEach(function(im){ im.addEventListener('load', fitMore); });
      } else if (PD[pid] && PD[pid].full) {
        body.innerHTML = sanitize(PD[pid].full) + (r.ok && r.paid
          ? '<p class="msg">LeetCode\'s official text for this one is Premium-only' + (r.logged_in ? ' (your saved session didn\'t unlock it)' : '') + '. To see it here, add your session cookie (see README) and click Refresh.</p>'
          : '<p class="msg">Couldn\'t load LeetCode\'s official text: ' + esc(r.error || 'unknown error') + '</p>');
        srcEl.textContent = '· written in our own words';
        $('mExample').parentNode.style.display = 'none';
      } else if (r.ok && r.paid) {
        body.innerHTML = '<p class="msg"><b>Premium problem.</b> LeetCode only returns its statement to a logged-in Premium account' +
          (r.logged_in ? ' — your saved session was sent but LeetCode didn\'t return the text (expired session, or the account isn\'t Premium).' : '.') +
          ' To load it, save your LeetCode session cookie in <code>~/learn/prep/.leetcode_session</code> (see README), then click Refresh. Until then, use the summary above and the test cases below.</p>';
        srcEl.textContent = '';
      } else {
        body.innerHTML = '<p class="msg">' + esc(r.error || 'Could not load the full problem.') + ' The summary above and the test cases below still work.</p>';
        srcEl.textContent = '';
      }
      fitMore();
    }).catch(function(e){
      if (cur !== pid) return;
      body.innerHTML = '<p class="msg">Could not reach the local runner (' + esc(e.message) + ').</p>'; fitMore();
    });
  }
  $('mFullMore').addEventListener('click', function(){ setFullOpen(!fullOpen); });
  $('mFullRefresh').addEventListener('click', function(){ if (cur) loadStatement(cur, true); });

  // ---------- run ----------
  function expand(s){
    return s.split('@@PYHELPERS@@').join(SH.py_helpers).split('@@PYPRELUDE@@').join(SH.py_prelude).split('@@JHELPERS@@').join(SH.java_main_helpers).split('@@JUSERMAIN@@').join(SH.java_user_main);
  }
  function run(){
    if (!cur) return;
    var out = $('mOut');
    if (!SERVER) { out.innerHTML = '<div class="res fail"><b>Local runner not running.</b><pre>cd ' + esc(SH.folder_hint) + '\npython3 prep_server.py</pre>Then use the page it opens (http://127.0.0.1:8777). Your code is kept in this browser either way.</div>'; return; }
    if (lang === 'java' && SH.hasJava === false) { out.innerHTML = '<div class="res fail"><b>No JDK found.</b> Install one (e.g. <code>brew install openjdk</code>), then restart prep_server.py.</div>'; return; }
    var p = PD[cur], btn = $('mRun');
    btn.disabled = true; var label = btn.textContent; btn.textContent = 'Running…';
    out.innerHTML = '<div class="outhint">' + (lang === 'java' ? 'Compiling and running…' : 'Running…') + '</div>';
    var pre = lang === 'python' ? expand(p.py_pre) : '';
    var post = lang === 'python' ? expand(p.py_post) : expand(p.java_post);
    api('/run', { lang: lang, code: cm.getValue(), pre: pre, post: post }).then(function(r){
      btn.disabled = false; btn.textContent = label;
      if (r.compile_error) { out.innerHTML = '<div class="sum fail">Compile error</div><pre>' + esc(r.compile_error) + '</pre>'; return; }
      var lines = (r.stdout || '').split('\n'), results = [], user = [];
      lines.forEach(function(l){ if (l.indexOf('@@R ') === 0) { try { results.push(JSON.parse(l.slice(4))); } catch(e){} } else if (l.length) user.push(l); });
      var html = '';
      if (p.tests.length) {
        var passed = results.filter(function(x){ return x.ok; }).length;
        var all = passed === p.tests.length;
        patch(cur, { attempted: true, last: { lang: lang, ok: passed, total: p.tests.length, at: new Date().toISOString() } });
        showModalStatus();
        html += '<div class="sum ' + (all ? 'pass' : 'fail') + '">' + (all ? '✓ All ' + passed + ' tests passed' : passed + ' / ' + p.tests.length + ' tests passed') + '</div>';
        if (all && !(PROG[cur] && PROG[cur].done)) html += '<div class="outhint">All passing — tick <b>Done</b> at the top when you\'re confident.</div>';
        function resHtml(x){
          var m = String(x.label).match(/^(.*?)\s+— (.*)$/);
          var lab = m ? '<span class="rlab">' + esc(m[1]) + '</span><div class="tnote">' + esc(m[2]) + '</div>' : esc(x.label);
          return '<div class="res ' + (x.ok ? 'pass' : 'fail') + '"><div class="lbl">' + (x.ok ? '✓ ' : '✗ ') + lab + '</div>' +
            (x.ok ? '' : (x.err ? '<pre>' + esc(x.err) + '</pre>' : '<pre>expected ' + esc(x.exp) + '\ngot      ' + esc(x.got) + '</pre>')) + '</div>';
        }
        var fails = results.filter(function(x){ return !x.ok; }), oks = results.filter(function(x){ return x.ok; });
        fails.slice(0, 8).forEach(function(x){ html += resHtml(x); });
        if (fails.length > 8) html += '<div class="outhint">…and ' + (fails.length - 8) + ' more failing tests. Fix the ones above first.</div>';
        if (oks.length) html += '<details class="passlist"' + (fails.length ? '' : ' open') + '><summary>' + oks.length + ' passing test' + (oks.length > 1 ? 's' : '') + '</summary>' + oks.map(resHtml).join('') + '</details>';
        if (results.length < p.tests.length && !r.timeout) html += '<div class="res fail">Some tests did not run (your program stopped early).</div>';
      } else {
        html += '<div class="sum pass">Ran' + (r.rc === 0 ? ' successfully' : '') + '</div>';
        patch(cur, { attempted: true, last: { lang: lang, ok: 0, total: 0, at: new Date().toISOString() } });
        showModalStatus();
      }
      if (user.length) html += '<h4>Your output</h4><pre>' + esc(user.join('\n')) + '</pre>';
      if (r.timeout) html += '<div class="res fail"><b>Time limit:</b> ' + esc(r.stderr) + '</div>';
      else if (r.stderr && r.stderr.trim()) html += '<h4>Errors</h4><pre>' + esc(r.stderr.trim().split('\n').slice(-25).join('\n')) + '</pre>';
      out.innerHTML = html;
    }).catch(function(e){
      btn.disabled = false; btn.textContent = label;
      out.innerHTML = '<div class="res fail"><b>Could not reach the local runner.</b> Is prep_server.py still running? (' + esc(e.message) + ')</div>';
    });
  }
  $('mRun').addEventListener('click', run);

  // ---------- reference panel ----------
  function renderRef(q){
    q = (q || '').trim().toLowerCase();
    var refs = lang === 'java' ? JREF : PYREF, html = '';
    var terms = q.split(/\s+/).filter(Boolean);
    function match(cls, m){
      var hay = (cls.name + ' ' + (m ? m.join(' ') : cls.note)).toLowerCase();
      return terms.every(function(t){ return hay.indexOf(t) !== -1; });
    }
    refs.forEach(function(c){
      var ms = c.methods.filter(function(m){ return !terms.length || match(c, m); });
      if (terms.length && !ms.length && !match(c)) return;
      if (!ms.length) ms = c.methods;
      html += '<details class="rcls"' + (terms.length ? ' open' : '') + '><summary>' + esc(c.name) + ' <small>' + esc(c.pkg || '') + (c.kind === 'interface' ? ' · interface' : '') + (c.impl ? ' · implements ' + esc(c.impl.join(', ')) : '') + '</small></summary>' +
        (c.note ? '<div class="rnote">' + esc(c.note) + '</div>' : '') +
        '<table><tbody>' + ms.map(function(m){
          return '<tr><td><code>' + esc(m[0]) + '</code>' + (m[1] ? ' <span class="rbig">→ ' + esc(m[1]) + '</span>' : '') + '<div class="rnote" style="padding:2px 0 0">' + esc(m[2]) + '</div></td><td class="rbig">' + esc(m[3] || '') + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<div class="rnote"><a href="' + c.url + '" target="_blank" rel="noopener">Official docs ↗</a></div></details>';
    });
    if (lang === 'java') {
      var sn = JSNIP.filter(function(s){ return !terms.length || terms.every(function(t){ return (s[0] + ' ' + s[1]).toLowerCase().indexOf(t) !== -1; }); });
      if (sn.length) {
        html += '<h4>Snippets</h4>' + sn.map(function(s, i){
          return '<div class="snip"><b>' + esc(s[0]) + '</b> <button type="button" data-snip="' + JSNIP.indexOf(s) + '">Insert at cursor</button><pre>' + esc(s[1]) + '</pre></div>';
        }).join('');
      }
    }
    $('refBody').innerHTML = html || '<p class="note">No matches.</p>';
    $('refBody').querySelectorAll('button[data-snip]').forEach(function(b){
      b.addEventListener('click', function(){ cm.replaceSelection(JSNIP[+b.getAttribute('data-snip')][1]); cm.focus(); });
    });
  }
  $('refQ').addEventListener('input', function(){ renderRef($('refQ').value); });

  // ---------- autocomplete ----------
  var JBY = {}; JREF.forEach(function(c){ JBY[c.key || c.name] = c; });
  var JKEYWORDS = 'abstract boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long new null private protected public return short static super switch this throw throws true false try void while var'.split(' ');
  function parseSig(sig){
    var isStatic = sig.indexOf('static ') === 0, s = isStatic ? sig.slice(7) : sig;
    var m = s.match(/^([\w$]+)\s*(\(([^)]*)\))?/);
    return { name: m ? m[1] : s, params: m && m[2] ? m[3] : null, isStatic: isStatic };
  }
  function methodsOf(typeName, seen){
    seen = seen || {}; if (seen[typeName]) return []; seen[typeName] = 1;
    var c = JBY[typeName]; if (!c) return [];
    var list = c.methods.map(function(m){ return { m: m, cls: c.name }; });
    (c.impl || []).forEach(function(p){ list = list.concat(methodsOf(p, seen)); });
    return list;
  }
  function resolveJava(code, ident){
    var re = new RegExp('(?:^|[\\s(,;{])([A-Za-z_][\\w.]*)\\s*(<[^;=(){}]*>)?\\s*((?:\\[\\s*\\])*)\\s+' + ident + '\\s*(?:[=;,):]|$)', 'gm');
    var m, last = null; while ((m = re.exec(code))) { if (m[1] !== 'return' && m[1] !== 'new') last = m; }
    if (!last) return null;
    if (last[3] && last[3].indexOf('[') !== -1) return '__array__';
    var t = last[1].split('.').pop();
    return t;
  }
  function hintItems(list, prefix, from, to){
    prefix = prefix.toLowerCase();
    var seen = {}, items = [];
    list.forEach(function(x){
      var ps = parseSig(x.m[0]); var k = ps.name + '(' + ps.params + ')';
      if (seen[k]) return; seen[k] = 1;
      if (prefix && ps.name.toLowerCase().indexOf(prefix) !== 0) return;
      items.push({
        text: ps.params === null ? ps.name : ps.name + '()', ps: ps, m: x.m, cls: x.cls,
        hint: function(c, data, comp){
          c.replaceRange(comp.text, data.from, data.to, 'complete');
          if (comp.ps.params) { var p = c.getCursor(); c.setCursor({ line: p.line, ch: p.ch - 1 }); }
        },
        render: function(el, data, comp){
          el.innerHTML = '<span class="hn">' + esc(comp.ps.name) + '</span>' + (comp.ps.params !== null ? '<span class="hr">(' + esc(comp.ps.params) + ')</span>' : '') +
            (comp.m[1] ? ' <span class="hr">→ ' + esc(comp.m[1]) + '</span>' : '') +
            '<span class="hd">' + esc(comp.cls) + ' · ' + esc(comp.m[2]) + (comp.m[3] ? ' · ' + esc(comp.m[3]) : '') + '</span>';
        }
      });
    });
    return { list: items, from: from, to: to };
  }
  function wordItems(words, prefix, from, to, extraClass){
    var lp = prefix.toLowerCase(), seen = {}, items = [];
    words.forEach(function(w){
      if (seen[w] || w === prefix || w.toLowerCase().indexOf(lp) !== 0) return; seen[w] = 1;
      items.push({ text: w, render: function(el){ el.innerHTML = '<span class="hn">' + esc(w) + '</span>' + (JBY[w] ? '<span class="hd">' + esc(JBY[w].pkg) + ' · ' + esc((JBY[w].note || '').slice(0, 90)) + '</span>' : ''); } });
    });
    return { list: items.slice(0, 40), from: from, to: to };
  }
  var PYMOD = {};
  PYREF.forEach(function(c){ PYMOD[c.name] = c; });
  function javaHint(c){
    var cur = c.getCursor(), line = c.getLine(cur.line).slice(0, cur.ch);
    var md = line.match(/([A-Za-z_$][\w$]*(?:\[[^\]]*\])*)\s*\.\s*([\w$]*)$/);
    var to = cur, code = c.getRange({ line: 0, ch: 0 }, cur);
    if (md) {
      var obj = md[1], prefix = md[2], from = { line: cur.line, ch: cur.ch - prefix.length }, list;
      if (/\[/.test(obj)) { var bt = resolveJava(code, obj.replace(/\[.*$/, '')); if (bt === '__array__') list = methodsOf('__array__'); }
      if (JBY[obj] && obj !== '__array__') {
        list = JBY[obj].methods.filter(function(m){ return m[0].indexOf('static ') === 0; }).map(function(m){ return { m: m, cls: obj }; });
        if (!list.length) list = methodsOf(obj);
      } else if (!list) {
        var t = resolveJava(code, obj);
        if (t === '__array__') list = methodsOf('__array__');
        else if (t && JBY[t]) list = methodsOf(t).filter(function(x){ return x.m[0].indexOf('static ') !== 0 && x.m[1] !== ''; });
        else if (t === 'StringBuilder' || t === 'String') list = methodsOf(t);
        else {
          list = [];
          ['List', 'Map', 'Set', 'Deque', 'PriorityQueue', 'String', 'StringBuilder', 'TreeMap', 'TreeSet'].forEach(function(n){ list = list.concat(methodsOf(n)); });
          list = list.filter(function(x){ return x.m[0].indexOf('static ') !== 0 && x.m[1] !== ''; });
        }
      }
      return hintItems(list, prefix, from, to);
    }
    var mw = line.match(/([A-Za-z_$][\w$]*)$/); if (!mw) return null;
    var p = mw[1], f = { line: cur.line, ch: cur.ch - p.length };
    var idents = (c.getValue().match(/[A-Za-z_$][\w$]{2,}/g) || []);
    return wordItems(Object.keys(JBY).filter(function(k){ return k !== '__array__'; }).concat(JKEYWORDS, idents), p, f, to);
  }
  function pyHint(c){
    var cur = c.getCursor(), line = c.getLine(cur.line).slice(0, cur.ch);
    var md = line.match(/([A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)?)\s*\.\s*(\w*)$/);
    if (md) {
      var obj = md[1], prefix = md[2], from = { line: cur.line, ch: cur.ch - prefix.length }, list = [];
      var mod = PYMOD[obj] || PYMOD['collections.' + obj];
      if (mod) list = mod.methods.map(function(m){ return { m: m, cls: mod.name }; });
      else ['list', 'dict', 'set', 'str', 'collections.deque'].forEach(function(n){ list = list.concat(PYMOD[n].methods.map(function(m){ return { m: m, cls: n }; })); });
      return hintItems(list, prefix, from, cur);
    }
    var mw = line.match(/([A-Za-z_]\w*)$/); if (!mw) return null;
    var kw = 'def return class for while if elif else import from in not and or None True False len range enumerate zip sorted sum min max abs list dict set tuple str int float append heapq deque defaultdict Counter bisect self lambda break continue pass'.split(' ');
    return wordItems(kw.concat(c.getValue().match(/[A-Za-z_]\w{2,}/g) || []), mw[1], { line: cur.line, ch: cur.ch - mw[1].length }, cur);
  }
  function showHints(c, manual){
    c.showHint({ hint: lang === 'java' ? javaHint : pyHint, completeSingle: false, closeOnUnfocus: true, alignWithWord: true });
  }
  cm.on('inputRead', function(c, ch){
    if (!$('mAuto').checked || c.state.completionActive) return;
    var t = ch.text.join('');
    if (t === '.') { showHints(c); return; }
    if (/^[A-Za-z_]$/.test(t)) {
      var cur = c.getCursor(), line = c.getLine(cur.line).slice(0, cur.ch);
      if (/(^|[^\w.$])[A-Za-z_][\w$]{2}$/.test(line) && !/\/\/|#/.test(line)) showHints(c);
    }
  });
  }
})();
