import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

function FiltroInvestimentos({ onChange }) {
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  const [mes, setMes] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [limite, setLimite] = useState('10');
  const [nome, setNome] = useState('');

  useEffect(() => {
    if (nome.trim() !== '') {
      onChange({ nome });
    } else {
      onChange({ ano, mes, limite });
    }
  }, [ano, mes, limite, nome]);

  const meses = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const currentYear = new Date().getFullYear();
  const anos = Array.from({ length: 5 }).map((_, i) => (currentYear - i).toString());

  return (
        <div className="bg-white dark:bg-darkCard rounded-xl shadow px-3 py-4 w-auto border border-gray-100 dark:border-darkBorder">
      <div className="flex items-center gap-4">
        <span className="self-center text-sm font-medium text-gray-600 dark:text-darkText">Filtros:</span>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-1">
          {/* Nome */}
          <div className="min-w-[200px]">
            <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Buscar por nome"
              className="h-10 w-full rounded-lg border bg-white px-3 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
            />
          </div>

          {/* Só mostra os demais quando Nome estiver vazio */}
          {nome.trim() === '' && (
            <>
              {/* Ano */}
              <div className="min-w-[120px]">
                <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Ano</label>
                <div className="relative">
                  <select
                    value={ano}
                    onChange={(e) => setAno(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10
                               text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                               dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
                  >
                    <option value="todos">Todos</option>
                    {anos.map((y) => (<option key={y} value={y}>{y}</option>))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
                </div>
              </div>

              {/* Mês */}
              <div className="min-w-[160px]">
                <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Mês</label>
                <div className="relative">
                  <select
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10
                               text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                               dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
                  >
                    <option value="todos">Todos</option>
                    {meses.map((m, idx) => {
                      const label = cap(new Date(0, idx).toLocaleString('pt-BR', { month: 'long' }));
                      return <option key={m} value={m}>{label}</option>;
                    })}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
                </div>
              </div>

              {/* Quantidade */}
              <div className="min-w-[140px]">
                <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Quantidade</label>
                <div className="relative">
                  <select
                    value={limite}
                    onChange={(e) => setLimite(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10
                               text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                               dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
                  >
                    <option value="10">10</option>
                    <option value="30">30</option>
                    <option value="50">50</option>
                    <option value="todos">Todos</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default FiltroInvestimentos;