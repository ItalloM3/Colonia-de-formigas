/* tests.js — testes de validação da seção 6 do enunciado.
 * Uso: node tests/tests.js   (grava também tests/resultados.txt)
 * Tolerância absoluta para decimais: 0,000001. */
'use strict';
const fs = require('fs');
const path = require('path');
const Random = require('../js/random.js');
const Graph = require('../js/graph.js');
const AS = require('../js/ant-system.js');
const Simulation = require('../js/simulation.js');
const V = require('../js/validation.js');

const TOL = 1e-6;
const out = [];
let pass = 0, fail = 0;
const log = (s = '') => { out.push(s); console.log(s); };
const fmt = x => (typeof x === 'number' ? String(+x.toFixed(6)).replace('.', ',') : String(x));
function check(desc, cond, detail) {
  if (cond) pass++; else fail++;
  log(`  [${cond ? 'OK' : 'FALHOU'}] ${desc}${detail ? '  → ' + detail : ''}`);
}
const near = (a, b) => Math.abs(a - b) <= TOL;

// ---------- instância de referência ----------
const REF = [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 3, y: 0 }, { id: 'C', x: 3, y: 4 }, { id: 'D', x: 0, y: 4 }];
const [A, B, C, D] = [0, 1, 2, 3];
const name = r => r.map(i => REF[i].id).join(' → ');
const base = (o = {}) => Object.assign({
  vertices: REF, depot: A, ants: 10, iterations: 30, alpha: 1, beta: 2, rho: 0.5, tau0: 1, Q: 14, seed: 42
}, o);

log('TESTES DE VALIDAÇÃO — Colônia de Formigas (Ant System)');
log('Instância: A=(0,0) B=(3,0) C=(3,4) D=(0,4), depósito A. Tolerância 0,000001.');

// ---------- 6.1 ----------
log('\n6.1 Instância de referência e cálculo das rotas');
const dist = Graph.distanceMatrix(REF);
const expD = { AB: 3, AC: 5, AD: 4, BC: 4, BD: 5, CD: 3 };
for (const [k, v] of Object.entries(expD)) {
  const i = 'ABCD'.indexOf(k[0]), j = 'ABCD'.indexOf(k[1]);
  check(`d(${k[0]},${k[1]}) = ${v}`, near(dist[i][j], v) && near(dist[j][i], v), `obtido ${fmt(dist[i][j])}`);
}
check('d(i,i) = 0 em toda a diagonal', [0, 1, 2, 3].every(i => dist[i][i] === 0));
const routes = [
  [[A, B, C, D, A], 14], [[A, B, D, C, A], 16], [[A, C, B, D, A], 18],
  [[A, C, D, B, A], 16], [[A, D, B, C, A], 18], [[A, D, C, B, A], 14]
];
for (const [r, L] of routes) {
  const got = Graph.routeLength(r, dist);
  check(`${name(r)} = ${L}`, near(got, L) && Graph.isValidRoute(r, 4, A), `obtido ${fmt(got)}`);
}
check('rota incompleta é inválida', !Graph.isValidRoute([A, B, C, A], 4, A));
check('rota com repetição é inválida', !Graph.isValidRoute([A, B, B, D, A], 4, A));
check('rota sem retorno ao depósito é inválida', !Graph.isValidRoute([A, B, C, D, B], 4, A));

// ---------- 6.2 ----------
log('\n6.2 Probabilidades de escolha (τ = 1, α = 1, β = 2)');
const tau1 = Graph.createPheromone(4, 1);
let cd = AS.candidateData(A, [B, C, D], tau1, dist, 1, 2);
check('w(A,B)=1/9, w(A,C)=1/25, w(A,D)=1/16',
  near(cd.w[0], 1 / 9) && near(cd.w[1], 1 / 25) && near(cd.w[2], 1 / 16),
  `${fmt(cd.w[0])}; ${fmt(cd.w[1])}; ${fmt(cd.w[2])}`);
