import React from 'react';
import { useEffect, useState } from 'react';
import SelectMes from './selectMes'; // ou o caminho real

function FiltroPeriodo({ ano, setAno, mes, setMes, onChange }) {
  const [mesesDisponiveis, setMesesDisponiveis] = useState([]);

  const nomeDosMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  useEffect(() => {
    const token = localStorage.getItem('token');

    fetch(`/api/lancamentos/meses-disponiveis?ano=${ano}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Não autorizado');
        const data = await res.json();
        setMesesDisponiveis(Array.isArray(data) ? data : []);
      })
      .catch(() => alert('Erro ao carregar meses disponíveis'));
  }, [ano]);

  useEffect(() => {
    if (onChange) onChange({ ano, mes });
  }, [ano, mes]);

 return (
  <div className="flex gap-2 text-sm">
    <input
      type="number"
      value={ano}
      onChange={(e) => setAno(parseInt(e.target.value))}
      className="w-24 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Ano"
    />

  <SelectMes mes={mes} setMes={setMes} mesesDisponiveis={mesesDisponiveis} />
  </div>
);
}

export default FiltroPeriodo;
