/* main.js — interface: formulário, controles, métricas, logs e ligação com o simulador. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const { Graph, AS, Validation, Viz, Simulation } = window;
  const { fmt, esc } = Viz;

  /* ---------------- cenários e parâmetros padrão ---------------- */
  const PRESETS = {
    inicial: {
      depot: 0,
      rows: [['A', 10, 10], ['B', 25, 70], ['C', 45, 40], ['D', 60, 85], ['E', 85, 60], ['F', 90, 15], ['G', 55, 10], ['H', 30, 25]]
    },
    ref: { depot: 0, rows: [['A', 0, 0], ['B', 3, 0], ['C', 3, 4], ['D', 0, 4]] }
  };
  const DEFAULT_PARAMS = { ants: '15', iterations: '50', alpha: '1', beta: '3', rho: '30', tau0: '1', Q: '100', seed: '42' };
  const TEST_PARAMS = { ants: '10', iterations: '30', alpha: '1', beta: '2', rho: '50', tau0: '1', Q: '14', seed: '42' };
  const PARAM_ORDER = ['ants', 'iterations', 'alpha', 'beta', 'rho', 'tau0', 'Q', 'seed'];
  const PARAM_HINT = {
    ants: 'inteiro, 1 a 100', iterations: 'inteiro, 1 a 200',
    alpha: '0 a 5 · com 0 o feromônio não influencia', beta: '0 a 5 · com 0 a distância não influencia',
    rho: '0% a 90% · 50% vira ρ = 0,5', tau0: '0,01 a 100 · igual em todas as arestas',
    Q: '0,01 a 10.000 · cada formiga deposita Q/L', seed: 'inteiro, 0 a 4.294.967.295'
  };

  /* ---------------- estado da interface ---------------- */
  let uidSeq = 0;
  const state = {
    rows: [], depotUid: null, params: Object.assign({}, DEFAULT_PARAMS),
    sim: null, snapshot: null, running: false, timer: null, delay: 300,
    viewIter: null, hover: null, pinned: null, logAnt: 0, showLabels: false, showAnt: false,
    open: {}, ev: null, gd: null, edgeSig: ''
  };
  const newRow = (id, x, y) => ({ uid: ++uidSeq, id: String(id), x: String(x), y: String(y) });

  function loadScenario(key) {
    const p = PRESETS[key];
    state.rows = p.rows.map(r => newRow(...r));
    state.depotUid = state.rows[p.depot].uid;
    state.hover = state.pinned = null;
    renderVertexTable();
  }

  /* ---------------- tabela de vértices ---------------- */
  function renderVertexTable() {
    $('#vbody').innerHTML = state.rows.map((r, k) => `
      <tr data-uid="${r.uid}">
        <td class="c"><input type="radio" name="depot" value="${r.uid}" ${r.uid === state.depotUid ? 'checked' : ''} aria-label="Depósito: vértice ${k + 1}"></td>
        <td><input class="t" data-f="id" maxlength="8" autocomplete="off" value="${esc(r.id)}" aria-label="Identificador do vértice ${k + 1}"></td>
        <td><input class="t" data-f="x" inputmode="decimal" autocomplete="off" value="${esc(r.x)}" aria-label="Coordenada x do vértice ${k + 1}"></td>
        <td><input class="t" data-f="y" inputmode="decimal" autocomplete="off" value="${esc(r.y)}" aria-label="Coordenada y do vértice ${k + 1}"></td>
        <td class="c"><button type="button" class="icon" data-remove aria-label="Remover vértice ${esc(r.id)}">×</button></td>
      </tr>`).join('');
    $('#vcount').textContent = `${state.rows.length} de 12 vértices`;
    $('#add-vertex').disabled = state.rows.length >= 12 || state.running;
  }

  function nextId() {
    const used = new Set(state.rows.map(r => r.id.trim().toLowerCase()));
    for (let c = 65; c <= 90; c++) if (!used.has(String.fromCharCode(c).toLowerCase())) return String.fromCharCode(c);
    let k = state.rows.length + 1;
    while (used.has('v' + k)) k++;
    return 'V' + k;
  }
  function freeCoords() {
    const used = new Set(state.rows.map(r => `${Math.round(parseFloat(String(r.x).replace(',', '.')) * 100)},${Math.round(parseFloat(String(r.y).replace(',', '.')) * 100)}`));
    for (let k = state.rows.length + 1; k < 5000; k++) {
      const x = (137 * k + 50) % 1000, y = (263 * k + 80) % 1000;
      if (!used.has(`${x * 100},${y * 100}`)) return [x, y];
    }
    return [0, 0];
  }

  /* ---------------- campos de parâmetros ---------------- */
  function buildParamFields() {
    $('#params').innerHTML = PARAM_ORDER.map(k => {
      const def = Validation.PARAMS[k];
      return `<div class="field" data-field="${k}">
        <label for="p-${k}">${def.label}</label>
        <div class="inwrap"><input id="p-${k}" class="t" data-param="${k}" inputmode="decimal" autocomplete="off" value="${esc(state.params[k])}">${def.unit ? `<span class="unit">${def.unit}</span>` : ''}</div>
        <small class="hint">${PARAM_HINT[k]}</small>
        <small class="err" id="e-${k}"></small>
      </div>`;
    }).join('');
  }
  function fillParams(p) {
    state.params = Object.assign({}, p);
    for (const k of PARAM_ORDER) $('#p-' + k).value = p[k];
  }

  /* ---------------- validação (live) ---------------- */
  function rawConfig() {
    return {
      rows: state.rows.map(r => ({ id: r.id, x: r.x, y: r.y })),
      depotIndex: state.rows.findIndex(r => r.uid === state.depotUid),
      params: Object.assign({}, state.params)
    };
  }
  function evaluate() {
    const raw = rawConfig();
    const sc = Validation.validateScenario(raw.rows, raw.depotIndex);
    const pr = Validation.validateParams(raw.params);
    return { raw, sc, pr, errors: sc.errors.concat(pr.errors) };
  }

  function paintValidation(ev) {
    document.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
    document.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
    document.querySelectorAll('.field .err').forEach(e => { e.textContent = ''; });
    const vmsgs = [];
    const mark = (el, msg) => { if (el) { el.classList.add('invalid'); el.setAttribute('aria-invalid', 'true'); el.title = msg; } };
    for (const e of ev.errors) {
      const m = /^v(\d+)\.(id|x|y)$/.exec(e.field);
      if (m) {
        const row = $('#vbody').children[+m[1]];
        mark(row && row.querySelector(`[data-f="${m[2]}"]`), e.message);
        for (const f of e.also || []) {
          const mm = /^v(\d+)\.(x|y)$/.exec(f);
          const r2 = $('#vbody').children[+mm[1]];
          mark(r2 && r2.querySelector(`[data-f="${mm[2]}"]`), e.message);
        }
        vmsgs.push(e.message);
      } else if (e.field === 'vertices' || e.field === 'depot') {
        $('.vtable').classList.add('invalid');
        vmsgs.push(e.message);
      } else {
        mark(document.querySelector(`#p-${e.field}`), e.message);
        const er = $('#e-' + e.field);
        if (er) er.textContent = e.message.replace(/^[^:]+:\s*/, '');
      }
    }
    const box = $('#errors');
    if (ev.errors.length) {
      box.hidden = false;
      box.innerHTML = `<strong>A execução está bloqueada. Corrija:</strong><ul>${ev.errors.map(e => `<li>${esc(e.message)}</li>`).join('')}</ul>`;
    } else { box.hidden = true; box.innerHTML = ''; }
    $('#add-vertex').disabled = state.rows.length >= 12 || state.running;
  }

  /* ---------------- ciclo de refresh ---------------- */
  function isDirty() {
    return !!(state.sim && state.sim.iteration > 0 && JSON.stringify(state.ev.raw) !== state.snapshot);
  }
  function onConfigChange() {
    state.hover = state.pinned = null;
    refresh();
  }
  function refresh() {
    state.ev = evaluate();
    if (state.sim && state.sim.iteration === 0 && JSON.stringify(state.ev.raw) !== state.snapshot) {
      state.sim = null; state.snapshot = null; state.viewIter = null; state.logAnt = 0;
    }
    paintValidation(state.ev);
    updateControls();
    renderAll();
  }

  function updateControls() {
    const valid = state.ev.errors.length === 0;
    const dirty = isDirty();
    const done = !!(state.sim && state.sim.done);
    const canStart = valid && !dirty && !done;
    $('#btn-run').disabled = state.running || !canStart;
    $('#btn-pause').disabled = !state.running;
    $('#btn-step').disabled = state.running || !canStart;
    $('#btn-reset').disabled = !valid;
    $('#config').classList.toggle('locked', state.running);
    document.querySelectorAll('#config input, #config select, #config button').forEach(el => { el.disabled = state.running; });
    if (!state.running) $('#add-vertex').disabled = state.rows.length >= 12;

    const b = $('#banner');
    b.hidden = !dirty;
    if (dirty) b.textContent = 'Os dados ou parâmetros foram alterados. Clique em Reiniciar para aplicar; enquanto isso, o painel mostra a execução com a configuração anterior.';

    let st;
    const sim = state.sim;
    if (!valid) st = 'Corrija os campos destacados para liberar a execução.';
    else if (dirty) st = 'Configuração alterada: reinicie para continuar.';
    else if (state.running) st = `Executando — iteração ${sim.iteration} de ${sim.cfg.iterations}.`;
    else if (done) st = `Concluído: ${sim.cfg.iterations} iterações. Reinicie para uma nova execução.`;
    else if (sim && sim.iteration > 0) st = `Pausado na iteração ${sim.iteration} de ${sim.cfg.iterations}.`;
    else st = 'Pronto. Clique em Executar ou Avançar uma iteração.';
    $('#status').textContent = st;
  }

  /* ---------------- execução ---------------- */
  function buildConfig(ev) {
    const p = ev.pr.values;
    return { vertices: ev.sc.vertices, depot: ev.sc.depot, ants: p.ants, iterations: p.iterations, alpha: p.alpha, beta: p.beta, rho: p.rho, tau0: p.tau0, Q: p.Q, seed: p.seed };
  }
  function startSim() {
    if (state.ev.errors.length) return false;
    state.sim = new Simulation(buildConfig(state.ev));
    state.snapshot = JSON.stringify(state.ev.raw);
    state.viewIter = null; state.logAnt = 0; state.hover = state.pinned = null; state.open = {};
    return true;
  }
  function tick() {
    if (!state.running) return;
    const sim = state.sim;
    if (sim.done) { state.running = false; refresh(); return; }
    sim.step();
    afterStep();
    if (sim.done) { state.running = false; updateControls(); renderVertexTable(); paintValidation(state.ev); renderAll(); return; }
    state.timer = setTimeout(tick, state.delay);
  }
  function afterStep() { updateControls(); renderAll(); }

  function onRun() {
    if (!state.sim && !startSim()) return;
    state.running = true;
    updateControls();
    state.timer = setTimeout(tick, 0);
  }
  function onPause() {
    state.running = false;
    clearTimeout(state.timer);
    renderVertexTable(); refresh();
  }
  function onStep() {
    if (!state.sim && !startSim()) return;
    if (state.sim.done) return;
    state.sim.step();
    afterStep();
  }
  function onReset() {
    state.running = false; clearTimeout(state.timer);
    state.ev = evaluate();
    if (!startSim()) { refresh(); return; }
    renderVertexTable();
    refresh();
  }

  /* ---------------- dados do grafo exibido ---------------- */
  function view() {
    const sim = state.sim;
    const last = sim ? sim.iteration : 0;
    const it = state.viewIter === null ? last : Math.min(state.viewIter, last);
    return { sim, it, last };
  }

  function computeGraphData() {
    const { sim, it } = view();
    const gd = { it, sim, rec: null, vertices: [], depot: -1, tau: null, dist: null, scale: 1, bestRoute: null, overlayRoute: null };
    if (sim) {
      gd.vertices = sim.cfg.vertices; gd.depot = sim.cfg.depot; gd.tau = sim.tauAt(it); gd.scale = sim.scaleAt(it); gd.dist = sim.dist;
      if (it > 0) {
        gd.rec = sim.history[it - 1];
        gd.bestRoute = gd.rec.bestRoute;
        if (state.showAnt) gd.overlayRoute = gd.rec.ants[Math.min(state.logAnt, gd.rec.ants.length - 1)].route;
      }
    } else {
      const ev = state.ev;
      const rows = state.rows.map(r => ({ r, x: Validation.parseNumber(r.x), y: Validation.parseNumber(r.y) }))
        .filter(o => Number.isFinite(o.x) && Number.isFinite(o.y));
      gd.vertices = rows.map(o => ({ id: o.r.id.trim() || '?', x: o.x, y: o.y }));
      gd.depot = rows.findIndex(o => o.r.uid === state.depotUid);
      if (ev.sc.errors.length === 0) {
        const t0 = ev.pr.values ? ev.pr.values.tau0 : 1;
        gd.tau = Graph.createPheromone(gd.vertices.length, t0);
        gd.scale = t0;
        gd.dist = Graph.distanceMatrix(gd.vertices);
      }
    }
    return gd;
  }

  /* ---------------- renderização ---------------- */
  function renderAll() {
    state.gd = computeGraphData();
    renderMetrics();
    renderGraphArea();
    renderChartArea();
    renderHistory();
    const active = document.activeElement;
    if (!(active && active.id === 'log-ant')) renderLogs();
  }

  const seq = (route, V) => route.map(i => V[i].id).join(' → ');

  function renderMetrics() {
    const gd = state.gd, { sim, it, last } = view();
    const total = sim ? sim.cfg.iterations : (state.ev.pr.values ? state.ev.pr.values.iterations : '—');
    $('#m-iter').textContent = it;
    $('#m-iter-sub').textContent = `de ${total}` + (sim && it < last ? ` · visualizando (execução em ${last})` : '');
    const rec = gd.rec;
    $('#m-iterbest').textContent = rec ? fmt(rec.bestIterLen, 4) : '—';
    $('#m-mean').textContent = rec ? fmt(rec.meanLen, 4) : '—';
    $('#m-best').textContent = rec ? fmt(rec.bestLen, 4) : 'ainda não calculada';
    $('#best-route').textContent = rec
      ? `${seq(rec.bestRoute, gd.vertices)}  ·  distância total ${fmt(rec.bestLen, 4)}  ·  encontrada na iteração ${rec.bestFoundAt}`
      : 'ainda não calculada';
  }

  function edgeSig(gd) { return gd.vertices.map(v => v.id).join('|') + '#' + (gd.tau ? 1 : 0); }

  function renderGraphArea() {
    const gd = state.gd, { sim, it, last } = view();
    Viz.renderGraph($('#graph'), {
      vertices: gd.vertices, depot: gd.depot, tau: gd.tau, scale: gd.scale,
      bestRoute: gd.bestRoute, overlayRoute: gd.overlayRoute, showLabels: state.showLabels,
      edgeSelected: validSel(state.pinned), edgeHover: validSel(state.hover)
    });
    // navegação
    $('#nav-label').textContent = sim ? `Iteração ${it} de ${sim.cfg.iterations}` : 'Estado inicial';
    $('#nav-prev').disabled = !sim || it <= 0;
    $('#nav-next').disabled = !sim || it >= last;
    $('#nav-follow').hidden = !(sim && state.viewIter !== null && state.viewIter < last);
    renderEdgeSelect();
    renderEdgeInfo();
    renderLegend();
    renderScaleNote();
  }

  function validSel(s) {
    const gd = state.gd;
    return s && gd && gd.tau && s.i < gd.vertices.length && s.j < gd.vertices.length ? s : null;
  }

  function renderLegend() {
    const gd = state.gd, ref = gd.scale;
    const samples = gd.tau ? [1, 0.5, 0.1, 0.01] : [];
    const rows = samples.map(f => {
      const st = Viz.pheromoneStyle(ref * f, ref);
      return `<li><svg width="52" height="14" aria-hidden="true"><line x1="2" y1="7" x2="50" y2="7" stroke="var(--ph)" stroke-width="${st.width.toFixed(2)}" stroke-opacity="${st.opacity.toFixed(3)}" stroke-linecap="round"/></svg><span>τ = ${fmt(ref * f, 3)}</span></li>`;
    }).join('');
    $('#legend').innerHTML = `
      <h3>Legenda</h3>
      <ul class="lg">
        ${rows}
        <li><svg width="52" height="14" aria-hidden="true"><path d="M3,10 Q26,0 49,10" fill="none" stroke="var(--best)" stroke-width="3"/><polygon points="7,0 -5,-5 -5,5" transform="translate(26,5) rotate(12)" fill="var(--best)"/></svg><span>melhor rota acumulada (o número é a ordem de visita)</span></li>
        <li><svg width="52" height="14" aria-hidden="true"><path d="M3,4 Q26,14 49,4" fill="none" stroke="var(--ant)" stroke-width="2.4" stroke-dasharray="5 4"/></svg><span>rota da formiga aberta no log (opcional)</span></li>
        <li><svg width="52" height="18" aria-hidden="true"><rect x="19" y="1" width="16" height="16" rx="4" fill="var(--depot)" stroke="var(--ink)" stroke-width="1.5"/></svg><span>depósito</span></li>
        <li><svg width="52" height="18" aria-hidden="true"><circle cx="27" cy="9" r="8" fill="#fff" stroke="var(--ink)" stroke-width="1.5"/></svg><span>ponto de entrega</span></li>
      </ul>
      <p class="hint">A <b>posição</b> dos pontos e o comprimento das arestas no desenho são a <b>distância</b>, que não muda. O que muda com o algoritmo é a <b>espessura e a opacidade</b> da linha violeta, o <b>feromônio</b> (escala por raiz quadrada de τ).</p>`;
  }

  function renderScaleNote() {
    const { sim, it } = view();
    const el = $('#scale-note');
    el.classList.remove('warn');
    if (!sim || !state.gd.tau) { el.textContent = state.gd.tau ? `Escala visual: máximo de referência = τ₀ = ${fmt(state.gd.scale, 4)}.` : ''; return; }
    let changedAt = 0;
    for (let k = 1; k <= it; k++) if (sim.scaleMax[k] > sim.scaleMax[k - 1] * (1 + 1e-12)) changedAt = k;
    const ref = sim.scaleAt(it);
    if (it > 0 && changedAt === it) {
      el.classList.add('warn');
      el.textContent = `A escala visual mudou nesta iteração: o máximo de referência passou de ${fmt(sim.scaleAt(it - 1), 4)} para ${fmt(ref, 4)}. Arestas com o mesmo valor ficam mais finas que antes — compare pelos números, não só pela espessura.`;
    } else if (changedAt === 0) {
      el.textContent = `Escala visual: máximo de referência = τ₀ = ${fmt(ref, 4)} (sem mudança desde o início). A escala só cresce, nunca diminui: linha mais fina sempre indica menos feromônio.`;
    } else {
      el.textContent = `Escala visual: máximo de referência = ${fmt(ref, 4)} (última mudança na iteração ${changedAt}). A escala só cresce, nunca diminui: linha mais fina sempre indica menos feromônio.`;
    }
  }

  /* --- painel de aresta --- */
  function ensureEdgePanel() {
    const p = $('#edge-panel');
    if (p.firstChild) return;
    p.innerHTML = `<h3>Aresta selecionada</h3>
      <label class="stack" for="edge-select">Escolher aresta<select id="edge-select"></select></label>
      <div id="edge-info" class="edge-info"></div>`;
    $('#edge-select').addEventListener('change', e => {
      const v = e.target.value;
      state.pinned = v ? { i: +v.split('-')[0], j: +v.split('-')[1] } : null;
      renderEdgeInfo();
      Viz.highlight($('#graph'), validSel(state.pinned), false);
    });
  }
  function renderEdgeSelect() {
    ensureEdgePanel();
    const gd = state.gd, sig = edgeSig(gd);
    const sel = $('#edge-select');
    if (sig !== state.edgeSig) {
      state.edgeSig = sig;
      let o = '<option value="">— nenhuma —</option>';
      if (gd.tau) for (let i = 0; i < gd.vertices.length; i++) for (let j = i + 1; j < gd.vertices.length; j++)
        o += `<option value="${i}-${j}">${esc(gd.vertices[i].id)} — ${esc(gd.vertices[j].id)}</option>`;
      sel.innerHTML = o;
    }
    const p = validSel(state.pinned);
    sel.value = p ? `${p.i}-${p.j}` : '';
    sel.disabled = !gd.tau;
  }
  function renderEdgeInfo() {
    const gd = state.gd, box = $('#edge-info');
    if (!gd.tau) { box.innerHTML = '<p class="muted">Corrija o cenário para consultar as arestas.</p>'; return; }
    const s = validSel(state.hover) || validSel(state.pinned);
    if (!s) { box.innerHTML = '<p class="muted">Passe o cursor ou clique em uma aresta do grafo (ou use a lista acima) para ver distância e feromônio.</p>'; return; }
    const V = gd.vertices;
    const tau = gd.tau[s.i][s.j];
    let html = `<p class="edge-name">${esc(V[s.i].id)} — ${esc(V[s.j].id)}${state.hover && validSel(state.pinned) && !sameEdge(state.hover, state.pinned) ? ' <span class="muted">(prévia)</span>' : ''}</p>
      <dl>
        <dt>Distância (custo fixo)</dt><dd>${fmt(gd.dist[s.i][s.j], 4)}</dd>
        <dt>Feromônio τ ${gd.it === 0 ? '(inicial, τ₀)' : `(fim da iteração ${gd.it})`}</dt><dd>${fmt(tau, 6)}</dd>`;
    if (gd.rec) {
      const e = gd.rec.edgeLog.find(x => x.i === Math.min(s.i, s.j) && x.j === Math.max(s.i, s.j));
      html += `<dt>Nesta iteração</dt><dd class="small">anterior ${fmt(e.prev, 6)} → após evaporação ${fmt(e.evap, 6)} → depósito ${fmt(e.deposit, 6)} → final ${fmt(e.final, 6)}</dd>`;
    }
    box.innerHTML = html + '</dl>';
  }
  const sameEdge = (a, b) => a && b && a.i === b.i && a.j === b.j;

  /* --- gráfico e histórico --- */
  function renderChartArea() {
    const { sim, it } = view();
    Viz.renderChart($('#chart'), sim ? sim.history : [], sim ? sim.cfg.iterations : 1, it);
  }

  function renderHistory() {
    const { sim, it } = view();
    const t = $('#history');
    const V = state.gd.vertices;
    let html = '<thead><tr><th>Iteração</th><th>Menor da iteração</th><th>Média das formigas</th><th>Melhor acumulada</th><th>Rota da menor distância da iteração</th></tr></thead><tbody>';
    if (sim) for (let k = sim.history.length - 1; k >= 0; k--) {
      const h = sim.history[k];
      html += `<tr data-it="${h.iteration}" class="${h.iteration === it ? 'sel' : ''}" tabindex="0"><td>${h.iteration}${h.improved ? ' <span class="star" title="nova melhor distância acumulada">melhorou</span>' : ''}</td><td>${fmt(h.bestIterLen, 4)}</td><td>${fmt(h.meanLen, 4)}</td><td>${fmt(h.bestLen, 4)}</td><td>${esc(seq(h.bestIterRoute, V))}</td></tr>`;
    }
    html += `<tr data-it="0" class="${it === 0 ? 'sel' : ''}" tabindex="0"><td>0</td><td colspan="4" class="muted">Estado inicial: τ = τ₀ em todas as arestas · melhor distância ainda não calculada</td></tr></tbody>`;
    t.innerHTML = html;
  }

  /* --- logs --- */
  const isOpen = (key, def) => (key in state.open ? state.open[key] : def);

  function renderLogs() {
    const { sim, it } = view();
    const box = $('#logs-body');
    if (!sim || it === 0) {
      box.innerHTML = '<p class="muted">Execute ou avance uma iteração para inspecionar a construção das rotas (candidatos, probabilidades, sorteio) e a atualização dos feromônios de cada aresta.</p>';
      return;
    }
    const rec = sim.history[it - 1], V = sim.cfg.vertices;
    if (state.logAnt >= rec.ants.length) state.logAnt = 0;
    const ant = rec.ants[state.logAnt];
    const ctx = { n: sim.n, depot: sim.cfg.depot, tau: rec.tauBefore, dist: sim.dist, alpha: sim.cfg.alpha, beta: sim.cfg.beta };
    const ex = AS.explainRoute(ctx, ant.route, ant.steps);

    let html = `<div class="log-head">Iteração <b>${it}</b> · todas as formigas usaram os feromônios do fim da iteração ${it - 1}.
      <label class="inline">Formiga
        <select id="log-ant">${rec.ants.map((a, k) => `<option value="${k}" ${k === state.logAnt ? 'selected' : ''}>${k + 1} — L = ${fmt(a.length, 4)}${k === rec.bestIterAnt ? ' (melhor da iteração)' : ''}</option>`).join('')}</select>
      </label></div>`;

    // construção
    html += `<details data-key="cons" ${isOpen('cons', true) ? 'open' : ''}><summary>Construção da rota da formiga ${state.logAnt + 1}</summary><div class="inner">`;
    ex.steps.forEach((s, k) => {
      const key = 'step' + k;
      const rows = s.candidates.map((c, q) => `<tr class="${c === s.chosen ? 'chosen' : ''}"><td>${esc(V[c].id)}</td><td>${fmt(s.dist[q], 4)}</td><td>${fmt(s.tau[q], 6)}</td><td>${fmt(s.w[q], 6)}</td><td><span class="pbar"><i style="width:${(s.p[q] * 100).toFixed(1)}%"></i></span>${fmt(s.p[q] * 100, 2)}%</td><td>${c === s.chosen ? 'escolhido' : ''}</td></tr>`).join('');
      html += `<details class="step" data-key="${key}" ${isOpen(key, k === 0) ? 'open' : ''}><summary>Passo ${k + 1}: em <b>${esc(V[s.from].id)}</b> · candidatos ${s.candidates.map(c => esc(V[c].id)).join(', ')} · escolhido <b>${esc(V[s.chosen].id)}</b></summary>
        <div class="xscroll"><table class="ltable"><thead><tr><th>Candidato j</th><th>d(i,j)</th><th>τ(i,j)</th><th>w(i,j)</th><th>p(i,j)</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="muted small">${s.single ? 'Só havia um candidato: p = 100%, sem sorteio.' : `Número sorteado u = ${fmt(s.u, 6)} (sorteio proporcional às probabilidades acima).`}</p></details>`;
    });
    html += `<p class="ret">Todos os vértices foram visitados: retorno obrigatório <b>${esc(V[ex.returnFrom].id)} → ${esc(V[ex.depot].id)}</b> (d = ${fmt(ex.returnDist, 4)}).</p>
      <p><b>Rota:</b> ${esc(seq(ant.route, V))} · <b>comprimento L = ${fmt(ant.length, 6)}</b></p></div></details>`;

    // rotas de todas as formigas
    html += `<details data-key="ants" ${isOpen('ants', false) ? 'open' : ''}><summary>Rotas e comprimentos das ${rec.ants.length} formigas</summary><div class="inner scroll"><div class="xscroll"><table class="ltable"><thead><tr><th>Formiga</th><th>Rota</th><th>L</th></tr></thead><tbody>${
      rec.ants.map((a, k) => `<tr class="${k === rec.bestIterAnt ? 'chosen' : ''}"><td>${k + 1}</td><td>${esc(seq(a.route, V))}</td><td>${fmt(a.length, 4)}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted small">Menor L = ${fmt(rec.bestIterLen, 6)} · média = ${fmt(rec.meanLen, 6)} · melhor acumulada = ${fmt(rec.bestLen, 6)}.</p></div></details>`;

    // atualização dos feromônios
    const rho = sim.cfg.rho, Q = sim.cfg.Q;
    html += `<details data-key="upd" ${isOpen('upd', true) ? 'open' : ''}><summary>Atualização dos feromônios (ρ = ${fmt(rho * 100, 4)}% · Q = ${fmt(Q, 4)})</summary><div class="inner scroll">
      <p class="muted small">Só depois de todas as formigas terminarem: τ_novo = (1 − ρ) · τ_antigo + Σ Q/L. A aresta de retorno ao depósito também recebe depósito.</p>
      <div class="xscroll"><table class="ltable"><thead><tr><th>Aresta</th><th>d</th><th>Anterior</th><th>Após evaporação</th><th>Depósito total</th><th>Final</th><th>Registro</th></tr></thead><tbody>${
      rec.edgeLog.map(e => `<tr class="${e.deposit > 0 ? 'dep' : ''}"><td>${esc(V[e.i].id)}–${esc(V[e.j].id)}</td><td>${fmt(sim.dist[e.i][e.j], 4)}</td><td>${fmt(e.prev, 6)}</td><td>${fmt(e.evap, 6)}</td><td>${fmt(e.deposit, 6)}</td><td>${fmt(e.final, 6)}${e.floored ? ' <span class="muted">(piso 10⁻¹²)</span>' : ''}</td><td class="muted small">anterior ${fmt(e.prev, 6)}; após evaporação ${fmt(e.evap, 6)}; depósito ${fmt(e.deposit, 6)}; final ${fmt(e.final, 6)}</td></tr>`).join('')}</tbody></table></div></div></details>`;
    box.innerHTML = html;
  }

  /* ---------------- ligação de eventos ---------------- */
  function bind() {
    // vértices
    $('#vbody').addEventListener('input', e => {
      const t = e.target; if (!t.dataset.f) return;
      const row = state.rows.find(r => r.uid === +t.closest('tr').dataset.uid);
      row[t.dataset.f] = t.value;
      onConfigChange();
    });
    $('#vbody').addEventListener('change', e => {
      if (e.target.name === 'depot') { state.depotUid = +e.target.value; onConfigChange(); }
    });
    $('#vbody').addEventListener('click', e => {
      const b = e.target.closest('[data-remove]'); if (!b) return;
      const uid = +b.closest('tr').dataset.uid;
      state.rows = state.rows.filter(r => r.uid !== uid);
      if (state.depotUid === uid) state.depotUid = null; // depósito removido => exige nova seleção
      renderVertexTable(); onConfigChange();
    });
    $('#add-vertex').addEventListener('click', () => {
      if (state.rows.length >= 12) return;
      const [x, y] = freeCoords();
      const r = newRow(nextId(), x, y);
      state.rows.push(r);
      renderVertexTable(); onConfigChange();
      const inp = $('#vbody').lastElementChild.querySelector('[data-f="id"]'); if (inp) inp.focus();
    });
    $('#preset').addEventListener('change', e => {
      if (!e.target.value) return;
      loadScenario(e.target.value);
      e.target.value = '';
      onConfigChange();
    });
    // parâmetros
    $('#params').addEventListener('input', e => {
      const k = e.target.dataset.param; if (!k) return;
      state.params[k] = e.target.value; onConfigChange();
    });
    $('#preset-params').addEventListener('click', () => { fillParams(TEST_PARAMS); onConfigChange(); });
    // controles
    $('#btn-run').addEventListener('click', onRun);
    $('#btn-pause').addEventListener('click', onPause);
    $('#btn-step').addEventListener('click', onStep);
    $('#btn-reset').addEventListener('click', onReset);
    $('#speed').addEventListener('input', e => { state.delay = +e.target.value; $('#speed-out').textContent = state.delay + ' ms'; });
    // navegação pelas iterações
    const goto = k => { const { last } = view(); state.viewIter = k >= last ? null : Math.max(0, k); renderAll(); };
    $('#nav-prev').addEventListener('click', () => goto(view().it - 1));
    $('#nav-next').addEventListener('click', () => goto(view().it + 1));
    $('#nav-follow').addEventListener('click', () => { state.viewIter = null; renderAll(); });
    $('#show-labels').addEventListener('change', e => { state.showLabels = e.target.checked; renderGraphArea(); });
    $('#show-ant').addEventListener('change', e => { state.showAnt = e.target.checked; state.gd = computeGraphData(); renderGraphArea(); });
    // histórico
    const pick = e => {
      const tr = e.target.closest('tr[data-it]'); if (!tr) return;
      goto(+tr.dataset.it);
    };
    $('#history').addEventListener('click', pick);
    $('#history').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });
    // grafo: hover e clique
    const g = $('#graph');
    g.addEventListener('mouseover', e => {
      const l = e.target.closest && e.target.closest('.hit'); if (!l) return;
      state.hover = { i: +l.dataset.i, j: +l.dataset.j };
      renderEdgeInfo(); Viz.highlight(g, state.hover, true);
    });
    g.addEventListener('mouseout', e => {
      if (!(e.target.closest && e.target.closest('.hit'))) return;
      state.hover = null; renderEdgeInfo(); Viz.highlight(g, validSel(state.pinned), false);
    });
    g.addEventListener('click', e => {
      const l = e.target.closest && e.target.closest('.hit'); if (!l) return;
      const s = { i: +l.dataset.i, j: +l.dataset.j };
      state.pinned = sameEdge(state.pinned, s) ? null : s;
      renderEdgeSelect(); renderEdgeInfo(); Viz.highlight(g, validSel(state.pinned), false);
    });
    // logs
    const logs = $('#logs-body');
    logs.addEventListener('change', e => { if (e.target.id === 'log-ant') { state.logAnt = +e.target.value; state.gd = computeGraphData(); renderGraphArea(); renderLogs(); } });
    logs.addEventListener('toggle', e => { const k = e.target.dataset && e.target.dataset.key; if (k) state.open[k] = e.target.open; }, true);
  }

  /* ---------------- início ---------------- */
  buildParamFields();
  loadScenario('inicial');
  bind();
  refresh();
})();
