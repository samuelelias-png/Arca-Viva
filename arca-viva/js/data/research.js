/* =========================================================
   Árvore de pesquisa
   rp = pontos de pesquisa necessários; money = custo para iniciar
   effect: species[], objects[], fences[], mods{chave: multiplicador}
   ========================================================= */
(function (ZM) {
  'use strict';

  ZM.RESEARCH_CATS = {
    veterinaria: { name: 'Veterinária', icon: '🩺' },
    alimentacao: { name: 'Alimentação', icon: '🥗' },
    habitats: { name: 'Habitats e espécies', icon: '🌿' },
    aquaticos: { name: 'Aquáticos e marinhos', icon: '🌊' },
    infraestrutura: { name: 'Infraestrutura', icon: '🏗️' },
    conservacao: { name: 'Conservação', icon: '🧬' },
    visitantes: { name: 'Visitantes', icon: '🎈' },
    educacao: { name: 'Educação', icon: '📚' },
  };

  const R = [
    // Veterinária
    { id: 'vet1', cat: 'veterinaria', name: 'Veterinária I', rp: 10, money: 800, req: [], effect: { mods: { vetSpeed: 1.3 } }, desc: 'Tratamentos 30% mais rápidos.' },
    { id: 'vet2', cat: 'veterinaria', name: 'Tratamentos avançados', rp: 20, money: 1500, req: ['vet1'], effect: { mods: { healAmount: 1.5 } }, desc: 'Animais tratados recuperam mais saúde.' },
    { id: 'vet3', cat: 'veterinaria', name: 'Prevenção de doenças', rp: 30, money: 2500, req: ['vet2'], effect: { mods: { disease: 0.5 } }, desc: 'Chance de doenças cai pela metade.' },
    // Alimentação
    { id: 'food1', cat: 'alimentacao', name: 'Nutrição balanceada', rp: 8, money: 600, req: [], effect: { mods: { foodCost: 0.8 } }, desc: 'Comida 20% mais barata.' },
    { id: 'food2', cat: 'alimentacao', name: 'Forrageio estimulado', rp: 14, money: 900, req: ['food1'], effect: { objects: ['hiddenfood'] }, desc: 'Libera o item "Comida escondida".' },
    { id: 'food3', cat: 'alimentacao', name: 'Dietas especiais', rp: 24, money: 1800, req: ['food2'], effect: { mods: { hungerRate: 0.85 } }, desc: 'Animais sentem fome 15% mais devagar.' },
    // Habitats e espécies
    { id: 'hab1', cat: 'habitats', name: 'Fauna brasileira I', rp: 10, money: 1000, req: [], effect: { species: ['anta', 'tamandua'] }, desc: 'Libera Anta e Tamanduá-bandeira.' },
    { id: 'hab2', cat: 'habitats', name: 'Répteis e aves', rp: 16, money: 1400, req: ['hab1'], effect: { species: ['jacare', 'arara'] }, desc: 'Libera Jacaré-do-papo-amarelo e Arara-azul.' },
    { id: 'hab3', cat: 'habitats', name: 'Predadores do Brasil', rp: 26, money: 2500, req: ['hab2'], effect: { species: ['loboguara', 'onca'] }, desc: 'Libera Lobo-guará e Onça-pintada (exigem Pontos de Conservação).' },
    { id: 'hab4', cat: 'habitats', name: 'Primatas', rp: 30, money: 3000, req: ['hab2'], effect: { species: ['mico', 'chimpanze'] }, desc: 'Libera Mico-leão-dourado e Chimpanzé.' },
    { id: 'hab5', cat: 'habitats', name: 'Megafauna africana', rp: 40, money: 5000, req: ['hab3', 'infra1'], effect: { species: ['hipopotamo', 'elefante', 'rinoceronte'] }, desc: 'Libera Hipopótamo, Elefante-africano e Rinoceronte-branco.' },
    { id: 'hab6', cat: 'habitats', name: 'Fauna brasileira II', rp: 16, money: 1800, req: ['hab1'], effect: { species: ['ema', 'tatucanastra', 'tucano', 'quati', 'vinagre', 'preguica'] }, desc: 'Libera Ema, Tatu-canastra, Tucano, Quati, Cachorro-vinagre e Preguiça.' },
    { id: 'hab7', cat: 'habitats', name: 'Savanas e desertos', rp: 14, money: 1500, req: ['hab1'], effect: { species: ['avestruz', 'canguru', 'suricato'] }, desc: 'Libera Avestruz, Canguru-vermelho e Suricato.' },
    { id: 'hab8', cat: 'habitats', name: 'Grandes predadores', rp: 32, money: 4000, req: ['hab3'], effect: { species: ['tigre', 'ursopardo', 'lobo', 'sucuarana'] }, desc: 'Libera Tigre, Urso-pardo, Lobo-cinzento e Onça-parda.' },
    { id: 'hab9', cat: 'habitats', name: 'Grandes símios', rp: 40, money: 5000, req: ['hab4'], effect: { species: ['gorila'] }, desc: 'Libera o Gorila-do-ocidente (criticamente ameaçado).' },
    // Aquáticos e marinhos (exigem o Centro de Biologia Aquática)
    { id: 'aqua1', cat: 'aquaticos', name: 'Biologia de água doce', rp: 16, money: 2500, req: [], reqBuilding: 'aqualab', effect: { species: ['ariranha', 'peixeboi', 'boto'], objects: ['aquafeeder', 'filter', 'floattoy', 'aquaview'], fences: ['glass'] }, desc: 'Libera Ariranha, Peixe-boi e Boto, a Parede de aquário, filtros, comedouro aquático e visor subaquático.' },
    { id: 'aqua2', cat: 'aquaticos', name: 'Biologia marinha', rp: 24, money: 3500, req: ['aqua1'], effect: { species: ['pinguim', 'leaomarinho', 'tartaruga'], terrain: ['salt'] }, desc: 'Libera Água salgada, Pinguim, Leão-marinho e Tartaruga-verde.' },
    { id: 'aqua3', cat: 'aquaticos', name: 'Oceanário', rp: 36, money: 6000, req: ['aqua2'], effect: { species: ['golfinho', 'tubarao'] }, desc: 'Libera Golfinho e Tubarão-lixa (exigem tanque grande de água salgada).' },
    { id: 'polar1', cat: 'aquaticos', name: 'Ambientes polares', rp: 30, money: 5000, req: ['aqua2'], effect: { species: ['ursopolar'], objects: ['icemaker'], terrain: ['snow'] }, desc: 'Libera Neve e gelo, Máquina de gelo e o Urso-polar.' },
    // Infraestrutura
    { id: 'infra1', cat: 'infraestrutura', name: 'Cercas reforçadas', rp: 12, money: 1200, req: [], effect: { fences: ['concrete'] }, desc: 'Libera o Muro com vidro (nível 3).' },
    { id: 'infra2', cat: 'infraestrutura', name: 'Manutenção eficiente', rp: 18, money: 1500, req: ['infra1'], effect: { mods: { decay: 0.6 } }, desc: 'Cercas e equipamentos se desgastam 40% menos.' },
    { id: 'infra3', cat: 'infraestrutura', name: 'Energia solar', rp: 26, money: 3500, req: ['infra2'], effect: { mods: { utility: 0.6 } }, desc: 'Custos de manutenção diária 40% menores.' },
    // Conservação
    { id: 'cons1', cat: 'conservacao', name: 'Programa de reprodução', rp: 14, money: 1500, req: [], effect: { mods: { breeding: 1.5 }, objects: ['genelab'] }, desc: 'Reprodução 50% mais provável. Libera o Laboratório de Genética.' },
    { id: 'cons2', cat: 'conservacao', name: 'Parcerias internacionais', rp: 22, money: 2500, req: ['cons1'], effect: { mods: { cpMult: 1.5 } }, desc: '+50% de Pontos de Conservação.' },
    { id: 'cons3', cat: 'conservacao', name: 'Banco genético', rp: 34, money: 4000, req: ['cons2'], effect: { mods: { cpMult: 1.3, breeding: 1.2 } }, desc: 'Mais conservação e reprodução saudável.' },
    // Visitantes
    { id: 'vis1', cat: 'visitantes', name: 'Marketing digital', rp: 8, money: 1000, req: [], effect: { mods: { spawn: 1.15 } }, desc: '+15% de visitantes.' },
    { id: 'vis2', cat: 'visitantes', name: 'Gelados artesanais', rp: 10, money: 700, req: ['vis1'], effect: { objects: ['icecream'] }, desc: 'Libera a Sorveteria.' },
    { id: 'vis3', cat: 'visitantes', name: 'Gastronomia', rp: 18, money: 1800, req: ['vis2'], effect: { objects: ['restaurant'] }, desc: 'Libera o Restaurante.' },
    // Educação
    { id: 'edu1', cat: 'educacao', name: 'Comunicação científica', rp: 8, money: 600, req: [], effect: { objects: ['info'] }, desc: 'Libera o Ponto de Informação.' },
    { id: 'edu2', cat: 'educacao', name: 'Trilhas educativas', rp: 16, money: 1200, req: ['edu1'], effect: { mods: { education: 1.5 } }, desc: 'Placas ensinam 50% mais.' },
    { id: 'edu3', cat: 'educacao', name: 'Educação ambiental', rp: 28, money: 3000, req: ['edu2'], effect: { objects: ['edu'] }, desc: 'Libera o Centro de Educação Ambiental.' },
  ];

  ZM.RESEARCH = {};
  R.forEach((r) => (ZM.RESEARCH[r.id] = r));
  ZM.RESEARCH_LIST = R;
})(window.ZM);
