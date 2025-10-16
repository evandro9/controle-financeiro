// AtualizarValores.jsx
import React, { useEffect, useState } from 'react';
import FiltroValoresAtuais from '../components/FiltroValoresAtuais';
import { DollarSign } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function AtualizarValores() {
  const [filtro, setFiltro] = useState({
    ano: new Date().getFullYear().toString(),
    mes: (new Date().getMonth() + 1).toString().padStart(2, '0')
  });
  const [valores, setValores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    buscarOuPreencher();
  }, [filtro]);

  const buscarOuPreencher = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/valores-atuais?ano=${filtro.ano}&mes=${filtro.mes}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      const res2 = await fetch('/api/investimentos/todos', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const todosInvest = await res2.json();

      const dataLimite = new Date(filtro.ano, parseInt(filtro.mes), 0);
      const ativosComQuantidade = {};

      todosInvest.forEach((inv) => {
        const dataOp = new Date(inv.data_operacao);
        if (dataOp <= dataLimite) {
          const nome = inv.nome_investimento;
          const mult = inv.tipo_operacao === 'compra' ? 1 : -1;
          if (!ativosComQuantidade[nome]) ativosComQuantidade[nome] = 0;
          ativosComQuantidade[nome] += mult * inv.quantidade;
        }
      });

      const ativosRestantes = Object.entries(ativosComQuantidade)
        .filter(([_, qtd]) => qtd > 0)
        .map(([nome, qtd]) => {
          const existente = data.find(v => v.nome_investimento === nome);
          const dataRef = new Date(filtro.ano, parseInt(filtro.mes), 0).toISOString().split('T')[0];

          return {
            nome_investimento: nome,
            data_referencia: dataRef,
            quantidade: qtd,
            preco_unitario: existente?.preco_unitario || '',
            valor_total: existente?.valor_total || ''
          };
        });

      setValores(ativosRestantes);
    } catch (err) {
      console.error('Erro ao buscar valores ou ativos:', err);
    } finally {
      setLoading(false);
    }
  };

  const atualizarCampo = (index, campo, valor) => {
    const novos = [...valores];
    novos[index][campo] = valor;

    if (campo === 'preco_unitario') {
      const qtd = parseFloat(novos[index].quantidade);
      const preco = parseFloat(valor);
      novos[index].valor_total = isNaN(qtd * preco) ? '' : (qtd * preco).toFixed(2);
    }

    setValores(novos);
  };

  const salvar = async () => {
  const algumVazio = valores.some(v => v.preco_unitario === '' || v.preco_unitario === null);
  if (algumVazio) {
    toast.warn('⚠️ Preencha o preço unitário de todos os ativos antes de salvar.');
    return;
  }

  const token = localStorage.getItem('token');
  for (const item of valores) {
    const body = {
      nome_investimento: item.nome_investimento,
      data_referencia: item.data_referencia,
      preco_unitario: item.preco_unitario.toString().replace(',', '.'),
      valor_total: item.valor_total.toString().replace(',', '.')
    };

    console.log('Enviando valor:', body);

    try {
      await fetch('/api/valores-atuais', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      console.error(`Erro ao salvar ${item.nome_investimento}:`, err);
    }
  }

  toast.success('✅ Valores salvos com sucesso!');
  setSucesso(true);
  setTimeout(() => setSucesso(false), 3000);
  buscarOuPreencher();
};

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
  <div className="p-6 shadow-md space-y-4 rounded-xl bg-white">
    <div className="flex flex-wrap justify-between items-center gap-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800">
          <DollarSign className="w-5 h-5 text-green-600" />
          Atualizar Valores Atuais
        </h2>
        <p className="text-sm text-gray-600">
          Registre aqui o valor atualizado de cada ativo da sua carteira. Esses dados alimentam os gráficos e relatórios de evolução.
        </p>
      </div>

      <button
        onClick={salvar}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition whitespace-nowrap"
      >
        Salvar
      </button>
    </div>

    <div className="h-px w-full mt-4 bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300" />
  </div>
</div>

      <FiltroValoresAtuais filtro={filtro} onChange={setFiltro} />

      <div className="overflow-x-auto mt-4">
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <table className="w-full border text-sm bg-white shadow-sm">
            <thead className="bg-gray-100 text-center">
              <tr>
                <th className="p-2">Ativo</th>
                <th className="p-2">Data Referência</th>
                <th className="p-2">Quantidade</th>
                <th className="p-2">Preço Unitário</th>
                <th className="p-2">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {valores.map((item, index) => (
                <tr key={index} className="border-t text-center">
                  <td className="p-2">{item.nome_investimento}</td>
                  <td className="p-2">{new Date(item.data_referencia + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="p-2">{item.quantidade}</td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={item.preco_unitario}
                      onChange={(e) => atualizarCampo(index, 'preco_unitario', e.target.value)}
                      className="border px-2 py-1 rounded w-28 text-right"
                    />
                  </td>
                  <td className="p-2">R$ {parseFloat(item.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {valores.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-4">
                    Nenhum ativo em carteira nesse mês.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AtualizarValores;