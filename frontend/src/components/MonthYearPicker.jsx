import React, { useEffect, useState } from 'react';

export default function MonthYearPicker({ label, value, onChange, startYear = 2015, endYear = 2040 }) {
  // value esperado: "YYYY-MM" ou ""
  const [yy, mm] = (value || '').split('-');
  const parsedYear = yy ? parseInt(yy, 10) : '';
  const parsedMonth = mm ? parseInt(mm, 10) : '';

  // 👇 controla seleção parcial
  const [localYear, setLocalYear] = useState(parsedYear);
  const [localMonth, setLocalMonth] = useState(parsedMonth);

  // quando o value externo mudar, sincroniza
  useEffect(() => {
    setLocalYear(parsedYear);
    setLocalMonth(parsedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const meses = [
    { v: 1, n: 'Mês' }, { v: 1, n: 'Jan' }, { v: 2, n: 'Fev' }, { v: 3, n: 'Mar' }, { v: 4, n: 'Abr' },
    { v: 5, n: 'Mai' }, { v: 6, n: 'Jun' }, { v: 7, n: 'Jul' }, { v: 8, n: 'Ago' },
    { v: 9, n: 'Set' }, { v: 10, n: 'Out' }, { v: 11, n: 'Nov' }, { v: 12, n: 'Dez' },
  ].slice(1); // remove o placeholder extra

  const anos = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  const handleMonth = (m) => {
    const novoMes = m ? Number(m) : '';
    setLocalMonth(novoMes);
    if (localYear && novoMes) {
      onChange(`${String(localYear)}-${String(novoMes).padStart(2, '0')}`);
    }
  };

  const handleYear = (y) => {
    const novoAno = y ? Number(y) : '';
    setLocalYear(novoAno);
    if (novoAno && localMonth) {
      onChange(`${String(novoAno)}-${String(localMonth).padStart(2, '0')}`);
    }
  };

  return (
    <div>
      {label && (
        <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{label}</label>
        )}
      <div className="grid grid-cols-2 gap-3">
        <select
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800
                     focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none
                     dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:focus:ring-blue-500/50"
          value={localMonth || ''}
          onChange={(e) => handleMonth(e.target.value)}
        >
          <option value="">Mês</option>
          {meses.map(m => <option key={m.v} value={m.v}>{m.n}</option>)}
        </select>

        <select
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800
                     focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none
                     dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:focus:ring-blue-500/50"
          value={localYear || ''}
          onChange={(e) => handleYear(e.target.value)}
        >
          <option value="">Ano</option>
          {anos.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
}