/* =========================================================
   Construções, natureza, itens de recinto, cercas e funcionários
   kind define o comportamento; inEnc: true (só dentro de recinto),
   false (só fora), null (qualquer lugar)
   ========================================================= */
(function (ZM) {
  'use strict';

  const O = {};
  function add(id, d) { d.id = id; d.w = d.w || 1; d.h = d.h || 1; O[id] = d; }

  /* ---- Prédios principais ---- */
  add('entrance', { name: 'Entrada e Bilheteria', cat: 'build', icon: '🎟️', cost: 1500, upkeep: 20, w: 2, h: 2, kind: 'entrance', unique: true, inEnc: false, blocks: true, needsPath: true, height: 26, wall: '#d9c7a3', roof: '#b5442e', desc: 'Por onde os visitantes entram. Cobra o ingresso.' });
  add('lab', { name: 'Centro de Pesquisa', cat: 'build', icon: '🔬', cost: 6000, upkeep: 60, w: 2, h: 2, kind: 'lab', inEnc: false, blocks: true, needsPath: false, height: 30, wall: '#e8eef2', roof: '#3d7fa8', desc: 'Pesquisadores trabalham aqui para gerar pontos de pesquisa.' });
  add('clinic', { name: 'Clínica Veterinária', cat: 'build', icon: '🏥', cost: 5000, upkeep: 50, w: 2, h: 2, kind: 'clinic', inEnc: false, blocks: true, needsPath: false, height: 24, wall: '#f4f4f4', roof: '#4caf7a', desc: 'Acelera tratamentos e reduz doenças em 25%.' });
  add('genelab', { name: 'Laboratório de Genética', cat: 'build', icon: '🧬', cost: 8000, upkeep: 70, w: 2, h: 2, kind: 'lab', labType: 'gene', inEnc: false, blocks: true, needsPath: false, height: 28, wall: '#eef0f8', roof: '#7a5cc0', research: 'cons1', desc: 'Pesquisadores podem trabalhar aqui. +30% de reprodução e +25% de Pontos de Conservação. Pesquisas de conservação e veterinária andam 50% mais rápido.' });
  add('aqualab', { name: 'Centro de Biologia Aquática', cat: 'build', icon: '🔭', cost: 9000, upkeep: 80, w: 2, h: 2, kind: 'lab', labType: 'aqua', inEnc: false, blocks: true, needsPath: false, height: 26, wall: '#e2f2f6', roof: '#1f7f97', desc: 'Necessário para pesquisar espécies aquáticas e marinhas. Pesquisadores trabalham aqui (pesquisas aquáticas 50% mais rápidas).' });
  add('workshop', { name: 'Oficina de Manutenção', cat: 'build', icon: '🛠️', cost: 3500, upkeep: 30, w: 2, h: 2, kind: 'workshop', inEnc: false, blocks: true, needsPath: false, height: 22, wall: '#d8d2c4', roof: '#d9822b', desc: 'Base dos técnicos: consertos 2× mais rápidos e desgaste 25% menor em todo o zoológico.' });
  add('warehouse', { name: 'Depósito de Alimentos', cat: 'build', icon: '📦', cost: 3000, upkeep: 25, w: 2, h: 2, kind: 'warehouse', inEnc: false, blocks: true, needsPath: false, height: 22, wall: '#e6dcc4', roof: '#6b8e3a', desc: 'Câmara fria e estoque: comida 15% mais barata e tratadores abastecem 60% mais rápido.' });
  add('staffroom', { name: 'Sala da Equipe', cat: 'build', icon: '☕', cost: 1500, upkeep: 10, kind: 'staffroom', inEnc: false, blocks: true, needsPath: false, height: 16, wall: '#f2ead8', roof: '#8a6a4a', desc: 'Descanso para os funcionários: toda a equipe trabalha 15% mais rápido.' });
  add('edu', { name: 'Centro de Educação Ambiental', cat: 'build', icon: '🏫', cost: 7000, upkeep: 50, w: 2, h: 2, kind: 'educenter', inEnc: false, blocks: true, needsPath: true, height: 26, wall: '#f6e7c8', roof: '#6c9a3a', research: 'edu3', desc: 'Visitantes aprendem sobre conservação. Grande bônus de educação.' });

  /* ---- Lojas ---- */
  add('snack', { name: 'Lanchonete', cat: 'shop', icon: '🍔', cost: 1200, upkeep: 15, kind: 'shop', inEnc: false, blocks: true, needsPath: true, height: 20, wall: '#f2e2c4', roof: '#e0533d', awning: true, sells: 'Lanche', need: 'hunger', amount: 60, price: 12, unitCost: 4, trash: true, desc: 'Vende lanches. Satisfaz a fome.' });
  add('drinks', { name: 'Quiosque de Bebidas', cat: 'shop', icon: '🥤', cost: 800, upkeep: 10, kind: 'shop', inEnc: false, blocks: true, needsPath: true, height: 18, wall: '#e6f1f7', roof: '#2b8fd6', awning: true, sells: 'Suco', need: 'thirst', amount: 70, price: 6, unitCost: 1.5, trash: true, desc: 'Vende bebidas. Satisfaz a sede.' });
  add('icecream', { name: 'Sorveteria', cat: 'shop', icon: '🍦', cost: 1000, upkeep: 12, kind: 'shop', inEnc: false, blocks: true, needsPath: true, height: 18, wall: '#fdeef4', roof: '#e86fa3', awning: true, sells: 'Sorvete', need: 'thirst', amount: 35, fun: 12, price: 8, unitCost: 2.5, trash: true, research: 'vis2', desc: 'Sorvetes refrescam e alegram (ótimo em ondas de calor).' });
  add('souvenir', { name: 'Loja de Souvenirs', cat: 'shop', icon: '🧸', cost: 1500, upkeep: 15, kind: 'shop', inEnc: false, blocks: true, needsPath: true, height: 22, wall: '#efe3f7', roof: '#8a4fc0', awning: true, sells: 'Pelúcia', need: 'souvenir', amount: 0, fun: 15, price: 25, unitCost: 9, desc: 'Visitantes felizes compram lembranças.' });
  add('restaurant', { name: 'Restaurante', cat: 'shop', icon: '🍽️', cost: 4000, upkeep: 40, w: 2, h: 2, kind: 'shop', inEnc: false, blocks: true, needsPath: true, height: 24, wall: '#f5ead6', roof: '#7a4a2a', sells: 'Refeição', need: 'hunger', amount: 95, thirst: 40, fun: 10, price: 30, unitCost: 11, trash: false, research: 'vis3', desc: 'Refeições completas: mata fome e sede e aumenta a felicidade.' });

  /* ---- Infraestrutura ---- */
  add('toilet', { name: 'Banheiro', cat: 'shop', icon: '🚻', cost: 900, upkeep: 10, kind: 'toilet', inEnc: false, blocks: true, needsPath: true, height: 18, wall: '#dfe9ee', roof: '#5a7d8c', desc: 'Essencial. Visitantes apertados ficam muito infelizes.' });
  add('bench', { name: 'Banco', cat: 'shop', icon: '🪑', cost: 120, upkeep: 0, kind: 'bench', inEnc: false, blocks: true, needsPath: true, desc: 'Lugar para descansar (restaura energia).' });
  add('bin', { name: 'Lixeira', cat: 'shop', icon: '🗑️', cost: 80, upkeep: 0, kind: 'bin', inEnc: false, blocks: true, needsPath: false, capacity: 40, desc: 'Visitantes descartam o lixo em lixeiras próximas (raio 4).' });
  add('lamp', { name: 'Poste de luz', cat: 'shop', icon: '💡', cost: 150, upkeep: 2, kind: 'decor', decor: 1, light: true, inEnc: false, blocks: false, desc: 'Ilumina à noite e decora.' });
  add('sign', { name: 'Placa Educativa', cat: 'shop', icon: '🪧', cost: 200, upkeep: 0, kind: 'sign', inEnc: false, blocks: false, needsPath: true, desc: 'Coloque ao lado de um caminho perto de um recinto. Aumenta a educação ambiental.' });
  add('info', { name: 'Ponto de Informação', cat: 'shop', icon: 'ℹ️', cost: 1200, upkeep: 12, kind: 'info', inEnc: false, blocks: true, needsPath: true, height: 16, wall: '#fff5d6', roof: '#e0a020', research: 'edu1', desc: 'Mapas e informações: visitantes ficam mais tempo e aprendem.' });
  add('fountain', { name: 'Chafariz', cat: 'shop', icon: '⛲', cost: 900, upkeep: 4, kind: 'decor', decor: 4, inEnc: false, blocks: true, desc: 'Decoração que alegra quem passa.' });

  /* ---- Itens de recinto ---- */
  add('feeder', { name: 'Comedouro', cat: 'animal', icon: '🥕', cost: 300, upkeep: 2, kind: 'feeder', inEnc: true, blocks: false, capacity: 100, desc: 'Tratadores reabastecem com a comida de cada espécie.' });
  add('trough', { name: 'Bebedouro', cat: 'animal', icon: '🚰', cost: 250, upkeep: 3, kind: 'trough', inEnc: true, blocks: false, capacity: 100, desc: 'Água fresca. Lagos dentro do recinto também servem.' });
  add('shelter', { name: 'Abrigo', cat: 'animal', icon: '🛖', cost: 900, upkeep: 4, kind: 'shelter', inEnc: true, blocks: false, height: 14, desc: 'Abrigo para dormir e se esconder de multidões. Reduz o estresse.' });
  add('ball', { name: 'Bola de enriquecimento', cat: 'animal', icon: '⚽', cost: 150, upkeep: 0, kind: 'toy', enrich: 1, inEnc: true, blocks: false, desc: 'Enriquecimento ambiental: estimula brincadeiras.' });
  add('logs', { name: 'Troncos', cat: 'animal', icon: '🪵', cost: 200, upkeep: 0, kind: 'toy', enrich: 1, foliage: 0.5, inEnc: true, blocks: false, desc: 'Troncos para explorar e arranhar.' });
  add('platform', { name: 'Estrutura de escalada', cat: 'animal', icon: '🪜', cost: 600, upkeep: 1, kind: 'toy', enrich: 2, climb: true, inEnc: true, blocks: false, desc: 'Plataformas e cordas: ótimas para primatas, felinos e aves.' });
  add('hiddenfood', { name: 'Comida escondida', cat: 'animal', icon: '🎁', cost: 250, upkeep: 1, kind: 'toy', enrich: 2, inEnc: true, blocks: false, research: 'food2', desc: 'Caixas com petiscos escondidos: estimula o forrageio.' });

  /* ---- Estruturas aquáticas e polares ---- */
  add('aquafeeder', { name: 'Comedouro aquático', cat: 'animal', icon: '🐟', cost: 400, upkeep: 2, kind: 'feeder', inEnc: true, onWater: true, blocks: false, capacity: 100, research: 'aqua1', desc: 'Plataforma flutuante de alimentação. Deve ficar sobre a água — essencial para animais que só nadam.' });
  add('filter', { name: 'Filtro e bomba d\'água', cat: 'animal', icon: '♒', cost: 1200, upkeep: 15, kind: 'filter', inEnc: true, blocks: false, research: 'aqua1', desc: 'Mantém a qualidade da água do recinto. Cada filtro atende cerca de 25 tiles de água. Técnicos fazem a manutenção.' });
  add('floattoy', { name: 'Brinquedo flutuante', cat: 'animal', icon: '🛟', cost: 300, upkeep: 0, kind: 'toy', enrich: 2, onWater: true, inEnc: true, blocks: false, research: 'aqua1', desc: 'Enriquecimento para golfinhos, botos, ariranhas e leões-marinhos. Fica sobre a água.' });
  add('icemaker', { name: 'Máquina de gelo', cat: 'animal', icon: '🧊', cost: 2500, upkeep: 25, kind: 'icemaker', inEnc: true, blocks: false, research: 'polar1', desc: 'Neve e água gelada constantes. Obrigatória para animais polares.' });
  add('aquaview', { name: 'Visor subaquático', cat: 'build', icon: '🪟', cost: 3500, upkeep: 20, w: 2, h: 1, kind: 'aquaview', inEnc: false, blocks: true, needsPath: true, height: 14, wall: '#cfe8f0', roof: '#2a6f8a', research: 'aqua1', desc: 'Encoste num recinto com água: visitantes veem os animais por baixo d\'água (+40% de atração).' });

  /* ---- Natureza ---- */
  add('acacia', { name: 'Acácia', cat: 'nature', icon: '🌳', cost: 60, upkeep: 0, kind: 'tree', foliage: 1, shade: true, inEnc: null, blocks: false, decor: 1, desc: 'Árvore de savana. Dá sombra.' });
  add('palm', { name: 'Palmeira', cat: 'nature', icon: '🌴', cost: 70, upkeep: 0, kind: 'tree', foliage: 1, shade: true, inEnc: null, blocks: false, decor: 1, desc: 'Palmeira tropical.' });
  add('ipe', { name: 'Ipê-amarelo', cat: 'nature', icon: '🌼', cost: 90, upkeep: 0, kind: 'tree', foliage: 1, shade: true, inEnc: null, blocks: false, decor: 2, desc: 'Árvore símbolo do Brasil, florida.' });
  add('bigtree', { name: 'Árvore frondosa', cat: 'nature', icon: '🌲', cost: 80, upkeep: 0, kind: 'tree', foliage: 1.2, shade: true, inEnc: null, blocks: false, decor: 1, desc: 'Árvore de floresta densa.' });
  add('bush', { name: 'Arbusto', cat: 'nature', icon: '🌿', cost: 25, upkeep: 0, kind: 'bush', foliage: 0.6, inEnc: null, blocks: false, decor: 0.5, desc: 'Vegetação baixa.' });
  add('tallgrass', { name: 'Capim alto', cat: 'nature', icon: '🌾', cost: 15, upkeep: 0, kind: 'bush', foliage: 0.4, inEnc: null, blocks: false, decor: 0.2, desc: 'Capim alto, típico de savana e cerrado.' });
  add('flowers', { name: 'Canteiro de flores', cat: 'nature', icon: '🌺', cost: 30, upkeep: 0, kind: 'bush', foliage: 0.2, inEnc: null, blocks: false, decor: 1.5, desc: 'Decoração colorida.' });
  add('rock', { name: 'Rocha', cat: 'nature', icon: '🪨', cost: 50, upkeep: 0, kind: 'rock', rock: 1, inEnc: null, blocks: false, decor: 0.5, desc: 'Rochas para tomar sol e marcar território.' });

  ZM.OBJECTS = O;

  ZM.FENCES = {
    wood:     { id: 'wood', name: 'Cerca de madeira', level: 1, cost: 22, decay: 1.0, post: '#7a5230', rail: '#a8784a', icon: '🪵', desc: 'Barata. Suficiente para herbívoros pequenos.' },
    metal:    { id: 'metal', name: 'Alambrado de aço', level: 2, cost: 45, decay: 0.6, post: '#5d6870', rail: '#9fb0ba', icon: '⛓️', desc: 'Resistente. Necessária para felinos e animais grandes.' },
    concrete: { id: 'concrete', name: 'Muro com vidro', level: 3, cost: 85, decay: 0.3, post: '#a9a59c', rail: '#bfe4f2', icon: '🧱', research: 'infra1', desc: 'Máxima segurança e visibilidade pelo vidro.' },
    glass:    { id: 'glass', name: 'Parede de aquário', level: 3, cost: 110, decay: 0.35, post: '#5c8fa0', rail: '#9fdcf0', icon: '🐠', research: 'aqua1', watertight: true, desc: 'Vidro acrílico estanque. Obrigatório para tanques de peixes-boi, botos, golfinhos e tubarões.' },
  };

  ZM.PATH_COST = 15;

  ZM.STAFF_ROLES = {
    keeper:      { name: 'Tratador', plural: 'Tratadores', icon: '🧑‍🌾', salary: 120, hire: 200, shirt: '#3f8f3a', hat: '#c8a24a', desc: 'Alimenta animais, repõe água e limpa recintos.' },
    vet:         { name: 'Veterinário', plural: 'Veterinários', icon: '🧑‍⚕️', salary: 200, hire: 400, shirt: '#ffffff', hat: '#3aa0d0', desc: 'Examina e trata animais doentes.' },
    janitor:     { name: 'Faxineiro', plural: 'Faxineiros', icon: '🧹', salary: 80, hire: 100, shirt: '#2f6fb3', hat: '#2f6fb3', desc: 'Recolhe lixo dos caminhos e esvazia lixeiras.' },
    security:    { name: 'Segurança', plural: 'Seguranças', icon: '👮', salary: 110, hire: 200, shirt: '#2b2f3a', hat: '#2b2f3a', desc: 'Patrulha, reduz riscos e captura animais fugitivos.' },
    maintenance: { name: 'Técnico de manutenção', plural: 'Técnicos', icon: '🔧', salary: 110, hire: 200, shirt: '#e08a1e', hat: '#ffcc33', desc: 'Conserta cercas e equipamentos.' },
    researcher:  { name: 'Pesquisador', plural: 'Pesquisadores', icon: '🧑‍🔬', salary: 180, hire: 400, shirt: '#e8e8f0', hat: '#7a5cc0', desc: 'Trabalha no Centro de Pesquisa gerando pontos de pesquisa.' },
  };
  ZM.STAFF_ORDER = ['keeper', 'vet', 'janitor', 'security', 'maintenance', 'researcher'];
})(window.ZM);
