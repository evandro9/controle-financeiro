const express = require('express');
const router = express.Router();

// Helper para janelas por período
function rangeFromPeriodo(periodo = 'ano') {
  const today = new Date();
  const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  let start;
  if (periodo === '12m') {
    start = new Date(end); start.setUTCDate(start.getUTCDate() - 365);
  } else if (periodo === '24m') {
    start = new Date(end); start.setUTCDate(start.getUTCDate() - 730);
  } else if (periodo === 'inicio') {
    start = new Date(Date.UTC(2000, 0, 1));
  } else { // 'ano'
    start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
  }
  const toISO = (d) => d.toISOString().slice(0,10);
  return { startISO: toISO(start), endISO: toISO(end) };
}


// IBOV - Yahoo Finance
router.get('/ibov/:ano', async (req, res) => {
  try {
    const { ano } = req.params;
    const { periodo = 'ano' } = req.query;

    // Importa yahoo-finance2 apenas dentro da função (evita erro ESM)
    const yahooFinance = (await import('yahoo-finance2')).default;

        const fetchAno = async (a) => {
      const start = `${a}-01-01`;
      const end = `${a}-12-31`;
      const result = await yahooFinance.historical('^BVSP', {
        period1: start,
        period2: end,
        interval: '1mo'
      });
      // Usa UTC para evitar off-by-one de fuso
      return result.map(r => {
        const d = new Date(r.date);
        return {
          ano: d.getUTCFullYear(),
          mes: d.getUTCMonth() + 1,
          close: r.close,
          adjClose: r.adjClose ?? r.close
        };
      });
    };

    // Junta anos necessários e calcula retorno de fechamento->fechamento
    let meses = await fetchAno(Number(ano));
    const addPrev = async (y) => { meses = [...(await fetchAno(y)), ...meses]; };

    if (periodo === 'ano') {
      // precisamos do dezembro do ano anterior para formar o retorno de janeiro
      await addPrev(Number(ano) - 1);
    } else if (periodo === '12m') {
      await addPrev(Number(ano) - 1);
    } else if (periodo === '24m') {
      await addPrev(Number(ano) - 1);
      await addPrev(Number(ano) - 2);
    } else if (periodo === 'inicio') {
      let cursor = Number(ano) - 1;
      let rounds = 0;
      while (cursor >= 2000 && rounds < 20) {
        await addPrev(cursor);
        cursor--; rounds++;
      }
    }

    // Ordena e remove possíveis duplicatas (YYYY-MM)
    const key = (m) => `${m.ano}-${String(m.mes).padStart(2,'0')}`;
    const uniq = new Map();
    meses.sort((a,b)=> a.ano - b.ano || a.mes - b.mes).forEach(m => uniq.set(key(m), m));
    const serie = Array.from(uniq.values());

    // Retornos mensais via close(t)/close(t-1) - 1
    const retornos = [];
    for (let i = 1; i < serie.length; i++) {
      const prev = serie[i-1].adjClose ?? serie[i-1].close;
      const cur  = serie[i].adjClose ?? serie[i].close;
      if (prev && cur) {
        const valor = ((cur - prev) / prev) * 100;
        retornos.push({
          ano: serie[i].ano,
          mes: serie[i].mes,
          valor: parseFloat(valor.toFixed(2))
        });
      }
    }

    let saida = [...retornos];
    if (periodo === 'ano') {
      // agora janeiro existe porque adicionamos o ano anterior
      saida = saida.filter(r => r.ano === Number(ano));
    } else if (periodo === '12m') {
      saida = saida.slice(-12);
    } else if (periodo === '24m') {
      saida = saida.slice(-24);
    }

    res.json(saida);
  } catch (err) {
    console.error('Erro ao buscar IBOV:', err);
    res.status(500).json({ error: 'Erro ao buscar IBOV' });
  }
});