check('p(A,B)=400/769, p(A,C)=144/769, p(A,D)=225/769',
  near(cd.p[0], 400 / 769) && near(cd.p[1], 144 / 769) && near(cd.p[2], 225 / 769),
  `${fmt(cd.p[0])}; ${fmt(cd.p[1])}; ${fmt(cd.p[2])}`);
check('soma das probabilidades = 1', near(cd.p.reduce((a, b) => a + b, 0), 1));
cd = AS.candidateData(B, [C, D], tau1, dist, 1, 2);
check('após visitar B: p(B,C)=25/41 e p(B,D)=16/41 (A e B fora do sorteio)',
  near(cd.p[0], 25 / 41) && near(cd.p[1], 16 / 41) && cd.p.length === 2,
  `${fmt(cd.p[0])}; ${fmt(cd.p[1])}`);
// α=0 e β=0 com feromônios e distâncias DIFERENTES entre candidatos
const tauMix = Graph.createPheromone(4, 1); tauMix[A][B] = tauMix[B][A] = 7; tauMix[A][C] = tauMix[C][A] = 0.3;
cd = AS.candidateData(A, [B, C, D], tauMix, dist, 0, 0);
check('α = 0 e β = 0: probabilidades iguais (1/3)', cd.p.every(p => near(p, 1 / 3)), cd.p.map(fmt).join('; '));
cd = AS.candidateData(A, [B, C, D], tauMix, dist, 0, 2);
check('α = 0: feromônio não influencia (usa só distância)', near(cd.p[0], 400 / 769) && near(cd.p[1], 144 / 769));
cd = AS.candidateData(A, [B, C, D], tauMix, dist, 1, 0);
const sT = 7 + 0.3 + 1;
check('β = 0: distância não influencia (usa só feromônio)', near(cd.p[0], 7 / sT) && near(cd.p[1], 0.3 / sT) && near(cd.p[2], 1 / sT));
cd = AS.candidateData(C, [D], tau1, dist, 1, 2);
check('um único candidato: probabilidade 1', cd.p.length === 1 && cd.p[0] === 1);
// sorteio proporcional (não escolhe sempre o maior)
{
  const rng = Random.create(7); const cnt = [0, 0, 0]; const N = 100000;
  const p = AS.candidateData(A, [B, C, D], tau1, dist, 1, 2).p;
  for (let k = 0; k < N; k++) cnt[AS.chooseIndex(p, rng.next())]++;
  const fr = cnt.map(c => c / N);
  check('sorteio proporcional: 100 000 sorteios reproduzem as probabilidades (±0,01)',
    fr.every((f, k) => Math.abs(f - p[k]) < 0.01) && cnt.every(c => c > 0), `freq. ${fr.map(fmt).join('; ')}`);
}

