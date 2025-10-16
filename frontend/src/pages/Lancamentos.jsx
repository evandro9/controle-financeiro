import React, { useEffect, useMemo, useState } from 'react';
import { HiPlus, HiPencil, HiTrash, HiClipboardDocumentList } from 'react-icons/hi2';
import { Dialog } from '@headlessui/react';
import FiltroLancamentos from '../components/lancamentos/FiltroLancamentos';
import SelectBase from '../components/SelectBase';
import ModalNovoLancamento from '../components/lancamentos/ModalNovoLancamento';
import CardsResumoLancamentos from '../components/lancamentos/CardsResumoLancamentos';
import ModalPagarDespesas from '../components/lancamentos/ModalPagarDespesas';
import useFirstLoginTour from '../hooks/useFirstLoginTour';
import { getLancamentosSteps, getLancamentosMobileNoticeSteps } from '../tour/steps/lancamentos';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { TbRepeat } from 'react-icons/tb';

function Lancamentos() {
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [formasPagamento, setFormasPagamento] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [quantidade, setQuantidade] = useState(10);
  const [msg, setMsg] = useState('');
  const [status, setStatus] = useState('');
  const [idParaExcluir, setIdParaExcluir] = useState(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [formaPagamentoSelecionada, setFormaPagamentoSelecionada] = useState('todas');
  const [modalPagarAberto, setModalPagarAberto] = useState(false);
  const [modoPagamentoEmLote, setModoPagamentoEmLote] = useState(false);
  const [excluirLancamentoId, setExcluirLancamentoId] = useState(null);
  const [excluirGrupo, setExcluirGrupo] = useState(false);
  const [duracaoMesesEdicao, setDuracaoMesesEdicao] = useState(2);
  const [excluirRecorrenteId, setExcluirRecorrenteId] = useState(null);
  const [ordenarPor, setOrdenarPor] = useState('data_lancamento');
  const [ordem, setOrdem] = useState('DESC');

  const hojeModal = new Date().toISOString().split('T')[0];
  const [dados, setDados] = useState({
    tipo: 'despesa',
    data_lancamento: hojeModal,
    data_vencimento: hojeModal,
    valor: '',
    categoria_id: '',
    subcategoria_id: '',
    forma_pagamento_id: '',
    observacao: '',
    status: 'pendente'
  });

  // ---- Tours (desktop x mobile) – apenas fora do modo "Pagar Despesas"
  const stepsLanc = useMemo(() => getLancamentosSteps(), []);
  const { maybeStart: maybeStartLanc } = useFirstLoginTour('lancamentos_v1', stepsLanc);
  const stepsLancMobile = useMemo(() => getLancamentosMobileNoticeSteps(), []);
  const { maybeStart: maybeStartLancMobile } = useFirstLoginTour('lancamentos_mobile_v1', stepsLancMobile);

  async function excluirLancamento() {
  if (!excluirLancamentoId) {
    toast.error("ID inválido para exclusão");
    return;
  }

  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/lancamentos/${excluirLancamentoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error();

    toast.success("Lançamento excluído com sucesso");
    setMsg(`excluido-${Date.now()}`);
    setExcluirLancamentoId(null);
    setExcluirGrupo(false);
  } catch (err) {
    toast.error("❌ Erro ao excluir lançamento");
  }
}

async function excluirRecorrenciaAPartirDe(id) {
  if (!id) {
    toast.error("ID inválido para exclusão");
    return;
  }

  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/lancamentos/recorrente/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error();

    toast.success("Lançamento recorrente excluído com sucesso");
    setMsg(`recorrente-excluido-${Date.now()}`);
  } catch (err) {
    toast.error("❌ Erro ao excluir lançamento recorrente");
  }
}

  function salvarNovoLancamento(dadosNovo) {
    const token = localStorage.getItem('token');
    const url = editandoId
      ? `/api/lancamentos/${editandoId}`
      : '/api/lancamentos';
    const metodo = editandoId ? 'PUT' : 'POST';

    const body = Array.isArray(dadosNovo) ? dadosNovo : { ...dadosNovo };

    if (body.editarGrupo && body.grupo_recorrente_id) {
      body.editarTodosRecorrentes = true;
    }

    fetch(url, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    })
      .then(res => {
        if (!res.ok) throw new Error('Erro ao salvar');
        return res.json();
      })
      .then(() => {
        setMsg(`salvo-${Date.now()}`);
        setModalAberto(false);
        setEditandoId(null);
      })
      .catch(() => {
        toast.error('Erro ao salvar lançamento');
      });
  }

