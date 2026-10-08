# Simulador de Colônia de Formigas — rota de entregas (Ant System)

**Disciplina:** Inteligência Artificial — UFPI, período 2026.2
**Autores:** _(preencher: nome completo e matrícula de cada integrante, no máximo três)_
**Aplicação publicada (GitHub Pages):** _(colar aqui o link, ex.: https://SEU-USUARIO.github.io/colonia-formigas/)_
**Repositório:** _(https://github.com/SEU-USUARIO/colonia-formigas)_

## 1. Descrição da solução

Simulador, executado inteiramente no navegador, que usa a variante **Ant System** para planejar a rota de um veículo que sai do depósito, visita cada ponto de entrega exatamente uma vez e retorna ao depósito, minimizando a distância total (problema do caixeiro viajante).

- O mapa é um **grafo completo, não direcionado**; a distância de cada aresta é euclidiana, `d(i,j) = √((x(i)−x(j))² + (y(i)−y(j))²)`.
- Cada formiga constrói uma rota completa escolhendo o próximo vértice **por sorteio proporcional** a `p(i,j) = w(i,j) / Σ w(i,u)`, com `w(i,j) = τ(i,j)^α × (1/d(i,j))^β`, considerando apenas vértices ainda não visitados. Depois de visitar todos, retorna ao depósito.
- Todas as formigas de uma iteração usam os **mesmos feromônios** (os do fim da iteração anterior). Só depois que todas terminam é aplicada a atualização
  `τ_novo(i,j) = (1 − ρ)·τ_antigo(i,j) + Σ Δτk(i,j)`, com `Δτk = Q/Lk` se a formiga k percorreu a aresta (inclusive a de retorno ao depósito). Como o grafo é não direcionado, `τ(i,j) = τ(j,i)` e cada formiga conta uma única vez por aresta. Piso numérico de 10⁻¹² após a atualização; a diagonal nunca recebe feromônio.
- São registradas a melhor rota de cada iteração e a melhor de toda a execução (que só é substituída por uma rota estritamente menor, logo nunca aumenta).
- Todos os sorteios usam um gerador com semente (mulberry32, em `js/random.js`); `Math.random` nunca é usado nos sorteios do algoritmo.
- Não há busca local nem outras variantes de colônia de formigas.

## 2. Como usar

1. Abra a página (GitHub Pages ou o arquivo `index.html` direto no navegador; não exige servidor, login ou instalação).
2. Em **Cenário**, edite, adicione (até 12) ou remova vértices (mínimo 4) e escolha o **depósito** no botão de opção da linha. O menu *Carregar cenário* traz o cenário inicial de 8 pontos e a instância de referência A, B, C, D do enunciado.
3. Em **Parâmetros**, ajuste os campos (tabela abaixo). Qualquer campo vazio ou inválido bloqueia a execução e mostra a mensagem do problema.
4. Use **Executar**, **Pausar** (preserva o estado), **Avançar uma iteração** (completa uma iteração e permanece pausado) e **Reiniciar** (limpa o histórico, restaura τ₀ e a semente). O controle de velocidade só altera a pausa entre iterações; não muda sorteios nem resultados.
5. Se os dados ou parâmetros forem alterados depois que a execução começou, os botões Executar/Avançar ficam bloqueados até clicar em **Reiniciar**.
6. Acompanhe: métricas (iteração, menor distância da iteração, média, melhor acumulada, melhor rota), o grafo, o gráfico de evolução, o histórico (clique numa linha para ver o grafo e os logs daquela iteração; também há os botões ‹ › ) e os logs expansíveis.

### Parâmetros

| Campo | Faixa | Observação |
|---|---|---|
| Vértices | 4 a 12; id único; x e y em 0–1.000 com até 2 casas | coordenadas duplicadas são bloqueadas (distância zero) |
| Depósito | um dos vértices cadastrados | |
| Número de formigas | inteiro, 1–100 | |
| Número de iterações | inteiro, 1–200 | |
| α (influência do feromônio) | 0–5 | com 0 o feromônio não influencia |
| β (influência da distância) | 0–5 | com 0 a distância não influencia |
| ρ (evaporação) | 0%–90% | convertida para fração (50% → 0,5) |
| τ₀ (feromônio inicial) | 0,01–100 | igual em todas as arestas |
| Q (constante de depósito) | 0,01–10.000 | cada formiga deposita Q/L |
| Semente | inteiro, 0–4.294.967.295 | reproduz os sorteios |

Valores iniciais: 15 formigas, 50 iterações, α = 1, β = 3, ρ = 30%, τ₀ = 1, Q = 100, semente 42 (adequados ao cenário inicial, cujas coordenadas vão de 10 a 90). O botão *Usar parâmetros do teste 6.4* aplica os valores do teste da seção 6.4.

## 3. Como ler o grafo

- **Distância ≠ feromônio.** A posição dos vértices é dada pelas coordenadas (mesma escala nos dois eixos), então o comprimento desenhado de cada aresta representa a distância, que é um custo fixo.
- O **feromônio** é a linha **violeta**: quanto maior τ, mais **grossa e opaca**. Ative *Valores de τ nas arestas* para ver os números. A espessura usa a raiz quadrada de `τ / τ_ref`.
- `τ_ref` (escala de referência) é o **maior feromônio já visto na execução** até a iteração exibida; ele só aumenta. Por isso uma linha mais fina sempre indica menos feromônio relativo ao máximo. Quando `τ_ref` muda, a faixa abaixo do grafo avisa ("a escala visual mudou nesta iteração…"), pois arestas com o mesmo valor passam a parecer mais finas. A legenda mostra quatro valores de τ de exemplo, na escala atual.
- A **melhor rota acumulada** aparece em **verde**, em curvas com setas e o número da ordem de visita (curvas separadas das retas para não esconder o feromônio). O **depósito** é o quadrado âmbar.
- Passe o cursor sobre uma aresta, clique nela (fixa a seleção) ou escolha-a na lista *Escolher aresta*: o painel mostra distância, feromônio e, na iteração exibida, o log *anterior → após evaporação → depósito → final*.
- Não há animação de formigas; a atualização visual do feromônio acontece a cada iteração.

## 4. Logs e transparência

Em **Logs da execução** (painéis expansíveis), para qualquer iteração concluída e **qualquer formiga** (não só uma):

- **Construção da rota:** em cada passo, vértice atual, candidatos, d, τ, w, probabilidade p (com barra), número sorteado `u` e vértice escolhido; depois o retorno obrigatório ao depósito e o comprimento L. Para reproduzir a escolha: `u` cai no intervalo acumulado de p do candidato escolhido (quando só resta um candidato, p = 100% e não há sorteio).
- **Rotas e comprimentos** das formigas da iteração, menor L, média e melhor acumulada.
- **Atualização dos feromônios:** para cada aresta, feromônio anterior, após evaporação, depósito total e final.

Os candidatos, pesos e probabilidades exibidos são recalculados com as mesmas funções do algoritmo, a partir dos feromônios guardados no início daquela iteração e do número `u` realmente sorteado; portanto correspondem à execução real.

## 5. Bibliotecas e tecnologias

- HTML, CSS e JavaScript puros, sem servidor de aplicação e **sem nenhuma biblioteca de JavaScript**. O grafo e o gráfico são desenhados em SVG por código próprio (`js/visualization.js`) e o gerador pseudoaleatório com semente é próprio (`js/random.js`).
- Único recurso externo: a fonte **Schibsted Grotesk** (Google Fonts), apenas para a tipografia; se não carregar, o navegador usa uma fonte do sistema e nada muda no funcionamento.
- O Ant System (construção de rotas, probabilidades, sorteio, evaporação, depósito) foi implementado pelos autores em `js/ant-system.js` e `js/simulation.js`.

## 6. Estrutura do repositório

```
index.html            página única
css/style.css         estilos
js/random.js          gerador com semente (mulberry32)
js/graph.js           distâncias, matriz de feromônio, comprimento e validade de rotas
js/ant-system.js      pesos, probabilidades, sorteio, construção de rota, evaporação e depósito
js/simulation.js      estado da execução, iterações, histórico, melhor solução
js/validation.js      validação de vértices e parâmetros (mensagens em português)
js/visualization.js   grafo e gráfico em SVG
js/main.js            interface: formulários, controles, métricas e logs
tests/tests.js        testes da seção 6 do enunciado (Node.js)
tests/resultados.txt  saída da última execução dos testes
```

Os módulos de `js/` (exceto `visualization.js` e `main.js`) funcionam tanto no navegador quanto no Node.js, e os testes usam exatamente o mesmo código da aplicação.

## 7. Publicação no GitHub Pages

1. Crie um repositório **público** e envie todos os arquivos (a pasta raiz deve conter `index.html`).
2. Em *Settings → Pages*, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. Aguarde alguns minutos e acesse `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
4. Troque `https://github.com/SEU-USUARIO/colonia-formigas` pelo endereço real do repositório no `index.html` (cabeçalho e rodapé) e neste README.

## 8. Testes de validação

Para repetir: `node tests/tests.js` (requer Node.js; gera `tests/resultados.txt`). Os testes controlados passam as rotas e escolhas diretamente às funções, sem campos extras na interface. Decimais são comparados com tolerância absoluta de 0,000001; os cálculos internos não são arredondados (só a exibição). Também é possível reproduzir os testes 6.1 e 6.4 pela interface: *Carregar cenário → Instância de referência* e *Usar parâmetros do teste 6.4*, depois *Reiniciar* e *Executar*.

### Resultado obtido (saída completa)

```
TESTES DE VALIDAÇÃO — Colônia de Formigas (Ant System)
Instância: A=(0,0) B=(3,0) C=(3,4) D=(0,4), depósito A. Tolerância 0,000001.

6.1 Instância de referência e cálculo das rotas
  [OK] d(A,B) = 3  → obtido 3
  [OK] d(A,C) = 5  → obtido 5
  [OK] d(A,D) = 4  → obtido 4
  [OK] d(B,C) = 4  → obtido 4
  [OK] d(B,D) = 5  → obtido 5
  [OK] d(C,D) = 3  → obtido 3
  [OK] d(i,i) = 0 em toda a diagonal
  [OK] A → B → C → D → A = 14  → obtido 14
  [OK] A → B → D → C → A = 16  → obtido 16
  [OK] A → C → B → D → A = 18  → obtido 18
  [OK] A → C → D → B → A = 16  → obtido 16
  [OK] A → D → B → C → A = 18  → obtido 18
  [OK] A → D → C → B → A = 14  → obtido 14
  [OK] rota incompleta é inválida
  [OK] rota com repetição é inválida
  [OK] rota sem retorno ao depósito é inválida

6.2 Probabilidades de escolha (τ = 1, α = 1, β = 2)
  [OK] w(A,B)=1/9, w(A,C)=1/25, w(A,D)=1/16  → 0,111111; 0,04; 0,0625
  [OK] p(A,B)=400/769, p(A,C)=144/769, p(A,D)=225/769  → 0,520156; 0,187256; 0,292588
  [OK] soma das probabilidades = 1
  [OK] após visitar B: p(B,C)=25/41 e p(B,D)=16/41 (A e B fora do sorteio)  → 0,609756; 0,390244
  [OK] α = 0 e β = 0: probabilidades iguais (1/3)  → 0,333333; 0,333333; 0,333333
  [OK] α = 0: feromônio não influencia (usa só distância)
  [OK] β = 0: distância não influencia (usa só feromônio)
  [OK] um único candidato: probabilidade 1
  [OK] sorteio proporcional: 100 000 sorteios reproduzem as probabilidades (±0,01)  → freq. 0,51963; 0,18868; 0,29169

6.3 Evaporação e depósito (τ₀=1, ρ=50%, Q=14)
  [OK] após evaporação todas as 6 arestas valem 0,5
  [OK] depósito Q/L = 1 em AB, BC, CD e AD (inclui o retorno D→A)
  [OK] final: AB = BC = CD = AD = 1,5
  [OK] final: AC = BD = 0,5 (sem depósito)
  log AB: "anterior 1; após evaporação 0,5; depósito 1; final 1,5"
  log AC: "anterior 1; após evaporação 0,5; depósito 0; final 0,5"
  [OK] matriz simétrica e diagonal sem feromônio
  [OK] 2ª iteração, mesma rota: perímetro = 1,75 e diagonais = 0,25  → perímetro 1,75; diagonais 0,25
  [OK] duas formigas, mesma rota, 1 iteração: perímetro = 2,5 e diagonais = 0,5  → perímetro 2,5; diagonais 0,5
  [OK] duas formigas em sentidos opostos: perímetro = 2,5 (1 depósito por formiga e aresta)
  [OK] as 5 formigas usaram os mesmos feromônios (τ de início da iteração = τ₀)
  [OK] ρ = 0%: evaporação não reduz nenhuma aresta em 10 iterações
  [OK] piso numérico: nenhuma aresta fica abaixo de 1e-12

6.4 Execução completa e reprodutibilidade (10 formigas, 30 iterações, α=1, β=2, ρ=50%, τ₀=1, Q=14, semente 42)
  melhor rota: A → D → C → B → A; comprimento 14; encontrada na iteração 1
  melhor por iteração (1–30): 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14 14
  média por iteração (1–5):   14,8 15 14,6 14,6 14,2 …
  [OK] 30 registros, um por iteração concluída
  [OK] toda rota construída é válida (300 rotas)
  [OK] todo comprimento ∈ {14, 16, 18}
  [OK] melhor distância acumulada nunca aumenta
  [OK] melhor final = 14 (rota ótima de referência)
  [OK] métricas coerentes: menor ≤ média ≤ maior comprimento da iteração
  [OK] mesmos dados, parâmetros e semente reproduzem o histórico
  [OK] pausar/retomar (e variar a velocidade) preserva o resultado
  [OK] Reiniciar limpa histórico, restaura τ₀ e a semente (reproduz o mesmo histórico)
  [OK] estado inicial: iteração 0, τ = 1, melhor distância ainda não calculada (null, não 0)
  [OK] sementes diferentes produzem históricos diferentes
  [OK] log de construção: 1º passo da 1ª formiga mostra p = 400/769; 144/769; 225/769 e u coerente  → u = 0,601104; escolhido C

6.5 Efeito dos parâmetros e entradas inválidas
  Comparação β = 0 × β = 2 (demais parâmetros da 6.4; sementes 1 a 5):
    β = 0: melhores finais por semente = [14; 14; 14; 14; 14]; média = 14; atingiram 14: 5 de 5
    β = 2: melhores finais por semente = [14; 14; 14; 14; 14]; média = 14; atingiram 14: 5 de 5
  [OK] todos os resultados finais de β=0 e β=2 pertencem a {14, 16, 18}
  Interpretação: com 4 vértices há só 6 rotas (3 distintas), então 10 formigas × 30 iterações já cobrem o espaço de busca;
  β = 0 e β = 2 empatam e não é possível concluir que a distância ajude nesta instância pequena (ver teste extra abaixo).
  Entradas inválidas (devem impedir a execução, com mensagem clara):
  [OK] cenário e parâmetros de referência são aceitos
  [OK] ρ = 50% é convertido para 0,5
  [OK] coordenadas duplicadas  → "Coordenadas duplicadas: "B" e "A" estão em (0; 0). A distância seria zero."
  [OK] identificadores repetidos  → "Identificador repetido: "a" (vértices 1 e 2)."
  [OK] menos de quatro vértices  → "São necessários pelo menos 4 vértices (há 3). Adicione vértices."
  [OK] mais de doze vértices  → "O máximo é 12 vértices (há 13). Remova vértices."
  [OK] coordenada vazia  → "Vértice 3 (C), coordenada x: campo vazio."
  [OK] coordenada fora do intervalo (1000,01)  → "Vértice 3 (C), coordenada x: 1000,01 está fora do intervalo 0 a 1000."
  [OK] coordenada negativa  → "Vértice 3 (C), coordenada y: -1 está fora do intervalo 0 a 1000."
  [OK] três casas decimais  → "Vértice 3 (C), coordenada y: use no máximo duas casas decimais."
  [OK] coordenada não numérica  → "Vértice 3 (C), coordenada y: "abc" não é um número válido."
  [OK] depósito não selecionado  → "Selecione um dos vértices como depósito."
  [OK] ants = "0"  → "Número de formigas: 0 está fora do intervalo 1 a 100."
  [OK] ants = "101"  → "Número de formigas: 101 está fora do intervalo 1 a 100."
  [OK] ants = "2,5"  → "Número de formigas: "2,5" não é um número inteiro válido."
  [OK] ants = ""  → "Número de formigas: campo vazio."
  [OK] iterations = "201"  → "Número de iterações: 201 está fora do intervalo 1 a 200."
  [OK] alpha = "5,1"  → "Influência do feromônio (α): 5,1 está fora do intervalo 0 a 5."
  [OK] alpha = "-1"  → "Influência do feromônio (α): -1 está fora do intervalo 0 a 5."
  [OK] beta = "6"  → "Influência da distância (β): 6 está fora do intervalo 0 a 5."
  [OK] rho = "91"  → "Taxa de evaporação (ρ): 91% está fora do intervalo 0% a 90%."
  [OK] rho = "-5"  → "Taxa de evaporação (ρ): -5% está fora do intervalo 0% a 90%."
  [OK] tau0 = "0"  → "Feromônio inicial (τ₀): 0 está fora do intervalo 0,01 a 100."
  [OK] tau0 = "100,5"  → "Feromônio inicial (τ₀): 100,5 está fora do intervalo 0,01 a 100."
  [OK] Q = "0,001"  → "Constante de depósito (Q): 0,001 está fora do intervalo 0,01 a 10000."
  [OK] Q = "10001"  → "Constante de depósito (Q): 10001 está fora do intervalo 0,01 a 10000."
  [OK] seed = ""  → "Semente aleatória: campo vazio."
  [OK] seed = "1,5"  → "Semente aleatória: "1,5" não é um número inteiro válido."
  [OK] seed = "x"  → "Semente aleatória: "x" não é um número inteiro válido."
  [OK] limites aceitos: ants 1 e 100, iterations 1 e 200, ρ 0% e 90%, τ₀ 0,01 e 100, Q 0,01 e 10000, α/β 0 e 5

Teste extra — cenário inicial da aplicação (8 vértices) × ótimo por força bruta (7! = 5 040 rotas)
  ótimo exato: A → G → F → E → D → B → C → H → A = 281,335186
  parâmetros padrão da aplicação, sementes 1–5: melhores = [281,335186; 281,335186; 281,335186; 281,335186; 281,335186]
  [OK] todas as execuções encontram rotas válidas com comprimento ≥ ótimo
  [OK] a melhor execução fica a até 5% do ótimo  → melhor 281,335186 × ótimo 281,335186

RESUMO: 81 verificações OK, 0 falhas.
```

### Conclusões

- **6.1 (rotas):** as distâncias e os seis comprimentos (14, 16, 18, 16, 18, 14) coincidem com o enunciado, e rotas incompletas, repetidas ou sem retorno ao depósito são rejeitadas.
- **6.2 (probabilidades):** p(A,B) = 400/769, p(A,C) = 144/769, p(A,D) = 225/769, p(B,C) = 25/41 e p(B,D) = 16/41 batem com os valores esperados; com α = 0 e β = 0 as probabilidades são iguais; com um candidato p = 1. Em 100.000 sorteios as frequências ficaram a menos de 0,01 das probabilidades, e todos os candidatos, inclusive os de menor peso, foram sorteados (a escolha não é gulosa).
- **6.3 (evaporação e depósito):** com uma formiga, todas as arestas vão a 0,5 após a evaporação; AB, BC, CD e AD terminam em 1,5 (o retorno D→A recebe depósito) e AC, BD em 0,5; a segunda iteração dá 1,75 e 0,25; com duas formigas na mesma rota, 2,5 e 0,5 (soma dos depósitos sem atualização durante a construção). Com ρ = 0% nenhuma aresta diminui, e o piso de 10⁻¹² é aplicado.
- **6.4 (execução completa):** com a semente 42 a execução produz 30 registros, todas as 300 rotas são válidas com comprimento 14, 16 ou 18, a melhor distância acumulada nunca aumenta e o resultado final é 14 (A → D → C → B → A, orientação inversa de A → B → C → D → A). Repetir dados, parâmetros e semente reproduz o histórico idêntico; pausar/retomar e variar a velocidade não alteram o resultado. O ótimo foi encontrado já na iteração 1, o que é esperado: com 4 vértices há apenas 3 rotas distintas e 10 formigas as cobrem quase sempre no primeiro lote. A comparação entre sementes diferentes confirma que a semente de fato controla os sorteios.
- **6.5 (parâmetros e entradas inválidas):** com sementes 1 a 5, tanto β = 0 quanto β = 2 tiveram média da melhor distância final igual a 14 e atingiram 14 em 5 das 5 execuções. **Não houve diferença**, e isso era previsto: nesta instância minúscula, 10 formigas × 30 iterações exploram praticamente todo o espaço de busca, de modo que nem a distância nem o feromônio fazem diferença. Para observar o efeito dos parâmetros é preciso uma instância maior (ver teste extra). Coordenadas duplicadas, identificadores repetidos, menos de 4 e mais de 12 vértices, campos vazios, valores fora do intervalo (inclusive três casas decimais e valores não numéricos) e depósito não selecionado bloqueiam a execução com mensagens claras (também verificado na interface).
- **Teste extra (8 vértices):** no cenário inicial da aplicação o ótimo exato, calculado por força bruta (5.040 rotas), é 281,335186 (A → G → F → E → D → B → C → H → A). Com os parâmetros iniciais da aplicação e as sementes 1 a 5, as cinco execuções chegaram a esse valor, mostrando que o Ant System está funcionando também em um problema com mais de um caminho possível. Isso não é garantia: o enunciado não exige o ótimo em todas as execuções, e com poucas formigas ou ρ muito alto o resultado pode ser subótimo.
