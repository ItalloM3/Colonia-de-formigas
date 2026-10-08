/* validation.js — validação de vértices e parâmetros a partir dos TEXTOS digitados.
 * Cada erro tem { field, message } para destacar o campo e explicar o problema. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Validation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LIMITS = { minVertices: 4, maxVertices: 12, coordMin: 0, coordMax: 1000, maxIdLength: 8 };

  /** Converte texto em número aceitando vírgula decimal; NaN se vazio/mal formado. */
  function parseNumber(str) {
    if (str === null || str === undefined) return NaN;
    const s = String(str).trim().replace(',', '.');
    if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }
  function parseInteger(str) {
    if (str === null || str === undefined) return NaN;
    const s = String(str).trim();
    return /^[+-]?\d+$/.test(s) ? Number(s) : NaN;
  }
  const isEmpty = s => s === null || s === undefined || String(s).trim() === '';
  const br = n => String(n).replace('.', ',');

  /**
   * rows: [{id:'A', x:'0', y:'0'}] (textos). depotIndex: índice da linha do depósito (ou -1).
   * Retorna { errors, vertices (números) | null, depot }.
   */
  function validateScenario(rows, depotIndex) {
    const errors = [];
    const add = (field, message) => errors.push({ field, message });
    const n = rows.length;

    if (n < LIMITS.minVertices)
      add('vertices', `São necessários pelo menos ${LIMITS.minVertices} vértices (há ${n}). Adicione vértices.`);
    if (n > LIMITS.maxVertices)
      add('vertices', `O máximo é ${LIMITS.maxVertices} vértices (há ${n}). Remova vértices.`);

    const vertices = [];
    const idSeen = new Map();
    const coordSeen = new Map();
    rows.forEach((r, k) => {
      const label = `Vértice ${k + 1}`;
      const id = String(r.id === undefined || r.id === null ? '' : r.id).trim();
      if (id === '') add(`v${k}.id`, `${label}: identificador vazio.`);
      else if (id.length > LIMITS.maxIdLength) add(`v${k}.id`, `${label}: identificador com mais de ${LIMITS.maxIdLength} caracteres.`);
      else {
        const key = id.toLowerCase();
        if (idSeen.has(key)) {
          add(`v${k}.id`, `Identificador repetido: "${id}" (vértices ${idSeen.get(key) + 1} e ${k + 1}).`);
        } else idSeen.set(key, k);
      }

      const coords = {};
      for (const axis of ['x', 'y']) {
        const raw = r[axis];
        const f = `v${k}.${axis}`;
        const name = `${label} (${id || '?'}), coordenada ${axis}`;
        if (isEmpty(raw)) { add(f, `${name}: campo vazio.`); coords[axis] = NaN; continue; }
        const v = parseNumber(raw);
        if (!Number.isFinite(v)) { add(f, `${name}: "${raw}" não é um número válido.`); coords[axis] = NaN; continue; }
        if (v < LIMITS.coordMin || v > LIMITS.coordMax) {
          add(f, `${name}: ${br(v)} está fora do intervalo ${LIMITS.coordMin} a ${LIMITS.coordMax}.`);
          coords[axis] = NaN; continue;
        }
        const dec = String(raw).trim().match(/[.,](\d+)$/);
        if (dec && dec[1].length > 2) { add(f, `${name}: use no máximo duas casas decimais.`); coords[axis] = NaN; continue; }
        coords[axis] = v;
      }
      if (Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
        const ck = Math.round(coords.x * 100) + ',' + Math.round(coords.y * 100);
        if (coordSeen.has(ck)) {
          const o = coordSeen.get(ck);
          add(`v${k}.x`, `Coordenadas duplicadas: "${id || '?'}" e "${rows[o].id}" estão em (${br(coords.x)}; ${br(coords.y)}). A distância seria zero.`);
          errors[errors.length - 1].also = [`v${k}.y`, `v${o}.x`, `v${o}.y`];
        } else coordSeen.set(ck, k);
      }
      vertices.push({ id, x: coords.x, y: coords.y });
    });

    if (depotIndex === null || depotIndex === undefined || depotIndex < 0 || depotIndex >= n)
      add('depot', 'Selecione um dos vértices como depósito.');

    const ok = errors.length === 0;
    return { errors, vertices: ok ? vertices : null, depot: ok ? depotIndex : null, preview: vertices };
  }

  /** Definições dos parâmetros (também usadas pela interface). */
  const PARAMS = {
    ants:       { label: 'Número de formigas',        integer: true, min: 1,    max: 100 },
    iterations: { label: 'Número de iterações',       integer: true, min: 1,    max: 200 },
    alpha:      { label: 'Influência do feromônio (α)', min: 0,    max: 5 },
    beta:       { label: 'Influência da distância (β)', min: 0,    max: 5 },
    rho:        { label: 'Taxa de evaporação (ρ)',    min: 0,    max: 90, unit: '%' },
    tau0:       { label: 'Feromônio inicial (τ₀)',    min: 0.01, max: 100 },
    Q:          { label: 'Constante de depósito (Q)', min: 0.01, max: 10000 },
    seed:       { label: 'Semente aleatória',         integer: true, min: 0, max: 4294967295 }
  };

  /** raw: textos dos campos. Retorna { errors, values } (rho já como fração). */
  function validateParams(raw) {
    const errors = [];
    const values = {};
    for (const key of Object.keys(PARAMS)) {
      const def = PARAMS[key];
      const text = raw[key];
      const unit = def.unit || '';
      const range = `${br(def.min)}${unit} a ${br(def.max)}${unit}`;
      if (isEmpty(text)) { errors.push({ field: key, message: `${def.label}: campo vazio.` }); continue; }
      const v = def.integer ? parseInteger(text) : parseNumber(text);
      if (!Number.isFinite(v)) {
        errors.push({ field: key, message: `${def.label}: "${String(text).trim()}" não é ${def.integer ? 'um número inteiro' : 'um número'} válido.` });
        continue;
      }
      if (v < def.min || v > def.max) {
        errors.push({ field: key, message: `${def.label}: ${br(v)}${unit} está fora do intervalo ${range}.` });
        continue;
      }
      values[key] = v;
    }
    if (errors.length === 0) values.rho = values.rho / 100; // 50% -> 0,5
    return { errors, values: errors.length === 0 ? values : null };
  }

  return { LIMITS, PARAMS, parseNumber, parseInteger, validateScenario, validateParams };
});
