/* visualization.js — desenho do grafo e do gráfico de evolução em SVG (sem bibliotecas).
 *
 * Codificação visual do grafo:
 *   - posição dos vértices = coordenadas (mesma escala nos dois eixos) → o comprimento
 *     desenhado de cada aresta é proporcional à distância, que é um custo FIXO;
 *   - espessura + opacidade da linha violeta = feromônio τ da aresta, na escala √(τ / τ_ref),
 *     onde τ_ref é o MAIOR feromônio já visto na execução até a iteração exibida (nunca diminui);
 *   - curva verde com setas = melhor rota acumulada; tracejado âmbar = rota da formiga escolhida no log.
 */
(function (root) {
  'use strict';

  const W = 860, H = 560, PAD = 64;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fmt(v, max) {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    if (v !== 0 && Math.abs(v) < 1e-4) return v.toExponential(2).replace('.', ',');
    return v.toLocaleString('pt-BR', { maximumFractionDigits: max === undefined ? 4 : max });
  }

  /** Rótulo curto de feromônio nas arestas (valores minúsculos em notação científica). */
  function fmtLabel(v) {
    if (v !== 0 && Math.abs(v) < 0.01) return v.toExponential(1).replace('.', ',').replace('e-', 'e−');
    return fmt(v, 3);
  }

  /** Largura/opacidade a partir de τ e da escala de referência. */
  function pheromoneStyle(tau, ref) {
    const r = ref > 0 ? Math.min(1, Math.sqrt(Math.max(tau, 0) / ref)) : 0;
    return { ratio: r, width: 0.7 + 4.6 * r, opacity: 0.16 + 0.6 * r };
  }

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p;
    return 10 * p;
  }

  function makeLayout(vertices) {
    const xs = vertices.map(v => v.x), ys = vertices.map(v => v.y);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const sx = maxx - minx, sy = maxy - miny;
    let s = Math.min((W - 2 * PAD) / (sx || Infinity), (H - 2 * PAD) / (sy || Infinity));
    if (!Number.isFinite(s)) s = 1;
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    return {
      s, cx, cy,
      px: x => W / 2 + (x - cx) * s,
      py: y => H / 2 - (y - cy) * s,
      pts: vertices.map(v => ({ x: W / 2 + (v.x - cx) * s, y: H / 2 - (v.y - cy) * s }))
    };
  }

  function gridSVG(L) {
    const step = niceStep(70 / L.s);
    const x0 = L.cx - (W / 2) / L.s, x1 = L.cx + (W / 2) / L.s;
    const y0 = L.cy - (H / 2) / L.s, y1 = L.cy + (H / 2) / L.s;
    let g = '<g class="grid" aria-hidden="true">';
    for (let x = Math.ceil(Math.max(x0, 0) / step) * step; x <= Math.min(x1, 1000) + 1e-9; x += step) {
      const px = L.px(x);
      g += `<line x1="${px}" y1="0" x2="${px}" y2="${H}"/><text x="${px + 3}" y="${H - 6}">${fmt(+x.toFixed(6), 6)}</text>`;
    }
    for (let y = Math.ceil(Math.max(y0, 0) / step) * step; y <= Math.min(y1, 1000) + 1e-9; y += step) {
      const py = L.py(y);
      g += `<line x1="0" y1="${py}" x2="${W}" y2="${py}"/><text x="5" y="${py - 4}">${fmt(+y.toFixed(6), 6)}</text>`;
    }
    return g + '</g>';
  }

  /** Curva de um segmento a→b deslocada para o lado `side` (+1 direita, −1 esquerda). */
  function bulge(P0, P1, side) {
    const dx = P1.x - P0.x, dy = P1.y - P0.y, len = Math.hypot(dx, dy) || 1;
    const off = Math.min(13, len * 0.14) * side;
    const nx = -dy / len, ny = dx / len; // normal à direita (y para baixo)
    const mx = (P0.x + P1.x) / 2, my = (P0.y + P1.y) / 2;
    return {
      d: `M${P0.x},${P0.y} Q${mx + nx * 2 * off},${my + ny * 2 * off} ${P1.x},${P1.y}`,
      mid: { x: mx + nx * off, y: my + ny * off }, angle: Math.atan2(dy, dx) * 180 / Math.PI
    };
  }

  /**
   * d = { vertices:[{id,x,y}], depot, tau (matriz|null), scale, bestRoute, overlayRoute,
   *       showLabels, edgeSelected:{i,j}|null, edgeHover }
   */
  function renderGraph(svg, d) {
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const V = d.vertices;
    if (!V || V.length === 0) {
      svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="empty-text">Adicione vértices para ver o grafo.</text>`;
      svg._pts = [];
      return;
    }
    const L = makeLayout(V);
    svg._pts = L.pts;
    const n = V.length;
    let html = gridSVG(L);

    // arestas (feromônio)
    if (d.tau) {
      const edges = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push({ i, j, t: d.tau[i][j] });
      edges.sort((a, b) => a.t - b.t);
      html += '<g class="edges">';
      for (const e of edges) {
        const st = pheromoneStyle(e.t, d.scale);
        html += `<line class="edge" x1="${L.pts[e.i].x}" y1="${L.pts[e.i].y}" x2="${L.pts[e.j].x}" y2="${L.pts[e.j].y}" stroke-width="${st.width.toFixed(2)}" stroke-opacity="${st.opacity.toFixed(3)}"/>`;
      }
      html += '</g>';
      if (d.showLabels) {
        html += '<g class="edge-labels">';
        for (const e of edges) {
          const mx = (L.pts[e.i].x + L.pts[e.j].x) / 2, my = (L.pts[e.i].y + L.pts[e.j].y) / 2;
          html += `<text x="${mx}" y="${my + 4}" text-anchor="middle">${fmtLabel(e.t)}</text>`;
        }
        html += '</g>';
      }
    }

    // rota da formiga (sobreposição) e melhor rota
    const drawRoute = (route, cls, side, arrows) => {
      if (!route) return '';
      let s = `<g class="${cls}">`;
      for (let k = 0; k < route.length - 1; k++) {
        const b = bulge(L.pts[route[k]], L.pts[route[k + 1]], side);
        s += `<path d="${b.d}"/>`;
        if (arrows) s += `<polygon points="7,0 -5,-5 -5,5" transform="translate(${b.mid.x},${b.mid.y}) rotate(${b.angle})"/>`;
      }
      return s + '</g>';
    };
    html += drawRoute(d.overlayRoute, 'ant-route', -1, false);
    html += drawRoute(d.bestRoute, 'best-route', 1, true);

    // destaque de aresta (hover/seleção) — atualizado sem redesenhar tudo
    html += '<g id="edge-hl"></g>';

    // alvos de interação (por cima das linhas, por baixo dos vértices)
    if (d.tau) {
      html += '<g class="hits">';
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
        html += `<line class="hit" data-i="${i}" data-j="${j}" x1="${L.pts[i].x}" y1="${L.pts[i].y}" x2="${L.pts[j].x}" y2="${L.pts[j].y}"><title>Aresta ${esc(V[i].id)}–${esc(V[j].id)}</title></line>`;
      html += '</g>';
    }

    // ordem na melhor rota
    const order = {};
    if (d.bestRoute) d.bestRoute.slice(0, -1).forEach((v, k) => { order[v] = k; });

    // vértices
    html += '<g class="vertices">';
    V.forEach((v, k) => {
      const p = L.pts[k];
      const small = v.id.length > 3 ? ' small' : '';
      const tip = `<title>${esc(v.id)} — (${fmt(v.x, 2)}; ${fmt(v.y, 2)})${k === d.depot ? ' — depósito' : ''}</title>`;
      if (k === d.depot) {
        html += `<g class="vertex depot">${tip}<rect x="${p.x - 16}" y="${p.y - 16}" width="32" height="32" rx="7"/><text class="vid${small}" x="${p.x}" y="${p.y + 4.5}" text-anchor="middle">${esc(v.id)}</text><text class="cap" x="${p.x}" y="${p.y + 31}" text-anchor="middle">depósito</text></g>`;
      } else {
        html += `<g class="vertex">${tip}<circle cx="${p.x}" cy="${p.y}" r="15"/><text class="vid${small}" x="${p.x}" y="${p.y + 4.5}" text-anchor="middle">${esc(v.id)}</text></g>`;
      }
      if (d.bestRoute && order[k] > 0)
        html += `<g class="badge"><circle cx="${p.x + 15}" cy="${p.y - 15}" r="8.5"/><text x="${p.x + 15}" y="${p.y - 11.7}" text-anchor="middle">${order[k]}</text></g>`;
    });
    html += '</g>';
    svg.innerHTML = html;
    highlight(svg, d.edgeHover || d.edgeSelected, !!d.edgeHover);
  }

  /** Destaca uma aresta (tracejado escuro) sem refazer o desenho. */
  function highlight(svg, sel, hover) {
    const g = svg.querySelector('#edge-hl');
    if (!g) return;
    if (!sel || !svg._pts || !svg._pts[sel.i] || !svg._pts[sel.j]) { g.innerHTML = ''; return; }
    const a = svg._pts[sel.i], b = svg._pts[sel.j];
    g.innerHTML = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${hover ? 'hl hover' : 'hl'}"/>`;
  }

  /** Gráfico de evolução: menor da iteração, média e melhor acumulada. */
  function renderChart(svg, history, total, viewIter) {
    const CW = 720, CH = 250, ml = 56, mr = 18, mt = 16, mb = 36;
    svg.setAttribute('viewBox', `0 0 ${CW} ${CH}`);
    if (!history.length) {
      svg.innerHTML = `<text x="${CW / 2}" y="${CH / 2}" text-anchor="middle" class="empty-text">O gráfico aparece depois da primeira iteração.</text>`;
      return;
    }
    const series = [
      { key: 'mean', name: 'Média das formigas', cls: 'ser-mean', get: h => h.meanLen },
      { key: 'iter', name: 'Menor da iteração', cls: 'ser-iter', get: h => h.bestIterLen },
      { key: 'best', name: 'Melhor acumulada', cls: 'ser-best', get: h => h.bestLen }
    ];
    let lo = Infinity, hi = -Infinity;
    for (const h of history) for (const s of series) { const v = s.get(h); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const padY = (hi - lo) * 0.1 || Math.abs(hi) * 0.1 || 1;
    lo -= padY; hi += padY;
    const X = k => total <= 1 ? ml + (CW - ml - mr) / 2 : ml + (k - 1) / (total - 1) * (CW - ml - mr);
    const Y = v => mt + (1 - (v - lo) / (hi - lo)) * (CH - mt - mb);
    let s = '<g class="axis">';
    for (let t = 0; t <= 4; t++) {
      const v = lo + (hi - lo) * t / 4, y = Y(v);
      s += `<line x1="${ml}" y1="${y}" x2="${CW - mr}" y2="${y}"/><text x="${ml - 8}" y="${y + 4}" text-anchor="end">${fmt(v, 2)}</text>`;
    }
    const xt = [...new Set([1, Math.round((1 + total) / 2), total])];
    for (const k of xt) s += `<text x="${X(k)}" y="${CH - 14}" text-anchor="middle">${k}</text>`;
    s += `<text x="${(ml + CW - mr) / 2}" y="${CH - 1}" text-anchor="middle" class="axis-title">iteração</text></g>`;
    if (viewIter > 0) s += `<line class="view-mark" x1="${X(viewIter)}" y1="${mt}" x2="${X(viewIter)}" y2="${CH - mb}"/>`;
    for (const sr of series) {
      const pts = history.map(h => `${X(h.iteration).toFixed(1)},${Y(sr.get(h)).toFixed(1)}`).join(' ');
      s += `<polyline class="${sr.cls}" points="${pts}"/>`;
      if (history.length === 1) { const h = history[0]; s += `<circle class="${sr.cls}-dot" cx="${X(1)}" cy="${Y(sr.get(h))}" r="3.5"/>`; }
    }
    svg.innerHTML = s;
  }

  root.Viz = { renderGraph, highlight, renderChart, pheromoneStyle, fmt, esc };
})(typeof self !== 'undefined' ? self : this);
