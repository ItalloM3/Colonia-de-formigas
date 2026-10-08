/* ant-system.js — núcleo do Ant System (Dorigo, 1996), implementado do zero.
 *   w(i,j) = τ(i,j)^α × (1/d(i,j))^β
 *   p(i,j) = w(i,j) / Σ w(i,u)      (u = vértices ainda não visitados)
 *   τ_novo = (1 − ρ)·τ_antigo + Σ_k Δτ_k,   Δτ_k = Q / L_k se a formiga k usou a aresta
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./graph.js'));
  else root.AS = factory(root.Graph);
})(typeof self !== 'undefined' ? self : this, function (Graph) {
  'use strict';

  const PHEROMONE_FLOOR = 1e-12;

  /** Peso de escolha w(i,j). */
  function weight(tau, d, alpha, beta) {
    return Math.pow(tau, alpha) * Math.pow(1 / d, beta);
  }

  /** Pesos e probabilidades de ir de `from` a cada candidato. */
  function candidateData(from, candidates, tau, dist, alpha, beta) {
    const t = candidates.map(j => tau[from][j]);
    const d = candidates.map(j => dist[from][j]);
    const w = candidates.map((j, k) => weight(t[k], d[k], alpha, beta));
    return { tau: t, dist: d, w, p: probabilities(w) };
  }

  /** Normaliza pesos em probabilidades. Um único candidato => 1. */
  function probabilities(w) {
    if (w.length === 1) return [1];
    let sum = 0;
    for (const x of w) sum += x;
    if (!(sum > 0) || !Number.isFinite(sum)) return w.map(() => 1 / w.length); // proteção numérica
    return w.map(x => x / sum);
  }

  /** Sorteio proporcional (roleta): u ∈ [0,1) -> índice. */
  function chooseIndex(p, u) {
    let acc = 0;
    for (let k = 0; k < p.length; k++) {
      acc += p[k];
      if (u < acc) return k;
    }
    for (let k = p.length - 1; k >= 0; k--) if (p[k] > 0) return k; // sobra de arredondamento
    return p.length - 1;
  }

  /**
   * Constrói uma rota completa. ctx = { n, depot, tau, dist, alpha, beta }.
   * Retorna { route, steps:[{from, chosen, u}] } — u é o número sorteado (null se só havia 1 candidato).
   */
  function constructRoute(ctx, rng) {
    const { n, depot, tau, dist, alpha, beta } = ctx;
    const visited = new Array(n).fill(false);
    visited[depot] = true;
    const route = [depot];
    const steps = [];
    let cur = depot;
    while (route.length < n) {
      const cand = [];
      for (let j = 0; j < n; j++) if (!visited[j]) cand.push(j);
      let idx = 0, u = null;
      if (cand.length > 1) {
        const data = candidateData(cur, cand, tau, dist, alpha, beta);
        u = rng.next();
        idx = chooseIndex(data.p, u);
      }
      const next = cand[idx];
      steps.push({ from: cur, chosen: next, u });
      visited[next] = true;
      route.push(next);
      cur = next;
    }
    route.push(depot); // retorno obrigatório
    return { route, steps };
  }

  /**
   * Reconstrói, para exibição, os candidatos/pesos/probabilidades de cada passo de uma rota,
   * usando os mesmos feromônios que a formiga viu (τ do início da iteração).
   */
  function explainRoute(ctx, route, steps) {
    const { n, depot, tau, dist, alpha, beta } = ctx;
    const visited = new Array(n).fill(false);
    visited[depot] = true;
    const out = [];
    for (let k = 0; k < n - 1; k++) {
      const from = route[k];
      const cand = [];
      for (let j = 0; j < n; j++) if (!visited[j]) cand.push(j);
      const data = candidateData(from, cand, tau, dist, alpha, beta);
      const chosen = route[k + 1];
      out.push({
        from, candidates: cand, tau: data.tau, dist: data.dist, w: data.w, p: data.p,
        chosen, u: steps && steps[k] ? steps[k].u : null, single: cand.length === 1
      });
      visited[chosen] = true;
    }
    const last = route[n - 1];
    return { steps: out, returnFrom: last, depot, returnDist: dist[last][depot] };
  }

  /**
   * Evaporação + depósito, aplicados só depois que todas as formigas terminaram.
   * Retorna { tau (nova matriz simétrica), edgeLog }.
   */
  function updatePheromones(tau, routes, lengths, rho, Q, floor) {
    if (floor === undefined) floor = PHEROMONE_FLOOR;
    const n = tau.length;
    // arestas usadas por cada formiga (conjunto: não conta a mesma aresta duas vezes por orientação)
    const used = routes.map(r => {
      const s = new Set();
      for (let k = 0; k < r.length - 1; k++) {
        const a = Math.min(r[k], r[k + 1]), b = Math.max(r[k], r[k + 1]);
        s.add(a * n + b);
      }
      return s;
    });
    const out = Graph.createPheromone(n, 0);
    const edgeLog = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const prev = tau[i][j];
        const evap = (1 - rho) * prev;
        let deposit = 0;
        for (let k = 0; k < routes.length; k++) if (used[k].has(i * n + j)) deposit += Q / lengths[k];
        let fin = evap + deposit;
        let floored = false;
        if (fin < floor) { fin = floor; floored = true; }
        out[i][j] = out[j][i] = fin;
        edgeLog.push({ i, j, prev, evap, deposit, final: fin, floored });
      }
    }
    return { tau: out, edgeLog };
  }

  return {
    PHEROMONE_FLOOR, weight, candidateData, probabilities, chooseIndex,
    constructRoute, explainRoute, updatePheromones
  };
});
