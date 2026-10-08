/* simulation.js — controle da execução: estado, iterações, histórico e melhor solução. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./random.js'), require('./graph.js'), require('./ant-system.js'));
  else root.Simulation = factory(root.Random, root.Graph, root.AS);
})(typeof self !== 'undefined' ? self : this, function (Random, Graph, AS) {
  'use strict';

  /**
   * cfg = { vertices:[{id,x,y}], depot (índice), ants, iterations,
   *         alpha, beta, rho (FRAÇÃO, ex.: 0.5), tau0, Q, seed }
   */
  class Simulation {
    constructor(cfg) {
      this.cfg = cfg;
      this.n = cfg.vertices.length;
      this.dist = Graph.distanceMatrix(cfg.vertices);
      this.reset();
    }

    /** Limpa histórico, restaura τ0 e restabelece a semente. */
    reset() {
      const c = this.cfg;
      this.rng = Random.create(c.seed);
      this.tau = Graph.createPheromone(this.n, c.tau0);
      this.initialTau = Graph.cloneMatrix(this.tau);
      this.iteration = 0;
      this.history = [];
      this.best = { length: null, route: null, iteration: null };
      this.scaleMax = [c.tau0]; // escala visual de referência por iteração (nunca diminui)
    }

    get done() { return this.iteration >= this.cfg.iterations; }

    /** Feromônio ao final da iteração k (k = 0: estado inicial). */
    tauAt(k) { return k === 0 ? this.initialTau : this.history[k - 1].tauAfter; }
    scaleAt(k) { return this.scaleMax[k]; }

    /**
     * Executa UMA iteração completa. `opts.forcedRoutes` (apenas para testes controlados)
     * substitui a construção por rotas fornecidas diretamente.
     */
    step(opts) {
      if (this.done && !(opts && opts.allowBeyond)) throw new Error('Execução já concluída.');
      const c = this.cfg;
      const tauBefore = this.tau; // todas as formigas usam os MESMOS feromônios
      const ctx = { n: this.n, depot: c.depot, tau: tauBefore, dist: this.dist, alpha: c.alpha, beta: c.beta };
      const rngStateBefore = this.rng.getState();

      const ants = [];
      if (opts && opts.forcedRoutes) {
        for (const r of opts.forcedRoutes) {
          if (!Graph.isValidRoute(r, this.n, c.depot)) throw new Error('Rota forçada inválida: ' + JSON.stringify(r));
          ants.push({ route: r.slice(), steps: [], length: Graph.routeLength(r, this.dist) });
        }
      } else {
        for (let k = 0; k < c.ants; k++) {
          const res = AS.constructRoute(ctx, this.rng);
          ants.push({ route: res.route, steps: res.steps, length: Graph.routeLength(res.route, this.dist) });
        }
      }

      // métricas da iteração
      let bestIdx = 0, sum = 0;
      ants.forEach((a, k) => { sum += a.length; if (a.length < ants[bestIdx].length) bestIdx = k; });
      const bestIterLen = ants[bestIdx].length;
      const meanLen = sum / ants.length;

      // melhor acumulada: só troca se for estritamente menor (nunca aumenta)
      let improved = false;
      if (this.best.length === null || bestIterLen < this.best.length) {
        this.best = { length: bestIterLen, route: ants[bestIdx].route.slice(), iteration: this.iteration + 1 };
        improved = true;
      }

      // evaporação + depósito, somente após todas as rotas
      const upd = AS.updatePheromones(tauBefore, ants.map(a => a.route), ants.map(a => a.length), c.rho, c.Q);
      this.tau = upd.tau;
      this.iteration++;
      this.scaleMax.push(Math.max(this.scaleMax[this.scaleMax.length - 1], Graph.maxPheromone(this.tau)));

      const rec = {
        iteration: this.iteration,
        ants, bestIterAnt: bestIdx, bestIterLen, bestIterRoute: ants[bestIdx].route.slice(), meanLen,
        bestLen: this.best.length, bestRoute: this.best.route.slice(), bestFoundAt: this.best.iteration, improved,
        tauBefore, tauAfter: upd.tau, edgeLog: upd.edgeLog, rngStateBefore
      };
      this.history.push(rec);
      return rec;
    }
  }

  return Simulation;
});
