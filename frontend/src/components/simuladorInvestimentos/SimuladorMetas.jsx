import React, { useState } from 'react';

export default function SimuladorMetas({ bare = false }) {
  const [aporteInicial, setAporteInicial] = useState(1000);
  const [aporteMensal, setAporteMensal] = useState(500);
  const [rentabilidade, setRentabilidade] = useState(0.7); // % mensal

  const prazos = [1, 2, 3, 4, 10, 20]; // anos

const calcular = () => {
  const aporteInicialNum = parseFloat(aporteInicial) || 0;
  const aporteMensalNum = parseFloat(aporteMensal) || 0;
  const rentabilidadeNum = parseFloat(rentabilidade) || 0;
  const taxa = rentabilidadeNum / 100;

  const resultados1 = [];
  const resultados2 = [];

  for (let anos of prazos) {
    const meses = anos * 12;

    // SEM REINVESTIMENTO
    const totalSem = aporteInicialNum + aporteMensalNum * meses;

    // COM REINVESTIMENTO
    let saldo = aporteInicialNum;
    for (let i = 0; i < meses; i++) {
      saldo += aporteMensalNum;
      const rendimento = saldo * taxa;
      saldo += rendimento;
    }

    const dividendoSem = (totalSem * taxa).toFixed(2);
    const dividendoCom = (saldo * taxa).toFixed(2);

    resultados1.push({
      prazo: `${anos} ano${anos > 1 ? 's' : ''}`,
      sem: totalSem.toFixed(2),
      com: saldo.toFixed(2)
    });

    resultados2.push({
      prazo: `${anos} ano${anos > 1 ? 's' : ''}`,
      sem: dividendoSem,
      com: dividendoCom
    });
  }

  return { resultados1, resultados2 };
};

  const { resultados1, resultados2 } = calcular();

  return (
<div className={bare
  ? "p-0 shadow-none rounded-none bg-transparent border-0"
  : "p-6 shadow-md rounded-xl bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder"
}>
    {/* Inputs */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div>
        <label className="block mb-1 font-medium text-gray-800 dark:text-darkText">Aporte Inicial (R$)</label>
        <input
          type="number"
          className="w-full border dark:border-gray-600 rounded px-3 py-1 dark:bg-gray-700 dark:text-darkText"
          value={aporteInicial}
          onChange={e => setAporteInicial(e.target.value)}
        />
      </div>
      <div>
        <label className="block mb-1 font-medium text-gray-800 dark:text-darkText">Aporte Mensal (R$)</label>
        <input
          type="number"
          className="w-full border dark:border-gray-600 rounded px-3 py-1 dark:bg-gray-700 dark:text-darkText"
          value={aporteMensal}
          onChange={e => setAporteMensal(e.target.value)}
        />
      </div>
      <div>
        <label className="block mb-1 font-medium text-gray-800 dark:text-darkText">Rentabilidade Mensal (%)</label>
        <input
          type="number"
          step="0.01"
          className="w-full border dark:border-gray-600 rounded px-3 py-1 dark:bg-gray-700 dark:text-darkText"
          value={rentabilidade}
          onChange={e => setRentabilidade(e.target.value)}
        />
      </div>
    </div>

    {/* Tabelas */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Crescimento do Patrimônio */}
 <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-darkCard shadow-sm">
  <h2 className="font-semibold mb-3 text-center text-gray-800 dark:text-darkText">🔁 Crescimento do Patrimônio</h2>
  <table className="w-full text-sm table-auto border-separate border-spacing-y-2">
          <thead className="bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-darkMuted uppercase">
            <tr>
              <th className="text-center py-2">Prazo</th>
              <th className="text-center py-2">Sem Reinvestir Dividendos</th>
              <th className="text-center py-2">Reinvestindo Dividendos</th>
            </tr>
          </thead>
          <tbody>
            {resultados1.map((r, i) => (
              <tr
                key={i}
                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded shadow-sm"
              >
                <td className="py-2 text-center font-medium text-gray-800 dark:text-darkText">{r.prazo}</td>
                <td className="py-2 text-center text-gray-700 dark:text-darkText">
                  R$ {Number(r.sem).toLocaleString('pt-BR')}
                </td>
                <td className="py-2 text-center text-gray-700 dark:text-darkText">
                  R$ {Number(r.com).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dividendos Mensais */}
   <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-darkCard shadow-sm">
  <h2 className="font-semibold mb-3 text-center text-gray-800 dark:text-darkText">💸 Dividendos Mensais Estimados</h2>
  <table className="w-full text-sm table-auto border-separate border-spacing-y-2">
          <thead className="bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-darkMuted uppercase">
            <tr>
              <th className="text-center py-2">Prazo</th>
              <th className="text-center py-2">Sem Reinvestir Dividendos</th>
              <th className="text-center py-2">Reinvestindo Dividendos</th>
            </tr>
          </thead>
          <tbody>
            {resultados2.map((r, i) => (
              <tr
                key={i}
                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded shadow-sm"
              >
                <td className="py-2 text-center font-medium text-gray-800 dark:text-darkText">{r.prazo}</td>
                <td className="py-2 text-center text-gray-700 dark:text-darkText">
                  R$ {Number(r.sem).toLocaleString('pt-BR')}
                </td>
                <td className="py-2 text-center text-gray-700 dark:text-darkText">
                  R$ {Number(r.com).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
}