// ---------- 6.3 ----------
log('\n6.3 Evaporação e depósito (τ₀=1, ρ=50%, Q=14)');
const ids = (sim, i, j) => sim.tau[i][j];
{
  const sim = new Simulation(base({ ants: 1, rho: 0.5, Q: 14 }));
  const rec = sim.step({ forcedRoutes: [[A, B, C, D, A]] });
  const e = rec.edgeLog;
  const get = (i, j) => e.find(x => x.i === Math.min(i, j) && x.j === Math.max(i, j));
  check('após evaporação todas as 6 arestas valem 0,5', e.length === 6 && e.every(x => near(x.evap, 0.5)));
  check('depósito Q/L = 1 em AB, BC, CD e AD (inclui o retorno D→A)',
    [[A, B], [B, C], [C, D], [A, D]].every(([i, j]) => near(get(i, j).deposit, 1)));
  check('final: AB = BC = CD = AD = 1,5', [[A, B], [B, C], [C, D], [A, D]].every(([i, j]) => near(get(i, j).final, 1.5)));
  check('final: AC = BD = 0,5 (sem depósito)', near(get(A, C).final, 0.5) && near(get(B, D).final, 0.5));
  const f = x => String(x).replace('.', ',');
  const l = get(A, B), l2 = get(A, C);
  log(`  log AB: "anterior ${f(l.prev)}; após evaporação ${f(l.evap)}; depósito ${f(l.deposit)}; final ${f(l.final)}"`);
  log(`  log AC: "anterior ${f(l2.prev)}; após evaporação ${f(l2.evap)}; depósito ${f(l2.deposit)}; final ${f(l2.final)}"`);
  check('matriz simétrica e diagonal sem feromônio',
    [0, 1, 2, 3].every(i => sim.tau[i][i] === 0 && [0, 1, 2, 3].every(j => sim.tau[i][j] === sim.tau[j][i])));
  sim.step({ forcedRoutes: [[A, B, C, D, A]] });
  check('2ª iteração, mesma rota: perímetro = 1,75 e diagonais = 0,25',
    [[A, B], [B, C], [C, D], [A, D]].every(([i, j]) => near(ids(sim, i, j), 1.75)) &&
    near(ids(sim, A, C), 0.25) && near(ids(sim, B, D), 0.25),
    `perímetro ${fmt(ids(sim, A, B))}; diagonais ${fmt(ids(sim, A, C))}`);
}
{
  const sim = new Simulation(base({ ants: 2, rho: 0.5, Q: 14 }));
  sim.step({ forcedRoutes: [[A, B, C, D, A], [A, B, C, D, A]] });
  check('duas formigas, mesma rota, 1 iteração: perímetro = 2,5 e diagonais = 0,5',
    [[A, B], [B, C], [C, D], [A, D]].every(([i, j]) => near(ids(sim, i, j), 2.5)) &&
    near(ids(sim, A, C), 0.5) && near(ids(sim, B, D), 0.5),
    `perímetro ${fmt(ids(sim, A, B))}; diagonais ${fmt(ids(sim, A, C))}`);
}
{
  // sentidos opostos da mesma rota: cada formiga deposita 1 em cada aresta do perímetro (sem contagem dupla por orientação)
  const sim = new Simulation(base({ ants: 2 }));
  sim.step({ forcedRoutes: [[A, B, C, D, A], [A, D, C, B, A]] });
  check('duas formigas em sentidos opostos: perímetro = 2,5 (1 depósito por formiga e aresta)', near(ids(sim, A, B), 2.5));
  // todas as formigas usam os mesmos feromônios dentro da iteração
  const s2 = new Simulation(base({ ants: 5 }));
  const rec = s2.step();
  check('as 5 formigas usaram os mesmos feromônios (τ de início da iteração = τ₀)',
    rec.tauBefore === s2.initialTau || JSON.stringify(rec.tauBefore) === JSON.stringify(s2.initialTau));
}
{
  // ρ = 0: nada reduz o feromônio
  const sim = new Simulation(base({ rho: 0, ants: 3 }));
  let ok = true, prev = Graph.cloneMatrix(sim.tau);
  for (let k = 0; k < 10; k++) {
    sim.step();
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (sim.tau[i][j] < prev[i][j] - 1e-15) ok = false;
    prev = Graph.cloneMatrix(sim.tau);
  }
  check('ρ = 0%: evaporação não reduz nenhuma aresta em 10 iterações', ok);
  const s = AS.updatePheromones(Graph.createPheromone(4, 1e-15), [], [], 0.5, 14);
  check('piso numérico: nenhuma aresta fica abaixo de 1e-12', s.tau[0][1] === 1e-12 && s.edgeLog[0].floored);
}

