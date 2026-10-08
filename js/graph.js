/* graph.js — grafo completo não direcionado: distâncias, feromônios e rotas. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Graph = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Matriz simétrica de distâncias euclidianas; diagonal = 0. */
  function distanceMatrix(vertices) {
    const n = vertices.length;
    const d = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = vertices[i].x - vertices[j].x;
        const dy = vertices[i].y - vertices[j].y;
        d[i][j] = d[j][i] = Math.sqrt(dx * dx + dy * dy);
      }
    }
    return d;
  }

  /** Matriz simétrica de feromônio com τ0 em todas as arestas e 0 na diagonal. */
  function createPheromone(n, tau0) {
    const t = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) t[i][j] = t[j][i] = tau0;
    return t;
  }

  function cloneMatrix(m) { return m.map(r => r.slice()); }

  /** Lista de arestas não direcionadas (i < j). */
  function edgeList(n) {
    const e = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) e.push({ i, j });
    return e;
  }

  function maxPheromone(tau) {
    let m = 0;
    for (let i = 0; i < tau.length; i++)
      for (let j = i + 1; j < tau.length; j++) if (tau[i][j] > m) m = tau[i][j];
    return m;
  }

  /** Comprimento L: soma das arestas da rota, incluindo o retorno. */
  function routeLength(route, dist) {
    let L = 0;
    for (let k = 0; k < route.length - 1; k++) L += dist[route[k]][route[k + 1]];
    return L;
  }

  /** Rota válida: começa e termina no depósito; os demais vértices aparecem uma única vez. */
  function isValidRoute(route, n, depot) {
    if (!Array.isArray(route) || route.length !== n + 1) return false;
    if (route[0] !== depot || route[n] !== depot) return false;
    const seen = new Array(n).fill(false);
    for (let k = 0; k < n; k++) {
      const v = route[k];
      if (!Number.isInteger(v) || v < 0 || v >= n || seen[v]) return false;
      seen[v] = true;
    }
    return true;
  }

  return { distanceMatrix, createPheromone, cloneMatrix, edgeList, maxPheromone, routeLength, isValidRoute };
});
