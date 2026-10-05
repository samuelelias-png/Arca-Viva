# Arca Viva — Gestão de Zoológico (protótipo v0.2)

Jogo de administração de zoológico para navegador, em HTML5 Canvas + JavaScript puro, sem dependências.
Abra `index.html` com duplo clique (funciona sem servidor) ou sirva a pasta com qualquer servidor estático.

## Estrutura

```
index.html              página e ordem de carregamento dos scripts
css/style.css           interface (HUD, gaveta, painéis, modais, escala 100/115/130%)
js/core/core.js         namespace ZM, configuração, utilidades, eventos, terrenos
js/data/                dados de jogo (fácil de balancear/expandir)
  species.js            39 espécies (30 terrestres e 9 aquáticas/marinhas), biomas, alimentos
  objects.js            construções, lojas, itens de recinto, natureza, cercas, funcionários
  research.js           árvore de pesquisa (8 categorias, 31 pesquisas)
  scenarios.js          tutorial, campanha (4 fases com problemas próprios) e modo livre
  prefabs.js            5 habitats aquáticos prontos (colocados como um prédio)
js/world/
  map.js                mapa em grade (arrays tipados), A*, marcação de regiões alteradas
  access.js             rede de caminhos ligada à entrada e área por onde a equipe circula
  enclosure.js          recintos, portão, pontos de observação, adequação do habitat
  buildings.js          objetos e desgaste
  construction.js       construir, mover, demolir, recintos e habitats prontos (com desfazer)
js/entities/            Agent (base), Animal, Visitor, Staff — cada um com máquina de estados
js/systems/
  economy.js            livro-caixa (operação separada de investimento)
  diagnostics.js        diagnóstico por recinto/espécie, prévia de compra, carga da equipe
  undo.js               pilha de desfazer (arrastos viram uma única ação)
  services.js           lojas e banheiros com capacidade, fila e desistências; lixo; placas
  research.js, events.js, missions.js (metas de vários dias), audio.js (ambiente pela câmera)
js/zoo.js               estado do jogo e laço de simulação (passo fixo)
js/render/              câmera isométrica, cache de terreno com atualização por região,
                        camadas de informação, transparência de árvores/prédios, sprites procedurais
js/ui/                  HUD, catálogo com busca e filtros, painel lateral, modais, entrada
js/save.js              localStorage: 3 slots + autosave, versão, migração e validação
js/game.js              inicialização, laço principal e aviso de falha no autosave
tests/                  testes da simulação (node tests/run-tests.js)
```

## O que mudou na versão 0.2

**Correções.** O save guarda visitantes (necessidades e atividade), fugas, tranquilização e retorno.
Rotas são revalidadas quando o mapa muda. Cada comedouro recebe a comida certa (automático ou fixo) e
cada animal só come a própria dieta. O autosave avisa quando falha e mostra o último salvamento bom.

**Acesso e diagnóstico.**
- Lojas e pontos de observação só contam caminhos ligados à entrada.
- O painel do recinto diz o que falta para cada espécie e oferece ações: localizar, ver o funcionário,
  contratar, pintar terreno, trocar a cerca, abrir a camada certa.
- Camadas do mapa: acesso, limpeza, bem-estar e equipe.

**Ferramentas.**
- Desfazer (Ctrl+Z) e mover construções (M).
- Custo e reembolso aparecem antes de confirmar.
- Busca e filtros no catálogo, com o requisito de desbloqueio escrito em cada carta.
- Alertas repetidos viram um só com contador, e os mais graves ficam em destaque.

**Profundidade.**
- Comportamentos próprios por espécie e personalidade: capivaras em grupo na água, felinos alternando
  descanso, patrulha e observação, primatas e preguiças escalando, tamanduás cavando, suricatos de sentinela.
- Prévia de compra: espaço, grupo, sexo, comida, cerca, compatibilidade e habitat. Uma compra arriscada pede
  um segundo clique.
- Equipe com prioridades por tarefa, ocupação e motivo de tarefas não atendidas.
- Finanças com resultado operacional, investimentos, previsão de custos recorrentes e desempenho por loja.
- Visitantes enfrentam fila e capacidade e registram por que desistiram.

**Campanha.**
1. Tutorial.
2. Recuperar um zoológico deteriorado com caixa curto.
3. Reorganizar a circulação e reproduzir uma espécie ameaçada.
4. Parque aquático com manutenção e qualidade da água.

Várias metas exigem dias seguidos.

**Desempenho.** Medido num parque cheio (60 animais, 350 visitantes) no Chromium sem GPU:
- Refazer o cache inteiro do terreno levava ~650 ms a cada construção. Agora só a região alterada é
  redesenhada (~20–90 ms).
- Quadro: ~21–27 ms. Passo da simulação: ~0,3 ms.

## Aquáticos e marinhos

- Terrenos: Água doce, Água salgada (pesquisa Biologia marinha) e Neve e gelo (Ambientes polares).
- Os 9 animais aquáticos e marinhos só moram em habitats prontos (Construção ▸ Habitats aquáticos):
  Tanque Amazônico, Costão Rochoso, Aquário de Recife, Oceanário e Domo Polar.
- A pesquisa aquática exige o Centro de Biologia Aquática.

## Pontos de extensão

- **Nova espécie:** adicione um bloco em `js/data/species.js` e, se quiser, os pesos de comportamento em
  `ZM.BEHAVIOR` (`js/entities/animal.js`).
- **Nova construção:** adicione em `js/data/objects.js` com um `kind` existente (shop, toilet, toy...).
- **Sons reais:** `ZM.Audio.register('birth', 'assets/sounds/birth.mp3')` substitui o placeholder.
- **Formato de save:** aumente `ZM.SAVE_VERSION` e escreva a migração em `js/save.js`.

## Controles

- **Câmera:** WASD/setas ou arrastar para mover · roda para zoom.
- **Tempo:** Espaço pausa · 1/2/3 velocidade.
- **Construção:** Esc cancela/menu · Del demole o selecionado · Ctrl+Z desfaz · M move.
- **Visão:** L troca a camada · G mostra a grade.
- **Interface:** tamanho em Menu ▸ Tamanho da interface.