// ---------- 6.4 ----------
log('\n6.4 Execução completa e reprodutibilidade (10 formigas, 30 iterações, α=1, β=2, ρ=50%, τ₀=1, Q=14, semente 42)');
function run(cfg) { const s = new Simulation(cfg); while (!s.done) s.step(); return s; }
const r1 = run(base());
log(`  melhor rota: ${name(r1.best.route)}; comprimento ${fmt(r1.best.length)}; encontrada na iteração ${r1.best.iteration}`);
log(`  melhor por iteração (1–30): ${r1.history.map(h => fmt(h.bestIterLen)).join(' ')}`);
log(`  média por iteração (1–5):   ${r1.history.slice(0, 5).map(h => fmt(h.meanLen)).join(' ')} …`);
check('30 registros, um por iteração concluída', r1.history.length === 30 && r1.history.every((h, k) => h.iteration === k + 1));
check('toda rota construída é válida (300 rotas)', r1.history.every(h => h.ants.every(a => Graph.isValidRoute(a.route, 4, A))));
check('todo comprimento ∈ {14, 16, 18}', r1.history.every(h => h.ants.every(a => [14, 16, 18].some(v => near(a.length, v)))));
check('melhor distância acumulada nunca aumenta', r1.history.every((h, k) => k === 0 || h.bestLen <= r1.history[k - 1].bestLen + 1e-12));
check('melhor final = 14 (rota ótima de referência)', near(r1.best.length, 14) && [[A, B, C, D, A], [A, D, C, B, A]].some(o => JSON.stringify(o) === JSON.stringify(r1.best.route)));
check('métricas coerentes: menor ≤ média ≤ maior comprimento da iteração',
  r1.history.every(h => { const L = h.ants.map(a => a.length); return h.bestIterLen <= h.meanLen + 1e-12 && h.meanLen <= Math.max(...L) + 1e-12; }));
const r2 = run(base());
check('mesmos dados, parâmetros e semente reproduzem o histórico',
  JSON.stringify(r1.history.map(h => [h.ants.map(a => a.route), h.bestIterLen, h.meanLen, h.tauAfter])) ===
  JSON.stringify(r2.history.map(h => [h.ants.map(a => a.route), h.bestIterLen, h.meanLen, h.tauAfter])));
{
  // pausar/retomar e "velocidade": intercalamos trabalho alheio (inclusive Math.random) entre as iterações
  const s = new Simulation(base());
  for (let k = 0; k < 30; k++) { Math.random(); if (k === 9 || k === 19) { /* pausa */ Math.random(); } s.step(); }
  check('pausar/retomar (e variar a velocidade) preserva o resultado',
    JSON.stringify(s.history.map(h => h.tauAfter)) === JSON.stringify(r1.history.map(h => h.tauAfter)));
}
{
  const s = new Simulation(base()); for (let k = 0; k < 7; k++) s.step();
  s.reset();
  const rs = []; while (!s.done) s.step();
  check('Reiniciar limpa histórico, restaura τ₀ e a semente (reproduz o mesmo histórico)',
    s.history.length === 30 && JSON.stringify(s.history.map(h => h.tauAfter)) === JSON.stringify(r1.history.map(h => h.tauAfter)));
  const z = new Simulation(base());
  check('estado inicial: iteração 0, τ = 1, melhor distância ainda não calculada (null, não 0)',
    z.iteration === 0 && z.best.length === null && z.history.length === 0 && z.tau[0][1] === 1 && z.tau[0][2] === 1);
}
{
  const s = new Simulation(base({ seed: 43 }));
  while (!s.done) s.step();
  const diff = JSON.stringify(s.history.map(h => h.ants.map(a => a.route))) !== JSON.stringify(r1.history.map(h => h.ants.map(a => a.route)));
  check('sementes diferentes produzem históricos diferentes', diff);
}
{
  // a explicação exibida na interface bate com o sorteio real
  const rec = r1.history[0];
  const ctx = { n: 4, depot: A, tau: rec.tauBefore, dist: r1.dist, alpha: 1, beta: 2 };
  const ex = AS.explainRoute(ctx, rec.ants[0].route, rec.ants[0].steps);
  const chosenOk = ex.steps.every((s, k) => s.chosen === rec.ants[0].route[k + 1]);
  const first = ex.steps[0];
  check('log de construção: 1º passo da 1ª formiga mostra p = 400/769; 144/769; 225/769 e u coerente',
    chosenOk && near(first.p[0], 400 / 769) && near(first.p[1], 144 / 769) && near(first.p[2], 225 / 769) &&
    first.candidates[AS.chooseIndex(first.p, first.u)] === first.chosen,
    `u = ${fmt(first.u)}; escolhido ${REF[first.chosen].id}`);
}