// CDI - Banco Central (fetch nativo no Node 18+)
router.get('/cdi/:ano', async (req, res) => {
  try {
    const { ano } = req.params;
    const { periodo = 'ano' } = req.query;
    const inicio = `01/01/${ano}`;
    const fim = `31/12/${ano}`;

    const fetchAno = async (a) => {
      const ini = `01/01/${a}`;
      const fi  = `31/12/${a}`;
      const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${ini}&dataFinal=${fi}`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) return [];
      const porMes = {};
      for (const item of data) {
        const [dia, mes] = item.data.split('/');  // dd/mm/yyyy
        const v = parseFloat(item.valor.replace(',', '.'));
        if (!porMes[mes]) porMes[mes] = [];
        porMes[mes].push(v);
      }
      const mensais = Object.keys(porMes).map((mesStr) => {
        const arr = porMes[mesStr];
        const dailyPercents = arr.map((v) => {
          if (v > 2) {
            const dailyFraction = Math.pow(1 + v / 100, 1 / 252) - 1;
            return dailyFraction * 100;
          }
          return v;
        });
        const fator = dailyPercents.reduce((acc, p) => acc * (1 + p / 100), 1);
        const mensalPercent = (fator - 1) * 100;
        return { ano: Number(a), mes: parseInt(mesStr, 10), valor: parseFloat(mensalPercent.toFixed(2)) };
      }).sort((a, b) => a.mes - b.mes);
      return mensais;
    };

    let dados = await fetchAno(ano);

    if (periodo === '12m') {
      const prev = await fetchAno(Number(ano) - 1);
      dados = [...prev, ...dados].slice(-12);
    } else if (periodo === '24m') {
      const prev = await fetchAno(Number(ano) - 1);
      dados = [...prev, ...dados].slice(-24);
    } else if (periodo === 'inicio') {
      let cursor = Number(ano) - 1;
      let rounds = 0;
      while (cursor >= 2000 && rounds < 20) {
        const prev = await fetchAno(cursor);
        if (!prev || prev.length === 0) break;
        dados = [...prev, ...dados];
        cursor--;
        rounds++;
      }
    }

    res.json(dados);
  } catch (err) {
    console.error('❌ Erro ao buscar CDI:', err);
    res.json([]);
  }
});

// 🟦 IBOV DIÁRIO: close->close % por dia, filtrado por período
router.get('/ibov-diario', async (req, res) => {
  try {
    const { periodo = 'ano' } = req.query;
    const { startISO, endISO } = rangeFromPeriodo(periodo);
    const startObj = new Date(startISO);
    // pegar preço do dia anterior p/ calcular retorno do 1º dia
    const startPad = new Date(startObj); startPad.setUTCDate(startPad.getUTCDate() - 7);

    const yahooFinance = (await import('yahoo-finance2')).default;
    const result = await yahooFinance.historical('^BVSP', {
      period1: startPad.toISOString().slice(0,10),
      period2: endISO,
      interval: '1d'
    });

    // Ordena, remove duplicatas e calcula retorno diário
    const rows = (result || []).map(r => ({
      date: new Date(r.date),
      close: r.adjClose ?? r.close ?? null
    })).filter(r => !!r.close).sort((a,b)=> a.date - b.date);

    const out = [];
    for (let i=1;i<rows.length;i++){
      const prev = rows[i-1], cur = rows[i];
      const pct = ((cur.close - prev.close) / prev.close) * 100;
      const iso = new Date(Date.UTC(cur.date.getUTCFullYear(), cur.date.getUTCMonth(), cur.date.getUTCDate()))
        .toISOString().slice(0,10);
      if (iso >= startISO && iso <= endISO) {
        out.push({ date: iso, valor: Number(pct.toFixed(4)) });
      }
    }
    res.json(out);
  } catch (err) {
    console.error('❌ Erro ao buscar IBOV diário:', err);
    res.json([]);
  }
});

// 🟩 CDI DIÁRIO: usa série BCB (sgs 12), converte para % diária
router.get('/cdi-diario', async (req, res) => {
  try {
    const { periodo = 'ano' } = req.query;
    const { startISO, endISO } = rangeFromPeriodo(periodo);
    const fmt = (iso) => {
      const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`;
    };
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${fmt(startISO)}&dataFinal=${fmt(endISO)}`;
    const r = await fetch(url);
    if (!r.ok) return res.json([]);
    const data = await r.json();
    const out = [];
    for (const it of (data || [])) {
      const [dd,mm,yyyy] = String(it.data).split('/');
      const iso = `${yyyy}-${mm}-${dd}`;
      const v = parseFloat(String(it.valor).replace(',', '.'));
      // Heurística: valores > 2% tratamos como taxa anual; converte p/ diária base 252
      const dailyPct = (v > 2)
        ? ((Math.pow(1 + v/100, 1/252) - 1) * 100)
        : v;
      out.push({ date: iso, valor: Number(dailyPct.toFixed(4)) });
    }
    // Ordena e garante janela
    out.sort((a,b)=> a.date.localeCompare(b.date));
    res.json(out.filter(x => x.date >= startISO && x.date <= endISO));
  } catch (err) {
    console.error('❌ Erro ao buscar CDI diário:', err);
    res.json([]);
  }
});

module.exports = router;