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
  Promise.all([get('problems.json'), get('content/reference.json'), opt('content/techniques.json'), opt('content/videos.json'), opt('content/concepts.json'), opt('content/focus.json'), opt('content/system_design.json')]).then(function(res){
    boot(res[0], res[1], res[2], res[3], res[4], res[5], res[6]);
  }).catch(function(e){
    document.getElementById('appRoot').innerHTML = '<div class="card offline"><b>Could not load problems.json.</b><p>' + esc(e.message) +
      '</p><p>Run <code>python3 build_prep.py</code> in <code>~/learn/prep</code>, then reload.</p></div>';
  });

  function boot(D, REF, TECHS, VIDS, CON, FOCUS, SDD){
    ((SDD && SDD.designs) || []).forEach(function(d){ SDBY[d.id] = d; });
    renderSD(SDD);
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
    var nFocus = D.problems.filter(function(p){ return p.focus; }).length;
    if (nFocus) src = src.replace('</option>', '</option><option value="focus">★ Focus: LinkedIn onsite (' + nFocus + ')</option>');
    function mine(p){ return p.custom && p.custom.origin !== 'focus'; }
    var nMine = D.problems.filter(mine).length;
    if (nMine) src += '<option value="custom">Added by you (' + nMine + ')</option>';
    var known = {}; cos.forEach(function(c){ known[c.slug] = 1; });
    var extra = {};   // companies that only appear on problems you added
    D.problems.forEach(function(p){ if (p.custom) Object.keys(p.companies).forEach(function(n){ if (!known[slugify(n)]) extra[n] = (extra[n] || 0) + 1; }); });
    Object.keys(extra).sort().forEach(function(n){ src += '<option value="co:' + slugify(n) + '">' + esc(n) + ' (' + extra[n] + ')</option>'; });
    document.getElementById('src').innerHTML = src;
    var pc = {}; D.problems.forEach(function(p){ pc[p.pattern] = (pc[p.pattern] || 0) + 1; });
    var pat = '<option value="">All patterns</option>';
    D.patterns.forEach(function(g){ if (pc[g]) pat += '<option value="' + slugify(g) + '">' + esc(g) + ' (' + pc[g] + ')</option>'; });
    document.getElementById('pat').innerHTML = pat;

    // rows
    var order = {}; cos.forEach(function(c, i){ order[c.name] = i; });
    var html = D.problems.map(function(p, i){
      var cn = Object.keys(p.companies).sort(function(a, b){ return (order[a] || 0) - (order[b] || 0); });
      var srcs = cn.map(function(n){ return 'co:' + slugify(n); }); if (p.blind75) srcs.push('blind75'); if (mine(p)) srcs.push('custom'); if (p.focus) srcs.push('focus');
      var freqs = {}; cn.forEach(function(n){ freqs[slugify(n)] = p.companies[n].freq || 0; });
      var tags = cn.map(function(n){
        var c = p.companies[n], w = c.window;
        if (w === 'mine') return '<button type="button" class="tag co" data-f="co:' + slugify(n) + '" title="You tagged this ' + esc(n) + '">' + esc(n) + '</button>';
        var tip = 'Asked at ' + n + ' within the last ' + ({ '30d': '30 days', '3mo': '3 months', '6mo': '6 months', 'all': 'all time' }[w] || w) + (c.freq != null ? '; ' + wl + ' frequency ' + Math.round(c.freq) + '%' : '');
        return '<button type="button" class="tag co" data-f="co:' + slugify(n) + '" title="' + esc(tip) + '">' + esc(n) + '<span class="win w' + w + '">' + w + '</span></button>';
      }).join('');
      if (p.blind75) tags += '<button type="button" class="tag b75" data-f="blind75" title="In the Blind 75">Blind 75</button>';
      if (p.focus) tags = '<button type="button" class="tag focus" data-f="focus" title="On the Focus list (LinkedIn onsite reports)">★ Focus</button>' + tags;
      if (mine(p)) tags = '<button type="button" class="tag mine" data-f="custom" title="' + esc(p.custom.source ? 'Added by you: ' + p.custom.source : 'Added by you') + '">Mine</button>' + tags;
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
    renderConcepts(CON);
    initModal(DATA);
    renderFocus(FOCUS, D);
    initCustom(D, function(slug){ var b = document.querySelector('button.ptitle[data-pid="' + slug + '"]'); if (b) b.click(); });
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

  // ---------- add / edit your own problems (content/custom_problems.json via prep_server.py) ----------
  function initCustom(D, openProblem){
    var $ = function(id){ return document.getElementById(id); };
    var box = $('cpModal'), editing = null, delArmed = false, busy = false;
    var FIELDS = { title: 'cpTitleIn', difficulty: 'cpDiff', pattern: 'cpPattern', companies: 'cpCompanies', source: 'cpSource',
                   summary: 'cpSummary', statement: 'cpStatement', example: 'cpExample', hint: 'cpHint',
                   signature: 'cpSig', tests: 'cpTests', order: 'cpOrder' };
    var FIELD_OF = { title: 'cpTitleIn', signature: 'cpSig', tests: 'cpTests' };

    $('cpPatList').innerHTML = D.patterns.map(function(p){ return '<option value="' + esc(p) + '">'; }).join('');
    var cos = {};
    D.companies.forEach(function(c){ cos[c.name] = 1; });
    D.problems.forEach(function(p){ Object.keys(p.companies).forEach(function(n){ cos[n] = 1; }); });
    $('cpCoList').innerHTML = Object.keys(cos).map(function(n){ return '<option value="' + esc(n) + '">'; }).join('');

    function bySlug(slug){ return D.problems.filter(function(p){ return p.slug === slug; })[0]; }

    function show(slug){
      var rec = slug ? (bySlug(slug) || {}).custom : null;
      editing = rec ? slug : null; delArmed = false;
      $('cpTitle').textContent = rec ? 'Edit problem' : 'Add a problem';
      $('cpSave').textContent = rec ? 'Save changes' : 'Save problem';
      $('cpDelete').hidden = !rec; $('cpDelete').textContent = 'Delete problem';
      Object.keys(FIELDS).forEach(function(k){
        var el = $(FIELDS[k]), v = rec ? rec[k] : '';
        if (k === 'companies') v = (v || []).join(', ');
        if (k === 'difficulty') v = v || 'Medium';
        if (k === 'order') v = v || 'exact';
        el.value = v == null ? '' : v; el.classList.remove('bad');
      });
      $('cpErr').hidden = true; $('cpMsg').textContent = '';
      box.hidden = false; document.body.classList.add('modal-open');
      setTimeout(function(){ $('cpTitleIn').focus(); }, 20);
    }
    function hide(){
      box.hidden = true;
      if ($('modal').hidden) document.body.classList.remove('modal-open');
    }
    window.prepEditCustom = show;

    // the "+ Add problem" button next to the filters
    var add = $('addProb');
    if (add) add.addEventListener('click', function(){ show(null); });
    $('cpClose').addEventListener('click', hide);
    $('cpCancel').addEventListener('click', hide);
    box.addEventListener('mousedown', function(e){ if (e.target === box) hide(); });
    window.addEventListener('keydown', function(e){
      if (box.hidden || e.key !== 'Escape') return;
      e.stopPropagation(); e.preventDefault(); hide();
    }, true);

    function showErrors(errors){
      Object.keys(FIELD_OF).forEach(function(k){ $(FIELD_OF[k]).classList.remove('bad'); });
      errors.forEach(function(er){ if (FIELD_OF[er.field]) $(FIELD_OF[er.field]).classList.add('bad'); });
      $('cpErr').innerHTML = '<b>Please fix:</b><ul>' + errors.map(function(er){ return '<li>' + esc(er.msg) + '</li>'; }).join('') + '</ul>';
      $('cpErr').hidden = false;
      $('cpErr').scrollIntoView({ block: 'nearest' });
    }
    function post(path, body){
      return fetch(path, { method: 'POST', headers: { 'X-Prep-Token': window.PREP.TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function(r){ if (!r.ok && r.status !== 404) throw new Error('HTTP ' + r.status); return r.json(); });
    }
    function done(slug){
      try { sessionStorage.setItem('prep:openAfter', slug || ''); } catch(e){}
      location.reload();
    }
    function setBusy(on, msg){
      busy = on; $('cpSave').disabled = on; $('cpDelete').disabled = on; $('cpMsg').textContent = msg || '';
    }

    $('cpForm').addEventListener('submit', function(e){
      e.preventDefault();
      if (busy) return;
      var fields = {};
      Object.keys(FIELDS).forEach(function(k){ fields[k] = $(FIELDS[k]).value; });
      if (!fields.title.trim()) { showErrors([{ field: 'title', msg: 'Give the problem a title.' }]); return; }
      setBusy(true, 'Saving and rebuilding the list…');
      post('/custom/save', { slug: editing, fields: fields }).then(function(r){
        if (!r.ok) { setBusy(false); showErrors(r.errors || [{ msg: 'Could not save.' }]); return; }
        done(r.slug);
      }).catch(function(err){ setBusy(false); showErrors([{ msg: 'Could not reach the runner (' + err.message + '). Is prep_server.py running?' }]); });
    });
    $('cpDelete').addEventListener('click', function(){
      if (!editing || busy) return;
      if (!delArmed) {
        delArmed = true; $('cpDelete').textContent = 'Click again to delete';
        setTimeout(function(){ delArmed = false; $('cpDelete').textContent = 'Delete problem'; }, 3000);
        return;
      }
      setBusy(true, 'Deleting…');
      post('/custom/delete', { slug: editing }).then(function(r){
        if (!r.ok) { setBusy(false); showErrors(r.errors || [{ msg: 'Could not delete.' }]); return; }
        done('');
      }).catch(function(err){ setBusy(false); showErrors([{ msg: 'Could not reach the runner (' + err.message + ').' }]); });
    });

    // reopen the problem that was just saved
    var again = null;
    try { again = sessionStorage.getItem('prep:openAfter'); sessionStorage.removeItem('prep:openAfter'); } catch(e){}
    if (again && bySlug(again)) {
      setTimeout(function(){
        document.getElementById('problems').scrollIntoView({ block: 'start' });
        openProblem(again);
      }, 50);
    }
  }

  // ---------- ML & LLM questions (content/concepts.json) ----------
  // markdown-lite: ### / #### headings, - bullets, 1. lists, ``` blocks, | tables |, **bold**, `code`
  function mdInline(s){
    var parts = String(s).split('`'), out = '';
    parts.forEach(function(p, i){
      out += i % 2 ? '<code>' + esc(p) + '</code>' : esc(p).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    });
    return out;
  }
  function mdLite(text){
    var lines = String(text || '').split('\n'), out = [], i = 0;
    function cells(l){   // split on unescaped pipes; "\|" inside a cell is a literal pipe
      return l.trim().replace(/^\||\|$/g, '').replace(/\\\|/g, '\u0000').split('|')
        .map(function(c){ return c.trim().replace(/\u0000/g, '|'); });
    }
    while (i < lines.length) {
      var l = lines[i];
      if (/^```svg\s*$/.test(l.trim())) {          // trusted local content: inline diagram
        var sv = []; i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) { sv.push(lines[i]); i++; }
        i++; out.push('<div class="mlsvg">' + sv.join('\n') + '</div>'); continue;
      }
      if (/^```/.test(l.trim())) {
        var buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
        i++; out.push('<pre class="mlpre">' + esc(buf.join('\n')) + '</pre>'); continue;
      }
      var h = l.match(/^(#{3,4})\s+(.*)$/);
      if (h) { out.push(h[1].length === 3 ? '<h4>' + mdInline(h[2]) + '</h4>' : '<h5>' + mdInline(h[2]) + '</h5>'); i++; continue; }
      if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        var head = cells(l), rows = []; i += 2;
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push('<div class="mltable"><table><thead><tr>' + head.map(function(c){ return '<th>' + mdInline(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' + rows.map(function(r){ return '<tr>' + r.map(function(c){ return '<td>' + mdInline(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
          '</tbody></table></div>');
        continue;
      }
      var ul = /^\s*[-*]\s+/, ol = /^\s*\d+[.)]\s+/;
      if (ul.test(l) || ol.test(l)) {
        var isOl = ol.test(l), re = isOl ? ol : ul, items = [];
        while (i < lines.length && re.test(lines[i])) {
          var item = lines[i].replace(re, ''); i++;
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !ul.test(lines[i]) && !ol.test(lines[i])) { item += ' ' + lines[i].trim(); i++; }
          items.push('<li>' + mdInline(item) + '</li>');
        }
        out.push((isOl ? '<ol>' : '<ul>') + items.join('') + (isOl ? '</ol>' : '</ul>')); continue;
      }
      if (!l.trim()) { i++; continue; }
      var para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{3,4}\s|```|\s*[-*]\s+|\s*\d+[.)]\s+|\s*\|)/.test(lines[i])) { para.push(lines[i].trim()); i++; }
      out.push('<p>' + mdInline(para.join(' ')) + '</p>');
    }
    return out.join('\n');
  }

  var SDBY = {};
  // an item with "design": "<id>" shows the full write-up from content/system_design.json
  function designOf(it){
    var d = it && it.design && SDBY[it.design];
    if (!d) return it;
    var o = {}; Object.keys(it).forEach(function(k){ o[k] = it[k]; });
    o.short = d.short; o.answer = d.answer; o.followups = d.followups;
    return o;
  }

  function renderConcepts(CON){
    var root = document.getElementById('mlRoot');
    if (!root) return;
    var qs = (CON && CON.questions) || [];
    if (!qs.length) { root.innerHTML = '<p class="note">No questions yet. Add them to <code>content/concepts.json</code>.</p>'; return; }
    var cats = [];
    qs.forEach(function(q){ if (cats.indexOf(q.category) === -1) cats.push(q.category); });
    var chips = '<div class="mlcats"><button type="button" class="pchip on" data-cat="">All (' + qs.length + ')</button>' + cats.map(function(c){
      return '<button type="button" class="pchip" data-cat="' + esc(c) + '">' + esc(c) + ' (' + qs.filter(function(q){ return q.category === c; }).length + ')</button>';
    }).join('') + '<label class="mlpractice"><input type="checkbox" id="mlPractice"> Practice mode (hide answers until you click)</label></div>';
    root.innerHTML = chips + qs.map(function(q0, n){
      var q = designOf(q0);
      return '<details class="sdq mlq" data-cat="' + esc(q.category) + '" id="ml-' + esc(q.id) + '">' +
        '<summary>' + (n + 1) + '. ' + esc(q.title) + ' <span class="tag">' + esc(q.category) + '</span></summary>' +
        '<div class="body">' +
          '<blockquote class="mlquestion">' + mdInline(q.question) + (q.source ? '<div class="note">' + esc(q.source) + '</div>' : '') + '</blockquote>' +
          '<div class="mlanswers">' +
            (q.short ? '<div class="mlshort"><b>60-second answer</b><p>' + mdInline(q.short) + '</p></div>' : '') +
            '<div class="mlfull">' + mdLite(q.answer) + '</div>' +
            ((q.followups || []).length ? '<h4>Likely follow-ups</h4><ul>' + q.followups.map(function(f){ return '<li>' + mdInline(f) + '</li>'; }).join('') + '</ul>' : '') +
            (q.related ? '<p class="note">' + mdInline(q.related) + '</p>' : '') +
            ((q.links || []).length ? '<p class="note">Read more: ' + q.links.map(function(l){ return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + ' ↗</a>'; }).join(' · ') + '</p>' : '') +
          '</div>' +
          '<button type="button" class="btn ghost sm mlreveal" hidden>Show answer</button>' +
        '</div></details>';
    }).join('');
    root.querySelectorAll('.mlcats .pchip').forEach(function(b){
      b.addEventListener('click', function(){
        var c = b.getAttribute('data-cat');
        root.querySelectorAll('.mlcats .pchip').forEach(function(x){ x.classList.toggle('on', x === b); });
        root.querySelectorAll('.mlq').forEach(function(d){ d.style.display = !c || d.getAttribute('data-cat') === c ? '' : 'none'; });
      });
    });
    var practice = document.getElementById('mlPractice');
    function setPractice(on){
      root.querySelectorAll('.mlq').forEach(function(d){
        d.querySelector('.mlanswers').hidden = on; d.querySelector('.mlreveal').hidden = !on;
      });
    }
    try { practice.checked = localStorage.getItem('prep:mlPractice') === '1'; } catch(e){}
    setPractice(practice.checked);
    practice.addEventListener('change', function(){ try { localStorage.setItem('prep:mlPractice', practice.checked ? '1' : '0'); } catch(e){} setPractice(practice.checked); });
    root.querySelectorAll('.mlreveal').forEach(function(b){
      b.addEventListener('click', function(){ b.parentNode.querySelector('.mlanswers').hidden = false; b.hidden = true; });
    });
  }

  // ---------- Focus tab (content/focus.json) ----------
  var FOCUS_BY_SLUG = {};
  window.prepFocusFor = function(slug){ return FOCUS_BY_SLUG[slug] || null; };
  window.prepMdLite = function(t){ return mdLite(t); };

  function renderFocus(F, D){
    var root = document.getElementById('focusRoot');
    if (!root) return;
    if (!F || !(F.items || []).length) { root.innerHTML = '<p class="note">No focus items. Add them to <code>content/focus.json</code>.</p>'; return; }
    var have = {}; D.problems.forEach(function(p){ have[p.slug] = p; });
    var byId = {};
    F.items = F.items.map(designOf);
    F.items.forEach(function(it){
      byId[it.id] = it;
      (it.slugs || []).forEach(function(s){ if (!FOCUS_BY_SLUG[s]) FOCUS_BY_SLUG[s] = it; });
    });
    var slugs = Object.keys(FOCUS_BY_SLUG).filter(function(s){ return have[s]; });

    function practiceButtons(it){
      var b = (it.slugs || []).map(function(s){
        if (!have[s]) return '<span class="note">(' + esc(s) + ' isn\'t in problems.json — run build_prep.py)</span>';
        var p = have[s];
        return '<button type="button" class="fprac" data-open="' + esc(s) + '"><span class="fst" data-st="' + esc(s) + '"></span>' +
               esc(p.title) + ' <span class="diff ' + esc(p.d.toLowerCase()) + '">' + esc(p.d) + '</span>' +
               (p.tests.length ? ' <span class="note">' + p.tests.length + ' tests</span>' : '') + ' ▸</button>';
      }).join('');
      return b ? '<div class="fpracs"><b>Practice in the editor:</b>' + b + '</div>' : '';
    }

    var html = '<p class="note">' + esc(F.intro || '') + '</p>';
    html += '<div class="fbar"><span id="fprog"></span><div class="bar"><i id="fbar"></i></div>' +
            '<label class="mlpractice"><input type="checkbox" id="fPractice"> Practice mode (hide solutions until you click)</label></div>';
    // the interview reports, round by round
    html += '<div class="freports">' + (F.reports || []).map(function(r){
      return '<div class="freport"><div class="frt">' + esc(r.title) + '</div><div class="note">' + esc(r.date) + ' · ' + esc(r.where) + '</div><ol>' +
        r.rounds.map(function(rd){
          return '<li><b>' + esc(rd.name) + '</b>' + (rd.note ? '<div class="note">' + esc(rd.note) + '</div>' : '') +
            '<div class="flinks">' + rd.items.map(function(id){
              return byId[id] ? '<a href="#f-' + esc(id) + '" class="flink" data-id="' + esc(id) + '">' + esc(byId[id].title) + '</a>' : '';
            }).join('') + '</div></li>';
        }).join('') + '</ol></div>';
    }).join('') + '</div>';
    // sections
    var sections = [];
    F.items.forEach(function(it){ if (sections.indexOf(it.section) === -1) sections.push(it.section); });
    sections.forEach(function(sec){
      html += '<h3 class="fsec">' + esc(sec) + '</h3>';
      html += F.items.filter(function(it){ return it.section === sec; }).map(function(it){
        return '<details class="sdq mlq fitem" id="f-' + esc(it.id) + '">' +
          '<summary>' + esc(it.title) + '<span class="fsum" data-sum="' + esc(it.id) + '"></span></summary><div class="body">' +
          '<blockquote class="mlquestion">' + mdInline(it.question) + (it.source ? '<div class="note">' + esc(it.source) + '</div>' : '') + '</blockquote>' +
          practiceButtons(it) +
          '<div class="mlanswers">' +
            (it.short ? '<div class="mlshort"><b>' + (sec === 'Coding' ? 'Solution in short' : '60-second answer') + '</b><p>' + mdInline(it.short) + '</p></div>' : '') +
            '<div class="mlfull">' + mdLite(it.answer) + '</div>' +
            ((it.followups || []).length ? '<h4>Likely follow-ups</h4><ul>' + it.followups.map(function(f){ return '<li>' + mdInline(f) + '</li>'; }).join('') + '</ul>' : '') +
          '</div>' +
          '<button type="button" class="btn ghost sm mlreveal" hidden>Show solution</button>' +
          '</div></details>';
      }).join('');
    });
    root.innerHTML = html;

    root.addEventListener('click', function(e){
      var b = e.target.closest('[data-open]');
      if (b) { var t = document.querySelector('button.ptitle[data-pid="' + b.getAttribute('data-open') + '"]'); if (t) t.click(); return; }
      var l = e.target.closest('.flink');
      if (l) { var d = document.getElementById('f-' + l.getAttribute('data-id')); if (d) d.open = true; }
      var r = e.target.closest('.mlreveal');
      if (r) { r.parentNode.querySelector('.mlanswers').hidden = false; r.hidden = true; }
    });
    var practice = document.getElementById('fPractice');
    function setPractice(on){
      root.querySelectorAll('.fitem').forEach(function(d){ d.querySelector('.mlanswers').hidden = on; d.querySelector('.mlreveal').hidden = !on; });
    }
    try { practice.checked = localStorage.getItem('prep:focusPractice') === '1'; } catch(e){}
    setPractice(practice.checked);
    practice.addEventListener('change', function(){ try { localStorage.setItem('prep:focusPractice', practice.checked ? '1' : '0'); } catch(e){} setPractice(practice.checked); });

    // status chips + progress, refreshed whenever progress changes
    var LABEL = { done: '✓ Done', passed: '✓ Passing', attempted: 'Tried' };
    function refresh(){
      var done = 0;
      slugs.forEach(function(s){
        var row = document.querySelector('#ptable tr[data-pid="' + s + '"]');
        var st = row ? row.getAttribute('data-status') || '' : '';
        if (st === 'done') done++;
        root.querySelectorAll('[data-st="' + s + '"]').forEach(function(el){ el.textContent = LABEL[st] || ''; el.className = 'fst' + (st ? ' st-' + st : ''); });
      });
      F.items.forEach(function(it){
        var ss = (it.slugs || []).filter(function(s){ return have[s]; }); if (!ss.length) return;
        var n = ss.filter(function(s){ var row = document.querySelector('#ptable tr[data-pid="' + s + '"]'); return row && row.getAttribute('data-status') === 'done'; }).length;
        var el = root.querySelector('[data-sum="' + it.id + '"]'); if (el) el.textContent = ' · ' + n + '/' + ss.length + ' done';
      });
      document.getElementById('fprog').textContent = done + ' / ' + slugs.length + ' focus problems done';
      document.getElementById('fbar').style.width = (slugs.length ? 100 * done / slugs.length : 0) + '%';
    }
    var prev = window.prepUpdate;
    window.prepUpdate = function(){ if (prev) prev(); refresh(); };
    refresh();
  }

  // ---------- System design tab (content/system_design.json) ----------
  function renderSD(SDD){
    var root = document.getElementById('sdRoot');
    if (!root) return;
    var ds = (SDD && SDD.designs) || [];
    if (!ds.length) { root.innerHTML = '<p class="note">No designs found. Run <code>python3 build_prep.py</code> or add <code>content/system_design.json</code>.</p>'; return; }
    var TAGS = SDD.tags || {};
    var order = Object.keys(TAGS);
    var chips = '<div class="mlcats"><button type="button" class="pchip on" data-tag="">All (' + ds.length + ')</button>' + order.map(function(t){
      var n = ds.filter(function(d){ return (d.tags || []).indexOf(t) !== -1; }).length;
      return n ? '<button type="button" class="pchip" data-tag="' + esc(t) + '">' + esc(TAGS[t]) + ' (' + n + ')</button>' : '';
    }).join('') + '<label class="mlpractice"><input type="checkbox" id="sdPractice"> Practice mode (hide the design until you click)</label></div>';
    var toc = '<div class="sdtoc">' + ds.map(function(d, i){
      return '<a href="#sd-' + esc(d.id) + '" class="flink" data-id="' + esc(d.id) + '">' + (i + 1) + '. ' + esc(d.title) + '</a>';
    }).join('') + '</div>';
    root.innerHTML = chips + toc + ds.map(function(d, i){
      return '<details class="sdq mlq sditem" id="sd-' + esc(d.id) + '" data-tags="' + esc((d.tags || []).join(' ')) + '">' +
        '<summary>' + (i + 1) + '. ' + esc(d.title) + (d.tags || []).map(function(t){ return ' <span class="tag">' + esc(TAGS[t] || t) + '</span>'; }).join('') + '</summary>' +
        '<div class="body">' +
          '<blockquote class="mlquestion">' + mdInline(d.question || '') + '</blockquote>' +
          '<div class="mlanswers">' +
            (d.short ? '<div class="mlshort"><b>60-second version</b><p>' + mdInline(d.short) + '</p></div>' : '') +
            '<div class="mlfull">' + mdLite(d.answer) + '</div>' +
            ((d.followups || []).length ? '<h4>Likely follow-ups</h4><ul>' + d.followups.map(function(f){ return '<li>' + mdInline(f) + '</li>'; }).join('') + '</ul>' : '') +
          '</div>' +
          '<button type="button" class="btn ghost sm mlreveal" hidden>Show design</button>' +
        '</div></details>';
    }).join('');
    root.addEventListener('click', function(e){
      var c = e.target.closest('.mlcats .pchip');
      if (c) {
        var t = c.getAttribute('data-tag');
        root.querySelectorAll('.mlcats .pchip').forEach(function(x){ x.classList.toggle('on', x === c); });
        root.querySelectorAll('.sditem').forEach(function(d){ d.style.display = !t || (' ' + d.getAttribute('data-tags') + ' ').indexOf(' ' + t + ' ') !== -1 ? '' : 'none'; });
        root.querySelectorAll('.sdtoc .flink').forEach(function(a){ var d = document.getElementById('sd-' + a.getAttribute('data-id')); a.style.display = d.style.display; });
        return;
      }
      var l = e.target.closest('.sdtoc .flink');
      if (l) { var d = document.getElementById('sd-' + l.getAttribute('data-id')); if (d) d.open = true; return; }
      var r = e.target.closest('.mlreveal');
      if (r) { r.parentNode.querySelector('.mlanswers').hidden = false; r.hidden = true; }
    });
    var practice = document.getElementById('sdPractice');
    function setPractice(on){
      root.querySelectorAll('.sditem').forEach(function(d){ d.querySelector('.mlanswers').hidden = on; d.querySelector('.mlreveal').hidden = !on; });
    }
    try { practice.checked = localStorage.getItem('prep:sdPractice') === '1'; } catch(e){}
    setPractice(practice.checked);
    practice.addEventListener('change', function(){ try { localStorage.setItem('prep:sdPractice', practice.checked ? '1' : '0'); } catch(e){} setPractice(practice.checked); });
  }

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
      'Ctrl-Enter': function(){ run(); }, 'Cmd-Enter': function(){ run(); },
      'Shift-Ctrl-Enter': function(){ runOnce(); }, 'Shift-Cmd-Enter': function(){ runOnce(); }
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
    verEdited();
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
    $('mEdit').hidden = !p.custom;
    var fItem = window.prepFocusFor ? window.prepFocusFor(pid) : null;
    $('mSolTab').hidden = !fItem;
    if (fItem) {
      $('mSol').innerHTML = '<div class="mlshort"><b>Solution in short</b><p>' + esc(fItem.short || '') + '</p></div>' + window.prepMdLite(fItem.answer) +
        ((fItem.followups || []).length ? '<h4>Likely follow-ups</h4><ul>' + fItem.followups.map(function(f){ return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '');
    } else if (!$('paneSol').hidden) {
      document.querySelector('.tab[data-tab="prob"]').click();
    }
    $('mLink').parentNode.style.display = p.link ? '' : 'none';
    $('mFullRefresh').hidden = !!p.custom;
    if (p.summary) { $('mSummary').textContent = p.summary; }
    else if (p.custom) { $('mSummary').innerHTML = 'No summary yet — click <b>Edit problem</b> (top right) to add one, plus the full problem and tests.'; }
    else { $('mSummary').innerHTML = 'No summary written for this one yet — use <b>Open on LeetCode</b> below for the full statement and method signature. (You can add a summary, hint and tests in <code>content/problems.json</code>.)'; }
    $('mExample').textContent = p.example || '';
    $('mExample').parentNode.style.display = p.example ? '' : 'none';
    loadStatement(pid, false);
    setupRunInput(p);
    loadVersions(pid);
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
  $('mEdit').addEventListener('click', function(){ if (cur && window.prepEditCustom) window.prepEditCustom(cur); });
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
    if (cur) { syncRunInput(); loadVersions(cur); }
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
      $('paneSol').hidden = t.getAttribute('data-tab') !== 'sol';
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
    if (PD[pid] && PD[pid].custom) {
      var c = PD[pid].custom;
      body.innerHTML = PD[pid].full ? sanitize(PD[pid].full) : '<p class="msg">No full problem written yet. Click <b>Edit problem</b> to add it.</p>';
      srcEl.textContent = '· added by you' + (c.source ? ' — ' + c.source : '');
      if (PD[pid].full) $('mExample').parentNode.style.display = PD[pid].example ? '' : 'none';
      fitMore(); return;
    }
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
        noteRunForVersion({ ok: passed, total: p.tests.length, at: new Date().toISOString() });
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

  // ---------- named versions (solutions/<slug>/<name>.<ext>) ----------
  var VERS = [], curVer = null, lastRun = null, verArmed = null, delArmed = false;
  function verOf(name){ return VERS.filter(function(v){ return v.lang === lang && v.name === name; })[0]; }
  function fmtWhen(iso){ try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch(e){ return ''; } }
  function verLabel(v){
    var r = v.result ? (v.result.total ? (v.result.ok === v.result.total ? ' · ✓ ' : ' · ✗ ') + v.result.ok + '/' + v.result.total : '') : ' · not run';
    return v.name + r + ' · ' + fmtWhen(v.updated || v.saved) + (v.note ? ' — ' + v.note : '');
  }
  function renderVersions(){
    var mine = VERS.filter(function(v){ return v.lang === lang; });
    var sel = $('mVerSel');
    sel.innerHTML = '<option value="">Draft (autosaved)</option>' + mine.map(function(v){
      return '<option value="' + esc(v.name) + '">' + esc(verLabel(v)) + '</option>'; }).join('');
    if (!curVer) { var same = mine.filter(function(v){ return v.code === cm.getValue(); })[0]; if (same) curVer = same.name; }
    sel.value = curVer && verOf(curVer) ? curVer : '';
    if (!verOf(curVer)) curVer = null;
    $('mVerDel').hidden = !curVer;
    verEdited();
  }
  function loadVersions(pid){
    VERS = []; curVer = null; verArmed = null; delArmed = false; lastRun = null;
    $('mVerNew').hidden = true; $('mVerSave').hidden = false; $('mVerMsg').textContent = ''; $('mVerMsg').className = 'note';
    if (!SERVER) { $('mVerSel').innerHTML = '<option>Draft (autosaved)</option>'; $('mVerSel').disabled = true; $('mVerSave').disabled = true;
                   $('mVerMsg').textContent = 'Start prep_server.py to save named versions.'; return; }
    $('mVerSel').disabled = false; $('mVerSave').disabled = false;
    api('/versions?id=' + encodeURIComponent(pid)).then(function(r){ if (cur !== pid) return; VERS = r.versions || []; renderVersions(); }).catch(function(){});
  }
  function verEdited(){
    var v = verOf(curVer), msg = $('mVerMsg');
    if (v && v.code !== cm.getValue()) { msg.textContent = 'Edited since saved — Save as version to update “' + v.name + '”, or pick a new name.'; msg.className = 'note warn'; }
    else if (msg.className.indexOf('warn') !== -1) { msg.textContent = ''; msg.className = 'note'; }
  }
  function draftIsUnsaved(){
    var code = cm.getValue(), p = PD[cur];
    if (!code.trim() || code === starter(p, lang)) return false;
    return !VERS.some(function(v){ return v.lang === lang && v.code === code; });
  }
  function setDraft(code){
    cm.setValue(code); cm.clearHistory();
    sset(key(cur, lang), code);
    if (SERVER) api('/save', { id: cur, lang: lang, code: code }).catch(function(){});
  }
  $('mVerSel').addEventListener('change', function(){
    var name = $('mVerSel').value, msg = $('mVerMsg');
    if (!name) { curVer = null; $('mVerDel').hidden = true; msg.textContent = 'Editing the draft. Load a version from this menu any time.'; msg.className = 'note'; return; }
    var v = verOf(name); if (!v) return;
    if (v.code !== cm.getValue() && draftIsUnsaved() && verArmed !== name) {
      verArmed = name;
      msg.textContent = 'Your current code isn’t saved as a version. Pick “' + name + '” again to replace it, or Save it as a version first.'; msg.className = 'note warn';
      $('mVerSel').value = curVer || ''; return;
    }
    verArmed = null; curVer = name; setDraft(v.code);
    $('mVerDel').hidden = false; delArmed = false; $('mVerDel').textContent = 'Delete';
    msg.textContent = 'Loaded “' + name + '”' + (v.result && v.result.total ? ' — last result ' + v.result.ok + '/' + v.result.total : '') + '.'; msg.className = 'note';
  });
  $('mVerSave').addEventListener('click', function(){
    var mine = VERS.filter(function(v){ return v.lang === lang; });
    var cv = verOf(curVer);
    $('mVerName').value = cv ? cv.name : 'v' + (mine.length + 1);
    $('mVerNote').value = cv && cv.note ? cv.note : '';
    $('mVerNew').hidden = false; $('mVerSave').hidden = true; $('mVerName').focus(); $('mVerName').select();
  });
  function closeNew(){ $('mVerNew').hidden = true; $('mVerSave').hidden = false; }
  $('mVerName').addEventListener('input', function(){
    var cv = verOf(curVer);
    if (cv && cv.note && $('mVerNote').value === cv.note && $('mVerName').value.trim().toLowerCase() !== cv.name) $('mVerNote').value = '';
  });
  $('mVerCancel').addEventListener('click', closeNew);
  function saveVersion(){
    var name = $('mVerName').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    if (!name) { $('mVerMsg').textContent = 'Give the version a name (letters, digits, dashes).'; $('mVerMsg').className = 'note warn'; return; }
    var code = cm.getValue(), body = { id: cur, lang: lang, name: name, code: code, note: $('mVerNote').value.trim() };
    if (lastRun && lastRun.code === code && lastRun.lang === lang) body.result = { ok: lastRun.ok, total: lastRun.total, at: lastRun.at };
    var existed = !!verOf(name);
    api('/versions/save', body).then(function(r){
      VERS = r.versions || []; curVer = name; closeNew(); renderVersions();
      $('mVerMsg').textContent = (existed ? 'Updated “' : 'Saved “') + name + '” to solutions/' + cur + '/' + name + (lang === 'java' ? '.java' : '.py');
      $('mVerMsg').className = 'note';
    }).catch(function(e){ $('mVerMsg').textContent = 'Could not save: ' + e.message; $('mVerMsg').className = 'note warn'; });
  }
  $('mVerOk').addEventListener('click', saveVersion);
  ['mVerName', 'mVerNote'].forEach(function(id){
    $(id).addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); saveVersion(); } if (e.key === 'Escape') { e.stopPropagation(); closeNew(); } });
  });
  $('mVerDel').addEventListener('click', function(){
    if (!curVer) return;
    if (!delArmed) { delArmed = true; $('mVerDel').textContent = 'Click again to delete “' + curVer + '”'; setTimeout(function(){ delArmed = false; $('mVerDel').textContent = 'Delete'; }, 3000); return; }
    var name = curVer;
    api('/versions/delete', { id: cur, lang: lang, name: name }).then(function(r){
      VERS = r.versions || []; curVer = null; delArmed = false; $('mVerDel').textContent = 'Delete'; renderVersions();
      $('mVerMsg').textContent = 'Deleted “' + name + '”. The code is still in the editor as your draft.'; $('mVerMsg').className = 'note';
    }).catch(function(){});
  });
  function noteRunForVersion(res){
    var code = cm.getValue();
    lastRun = { ok: res.ok, total: res.total, at: res.at, code: code, lang: lang };
    var v = verOf(curVer);
    if (v && v.code === code && SERVER) {
      api('/versions/result', { id: cur, lang: lang, name: v.name, result: { ok: res.ok, total: res.total, at: res.at } })
        .then(function(r){ VERS = r.versions || VERS; renderVersions(); }).catch(function(){});
    }
  }

  // ---------- Run once (no grading): single test, custom input, or just your code ----------
  function paramList(p){
    var m = (p.run && p.run.java || '').match(/\(([^)]*)\)/);
    return m && m[1].trim() ? m[1].split(',').map(function(x){ return x.trim(); }) : [];
  }
  function setupRunInput(p){
    var sel = $('mRunSel'), opts = [], meta = p.run || {};
    if (p.tests.length) opts.push(['t0', 'Test 1: ' + shortLab(p.tests[0][0])]);
    if (meta.kind === 'method') opts.push(['custom', 'Custom input…']);
    p.tests.forEach(function(t, i){ if (i > 0) opts.push(['t' + i, 'Test ' + (i + 1) + ': ' + shortLab(t[0])]); });
    opts.push(['none', 'No input — just run my code (main / prints)']);
    sel.innerHTML = opts.map(function(o){ return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('');
    var saved = sget('prep:runsel:' + cur);
    if (saved && opts.some(function(o){ return o[0] === saved; })) sel.value = saved;
    var argsSaved = sget('prep:runargs:' + cur);
    $('mRunArgs').value = argsSaved != null ? argsSaved : (meta.sample ? JSON.stringify(meta.sample) : '[]');
    syncRunInput();
  }
  function shortLab(l){ l = String(l).replace(/\s+— .*$/, ''); return l.length > 70 ? l.slice(0, 67) + '…' : l; }
  function syncRunInput(){
    var p = PD[cur], v = $('mRunSel').value, params = paramList(p);
    $('mRunArgs').hidden = v !== 'custom';
    $('mRunHint').textContent = v === 'custom' ? 'JSON list of arguments: ' + params.join(', ') + (p.run.ptypes.indexOf('tree') !== -1 ? ' (trees in level order with null)' : '') :
      (v === 'none' ? (lang === 'java' ? 'Runs your class\'s public static void main(String[] args), if you add one.' : 'Runs your file as-is: put print(...) calls at the bottom.') : 'Shows your prints, the return value and the expected answer.');
  }
  $('mRunSel').addEventListener('change', function(){ sset('prep:runsel:' + cur, $('mRunSel').value); syncRunInput(); });
  $('mRunArgs').addEventListener('input', function(){ sset('prep:runargs:' + cur, $('mRunArgs').value); });
  $('mRunArgs').addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); runOnce(); } });
  $('mRunOnce').addEventListener('click', runOnce);

  function jlit(v, t){
    function list(a, f){ return a.map(f).join(', '); }
    switch (t) {
      case 'int': return String(v);
      case 'long': return String(v) + 'L';
      case 'double': var d = String(v); return /[.eE]/.test(d) ? d : d + '.0';
      case 'bool': return v ? 'true' : 'false';
      case 'str': return JSON.stringify(String(v));
      case 'int[]': return 'new int[]{' + list(v, String) + '}';
      case 'int[][]': return 'new int[][]{' + list(v, function(r){ return '{' + list(r, String) + '}'; }) + '}';
      case 'char[][]': return 'new char[][]{' + list(v, function(r){ return '{' + list(r, function(c){ return "'" + (c === "'" || c === '\\' ? '\\' + c : String(c)) + "'"; }) + '}'; }) + '}';
      case 'str[]': return 'new String[]{' + list(v, function(x){ return JSON.stringify(String(x)); }) + '}';
      case 'robot': return 'new Robot(' + jlit(v[0], 'int[][]') + ', ' + v[1][0] + ', ' + v[1][1] + ')';
      case 'char': var ch = String(v); return "'" + (ch === "'" || ch === '\\' ? '\\' + ch : ch) + "'";
      case 'char[]': return 'new char[]{' + list(v, function(c){ return jlit(c, 'char'); }) + '}';
      case 'list<int>': return '__li(' + jlit(v, 'int[]') + ')';
      case 'list<str>': return '__ls(' + jlit(v, 'str[]') + ')';
      case 'list<list<int>>': return '__lli(' + jlit(v, 'int[][]') + ')';
      case 'tree': return 'T(new Integer[]{' + list(v, function(x){ return x === null ? 'null' : String(x); }) + '})';
      case 'list': return 'L(' + jlit(v, 'int[]') + ')';
      case 'list[]': return 'new ListNode[]{' + list(v, function(x){ return jlit(x, 'list'); }) + '}';
      case 'cyclelist': return 'LC(' + jlit(v[0], 'int[]') + ', ' + v[1] + ')';
      case 'nested': var obj = function(e){ return typeof e === 'number' ? String(e) : 'new Object[]{' + list(e, obj) + '}'; }; return 'NL(' + obj(v) + ')';
    }
    throw new Error('unsupported type ' + t);
  }
  function checkArg(v, t){
    var isInt = function(x){ return typeof x === 'number' && Math.floor(x) === x; };
    var ok = {
      'int': isInt(v), 'long': isInt(v), 'double': typeof v === 'number', 'bool': typeof v === 'boolean', 'str': typeof v === 'string',
      'int[]': Array.isArray(v) && v.every(isInt), 'list': Array.isArray(v) && v.every(isInt),
      'int[][]': Array.isArray(v) && v.every(function(r){ return Array.isArray(r) && r.every(isInt); }),
      'list[]': Array.isArray(v) && v.every(function(r){ return Array.isArray(r) && r.every(isInt); }),
      'char[][]': Array.isArray(v) && v.every(function(r){ return Array.isArray(r) && r.every(function(c){ return typeof c === 'string' && c.length === 1; }); }),
      'str[]': Array.isArray(v) && v.every(function(x){ return typeof x === 'string'; }),
      'list<str>': Array.isArray(v) && v.every(function(x){ return typeof x === 'string'; }),
      'list<int>': Array.isArray(v) && v.every(isInt),
      'list<list<int>>': Array.isArray(v) && v.every(function(r){ return Array.isArray(r) && r.every(isInt); }),
      'char': typeof v === 'string' && v.length === 1,
      'robot': Array.isArray(v) && v.length === 2 && Array.isArray(v[0]) && Array.isArray(v[1]),
      'char[]': Array.isArray(v) && v.every(function(c){ return typeof c === 'string' && c.length === 1; }),
      'tree': Array.isArray(v) && v.every(function(x){ return x === null || isInt(x); }),
      'cyclelist': Array.isArray(v) && v.length === 2 && Array.isArray(v[0]) && isInt(v[1]),
      'nested': Array.isArray(v)
    }[t];
    return ok !== false;
  }
  function onlyTests(src, keepIndex, isJava, extraLine){
    var re = isJava ? /^\s*__t\(/ : /^_t\(/, n = -1;
    var lines = src.split('\n').filter(function(l){
      if (!re.test(l)) return true;
      n++; return n === keepIndex;
    });
    var out = lines.join('\n');
    if (extraLine) {
      if (isJava) out = out.replace('public static void main(String[] args) {\n', 'public static void main(String[] args) {\n' + extraLine + '\n');
      else out += '\n' + extraLine + '\n';
    }
    return out;
  }
  function runOnce(){
    if (!cur) return;
    var out = $('mOut'), p = PD[cur], v = $('mRunSel').value, isJava = lang === 'java';
    if (!SERVER) { run(); return; }
    if (isJava && SH.hasJava === false) { run(); return; }
    var post = isJava ? expand(p.java_post) : expand(p.py_post), pre = isJava ? '' : expand(p.py_pre);
    var expected = null, what = '';
    if (v === 'none') { post = onlyTests(post, -1, isJava); what = 'your code (no input)'; }
    else if (v === 'custom') {
      var args, meta = p.run;
      try { args = JSON.parse($('mRunArgs').value); } catch (e) { out.innerHTML = '<div class="res fail"><b>Custom input isn\'t valid JSON.</b> Use a list of arguments, e.g. <code>' + esc(JSON.stringify(meta.sample || [])) + '</code></div>'; return; }
      if (!Array.isArray(args) || args.length !== meta.ptypes.length) { out.innerHTML = '<div class="res fail"><b>Expected ' + meta.ptypes.length + ' argument' + (meta.ptypes.length > 1 ? 's' : '') + ':</b> ' + esc(paramList(p).join(', ')) + '. Wrap them in a list, e.g. <code>' + esc(JSON.stringify(meta.sample || [])) + '</code></div>'; return; }
      for (var i = 0; i < args.length; i++) if (!checkArg(args[i], meta.ptypes[i])) { out.innerHTML = '<div class="res fail"><b>Argument ' + (i + 1) + ' should be ' + esc(paramList(p)[i] || meta.ptypes[i]) + '.</b></div>'; return; }
      var label = 'custom: ' + meta.name + '(' + args.map(function(a){ return JSON.stringify(a); }).join(', ') + ')';
      var wrapPy = meta.rtype === 'list' ? '_LA' : '', wrapJ = meta.rtype === 'list' ? '__LA' : '';
      var line = isJava
        ? '        __t(' + JSON.stringify(label) + ', () -> ' + wrapJ + '(new Solution().' + meta.name + '(' + args.map(function(a, i){ return jlit(a, meta.ptypes[i]); }).join(', ') + ')), "null", ' + JSON.stringify(meta.mode) + ');'
        : '_t(' + JSON.stringify(label) + ', lambda: ' + wrapPy + '(Solution().' + meta.name + '(' + args.map(function(a, i){ return '_conv(_json.loads(' + JSON.stringify(JSON.stringify(a)) + '), ' + JSON.stringify(meta.ptypes[i]) + ')'; }).join(', ') + ')), "null", ' + JSON.stringify(meta.mode) + ')';
      post = onlyTests(post, -1, isJava, line); what = 'your custom input';
    } else {
      var idx = +v.slice(1); expected = p.tests[idx][1];
      post = onlyTests(post, idx, isJava); what = 'test ' + (idx + 1);
    }
    var btn = $('mRunOnce'); btn.disabled = true; btn.textContent = 'Running…';
    out.innerHTML = '<div class="outhint">' + (isJava ? 'Compiling and running ' : 'Running ') + esc(what) + '…</div>';
    api('/run', { lang: lang, code: cm.getValue(), pre: pre, post: post }).then(function(r){
      btn.disabled = false; btn.textContent = 'Run ▷';
      if (r.compile_error) { out.innerHTML = '<div class="sum fail">Compile error</div><pre>' + esc(r.compile_error) + '</pre>'; return; }
      var results = [], user = [];
      (r.stdout || '').split('\n').forEach(function(l){ if (l.indexOf('@@R ') === 0) { try { results.push(JSON.parse(l.slice(4))); } catch(e){} } else user.push(l); });
      while (user.length && user[user.length - 1] === '') user.pop();
      var html = '<div class="outhint">Ran ' + esc(what) + ' — not graded, progress unchanged.</div>';
      html += '<h4>Your output' + (user.length ? '' : ' <span class="note">(nothing printed)</span>') + '</h4>' + (user.length ? '<pre class="uout">' + esc(user.join('\n')) + '</pre>' : '');
      var x = results[0];
      if (x) {
        var lab = String(x.label).replace(/^custom: /, '').replace(/\s+— .*$/, '');
        if (x.err) html += '<div class="retval fail"><b>Exception</b> in <code>' + esc(lab) + '</code><pre>' + esc(x.err) + '</pre></div>';
        else html += '<div class="retval"><div><code>' + esc(lab) + '</code></div><b>Returned:</b><pre>' + esc(x.got) + '</pre>' +
          (expected != null ? '<b>Expected:</b> <span class="' + (x.ok ? 'sum pass' : 'sum fail') + '">' + (x.ok ? '✓ match' : '✗ different') + '</span><pre>' + esc(expected) + '</pre>' : '') + '</div>';
      }
      if (r.timeout) html += '<div class="res fail"><b>Time limit:</b> ' + esc(r.stderr) + '</div>';
      else if (r.stderr && r.stderr.trim()) html += '<h4>Errors</h4><pre>' + esc(r.stderr.trim().split('\n').slice(-25).join('\n')) + '</pre>';
      out.innerHTML = html;
    }).catch(function(e){
      btn.disabled = false; btn.textContent = 'Run ▷';
      out.innerHTML = '<div class="res fail"><b>Could not reach the local runner.</b> (' + esc(e.message) + ')</div>';
    });
  }

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
  // ======== type-aware member suggestions ========
  // For `expr.` work out the type of expr (a variable, this/super, new T(...), a cast, a chain like
  // map.get(k).next, an array element, a lambda parameter, ...) and list that type's members. Types come from
  // the classes the problem provides (Robot, ListNode, TreeNode, ...), the classes in your own code (nested,
  // generic, anonymous, subclasses, including subclasses of JDK classes) and the JDK / Python built-ins.
  var provCache = {};
  function provSrc(l){
    var p = cur && PD[cur]; if (!p) return '';
    return expand(l === 'java' ? (p.java_post || '') : (p.py_pre || ''));
  }
  function provClasses(l){
    var k = cur + '|' + l;
    if (!provCache[k]) {
      var cls = l === 'java' ? javaClasses(provSrc(l), false) : pyClasses(provSrc(l), false);
      delete cls.Main; delete cls.Solution;          // the test harness, not something you call
      provCache[k] = cls;
    }
    return provCache[k];
  }
  function classTable(l, mine){                       // provided classes + yours (yours win)
    var all = {}, prov = provClasses(l);
    Object.keys(prov).forEach(function(k){ all[k] = prov[k]; });
    Object.keys(mine).forEach(function(k){ all[k] = mine[k]; });
    return all;
  }
  function blank(s){ return s.replace(/[^\n]/g, ' '); }
  function escRe(s){ return s.replace(/[$]/g, '\\$'); }
  function matchBack(s, i, open, close){              // s[i] is `close`; index of the matching `open`, or -1
    for (var d = 0; i >= 0; i--) { var ch = s[i]; if (ch === close) d++; else if (ch === open && --d === 0) return i; }
    return -1;
  }
  function matchFwd(s, i, open, close){               // s[i] is `open`; index of the matching `close`, or s.length
    for (var d = 0; i < s.length; i++) { var ch = s[i]; if (ch === open) d++; else if (ch === close && --d === 0) return i; }
    return s.length;
  }
  function splitArgs(s){                              // split on commas outside () [] {} <>
    var out = [], d = 0, last = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if ('([{<'.indexOf(ch) >= 0) d++;
      else if (')]}>'.indexOf(ch) >= 0) { if (!(ch === '>' && s[i - 1] === '-')) d = Math.max(0, d - 1); }
      else if (ch === ',' && d === 0) { out.push(s.slice(last, i).trim()); last = i + 1; }
    }
    out.push(s.slice(last).trim());
    return out.filter(Boolean);
  }
  function copyOf(x, extra){ var y = {}; Object.keys(x).forEach(function(k){ y[k] = x[k]; }); Object.keys(extra || {}).forEach(function(k){ y[k] = extra[k]; }); return y; }
  function memberItems(members, statics){             // statics: true = only static, false = no static, null = all
    var seen = {}, out = [];
    members.forEach(function(x){
      if (statics != null && !!x.isStatic !== statics) return;
      var key = x.kind + x.name + '(' + (x.params || '') + ')'; if (seen[key]) return; seen[key] = 1;
      out.push({ m: [(x.isStatic ? 'static ' : '') + x.name + (x.kind === 'm' ? '(' + (x.params || '') + ')' : ''), x.type || '', x.desc || '', x.cx || ''], cls: x.cls });
    });
    return out;
  }

  // ---------------- Java ----------------
  function stripJava(src){                            // blank out comments and string/char contents, keeping offsets
    return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])+'/g, function(s){
      return s.charAt(0) === '/' ? blank(s) : s.charAt(0) + blank(s.slice(1, -1)) + s.charAt(s.length - 1);
    });
  }
  var JMOD = '(?:(?:public|protected|private|static|final|abstract|synchronized|native|default|transient|volatile|strictfp|sealed)\\s+)*';
  var JGEN = '<(?:[^<>;{}()]|<(?:[^<>;{}()]|<[^<>;{}()]*>)*>)*>';
  var JTYPE = '[A-Za-z_$][\\w$.]*(?:\\s*' + JGEN + ')?(?:\\s*\\[\\s*\\])*';
  var JMETHOD = new RegExp('^(' + JMOD + ')(?:' + JGEN + '\\s*)?(' + JTYPE + ')\\s+([A-Za-z_$][\\w$]*)\\s*\\(([^()]*)\\)\\s*(?:throws\\s+[\\w$.,\\s]+)?$');
  var JFIELD = new RegExp('^(' + JMOD + ')(' + JTYPE + ')\\s+([A-Za-z_$][\\s\\S]*)$');
  var JPRIM = /^(int|long|short|byte|char|boolean|float|double|void)$/;
  var JNOTTYPE = /^(return|new|throw|throws|case|else|yield|assert|import|package|instanceof|extends|implements|super|this|goto|break|continue|do)$/;
  var JKEYCALL = /^(if|for|while|switch|catch|synchronized|return|throw|case|else|do|try|new|assert)$/;
  // generic type parameter names of the JDK classes in the reference, and a few name aliases
  var JTP = { List: ['E'], ArrayList: ['E'], LinkedList: ['E'], Set: ['E'], HashSet: ['E'], TreeSet: ['E'], Deque: ['E'], ArrayDeque: ['E'],
              Queue: ['E'], PriorityQueue: ['E'], Stack: ['E'], Iterator: ['E'], Collection: ['E'], Iterable: ['T'], Map: ['K', 'V'],
              HashMap: ['K', 'V'], LinkedHashMap: ['K', 'V'], TreeMap: ['K', 'V'], Entry: ['K', 'V'], Comparator: ['T'], Comparable: ['T'], __array__: ['T'] };
  var JALIAS = { NavigableMap: 'TreeMap', SortedMap: 'TreeMap', NavigableSet: 'TreeSet', SortedSet: 'TreeSet', LinkedHashSet: 'HashSet', Vector: 'ArrayList',
                 AbstractMap: 'HashMap', ConcurrentHashMap: 'HashMap', AbstractList: 'ArrayList', AbstractQueue: 'Queue' };
  var JITER = /^(List|ArrayList|LinkedList|Set|HashSet|TreeSet|Deque|ArrayDeque|Queue|PriorityQueue|Stack|Collection|Iterable|Iterator)$/;
  // a few JDK types the reference panel doesn't list but that autocomplete needs (not shown in the panel)
  [{ name: 'Map.Entry', key: 'Entry', pkg: 'java.util', methods: [['getKey()', 'K', 'The key', 'O(1)'], ['getValue()', 'V', 'The value', 'O(1)'], ['setValue(V v)', 'V', 'Replace the value, returns the old one', 'O(1)']] },
   { name: 'Stack', pkg: 'java.util', methods: [['push(E x)', 'E', 'Push on top', 'O(1)'], ['pop()', 'E', 'Remove the top (throws if empty)', 'O(1)'], ['peek()', 'E', 'Top without removing', 'O(1)'], ['empty()', 'boolean', 'Whether empty', 'O(1)'], ['isEmpty()', 'boolean', 'Whether empty', 'O(1)'], ['size()', 'int', 'Number of elements', 'O(1)'], ['get(int i)', 'E', 'Element at index i (0 = bottom)', 'O(1)'], ['search(Object o)', 'int', '1-based distance from the top, or -1', 'O(n)']] },
   { name: 'Comparable', pkg: 'java.lang', methods: [['compareTo(T o)', 'int', 'Negative, zero or positive', '']] },
   { name: 'Collection', pkg: 'java.util', methods: [['size()', 'int', 'Number of elements', 'O(1)'], ['isEmpty()', 'boolean', 'Whether empty', 'O(1)'], ['contains(Object o)', 'boolean', 'Whether present', ''], ['add(E e)', 'boolean', 'Add', ''], ['remove(Object o)', 'boolean', 'Remove one', ''], ['addAll(Collection<? extends E> c)', 'boolean', 'Add all', ''], ['clear()', 'void', 'Remove all', ''], ['iterator()', 'Iterator<E>', 'Iterator', 'O(1)']] },
   { name: 'Iterable', pkg: 'java.lang', methods: [['iterator()', 'Iterator<T>', 'Iterator', 'O(1)']] }
  ].forEach(function(c){ var k = c.key || c.name; if (!JBY[k]) JBY[k] = c; });

  function jParse(t){                                 // 'java.util.Map.Entry<K, List<V>>[]' -> { base: 'Entry', args: ['K', 'List<V>'], dims: 1 }
    t = (t || '').replace(/\s+/g, ' ').trim();
    var dims = 0; while (/\[\s*\]$/.test(t)) { t = t.replace(/\s*\[\s*\]$/, ''); dims++; }
    t = t.replace(/\s*\.\.\.$/, function(){ dims++; return ''; });
    var lt = t.indexOf('<'), args = [];
    if (lt >= 0 && t.charAt(t.length - 1) === '>') { args = splitArgs(t.slice(lt + 1, -1)); t = t.slice(0, lt); }
    args = args.map(function(a){ return a.replace(/^\?\s*(extends|super)\s+/, '').replace(/^\?$/, 'Object'); });
    return { base: t.replace(/\s/g, '').split('.').pop(), args: args, dims: dims };
  }
  function jStripDim(t){ return t.replace(/\s*(\[\s*\]|\.\.\.)\s*$/, ''); }
  function jSubst(t, params, args){                   // replace type parameters (E, K, V, T, ...) with actual type arguments
    if (!t || !params || !params.length || !args || !args.length) return t;
    return t.replace(/[A-Za-z_$][\w$]*/g, function(w){ var i = params.indexOf(w); return i >= 0 && args[i] ? args[i] : w; });
  }
  function jTParams(gen){ return gen ? splitArgs(gen.trim().slice(1, -1)).map(function(p){ return (p.match(/^[A-Za-z_$][\w$]*/) || [''])[0]; }) : []; }
  function jParents(h){
    h = (h || '').replace(/^\s*\([^)]*\)/, '').replace(/\bpermits\b[\s\S]*$/, '');
    var out = [], e = h.match(/\bextends\s+([\s\S]*?)(?=\bimplements\b|$)/), im = h.match(/\bimplements\s+([\s\S]*)$/);
    if (e) out = out.concat(splitArgs(e[1]));
    if (im) out = out.concat(splitArgs(im[1]));
    return out;
  }
  function javaClasses(src, own){                     // every class / interface / enum / record and anonymous class in src
    var out = {}, s = stripJava(src), m;
    var re = new RegExp('\\b(class|interface|enum|record)\\s+([A-Za-z_$][\\w$]*)\\s*(' + JGEN + ')?([^{;]*)\\{|\\bnew\\s+([A-Za-z_$][\\w$.]*\\s*(?:' + JGEN + ')?)\\s*\\(', 'g');
    while ((m = re.exec(s))) {
      var open, cls;
      if (m[1]) {
        open = re.lastIndex - 1;
        cls = { name: m[2], kind: m[1], tparams: jTParams(m[3]), parents: jParents(m[4]), header: m[4] };
      } else {
        var k = matchFwd(s, re.lastIndex - 1, '(', ')') + 1;
        while (k < s.length && /\s/.test(s[k])) k++;
        if (s[k] !== '{') continue;                   // a plain `new T(...)`, not an anonymous class
        open = k;
        cls = { name: '$anon@' + k, kind: 'anon', tparams: [], parents: [m[5].replace(/\s*<\s*>$/, '')], label: 'anonymous ' + jParse(m[5]).base };
      }
      cls.own = own; cls.bodyStart = open; cls.bodyEnd = matchFwd(s, open, '{', '}');
      cls.members = javaMembers(cls, s.slice(open + 1, cls.bodyEnd), own);
      out[cls.name] = cls;                            // the scan continues inside the body, so nested classes are found too
    }
    return out;
  }
  function javaMembers(cls, body, own){
    var top = '', d = 0, i;
    for (i = 0; i < body.length; i++) {               // keep only the body's own level; nested blocks become {}
      var ch = body[i];
      if (ch === '{') { if (d === 0) top += '{}'; d++; } else if (ch === '}') d = Math.max(0, d - 1); else if (d === 0) top += ch;
    }
    top = top.replace(/@[\w$.]+(?:\s*\([^)]*\))?/g, ' ');
    var segs = [], seg = '';
    for (i = 0; i < top.length; i++) {               // declarations end at ';' or at a method / initializer body
      if (top[i] === ';') { segs.push(seg); seg = ''; }
      else if (top[i] === '{' && top[i + 1] === '}') { i++; if (/=|->/.test(seg)) seg += '{}'; else { segs.push(seg); seg = ''; } }
      else seg += top[i];
    }
    segs.push(seg);
    var list = [], desc = own ? 'your class' : 'provided', label = cls.label || cls.name;
    function add(x){ x.cls = label; x.desc = desc; list.push(x); }
    if (cls.kind === 'record') {                      // record P(int x, int y) -> x(), y()
      var rp = (cls.header || '').match(/^\s*\(([^)]*)\)/);
      if (rp) splitArgs(rp[1]).forEach(function(p){ var pm = p.match(/^([\s\S]+?)\s+([A-Za-z_$][\w$]*)$/); if (pm) add({ name: pm[2], kind: 'm', params: '', type: pm[1].trim() }); });
    }
    if (cls.kind === 'enum') {
      splitArgs((segs.shift() || '').replace(/\{\}/g, '')).forEach(function(k){ var km = k.match(/^([A-Za-z_$][\w$]*)/); if (km) add({ name: km[1], kind: 'f', type: cls.name, isStatic: true }); });
      add({ name: 'name', kind: 'm', params: '', type: 'String' }); add({ name: 'ordinal', kind: 'm', params: '', type: 'int' });
    }
    var ctor = new RegExp('^' + JMOD + '(?:' + JGEN + '\\s*)?' + escRe(cls.name) + '\\s*(\\(|$)');
    segs.forEach(function(s){
      s = s.replace(/\s+/g, ' ').trim();
      if (!s || s === 'static' || ctor.test(s) || /\b(class|interface|enum|record)\s+[A-Za-z_$]/.test(s)) return;
      var mm = s.match(JMETHOD);
      if (mm) {
        if (!own && /\bprivate\b/.test(mm[1])) return;
        add({ name: mm[3], kind: 'm', params: mm[4].replace(/\s+/g, ' ').trim(), type: mm[2].replace(/\s+/g, ' '), isStatic: /\bstatic\b/.test(mm[1]) });
        return;
      }
      var fm = s.match(JFIELD);
      if (!fm || JNOTTYPE.test(jParse(fm[2]).base) || (!own && /\bprivate\b/.test(fm[1]))) return;
      var st = /\bstatic\b/.test(fm[1]) || cls.kind === 'interface';
      splitArgs(fm[3]).forEach(function(part){
        var nm = part.match(/^([A-Za-z_$][\w$]*)\s*((?:\[\s*\])*)\s*(?:=|$)/);
        if (nm) add({ name: nm[1], kind: 'f', type: (fm[2] + nm[2]).replace(/\s+/g, ' '), isStatic: st });
      });
    });
    return list;
  }
  function jSelfType(c){ return c.kind === 'anon' || !c.tparams.length ? c.name : c.name + '<' + c.tparams.join(', ') + '>'; }
  function jScopes(classes, pos){                     // your classes whose body contains pos, innermost first
    return Object.keys(classes).map(function(k){ return classes[k]; })
      .filter(function(c){ return c.own && c.bodyStart < pos && pos <= c.bodyEnd; })
      .sort(function(a, b){ return b.bodyStart - a.bodyStart; });
  }
  function jbyMembers(base, args){
    return methodsOf(base).map(function(x){
      var ps = parseSig(x.m[0]);
      return { name: ps.name, kind: ps.params === null ? 'f' : 'm', params: ps.params || '', type: jSubst(x.m[1], JTP[base], args),
               isStatic: ps.isStatic, cls: x.cls, desc: x.m[2], cx: x.m[3], ctor: x.m[1] === '' };
    }).filter(function(x){ return !x.ctor; });
  }
  function jMembers(t, ctx, depth){                   // all members of type t (own + inherited), or null if t is unknown
    depth = depth || 0; if (!t || depth > 8) return null;
    var p = jParse(t), base = JALIAS[p.base] || p.base;
    if (p.dims) return jbyMembers('__array__', [jStripDim(t)]);
    var c = ctx.classes[p.base];
    if (c) {
      var out = c.members.map(function(x){ return copyOf(x, { type: jSubst(x.type, c.tparams, p.args) }); });
      c.parents.forEach(function(par){ out = out.concat(jMembers(jSubst(par, c.tparams, p.args), ctx, depth + 1) || []); });
      return out;
    }
    return JBY[base] ? jbyMembers(base, p.args) : null;
  }
  function jMemberType(t, name, kind, ctx){
    var ms = jMembers(t, ctx) || [];
    for (var i = 0; i < ms.length; i++) if (ms[i].name === name && ms[i].kind === kind && ms[i].type) return ms[i].type;
    return null;
  }
  function jElem(t, ctx, depth){                      // what a for-each over t yields
    depth = depth || 0; if (!t || depth > 8) return null;
    var p = jParse(t), base = JALIAS[p.base] || p.base;
    if (p.dims) return jStripDim(t);
    if (JITER.test(base)) return p.args[0] || null;
    var c = ctx.classes[p.base];
    if (c) for (var i = 0; i < c.parents.length; i++) { var e = jElem(jSubst(c.parents[i], c.tparams, p.args), ctx, depth + 1); if (e) return e; }
    return null;
  }
  function jChain(s, i){                              // parse the expression that ends at s[i - 1], right to left
    var steps = [];
    function ws(){ while (i > 0 && /\s/.test(s[i - 1])) i--; }
    for (var guard = 0; guard < 60; guard++) {
      ws(); if (i <= 0) return null;
      var ch = s[i - 1];
      if (ch === ']') { var ob = matchBack(s, i - 1, '[', ']'); if (ob < 0) return null; i = ob; steps.unshift({ k: 'index' }); continue; }
      if (ch === '}') { var oc = matchBack(s, i - 1, '{', '}'); return oc < 0 ? null : { head: { k: 'block', open: oc }, steps: steps }; }
      if (ch === '"') return { head: { k: 'type', type: 'String' }, steps: steps };
      if (ch === ')') {
        var close = i - 1, open = matchBack(s, close, '(', ')'); if (open < 0) return null;
        i = open; ws();
        var gen = '';
        if (s[i - 1] === '>' && s[i - 2] !== '-') { var go = matchBack(s, i - 1, '<', '>'); if (go < 0) return null; gen = s.slice(go, i); i = go; ws(); }
        var nm = s.slice(Math.max(0, i - 120), i).match(/([A-Za-z_$][\w$]*)$/);
        if (nm && !JKEYCALL.test(nm[1])) {
          var at = i - nm[1].length; i = at; ws();
          if (/(^|[^\w$])new$/.test(s.slice(Math.max(0, i - 4), i))) return { head: { k: 'new', type: nm[1] + gen, close: close, pos: at }, steps: steps };
          if (s[i - 1] === '.') { steps.unshift({ k: 'call', name: nm[1] }); i--; continue; }
          return { head: { k: 'call0', name: nm[1], pos: at }, steps: steps };
        }
        var cast = s.slice(open + 1, close).match(new RegExp('^\\s*\\(\\s*(' + JTYPE + ')\\s*\\)'));
        if (cast && !JPRIM.test(cast[1])) return { head: { k: 'type', type: cast[1] }, steps: steps };
        return { head: { k: 'expr', end: close, pos: open }, steps: steps };
      }
      var id = s.slice(Math.max(0, i - 120), i).match(/([A-Za-z_$][\w$]*)$/);
      if (!id || /^\d/.test(id[1])) return null;
      var start = i - id[1].length; i = start; ws();
      if (s[i - 1] === '.' && !/\d$/.test(s.slice(0, i - 1))) { steps.unshift({ k: 'field', name: id[1] }); i--; continue; }
      return { head: { k: 'name', name: id[1], pos: start }, steps: steps };
    }
    return null;
  }
  function jResolve(s, end, ctx, depth){              // type of the expression ending right before s[end]
    depth = depth || 0; if (depth > 6) return null;
    var ch = jChain(s, end); if (!ch) return null;
    var h = ch.head, t = null, st = false, self = false, sc;
    if (h.k === 'name') {
      if (h.name === 'this') { sc = jScopes(ctx.classes, h.pos)[0]; t = sc && jSelfType(sc); self = true; }
      else if (h.name === 'super') { sc = jScopes(ctx.classes, h.pos)[0]; t = sc && sc.parents[0]; self = true; }
      else {
        t = jVarType(h.name, s, h.pos, ctx, depth);
        if (!t && (ctx.classes[h.name] || JBY[h.name] || JALIAS[h.name])) { t = h.name; st = true; }
      }
    } else if (h.k === 'new') {
      t = h.type.replace(/\s*<\s*>$/, '');
      var k = h.close + 1; while (k < s.length && /\s/.test(s[k])) k++;
      if (s[k] === '{' && ctx.classes['$anon@' + k]) t = '$anon@' + k;
    } else if (h.k === 'block') t = ctx.classes['$anon@' + h.open] ? '$anon@' + h.open : null;
    else if (h.k === 'type') t = h.type;
    else if (h.k === 'expr') { var r = jResolve(s, h.end, ctx, depth + 1); t = r && r.type; }
    else if (h.k === 'call0') {
      var scs = jScopes(ctx.classes, h.pos);
      for (var q = 0; q < scs.length && !t; q++) t = jMemberType(jSelfType(scs[q]), h.name, 'm', ctx);
    }
    for (var i = 0; t && i < ch.steps.length; i++) {
      var sp = ch.steps[i];
      if (sp.k === 'index') t = jParse(t).dims ? jStripDim(t) : null;
      else t = jMemberType(t, sp.name, sp.k === 'call' ? 'm' : 'f', ctx);
      st = false; self = false;
    }
    return t ? { type: t, isStatic: st, self: self } : null;
  }
  function jExprEnd(s, i, stops){                      // from i, the end of an expression: first stop char at depth 0
    for (var d = 0; i < s.length; i++) {
      var ch = s[i];
      if ('([{'.indexOf(ch) >= 0) d++;
      else if (')]}'.indexOf(ch) >= 0) { if (d === 0) return i; d--; }
      else if (d === 0 && stops.indexOf(ch) >= 0) return i;
    }
    return i;
  }
  function jVarType(name, s, pos, ctx, depth){        // declared type of a variable / parameter / field visible at pos
    var before = s.slice(0, pos), best = null, m, n = escRe(name);
    function later(c){ if (!best || c.idx > best.idx) best = c; }
    // Type name  /  Type name = ...  /  Type name : ...  /  (Type name, ...)  /  instanceof Type name
    var re = new RegExp('(?:^|[\\s(,;{}])(?:final\\s+)?(' + JTYPE + ')(?:\\s*\\.\\.\\.)?\\s+' + n + '\\s*(?=[=;,):]|$)', 'gm');
    while ((m = re.exec(before))) {
      if (JNOTTYPE.test(jParse(m[1]).base)) continue;
      later({ type: m[1].replace(/\s+/g, ' ').trim(), at: m.index + m[0].length, idx: m.index + m[0].length });
    }
    // int a = 0, name = 1;  /  for (int i = 0, name = n; ...)
    var re2 = new RegExp(',\\s*' + n + '\\s*(?=[=;,)])', 'g');
    while ((m = re2.exec(before))) {
      for (var k = m.index, d = 0; k > 0; k--) {
        var c2 = before[k - 1];
        if (c2 === ')' || c2 === ']') d++;
        else if (c2 === '(' || c2 === '[') { if (d === 0) break; d--; }
        else if ((c2 === ';' || c2 === '{' || c2 === '}') && d === 0) break;
      }
      var dm = before.slice(k, m.index).match(new RegExp('^\\s*(?:final\\s+)?(' + JTYPE + ')\\s+[A-Za-z_$][\\w$]*\\s*(?:=|$)'));
      if (dm && !JNOTTYPE.test(jParse(dm[1]).base)) later({ type: dm[1].replace(/\s+/g, ' ').trim(), at: m.index + m[0].length, idx: m.index + m[0].length });
    }
    // untyped lambda parameters:  name -> ...  /  (a, name) -> ...
    var re3 = new RegExp('(?:\\(([^()]*)\\)|(?:^|[^\\w$.])(' + n + '))\\s*->', 'g');
    while ((m = re3.exec(before))) {
      var ps = m[1] != null ? splitArgs(m[1]) : [name], pi = ps.indexOf(name);
      if (pi >= 0) later({ lambda: true, lpos: m[1] != null ? m.index : m.index + m[0].indexOf(name), pidx: pi, idx: m.index + m[0].length });
    }
    if (best && best.lambda) return jLambdaType(s, best.lpos, best.pidx, ctx, depth);
    if (best && best.type === 'var') {
      var a = best.at; while (a < s.length && /\s/.test(s[a])) a++;
      if (s[a] === '=') { var r = jResolve(s, jExprEnd(s, a + 1, ';,'), ctx, depth + 1); return r && r.type; }
      if (s[a] === ':') { var r2 = jResolve(s, jExprEnd(s, a + 1, ';'), ctx, depth + 1); return r2 && jElem(r2.type, ctx); }
      return null;
    }
    if (best) return best.type;
    var scs = jScopes(ctx.classes, pos);              // a field of an enclosing class (declared anywhere, or inherited)
    for (var q = 0; q < scs.length; q++) { var ft = jMemberType(jSelfType(scs[q]), name, 'f', ctx); if (ft) return ft; }
    return null;
  }
  function jLambdaType(s, lpos, pidx, ctx, depth){    // type of an untyped lambda parameter, from where the lambda is passed
    if (depth > 6) return null;
    for (var k = lpos - 1, d = 0, argi = 0; k >= 0; k--) {   // the call this lambda is an argument of
      var ch = s[k];
      if (ch === ')' || ch === ']' || ch === '}') d++;
      else if (ch === '(' || ch === '[' || ch === '{') { if (d === 0) break; d--; }
      else if (ch === ',' && d === 0) argi++;
      else if (ch === ';' && d === 0) return null;
    }
    if (k < 0 || s[k] !== '(') return null;
    var open = k, head = s.slice(0, open).replace(/\s+$/, ''), m, r, t;
    // Comparator.comparing(x -> ...) and friends: x is whatever the comparator compares
    if ((m = head.match(/\bComparator\s*\.\s*(?:<[^<>]*>\s*)?(?:comparing\w*)$/))) return jLambdaType(s, head.length - m[0].length, 0, ctx, depth + 1);
    if ((m = head.match(/\.\s*thenComparing\w*$/))) { var c0 = jChain(s, head.length - m[0].length); return c0 && c0.head.pos != null ? jLambdaType(s, c0.head.pos, 0, ctx, depth + 1) : null; }
    // new PriorityQueue<>((a, b) -> ...), new TreeSet<>(...), new TreeMap<>(...)
    if ((m = head.match(new RegExp('\\bnew\\s+([A-Za-z_$][\\w$.]*)\\s*(' + JGEN + ')?$')))) {
      if (!/^(PriorityQueue|TreeSet|TreeMap|ConcurrentSkipListSet|ConcurrentSkipListMap)$/.test(m[1])) return null;
      var targs = m[2] ? jParse(m[1] + m[2]).args : [];
      if (targs.length) return targs[0];
      var pre = head.slice(0, head.length - m[0].length), dm = pre.match(new RegExp('(' + JTYPE + ')\\s+[A-Za-z_$][\\w$]*\\s*=\\s*$')), am;
      if (dm) return jParse(dm[1]).args[0] || null;
      if ((am = pre.match(/([A-Za-z_$][\w$]*)\s*=\s*$/))) { t = jVarType(am[1], s, pre.length - am[0].length, ctx, depth + 1); return t ? jParse(t).args[0] || null : null; }
      return null;
    }
    if (!(m = head.match(/\.\s*([A-Za-z_$][\w$]*)$/))) return null;
    var meth = m[1], dot = head.length - m[0].length;
    r = jResolve(s, dot, ctx, depth + 1);
    if (r && r.isStatic && /^(Collections|Arrays)$/.test(r.type)) {   // Collections.sort(list, (a, b) -> ...), Arrays.sort(arr, ...)
      var fa = jResolve(s, jExprEnd(s, open + 1, ','), ctx, depth + 1);
      return fa ? jElem(fa.type, ctx) : null;
    }
    if (!r) return null;
    var p = jParse(r.type), base = JALIAS[p.base] || p.base;
    if (/Map$/.test(base) || base === 'Map') {
      if (/^(forEach|compute|computeIfPresent|replaceAll)$/.test(meth)) return p.args[pidx] || null;
      if (meth === 'computeIfAbsent') return p.args[0] || null;
      if (meth === 'merge') return p.args[1] || null;
      return null;
    }
    if (/^(sort|forEach|removeIf|anyMatch|allMatch|noneMatch|filter|map|mapToInt|mapToLong|mapToDouble|max|min|sorted)$/.test(meth)) return jElem(r.type, ctx);
    return null;
  }

  // ---------------- Python ----------------
  function stripPy(src){                              // blank out comments and strings (keeping offsets); keep 'Name' annotations
    return src.replace(/'''[\s\S]*?'''|"""[\s\S]*?"""|#[^\n]*|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, function(s){
      if (s.charAt(0) === '#' || s.length >= 6 && /^('''|""")/.test(s)) return blank(s);
      var inner = s.slice(1, -1);
      return /^[A-Za-z_][\w.\[\], ]*$/.test(inner) ? s : s.charAt(0) + blank(inner) + s.charAt(0);
    });
  }
  var PYLINK = /^(next|prev|left|right|parent|random|child)$/;    // node links usually point at the same class
  var PYTYPES = { list: 'list', List: 'list', Sequence: 'list', dict: 'dict', Dict: 'dict', defaultdict: 'dict', DefaultDict: 'dict', OrderedDict: 'dict',
                  Counter: 'dict', set: 'set', Set: 'set', frozenset: 'set', str: 'str', deque: 'collections.deque', Deque: 'collections.deque' };
  var PYKW = /^(if|elif|while|for|in|not|and|or|return|lambda|yield|await|assert|del|with|except|print|is|else|import|from|raise|global|nonlocal|pass|class|def)$/;
  function pyParse(t){                                // 'Optional[List[Node]]' -> { base: 'List', args: ['Node'] }
    t = (t || '').trim().replace(/^['"]|['"]$/g, '');
    var m;
    while ((m = t.match(/^(?:typing\.)?Optional\[([\s\S]*)\]$/))) t = m[1].trim().replace(/^['"]|['"]$/g, '');
    t = splitArgs(t.replace(/\|/g, ','))[0] || '';     // X | None -> X
    var lb = t.indexOf('['), args = [];
    if (lb > 0 && t.charAt(t.length - 1) === ']') { args = splitArgs(t.slice(lb + 1, -1)).map(function(a){ return a.replace(/^['"]|['"]$/g, ''); }); t = t.slice(0, lb); }
    return { base: t.trim().split('.').pop(), args: args };
  }
  function pyLitType(rhs){
    rhs = (rhs || '').trim();
    if (/^\[/.test(rhs)) return 'list';
    if (/^\{\s*\}$/.test(rhs) || /^\{[^}]*:/.test(rhs)) return 'dict';
    if (/^\{/.test(rhs)) return 'set';
    if (/^[rbfu]?['"]/.test(rhs)) return 'str';
    if (/^-?\d+$/.test(rhs)) return 'int';
    if (/^-?\d*\.\d+$/.test(rhs)) return 'float';
    if (/^(True|False)$/.test(rhs)) return 'bool';
    return '';
  }
  function pyClasses(src, own){
    var out = {}, s = stripPy(src), lines = s.split('\n'), offs = [], o = 0, desc = own ? 'your class' : 'provided';
    lines.forEach(function(L){ offs.push(o); o += L.length + 1; });
    lines.forEach(function(line, i){
      var m = line.match(/^([ \t]*)class\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?\s*:/); if (!m) return;
      var ind = m[1].length, name = m[2], members = [], seen = {}, meth = {}, selfNames = [], bodyInd = -1, end = lines.length, params = {};
      var cls = { name: name, own: own, ind: ind, start: offs[i], members: members,
                  parents: m[3] ? splitArgs(m[3]).filter(function(p){ return !/^(object|Generic\b|ABC$|metaclass\s*=)/.test(p); }) : [] };
      function hidden(n){ return /^__.*__$/.test(n) || (!own && n.charAt(0) === '_'); }
      function add(x){
        var key = x.kind + x.name;
        if (seen[key]) { if (!seen[key].type && x.type) seen[key].type = x.type; return; }
        if (hidden(x.name)) return;
        x.cls = name; x.desc = desc; seen[key] = x; members.push(x);
      }
      function rhsType(rhs, attr){
        rhs = (rhs || '').trim();
        var cm = rhs.match(/^([A-Za-z_][\w.]*)\s*\(/), im = rhs.match(/^([A-Za-z_]\w*)$/);
        if (cm) return cm[1].split('.').pop();
        if (im && params[im[1]]) return params[im[1]];
        var lt = pyLitType(rhs); if (lt) return lt;
        return PYLINK.test(attr) && (!im || im[1] === 'None' || im[1] === attr) ? name : '';
      }
      for (var j = i + 1; j < lines.length; j++) {
        var L = lines[j]; if (!L.trim()) continue;
        var li = L.match(/^[ \t]*/)[0].length; if (li <= ind) { end = j; break; }
        if (bodyInd < 0) bodyInd = li;
        if (li === bodyInd) {
          var d = L.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(([\s\S]*?)\)\s*(?:->\s*([^:]+?))?\s*:/);
          if (d) {
            meth[d[1]] = 1; params = {};
            var ps = splitArgs(d[2]);
            if (ps.length && /^(self|cls)\b/.test(ps[0])) ps.shift();
            ps.forEach(function(p){ var pm = p.match(/^\*{0,2}([A-Za-z_]\w*)\s*(?::\s*([^=]+?))?\s*(?:=[\s\S]*)?$/); if (pm) params[pm[1]] = pm[2] ? pm[2].trim() : ''; });
            add({ name: d[1], kind: 'm', params: ps.join(', '), type: (d[3] || '').trim(), isStatic: /@staticmethod/.test(lines[j - 1] || '') });
            continue;
          }
          var a = L.match(/^\s*([A-Za-z_]\w*)\s*(?::\s*([^=]+?))?\s*(?:=(?!=)\s*(.*))?$/);
          if (a && (a[2] || a[3] != null) && !PYKW.test(a[1])) add({ name: a[1], kind: 'f', type: a[2] ? a[2].trim() : rhsType(a[3], a[1]) });
          continue;
        }
        var sm, sre = /self\.([A-Za-z_]\w*)\s*(?::\s*([^=\n]+?))?\s*=(?!=)\s*([^\n]*)/g;
        while ((sm = sre.exec(L))) add({ name: sm[1], kind: 'f', type: sm[2] ? sm[2].trim() : rhsType(sm[3].split(/[,;]\s*(?![^()\[\]{}]*[)\]}])/)[0], sm[1]) });
        var an, are = /self\.([A-Za-z_]\w*)/g; while ((an = are.exec(L))) selfNames.push(an[1]);
      }
      selfNames.forEach(function(n){ if (!meth[n]) add({ name: n, kind: 'f', type: PYLINK.test(n) ? name : '' }); });
      cls.end = end < lines.length ? offs[end] : s.length;
      out[name] = cls;
    });
    return out;
  }
  function pyScope(classes, pos){                     // the innermost of your classes containing pos
    var best = null;
    Object.keys(classes).forEach(function(k){ var c = classes[k]; if (c.own && c.start < pos && pos <= c.end && (!best || c.start > best.start)) best = c; });
    return best;
  }
  function pyRet(r, p){                               // a reference return word -> a type
    if (r === 'item') return p.args[0] || '';
    if (r === 'value') return p.base === 'Counter' ? 'int' : p.args[1] || '';
    if (/^(list|dict|set|str|int|bool|float)$/.test(r)) return r === 'list' && p.base === 'str' ? 'List[str]' : r;
    return '';
  }
  function pyMembers(t, ctx, depth){                  // all members of type t (own + inherited), or null if unknown
    depth = depth || 0; if (!t || depth > 8) return null;
    var p = pyParse(t), c = ctx.classes[p.base];
    if (c) {
      var out = c.members.slice();
      c.parents.forEach(function(par){ out = out.concat(pyMembers(par, ctx, depth + 1) || []); });
      return out;
    }
    var mod = PYTYPES[p.base] && PYMOD[PYTYPES[p.base]];
    return mod ? mod.methods.map(function(m){ var ps = parseSig(m[0]); return { name: ps.name, kind: 'm', params: ps.params || '', type: pyRet(m[1], p), cls: mod.name, desc: m[2], cx: m[3] }; }) : null;
  }
  function pyMemberType(t, name, kind, ctx){
    var ms = pyMembers(t, ctx) || [];
    for (var i = 0; i < ms.length; i++) if (ms[i].name === name && ms[i].kind === kind && ms[i].type) return ms[i].type;
    if (kind === 'f') for (i = 0; i < ms.length; i++) if (ms[i].name === name && ms[i].type) return ms[i].type;
    return null;
  }
  function pyElem(t){                                 // what `for x in t` yields
    var p = pyParse(t), b = PYTYPES[p.base];
    if (b === 'str') return 'str';
    if (/^(list|set|collections\.deque|dict)$/.test(b) || /^(Iterable|Iterator|Generator|tuple|Tuple)$/.test(p.base)) return p.args[0] || null;
    return null;
  }
  function pyIndex(t){                                // what t[i] gives
    var p = pyParse(t), b = PYTYPES[p.base];
    if (b === 'str') return 'str';
    if (b === 'dict') return p.base === 'Counter' ? 'int' : p.args[1] || null;
    if (/^(list|collections\.deque)$/.test(b)) return p.args[0] || null;
    return null;
  }
  function pyChain(s, i){                             // parse the expression that ends at s[i - 1], right to left
    var steps = [];
    function ws(){ while (i > 0 && /[ \t]/.test(s[i - 1])) i--; }
    for (var guard = 0; guard < 60; guard++) {
      ws(); if (i <= 0) return null;
      var ch = s[i - 1], o;
      if (ch === '"' || ch === "'") return { head: { k: 'type', type: 'str' }, steps: steps };
      if (ch === '}') return { head: { k: 'type', type: pyLitType(s.slice(matchBack(s, i - 1, '{', '}'), i)) || 'dict' }, steps: steps };
      if (ch === ']') {
        o = matchBack(s, i - 1, '[', ']'); if (o < 0) return null;
        var pb = s.slice(0, o).replace(/[ \t]+$/, '');
        if (/[\w)\]'"]$/.test(pb) && !/(^|[^\w])(in|return|and|or|not|if|else|yield|print)$/.test(pb)) { i = o; steps.unshift({ k: 'index' }); continue; }
        return { head: { k: 'type', type: 'list' }, steps: steps };
      }
      if (ch === ')') {
        var close = i - 1, open = matchBack(s, close, '(', ')'); if (open < 0) return null;
        i = open; ws();
        var nm = s.slice(Math.max(0, i - 120), i).match(/([A-Za-z_]\w*)$/);
        if (nm && !PYKW.test(nm[1])) {
          var at = i - nm[1].length; i = at; ws();
          if (s[i - 1] === '.') { steps.unshift({ k: 'call', name: nm[1], pos: at, args: s.slice(open + 1, close) }); i--; continue; }
          return { head: { k: 'call0', name: nm[1], pos: at, args: s.slice(open + 1, close) }, steps: steps };
        }
        return { head: { k: 'expr', end: close }, steps: steps };
      }
      var id = s.slice(Math.max(0, i - 120), i).match(/([A-Za-z_]\w*)$/);
      if (!id || /^\d/.test(id[1])) return null;
      var start = i - id[1].length; i = start; ws();
      if (s[i - 1] === '.' && !/\d$/.test(s.slice(0, i - 1))) { steps.unshift({ k: 'field', name: id[1] }); i--; continue; }
      return { head: { k: 'name', name: id[1], pos: start }, steps: steps };
    }
    return null;
  }
  function pyResolve(s, end, ctx, depth){
    depth = depth || 0; if (depth > 6) return null;
    var ch = pyChain(s, end); if (!ch) return null;
    var h = ch.head, t = null, sc;
    if (h.k === 'name' && /^(collections|typing|builtins)$/.test(h.name) && ch.steps.length && ch.steps[0].k === 'call') { h = ch.steps.shift(); h.k = 'call0'; }
    if (h.k === 'name') {
      if (h.name === 'self' || h.name === 'cls') { sc = pyScope(ctx.classes, h.pos); t = sc && sc.name; }
      else t = pyVarType(h.name, s, h.pos, ctx, depth) || (ctx.classes[h.name] || PYTYPES[h.name] ? h.name : null);
    } else if (h.k === 'call0') {
      var a = (h.args || '').trim();
      if (h.name === 'super') { sc = pyScope(ctx.classes, h.pos); t = sc && sc.parents[0]; }
      else if (h.name === 'defaultdict') t = 'Dict[Any, ' + (a.match(/^[A-Za-z_]\w*$/) ? a : 'Any') + ']';
      else if (h.name === 'Counter') t = 'Counter';
      else if (ctx.classes[h.name] || PYTYPES[h.name]) t = h.name;
      else if (/^(sorted|list)$/.test(h.name)) t = 'list';
      else if (/^(str|repr|chr|input)$/.test(h.name)) t = 'str';
      else {                                          // your own top-level function with a return annotation
        var fm = s.match(new RegExp('^def\\s+' + h.name + '\\s*\\([^)]*\\)\\s*->\\s*([^:]+?)\\s*:', 'm'));
        t = fm ? fm[1] : null;
      }
    } else if (h.k === 'type') t = h.type;
    else if (h.k === 'expr') { var r = pyResolve(s, h.end, ctx, depth + 1); t = r && r.type; }
    for (var i = 0; t && i < ch.steps.length; i++) {
      var sp = ch.steps[i];
      t = sp.k === 'index' ? pyIndex(t) : pyMemberType(t, sp.name, sp.k === 'call' ? 'm' : 'f', ctx);
    }
    return t ? { type: t } : null;
  }
  function pyLineEnd(s, i){ var e = s.indexOf('\n', i); e = e < 0 ? s.length : e; while (e > i && /\s/.test(s[e - 1])) e--; return e; }
  function pyTypeText(s, i){                          // the annotation text starting at s[i]
    var m = s.slice(i).match(/^['"]?[A-Za-z_][\w.]*['"]?/); if (!m) return null;
    var e = i + m[0].length;
    if (s[e] === '[') e = matchFwd(s, e, '[', ']') + 1;
    return s.slice(i, e);
  }
  function pyVarType(name, s, pos, ctx, depth){
    var before = s.slice(0, pos), best = null, m, n = name;
    function later(c){ if (!best || c.idx > best.idx) best = c; }
    var re = new RegExp('(?:^[ \\t]*|[(,]\\s*)' + n + '\\s*:(?!=)[ \\t]*(?=[A-Za-z_\'"])', 'gm');      // name: Type  (params, variables)
    while ((m = re.exec(before))) { var tt = pyTypeText(before, m.index + m[0].length); if (tt) later({ type: tt, idx: m.index + m[0].length }); }
    var re2 = new RegExp('^[ \\t]*' + n + '\\s*=(?!=)[ \\t]*', 'gm');                                 // name = expr
    while ((m = re2.exec(before))) if (pyLineEnd(s, m.index + m[0].length) < pos) later({ rhs: m.index + m[0].length, idx: m.index + m[0].length });   // not the line being evaluated
    var re3 = new RegExp('\\bfor\\s+([A-Za-z_]\\w*(?:\\s*,\\s*[A-Za-z_]\\w*)*)\\s+in\\s+', 'g');      // for name in expr
    while ((m = re3.exec(before))) {
      var targets = m[1].split(',').map(function(x){ return x.trim(); }), ti = targets.indexOf(name);
      if (ti >= 0) later({ loop: m.index + m[0].length, ti: ti, tn: targets.length, idx: m.index + m[0].length });
    }
    var re4 = /\bdef\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g;                                        // def f(a, name): no annotation
    while ((m = re4.exec(before))) {
      var dps = splitArgs(m[2]).map(function(x){ return x.replace(/\s*=[\s\S]*$/, '').trim(); }), di = dps.indexOf(name);
      if (di >= 0) later({ fn: m[1], pidx: di, selfArg: dps[0] === 'self' || dps[0] === 'cls', idx: m.index + m[0].length });
    }
    for (var kb = pos - 1, db = 0; kb >= 0; kb--) {   // a comprehension variable is introduced after its use: [x.val for x in xs]
      var cb = s[kb]; if (')]}'.indexOf(cb) >= 0) db++; else if ('([{'.indexOf(cb) >= 0) { if (db === 0) break; db--; } else if (cb === '\n' && db === 0 && !/[(\[{,]\s*$/.test(s.slice(0, kb))) { kb = -1; break; }
    }
    if (kb >= 0) {
      var close = matchFwd(s, kb, s[kb], { '(': ')', '[': ']', '{': '}' }[s[kb]]), seg = s.slice(pos, close), cre2 = /\bfor\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s+in\s+/g, cm2;
      while ((cm2 = cre2.exec(seg))) { var ct = cm2[1].split(',').map(function(x){ return x.trim(); }); if (ct.indexOf(name) >= 0) { later({ loop: pos + cm2.index + cm2[0].length, ti: ct.indexOf(name), tn: ct.length, idx: Infinity }); break; } }
    }
    var re5 = /\blambda\s+([A-Za-z_][\w\s,]*?)\s*:/g;                                            // lambda name: ...
    while ((m = re5.exec(before))) { var lps = m[1].split(',').map(function(x){ return x.trim(); }); if (lps.indexOf(name) >= 0) later({ lam: m.index, idx: m.index + m[0].length }); }
    if (!best) return null;
    if (best.type) return best.type;
    if (best.fn) {                                    // look at what the function is called with (outermost call first)
      var cre = new RegExp('(?:^|[^\\w.]|self\\.)' + best.fn + '\\s*\\(', 'g'), calls = [];
      while ((m = cre.exec(s))) if (!/def\s+$/.test(s.slice(Math.max(0, m.index - 8), m.index + 1))) calls.push({ open: m.index + m[0].length - 1, viaSelf: m[0].indexOf('self.') >= 0 });
      for (var ci = calls.length - 1; ci >= 0; ci--) {
        var ai = best.pidx - (best.selfArg && calls[ci].viaSelf ? 1 : 0), st = calls[ci].open + 1;
        if (best.selfArg && !calls[ci].viaSelf) continue;
        for (var q = 0; q < ai && st < s.length; q++) st = jExprEnd(s, st, ',') + 1;
        if (s[st - 1] === ')') continue;
        var ca = pyResolve(s, jExprEnd(s, st, ','), ctx, depth + 1);
        if (ca) return ca.type;
      }
      return null;
    }
    if (best.lam != null) {                           // sorted(xs, key=lambda x: ...), xs.sort(key=...), min / max / heapq.nsmallest
      for (var k2 = best.lam - 1, d2 = 0; k2 >= 0; k2--) { var c2 = s[k2]; if (')]}'.indexOf(c2) >= 0) d2++; else if ('([{'.indexOf(c2) >= 0) { if (d2 === 0) break; d2--; } }
      if (k2 < 0 || s[k2] !== '(') return null;
      var callee = s.slice(0, k2).replace(/\s+$/, ''), lm;
      if ((lm = callee.match(/\.\s*sort$/))) { var lr = pyResolve(s, callee.length - lm[0].length, ctx, depth + 1); return lr && pyElem(lr.type); }
      if (/(^|[^\w.])(sorted|min|max|filter|map)$|heapq\.(nsmallest|nlargest)$/.test(callee)) {
        var fst = k2 + 1; if (/nsmallest|nlargest/.test(callee)) fst = jExprEnd(s, fst, ',') + 1;
        var lr2 = pyResolve(s, jExprEnd(s, fst, ','), ctx, depth + 1); return lr2 && pyElem(lr2.type);
      }
      return null;
    }
    if (best.rhs != null) {
      var e = pyLineEnd(s, best.rhs), r = pyResolve(s, e, ctx, depth + 1);
      return r ? r.type : pyLitType(s.slice(best.rhs, e)) || null;
    }
    // for-loop target: find where the iterable expression ends (':' / newline, or the end of a comprehension)
    for (var k = best.loop, d = 0; k < s.length; k++) {
      var c = s[k];
      if ('([{'.indexOf(c) >= 0) d++;
      else if (')]}'.indexOf(c) >= 0) { if (d === 0) break; d--; }
      else if (d === 0 && (c === ':' || c === '\n' || /^\sif\s/.test(s.slice(k, k + 4)))) break;
    }
    var ex = s.slice(best.loop, k).trim(), em;
    if (best.tn === 1) { var r1 = pyResolve(s, best.loop + s.slice(best.loop, k).replace(/\s+$/, '').length, ctx, depth + 1); return r1 && pyElem(r1.type); }
    if ((em = ex.match(/^enumerate\s*\(/)) && best.tn === 2) {
      if (best.ti === 0) return 'int';
      var eo = best.loop + s.slice(best.loop).indexOf('(') ;
      var r2 = pyResolve(s, jExprEnd(s, eo + 1, ','), ctx, depth + 1); return r2 && pyElem(r2.type);
    }
    if (/\.\s*items\s*\(\s*\)$/.test(ex) && best.tn === 2) {
      var it = best.loop + s.slice(best.loop, k).lastIndexOf('.'), r3 = pyResolve(s, it, ctx, depth + 1);
      return r3 ? pyParse(r3.type).args[best.ti] || (best.ti === 1 && pyParse(r3.type).base === 'Counter' ? 'int' : null) : null;
    }
    return null;
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
    var cur = c.getCursor(), line = c.getLine(cur.line).slice(0, cur.ch), to = cur;
    var md = line.match(/([\w$)\]}"])\s*\.\s*([\w$]*)$/);
    if (md && !/(^|[^\w$.])\d+\s*\.\s*[\w$]*$/.test(line)) {
      var prefix = md[2], from = { line: cur.line, ch: cur.ch - prefix.length }, list;
      var full = c.getValue(), s = stripJava(full), dot = c.indexFromPos(from) - 1;
      while (dot > 0 && s[dot] !== '.') dot--;
      var ctx = { classes: classTable('java', javaClasses(full, true)) };
      var r = jResolve(s, dot, ctx), ms = r && jMembers(r.type, ctx);
      if (ms) {
        list = memberItems(ms, r.self ? null : r.isStatic);
        if (r.isStatic && !list.length && JBY[r.type]) list = memberItems(ms, null);
      } else if (r) list = [];                        // a primitive, or a type we know nothing about: no guesses
      else {                                          // couldn't work out the type: offer the common collection methods
        list = [];
        ['List', 'Map', 'Set', 'Deque', 'PriorityQueue', 'String', 'StringBuilder', 'TreeMap', 'TreeSet'].forEach(function(n){ list = list.concat(methodsOf(n)); });
        list = list.filter(function(x){ return x.m[0].indexOf('static ') !== 0 && x.m[1] !== ''; });
      }
      return hintItems(list, prefix, from, to);
    }
    var mw = line.match(/([A-Za-z_$][\w$]*)$/); if (!mw) return null;
    var p = mw[1], f = { line: cur.line, ch: cur.ch - p.length };
    var idents = (c.getValue().match(/[A-Za-z_$][\w$]{2,}/g) || []);
    var types = Object.keys(classTable('java', javaClasses(c.getValue(), true))).filter(function(k){ return k.charAt(0) !== '$'; });
    return wordItems(Object.keys(JBY).filter(function(k){ return k !== '__array__'; }).concat(types, JKEYWORDS, idents), p, f, to);
  }
  function pyHint(c){
    var cur = c.getCursor(), line = c.getLine(cur.line).slice(0, cur.ch);
    var md = line.match(/([\w)\]}'"])\s*\.\s*(\w*)$/);
    if (md && !/(^|[^\w.])\d+\.\w*$/.test(line)) {
      var prefix = md[2], from = { line: cur.line, ch: cur.ch - prefix.length }, list = [];
      var bare = line.match(/(?:^|[^\w.])([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?)\s*\.\s*\w*$/), obj = bare && bare[1];
      var mod = obj && (PYMOD[obj] || PYMOD['collections.' + obj]);
      var full = c.getValue(), s = stripPy(full), dot = c.indexFromPos(from) - 1;
      while (dot > 0 && s[dot] !== '.') dot--;
      var ctx = { classes: classTable('python', pyClasses(full, true)) };
      var r = mod ? null : pyResolve(s, dot, ctx), ms = r && pyMembers(r.type, ctx);
      if (mod) list = mod.methods.map(function(m){ return { m: m, cls: mod.name }; });          // heapq. / bisect. / collections.
      else if (ms) list = memberItems(ms, null);
      else if (r) list = [];                          // int, float, or a type we know nothing about: no guesses
      else ['list', 'dict', 'set', 'str', 'collections.deque'].forEach(function(n){ list = list.concat(PYMOD[n].methods.map(function(m){ return { m: m, cls: n }; })); });
      return hintItems(list, prefix, from, cur);
    }
    var mw = line.match(/([A-Za-z_]\w*)$/); if (!mw) return null;
    var kw = 'def return class for while if elif else import from in not and or None True False len range enumerate zip sorted sum min max abs list dict set tuple str int float append heapq deque defaultdict Counter bisect self lambda break continue pass'.split(' ');
    var types = Object.keys(classTable('python', pyClasses(c.getValue(), true)));
    return wordItems(kw.concat(types, c.getValue().match(/[A-Za-z_]\w{2,}/g) || []), mw[1], { line: cur.line, ch: cur.ch - mw[1].length }, cur);
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