const aplicarFiltrosPagamento = ({ ano, mes, formaPagamento }) => {
  // 🔹 Atualiza estados globais
  setAno(ano);
  setMes(mes);
  setFormaPagamentoSelecionada(formaPagamento);
  setStatus('pendente');
  setModoPagamentoEmLote(true);

  // 🔹 Força atualização imediata dos cards
  // Basta alterar msg para disparar o useEffect que busca os dados
  setMsg(`filtro-pagamento-${Date.now()}`);
};

  const cancelarPagamentoEmLote = () => {
    const hoje = new Date();
    setAno(hoje.getFullYear());
    setMes(hoje.getMonth() + 1);
    setQuantidade(10);
    setFormaPagamentoSelecionada('todas');
    setStatus('');
    setModoPagamentoEmLote(false);
  };

  const confirmarPagamentoEmLote = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/lancamentos/pagar-mes', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ ano, mes, forma_pagamento_id: formaPagamentoSelecionada })
    });

    if (response.ok) {
  const resultado = await response.json();
  toast.success(`${resultado.atualizados} lançamento(s) pagos com sucesso!`);

  // 🔹 Dispara atualização imediata dos cards
  setMsg(`pagamento-${Date.now()}`);

  // 🔹 Mantém ou reseta filtros conforme sua lógica
  const hoje = new Date();
  setAno(hoje.getFullYear());
  setMes(hoje.getMonth() + 1);
  setQuantidade(10);
  setFormaPagamentoSelecionada('todas');
  setStatus('');
  setModoPagamentoEmLote(false);
} else {
      toast.error('Erro ao pagar lançamentos');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/categorias-com-sub', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => res.json()).then(setCategorias);

    fetch('/api/formas-pagamento', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => res.json()).then(setFormasPagamento);
  }, []);

  useEffect(() => {
    const categoria = categorias.find(c => c.id == dados.categoria_id);
    setSubcategorias(categoria ? categoria.subcategorias : []);
  }, [dados.categoria_id]);

  // Dispara tour/aviso quando a tela montar (fora do modo pagamento em lote)
  useEffect(() => {
    if (modoPagamentoEmLote) return; // não iniciar enquanto estiver no fluxo "Pagar Despesas"
    const isDesktop = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(min-width: 1024px)').matches; // >= lg
    const start = () => (isDesktop ? maybeStartLanc() : maybeStartLancMobile());
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      requestAnimationFrame(() => setTimeout(start, 0));
    } else {
      setTimeout(start, 0);
    }
  }, [modoPagamentoEmLote, maybeStartLanc, maybeStartLancMobile]);

