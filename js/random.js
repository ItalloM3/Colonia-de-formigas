/* random.js — gerador pseudoaleatório com semente (mulberry32).
 * Todos os sorteios do algoritmo passam por aqui; nunca usamos Math.random. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Random = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function create(seed) {
    const initial = Number(seed) >>> 0;
    let s = initial;
    return {
      seed: initial,
      /** Próximo número em [0, 1). */
      next() {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      getState() { return s; },
      setState(v) { s = v >>> 0; },
      reset() { s = initial; }
    };
  }

  return { create };
});