// ---------- 6.5 ----------
log('\n6.5 Efeito dos parâmetros e entradas inválidas');
log('  Comparação β = 0 × β = 2 (demais parâmetros da 6.4; sementes 1 a 5):');
const summary = {};
let allValidFinals = true;
for (const beta of [0, 2]) {
  const finals = [];
  for (const seed of [1, 2, 3, 4, 5]) finals.push(run(base({ beta, seed })).best.length);
  if (!finals.every(v => [14, 16, 18].some(x => near(v, x)))) allValidFinals = false;
  const mean = finals.reduce((a, b) => a + b, 0) / finals.length;
  const hits = finals.filter(v => near(v, 14)).length;
  summary[beta] = { mean, hits };
  log(`    β = ${beta}: melhores finais por semente = [${finals.map(fmt).join('; ')}]; média = ${fmt(mean)}; atingiram 14: ${hits} de 5`);
}
check('todos os resultados finais de β=0 e β=2 pertencem a {14, 16, 18}', allValidFinals);
log('  Interpretação: com 4 vértices há só 6 rotas (3 distintas), então 10 formigas × 30 iterações já cobrem o espaço de busca;');
log('  β = 0 e β = 2 empatam e não é possível concluir que a distância ajude nesta instância pequena (ver teste extra abaixo).');

log('  Entradas inválidas (devem impedir a execução, com mensagem clara):');
const okRows = [{ id: 'A', x: '0', y: '0' }, { id: 'B', x: '3', y: '0' }, { id: 'C', x: '3', y: '4' }, { id: 'D', x: '0', y: '4' }];
const okParams = { ants: '10', iterations: '30', alpha: '1', beta: '2', rho: '50', tau0: '1', Q: '14', seed: '42' };
check('cenário e parâmetros de referência são aceitos', V.validateScenario(okRows, 0).errors.length === 0 && V.validateParams(okParams).errors.length === 0);
check('ρ = 50% é convertido para 0,5', V.validateParams(okParams).values.rho === 0.5);
const rowsWith = (k, patch) => okRows.map((r, i) => (i === k ? Object.assign({}, r, patch) : r));
function expectErr(desc, errs, re) {
  const hit = errs.find(e => re.test(e.message));
  check(desc, !!hit, hit ? `"${hit.message}"` : 'nenhuma mensagem correspondente');
}
expectErr('coordenadas duplicadas', V.validateScenario(rowsWith(1, { x: '0', y: '0' }), 0).errors, /duplicadas/);
expectErr('identificadores repetidos', V.validateScenario(rowsWith(1, { id: 'a' }), 0).errors, /repetido/);
expectErr('menos de quatro vértices', V.validateScenario(okRows.slice(0, 3), 0).errors, /pelo menos 4/);
expectErr('mais de doze vértices', V.validateScenario(Array.from({ length: 13 }, (_, i) => ({ id: 'V' + i, x: String(i * 10), y: '5' })), 0).errors, /máximo é 12/);
expectErr('coordenada vazia', V.validateScenario(rowsWith(2, { x: '' }), 0).errors, /campo vazio/);
expectErr('coordenada fora do intervalo (1000,01)', V.validateScenario(rowsWith(2, { x: '1000.01' }), 0).errors, /fora do intervalo/);
expectErr('coordenada negativa', V.validateScenario(rowsWith(2, { y: '-1' }), 0).errors, /fora do intervalo/);
expectErr('três casas decimais', V.validateScenario(rowsWith(2, { y: '1,234' }), 0).errors, /duas casas/);
expectErr('coordenada não numérica', V.validateScenario(rowsWith(2, { y: 'abc' }), 0).errors, /não é um número/);
expectErr('depósito não selecionado', V.validateScenario(okRows, -1).errors, /depósito/);
for (const [k, bad, re] of [
  ['ants', '0', /fora do intervalo/], ['ants', '101', /fora do intervalo/], ['ants', '2,5', /inteiro/], ['ants', '', /vazio/],
  ['iterations', '201', /fora do intervalo/], ['alpha', '5,1', /fora do intervalo/], ['alpha', '-1', /fora do intervalo/],
  ['beta', '6', /fora do intervalo/], ['rho', '91', /fora do intervalo/], ['rho', '-5', /fora do intervalo/],
  ['tau0', '0', /fora do intervalo/], ['tau0', '100,5', /fora do intervalo/], ['Q', '0,001', /fora do intervalo/],
  ['Q', '10001', /fora do intervalo/], ['seed', '', /vazio/], ['seed', '1,5', /inteiro/], ['seed', 'x', /inteiro/]
]) {
  const r = V.validateParams(Object.assign({}, okParams, { [k]: bad }));
  expectErr(`${k} = "${bad}"`, r.errors, re);
  if (r.values !== null) { fail++; log('  [FALHOU] parâmetros inválidos não devem gerar valores'); }
}
check('limites aceitos: ants 1 e 100, iterations 1 e 200, ρ 0% e 90%, τ₀ 0,01 e 100, Q 0,01 e 10000, α/β 0 e 5',
  [{ ants: '1', iterations: '1', rho: '0', tau0: '0,01', Q: '0,01', alpha: '0', beta: '0' },
   { ants: '100', iterations: '200', rho: '90', tau0: '100', Q: '10000', alpha: '5', beta: '5' }]
    .every(p => V.validateParams(Object.assign({}, okParams, p)).errors.length === 0));

