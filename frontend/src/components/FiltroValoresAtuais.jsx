// FiltroValoresAtuais.jsx
import React, { useEffect, useState } from 'react';

function FiltroValoresAtuais({ onChange }) {
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  const [mes, setMes] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));

  useEffect(() => {
    onChange({ ano, mes });
  }, [ano, mes]);

  const meses = [
    '01', '02', '03', '04', '05', '06',
    '07', '08', '09', '10', '11', '12'
  ];

  return (
    <div className="flex flex-wrap gap-4 bg-white p-4 rounded shadow-md items-end">
      <div className="flex flex-col">
        <label className="text-sm text-gray-600">Ano</label>
        <select value={ano} onChange={(e) => setAno(e.target.value)} className="border rounded px-2 py-1">
          {Array.from({ length: 5 }).map((_, i) => {
            const y = (new Date().getFullYear() - i).toString();
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-sm text-gray-600">Mês</label>
        <select value={mes} onChange={(e) => setMes(e.target.value)} className="border rounded px-2 py-1">
          {meses.map((m, idx) => (
            <option key={m} value={m}>{new Date(0, idx).toLocaleString('pt-BR', { month: 'long' })}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default FiltroValoresAtuais;