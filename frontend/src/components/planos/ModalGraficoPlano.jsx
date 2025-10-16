import React, { useEffect, useState, useContext } from 'react';
import { Dialog } from '@headlessui/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ThemeContext } from '../../context/ThemeContext';

export default function ModalGraficoPlano({ plano, onClose }) {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const { darkMode } = useContext(ThemeContext);
  const apiBase = import.meta.env.VITE_API_URL ?? "/api";

  useEffect(() => {
    if (!plano?.id) return;
    const carregar = async () => {
      setLoading(true);
      setErro(null);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiBase}/planos-movimentos/evolucao/${plano.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Erro ao buscar evolução');
        const json = await res.json();
        setDados(Array.isArray(json) ? json : []);
      } catch (e) {
        console.error('❌ Erro ao buscar evolução:', e);
        setErro('Não foi possível carregar a evolução.');
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, [plano?.id]);

  const eixoCor = darkMode ? '#9ca3af' : '#4b5563';
  const gridCor = darkMode ? '#334155' : '#e5e7eb';
  const bgTooltip = darkMode ? '#1f2937' : '#ffffff';
  const textTooltip = darkMode ? '#f3f4f6' : '#1f2937';

  return (
    <Dialog open={!!plano} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-2xl">
          <Dialog.Title className="text-lg font-bold text-gray-800 dark:text-darkText mb-4">
            Evolução — {plano?.nome}
          </Dialog.Title>

          {loading && (
            <div className="text-sm text-gray-600 dark:text-gray-300"><div className="animate-pulse h-72 rounded bg-gray-100 dark:bg-gray-700" /></div>
          )}

          {erro && !loading && (
            <div className="text-sm text-red-500">{erro}</div>
          )}

          {!loading && !erro && dados.length === 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Sem dados de evolução para este plano.
            </div>
          )}

          {!loading && !erro && dados.length > 0 && (
            <div className="h-72 rounded-lg border border-transparent dark:border-gray-700/60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dados} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={gridCor} strokeOpacity={0.3} />
                  <XAxis dataKey="mes" stroke={eixoCor} tick={{ fill: eixoCor, fontSize: 12 }} />
                  <YAxis stroke={eixoCor} tick={{ fill: eixoCor, fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="p-3 rounded shadow text-sm" style={{ backgroundColor: bgTooltip, color: textTooltip }}>
                          <p className="font-semibold opacity-80">{label}</p>
                          <p>Arrecadado: <span className="font-medium">R$ {Number(payload[0].value || 0).toLocaleString('pt-BR')}</span></p>
                        </div>
                      );
                    }}
                    cursor={{ strokeOpacity: 0.2 }}
                  />
                  {/* Não definir cor explicitamente (segue padrão do projeto) */}
                  <Area type="monotone" dataKey="arrecadado" name="Arrecadado acumulado" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg"
            >
              Fechar
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}