// ---------- extra ----------
log('\nTeste extra — cenário inicial da aplicação (8 vértices) × ótimo por força bruta (7! = 5 040 rotas)');
const SCEN = [['A',10,10],['B',25,70],['C',45,40],['D',60,85],['E',85,60],['F',90,15],['G',55,10],['H',30,25]].map(([id,x,y]) => ({id,x,y}));
{
  const dd = Graph.distanceMatrix(SCEN);
  let opt = Infinity, optRoute = null;
  (function perm(arr, rest) {
    if (!rest.length) { const r = [0, ...arr, 0]; const L = Graph.routeLength(r, dd); if (L < opt) { opt = L; optRoute = r; } return; }
    rest.forEach((v, k) => perm(arr.concat(v), rest.filter((_, q) => q !== k)));
  })([], [1, 2, 3, 4, 5, 6, 7]);
  log(`  ótimo exato: ${optRoute.map(i => SCEN[i].id).join(' → ')} = ${fmt(opt)}`);
  const cfg = { vertices: SCEN, depot: 0, ants: 15, iterations: 50, alpha: 1, beta: 3, rho: 0.3, tau0: 1, Q: 100, seed: 42 };
  const res = [];
  for (const seed of [1, 2, 3, 4, 5]) { const s = new Simulation(Object.assign({}, cfg, { seed })); while (!s.done) s.step(); res.push(s.best.length); }
  log(`  parâmetros padrão da aplicação, sementes 1–5: melhores = [${res.map(fmt).join('; ')}]`);
  check('todas as execuções encontram rotas válidas com comprimento ≥ ótimo', res.every(v => v >= opt - TOL));
  check('a melhor execução fica a até 5% do ótimo', Math.min(...res) <= opt * 1.05, `melhor ${fmt(Math.min(...res))} × ótimo ${fmt(opt)}`);
}

log(`\nRESUMO: ${pass} verificações OK, ${fail} falhas.`);
fs.writeFileSync(path.join(__dirname, 'resultados.txt'), out.join('\n') + '\n');
process.exit(fail ? 1 : 0);