useEffect(() => {
  const token = localStorage.getItem('token');

  let url;
  if (modoPagamentoEmLote) {
    // Quando estiver no fluxo de Pagar Despesas → usar filtro por vencimento
    url = `/api/lancamentos/pendentes-vencimento?mes=${mes}&ano=${ano}&forma_pagamento_id=${formaPagamentoSelecionada}`;
  } else {
    // Busca normal (filtra por data_lancamento)
    url = `/api/lancamentos?mes=${mes}&ano=${ano}&limite=${quantidade}${status ? `&status=${status}` : ''}${formaPagamentoSelecionada !== 'todas' ? `&forma_pagamento_id=${formaPagamentoSelecionada}` : ''}&sort=${ordenarPor}&order=${ordem}`;
  }

  fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(setLancamentos)
    .catch(err => console.error("Erro ao buscar lançamentos:", err));

}, [msg, mes, ano, quantidade, status, formaPagamentoSelecionada, ordenarPor, ordem, modoPagamentoEmLote]);

  function handleChange(e) {
    const { name, value } = e.target;
    setDados(prev => ({ ...prev, [name]: value }));
  }

  function carregarEdicao(lanc) {
    const dadosBase = {
      tipo: lanc.tipo,
      data_lancamento: lanc.data_lancamento,
      data_vencimento: lanc.data_vencimento || `${ano}-${String(mes).padStart(2, '0')}-05`,
      valor: lanc.valor,
      categoria_id: lanc.categoria_id,
      subcategoria_id: lanc.subcategoria_id,
      forma_pagamento_id: lanc.forma_pagamento_id,
      observacao: lanc.observacao,
      status: lanc.status,
      grupo_parcela_id: lanc.grupo_parcela_id || null,
      grupo_recorrente_id: lanc.grupo_recorrente_id || null,
      parcela: lanc.parcela || null,
      total_parcelas: lanc.total_parcelas || null
    };

    setDados(dadosBase);
    setEditandoId(lanc.id);
    setModalAberto(true);
  }

   return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 text-center sm:text-left">
   <div className="flex-1">
     <h2 className="text-lg sm:text-xl font-semibold flex items-center justify-center sm:justify-start gap-2 text-gray-800 dark:text-darkText mb-1">
       <HiClipboardDocumentList className="w-5 h-5 text-blue-600" />
       Movimentações Financeiras
     </h2>
     <p className="text-sm text-gray-600 dark:text-darkMuted max-w-2xl mx-auto sm:mx-0">
       Sua central de lançamentos: registre receitas e despesas, gerencie vencimentos e quite pendências no mês selecionado.
     </p>
   </div>
  <div className="flex flex-wrap gap-3 items-center justify-center sm:justify-end">
  <button
    onClick={() => setModalPagarAberto(true)}
    disabled={modoPagamentoEmLote}
    className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-2
                font-medium transition-colors
                bg-blue-600 hover:bg-blue-700 text-white
                dark:bg-blue-600 dark:hover:bg-blue-700
                ${modoPagamentoEmLote ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    💳 Pagar Despesas
  </button>

  <button
    onClick={() => setModalAberto(true)}
    disabled={modoPagamentoEmLote}
    className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-2
                font-medium transition-colors
                bg-orange-500 hover:bg-orange-600 text-white
                dark:bg-orange-500 dark:hover:bg-orange-600
                ${modoPagamentoEmLote ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <HiPlus size={18} /> Novo Lançamento
  </button>
</div>
          </div>
                  {/* <div className="mt-4 h-[1.5px] w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300
                        dark:from-white/20 dark:via-white/15 dark:to-white/20" /> */}
                        <div className="mt-4 h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-darkCard rounded-xl shadow px-4 py-5 mb-6 border border-gray-100 dark:border-darkBorder">
        {!modoPagamentoEmLote && (
          <div className="space-y-3" data-tour="mov-filtros">
            <span className="text-center text-sm font-medium text-gray-600 dark:text-darkText block">Filtros</span>
            <FiltroLancamentos
  ano={ano}
  setAno={setAno}
  mes={mes}
  setMes={setMes}
  quantidade={quantidade}
  setQuantidade={setQuantidade}
  status={status}
  setStatus={setStatus}
  formaPagamentoSelecionada={formaPagamentoSelecionada}
  setFormaPagamentoSelecionada={setFormaPagamentoSelecionada}
  formasPagamento={formasPagamento}
  ordenarPor={ordenarPor}
  setOrdenarPor={setOrdenarPor}
  ordem={ordem}
  setOrdem={setOrdem}
/>
          </div>
        )}

        {modoPagamentoEmLote && (
          <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-400 text-yellow-800 dark:text-yellow-200 px-6 py-4 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
            <span className="text-base font-medium">
              ⚠ Confirma o pagamento de todas essas despesas?
            </span>
            <div className="flex gap-3">
              <button
                onClick={cancelarPagamentoEmLote}
                className="px-4 py-2 bg-gray-200 dark:bg-darkBorder text-gray-700 dark:text-darkText rounded hover:bg-gray-300 dark:hover:bg-darkBg"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPagamentoEmLote}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Pagar todos esses
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cards resumo */}
      <div data-tour="mov-cards">
        <CardsResumoLancamentos
          ano={ano}
          mes={mes}
          formaPagamentoId={formaPagamentoSelecionada}
          msg={msg}
        />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto bg-white dark:bg-darkCard shadow rounded-xl border border-gray-100 dark:border-darkBorder" data-tour="mov-tabela">
        <table className="w-full table-auto text-sm text-left">
          <thead className="bg-gray-100 dark:bg-darkBorder">
            <tr className="text-gray-800 dark:text-darkText">
              <th className="p-3">Tipo</th>
              <th className="p-3">Data</th>
              <th className="p-3">Vencimento</th>
              <th className="p-3 text-center">Valor</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Subcategoria</th>
              <th className="p-3">Observação</th>
              <th className="p-3">Forma Pgto</th>
              <th className="p-3">Status</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map(l => (
              <tr key={l.id} className="border-t hover:bg-gray-50 hover:dark:bg-darkBorder text-gray-800 dark:text-darkText">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="capitalize">{l.tipo}</span>
                    {l.parcela && l.total_parcelas && (
                      <span className="text-xs text-gray-500 dark:text-darkMuted bg-gray-100 dark:bg-darkBorder px-2 py-0.5 rounded">
                        {l.parcela}/{l.total_parcelas}
                      </span>
                    )}
                    {l.grupo_recorrente_id && (
                      <TbRepeat
                        size={18}
                        className="text-purple-600"
                        title="Lançamento recorrente"
                      />
                    )}
                  </div>
                </td>
                <td className="p-2">{new Date(l.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                <td className="p-2">{new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                <td className={`p-2 text-center font-semibold ${l.tipo === 'despesa' ? 'text-red-500' : 'text-blue-600'}`}>
                  {Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="p-2">{l.categoria_nome}</td>
                <td className="p-2">{l.subcategoria_nome}</td>
                <td className="p-2">{l.observacao || '-'}</td>
                <td className="p-2">{l.forma_pagamento || '-'}</td>
                <td className="p-2">
                  {(() => {
                    const base = String(l.status || '').toLowerCase();
                    const venc = l.data_vencimento ? new Date(l.data_vencimento + 'T23:59:59') : null;
                    const atrasado = base !== 'pago' && venc && venc < new Date();
                    const view = base === 'pago' ? 'pago' : (atrasado ? 'atrasado' : 'pendente');
                    const cls =
                      view === 'pago'
                        ? 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800'
                        : view === 'pendente'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800'
                        : 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800';
                    return (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}
                        title={venc ? `Vencimento: ${new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}` : undefined}
                      >
                        {view}
                      </span>
                    );
                  })()}
                </td>
                <td className="p-2 flex gap-2">
  {/* Botão editar com bloqueio para aportes/retiradas */}
  <button
    onClick={() => {
      const isPlano =
        String(l.categoria_nome || '').toLowerCase() === 'planos' ||
        ['aportes', 'retiradas'].includes(String(l.subcategoria_nome || '').toLowerCase());
      if (isPlano) {
const isDark = document.documentElement.classList.contains('dark');
toast.info(
  'Edição de aporte/retirada deve ser feita na tela de Planos e Metas.',
  {
    style: isDark
      ? { background: '#1f2937', color: '#f3f4f6' } // dark:bg-darkCard
      : { background: '#ffffff', color: '#1f2937', border: '1px solid #e5e7eb' } // claro, igual bg branco + borda
  }
);
        return;
      }
      carregarEdicao(l);
    }}
    className={`text-blue-500 hover:text-blue-700 ${
      (String(l.categoria_nome || '').toLowerCase() === 'planos' ||
       ['aportes', 'retiradas'].includes(String(l.subcategoria_nome || '').toLowerCase()))
        ? 'opacity-50 cursor-not-allowed'
        : ''
    }`}
    title={
      (String(l.categoria_nome || '').toLowerCase() === 'planos' ||
       ['aportes', 'retiradas'].includes(String(l.subcategoria_nome || '').toLowerCase()))
        ? 'Edite este movimento pela tela de Planos e Metas'
        : 'Editar lançamento'
    }
  >
    <HiPencil />
  </button>

  {/* Botão excluir com bloqueio para aportes/retiradas */}
  <button
    onClick={() => {
      const isPlano =
        String(l.categoria_nome || '').toLowerCase() === 'planos' ||
        ['aportes', 'retiradas'].includes(String(l.subcategoria_nome || '').toLowerCase());
      if (isPlano) {
const isDark = document.documentElement.classList.contains('dark');
toast.info(
  'Exclusão de aporte/retirada deve ser feita na tela de Planos e Metas.',
  {
    style: isDark
      ? { background: '#1f2937', color: '#f3f4f6' }
      : { background: '#ffffff', color: '#1f2937', border: '1px solid #e5e7eb' }
  }
);
        return;
      }
      if (l.grupo_parcela_id) {
        setExcluirGrupo(true);
        setExcluirLancamentoId(l.id);
      } else if (l.grupo_recorrente_id) {
        setExcluirRecorrenteId(l.id);
      } else {
        setIdParaExcluir(l.id);
        setConfirmandoExclusao(true);
      }
    }}
    className={`text-red-600 hover:text-red-700 ${
      (String(l.categoria_nome || '').toLowerCase() === 'planos' ||
       ['aportes', 'retiradas'].includes(String(l.subcategoria_nome || '').toLowerCase()))
        ? 'opacity-50 cursor-not-allowed'
        : ''
    }`}
    title={
      (String(l.categoria_nome || '').toLowerCase() === 'planos' ||
       ['aportes', 'retiradas'].includes(String(l.subcategoria_nome || '').toLowerCase()))
        ? 'Exclua este movimento pela tela de Planos e Metas'
        : 'Excluir lançamento'
    }
  >
    <HiTrash />
  </button>
</td>
              </tr>
            ))}
            {lancamentos.length === 0 && (
              <tr>
                <td colSpan="10" className="text-center text-gray-500 dark:text-darkMuted py-4">Nenhum lançamento encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      
{excluirLancamentoId && (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded p-6 w-full max-w-md shadow transition-all">
      <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Confirma exclusão?</h2>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        {excluirGrupo
          ? '⚠ Este lançamento faz parte de um parcelamento. Todas as parcelas serão excluídas.'
          : 'Tem certeza que deseja excluir este lançamento? Esta ação não poderá ser desfeita.'}
      </p>
      <div className="flex justify-end gap-3">
        <button
          onClick={() => setExcluirLancamentoId(null)}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-400 dark:hover:bg-gray-600 transition"
        >
          Cancelar
        </button>
        <button
          onClick={excluirLancamento}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          Confirmar Exclusão
        </button>
      </div>
    </div>
  </div>
)}

{excluirRecorrenteId && (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded p-6 w-full max-w-md shadow transition-all">
      <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
        Excluir lançamentos recorrentes?
      </h2>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        ⚠ Esta ação irá excluir este lançamento e todos os meses futuros da recorrência.
        Os meses anteriores serão mantidos.
      </p>
      <div className="flex justify-end gap-3">
        <button
          onClick={() => setExcluirRecorrenteId(null)}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-400 dark:hover:bg-gray-600 transition"
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            excluirRecorrenciaAPartirDe(excluirRecorrenteId);
            setExcluirRecorrenteId(null);
          }}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          Confirmar Exclusão
        </button>
      </div>
    </div>
  </div>
)}

{confirmandoExclusao && idParaExcluir && (
  <Dialog open={true} onClose={() => {}} static className="relative z-50">
    <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md transition-all">
        <Dialog.Title className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Confirmar Exclusão
        </Dialog.Title>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Tem certeza que deseja <span className="font-medium text-red-600">excluir</span> este lançamento?
          Esta ação <strong>não poderá ser desfeita.</strong>
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              setConfirmandoExclusao(false);
              setIdParaExcluir(null);
            }}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-100 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              if (!idParaExcluir) {
                alert("ID inválido para exclusão.");
                return;
              }
              const token = localStorage.getItem('token');
              const response = await fetch(`/api/lancamentos/${Number(idParaExcluir)}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
              });

              if (!response.ok) {
                toast.error("❌ Erro ao excluir lançamento");
                return;
              }

              toast.success("Lançamento excluído com sucesso");
              setMsg(`excluido-${Date.now()}`);
              setConfirmandoExclusao(false);
              setIdParaExcluir(null);
            }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            Excluir
          </button>
        </div>
      </Dialog.Panel>
    </div>
  </Dialog>
)}

<ModalNovoLancamento
  key={modalAberto ? 'modal-aberto' : 'modal-fechado'}
  isOpen={modalAberto}
onClose={() => {
  setModalAberto(false);
  setEditandoId(null);

  const hoje = new Date().toISOString().split('T')[0];
  setDados({
    tipo: 'despesa',
    data_lancamento: hoje,
    data_vencimento: hoje,
    valor: '',
    categoria_id: '',
    subcategoria_id: '',
    forma_pagamento_id: '',
    observacao: '',
    status: 'pendente'
  });
}}
  onSalvar={salvarNovoLancamento}
  categorias={categorias}
  formasPagamento={formasPagamento}
  dadosIniciais={dados}
  editando={editandoId !== null}
  setMsg={setMsg}
  duracaoMesesInicial={duracaoMesesEdicao} // ✅ NOVA PROP AQUI
/>
      <ModalPagarDespesas
  aberto={modalPagarAberto}
  onClose={() => setModalPagarAberto(false)}
  onAplicar={aplicarFiltrosPagamento}
  anoAtual={ano}
  mesAtual={mes}
  formasPagamento={formasPagamento}
/>

</div>
  );
}

export default Lancamentos;