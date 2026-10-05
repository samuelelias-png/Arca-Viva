/* =========================================================
   Economia: livro-caixa diário por categoria e histórico
   ========================================================= */
(function (ZM) {
  'use strict';

  ZM.LEDGER_LABELS = {
    ingressos: 'Ingressos', lojas: 'Lojas e alimentação', doacoes: 'Doações', conservacao: 'Programas de conservação',
    patrocinio: 'Patrocínios', eventos: 'Eventos e prêmios', vendas: 'Venda de animais', reembolso: 'Reembolso de demolições',
    animais: 'Compra de animais', cuidados: 'Cuidados com os animais', salarios: 'Salários', contratacao: 'Contratações', alimentacao: 'Alimentação animal',
    manutencao: 'Manutenção', construcao: 'Construção', pesquisa: 'Pesquisa', veterinario: 'Veterinário/medicamentos',
    agua: 'Água', energia: 'Energia e operação', estoque: 'Estoque das lojas', multas: 'Multas',
  };
  ZM.INCOME_CATS = ['ingressos', 'lojas', 'doacoes', 'conservacao', 'patrocinio', 'eventos', 'vendas', 'reembolso'];
  /* investimento (compras e obras) fica separado do resultado operacional */
  ZM.INVEST_CATS = ['construcao', 'animais', 'contratacao', 'pesquisa', 'vendas', 'reembolso', 'eventos'];

  class Economy {
    constructor() { this.today = this.blank(); this.history = []; }
    blank() { return { income: {}, expense: {} }; }
    earn(v, cat) { this.today.income[cat] = (this.today.income[cat] || 0) + v; }
    spend(v, cat) { this.today.expense[cat] = (this.today.expense[cat] || 0) + v; }
    totals(day = this.today) {
      let inc = 0, exp = 0;
      Object.values(day.income).forEach((v) => (inc += v));
      Object.values(day.expense).forEach((v) => (exp += v));
      return { income: inc, expense: exp, profit: inc - exp };
    }
    endDay(zoo) {
      const t = this.totals();
      const rec = {
        day: zoo.day, income: t.income, expense: t.expense, profit: t.profit,
        visitors: zoo.stats.visitorsToday, satisfaction: Math.round(zoo.stats.satAvg), welfare: Math.round(zoo.avgWelfare()),
        reputation: +zoo.reputation.toFixed(2), education: Math.round(zoo.education), cp: Math.round(zoo.cp),
        breakdown: JSON.parse(JSON.stringify(this.today)),
      };
      this.history.push(rec);
      if (this.history.length > 60) this.history.shift();
      this.today = this.blank();
      return rec;
    }
    toJSON() { return { today: this.today, history: this.history }; }
    static fromJSON(d) { const e = new Economy(); if (d) { e.today = d.today || e.blank(); e.history = d.history || []; } return e; }
  }
  ZM.Economy = Economy;
})(window.ZM);
