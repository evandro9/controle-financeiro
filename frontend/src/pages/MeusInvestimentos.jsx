import React, { useEffect, useMemo, useState } from 'react';
import FiltroInvestimentos from '../components/meusInvestimentos/FiltroInvestimentos';
import ModalNovoInvestimento from '../components/meusInvestimentos/ModalNovoInvestimento';
import { Pencil, Trash2, WalletCards } from 'lucide-react';
import { toast } from 'react-toastify';
import ModalConfirmacao from '../components/ModalConfirmacaoCategoria';
import ModalImportarB3 from '../components/meusInvestimentos/ModalImportarB3';
import useFirstLoginTour from '../hooks/useFirstLoginTour';
import { getMeusInvSteps, getMeusInvMobileNoticeSteps } from '../tour/steps/meusInvestimentos';
import { RequireFeature } from '../context/PlanContext.jsx';
import UpsellPremium from '../components/UpsellPremium.jsx';

function MeusInvestimentos() {
  const [investimentos, setInvestimentos] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState({
    ano: new Date().getFullYear().toString(),
    mes: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    limite: '10',
    nome: ''
  });
  const [idParaExcluir, setIdParaExcluir] = useState(null);
  const [modalB3, setModalB3] = useState(false);

  useEffect(() => {
    buscarInvestimentos();
  }, [filtro]);

    // pill do tipo (compra, venda, bonificação) — mesmo padrão visual das outras tags
  const tipoPill = (tipo) => {
    const t = String(tipo || '')
      .trim()
      .toLowerCase()
      .replace(/[ç]/g, 'c')
      .replace(/[\s-]+/g, '_');
    if (t === 'compra') {
      return (
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
          Compra
        </span>
      );
    }
    if (t === 'venda') {
      return (
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-300 dark:bg-rose-900/50 text-rose-900 dark:text-rose-200">
          Venda
        </span>
      );
    }
    if (t === 'ajuste_bonificacao') {
      return (
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
          Ajuste
        </span>
      );
    }
    if (t === 'bonificacao') {
      return (
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-200 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300">
          Bonificação
        </span>
      );
    }
    // fallback
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
        {t ? t.charAt(0).toUpperCase() + t.slice(1) : '—'}
      </span>
    );
  };

  const buscarInvestimentos = async () => {
    const token = localStorage.getItem('token');
    let url = '/api/investimentos';
    const params = new URLSearchParams();

if (filtro.nome && filtro.nome.trim() !== '') {
  params.append('nome', filtro.nome.trim());
} else {
  if (filtro.ano !== 'todos') {
    params.append('ano', filtro.ano);
  }
  if (filtro.mes !== 'todos') {
    params.append('mes', filtro.mes);
  }
  params.append('limite', filtro.limite === 'todos' ? '0' : filtro.limite);
}

    url += `?${params.toString()}`;

    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const dados = await res.json();
      setInvestimentos(dados);
    } catch {
      toast.error('Erro ao buscar investimentos');
    }
  };

  const abrirModal = () => {
    setEditando(null);
    setModalAberto(true);
  };

  const editar = (investimento) => {
    setEditando(investimento);
    setModalAberto(true);
  };

  // ---- Tours (desktop x mobile)
  const stepsMI = useMemo(() => getMeusInvSteps(), []);
  const { maybeStart: maybeStartMI } = useFirstLoginTour('meusinvestimentos_v1', stepsMI);
  const stepsMIMobile = useMemo(() => getMeusInvMobileNoticeSteps(), []);
  const { maybeStart: maybeStartMIMobile } = useFirstLoginTour('meusinvestimentos_mobile_v1', stepsMIMobile);

  useEffect(() => {
    const isDesktop =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(min-width: 1024px)').matches; // >= lg
    const start = () => (isDesktop ? maybeStartMI() : maybeStartMIMobile());
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      requestAnimationFrame(() => setTimeout(start, 0));
    } else {
      setTimeout(start, 0);
    }
  }, [maybeStartMI, maybeStartMIMobile]);  

  return (
    <RequireFeature feature="investimentos" fallback={<UpsellPremium title="Investimentos" />}>
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 text-center sm:text-left">
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl leading-tight font-semibold flex items-center justify-center sm:justify-start gap-2 text-gray-800 dark:text-darkText">
              <WalletCards className="w-5 h-5 text-green-600" />
              Meus Investimentos
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-darkMuted max-w-2xl mx-auto sm:mx-0">
              Cadastre operações, proventos e eventos de carteira (bonificações, ajustes). Importe da B3 ou lance manualmente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-end" data-tour="mi-acoes">
            {/* Importar da B3: desktop-only */}
            <button
              onClick={() => { setModalB3(true); }}
              className="hidden sm:inline-flex h-9 items-center gap-2 px-4 rounded-lg
                         border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 transition
                         focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2
                         dark:border-gray-700 dark:bg-gray-800 dark:text-darkText dark:hover:bg-gray-700 dark:focus:ring-offset-darkBg"
            >
              Importar da B3
            </button>
            {/* Novo: visível em todos os tamanhos */}
            <button
              onClick={abrirModal}
              className="inline-flex h-9 items-center px-3.5 rounded-lg
                         bg-green-600 text-white hover:bg-green-700 active:scale-95 transition
                         focus:outline-none focus:ring-2 focus:ring-green-400/60 focus:ring-offset-2
                         dark:focus:ring-offset-darkBg"
            >
              + Novo
            </button>
          </div>
        </div>
        {/* Linha decorativa */}
        <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
      </section>
      <div data-tour="mi-filtros">
        <FiltroInvestimentos onChange={setFiltro} />
      </div>

      {/* Tabela responsiva (mobile compacto) */}
      <section
        className="rounded-xl shadow border border-gray-100 dark:border-darkBorder bg-white dark:bg-darkCard overflow-x-auto"
        data-tour="mi-tabela"
      >
        <table
          className="min-w-full border-collapse text-xs sm:text-sm text-gray-800 dark:text-darkText"
        >
          <thead className="bg-gray-100 dark:bg-gray-800/80 text-gray-800 dark:text-darkText text-center border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-2 py-2 font-medium">Tipo</th>
              <th className="px-2 py-2 text-left font-medium">Nome</th>
              <th className="px-2 py-2 hidden sm:table-cell font-medium">Classe</th>
              <th className="px-2 py-2 hidden sm:table-cell font-medium">Subclasse</th>
              <th className="px-2 py-2 hidden sm:table-cell font-medium">Qtd</th>
              <th className="px-2 py-2 font-medium">Valor Unit.</th>
              <th className="px-2 py-2 font-medium">Total</th>
              <th className="px-2 py-2 font-medium">Data</th>
              <th className="px-2 py-2 hidden sm:table-cell font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {investimentos.map((inv) => (
              <tr key={inv.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                <td className="px-2 py-1.5 sm:p-2 text-center">{tipoPill(inv.tipo_operacao)}</td>
                <td className="px-2 py-1.5 sm:p-2">
                  <span className="block truncate max-w-[18ch] sm:max-w-none">{inv.nome_investimento}</span>
                </td>
                <td className="px-2 py-1.5 sm:p-2 hidden sm:table-cell">{inv.categoria}</td>
                <td className="px-2 py-1.5 sm:p-2 hidden sm:table-cell">{inv.subcategoria}</td>
                <td className="px-2 py-1.5 sm:p-2 hidden sm:table-cell">{inv.quantidade}</td>
                <td className="px-2 py-1.5 sm:p-2 whitespace-nowrap">
                  {Number(inv.valor_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-2 py-1.5 sm:p-2 whitespace-nowrap font-semibold">
                  {Number(inv.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-2 py-1.5 sm:p-2 whitespace-nowrap">
                  {new Date(inv.data_operacao + 'T12:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td className="px-2 py-1.5 sm:p-2 hidden sm:table-cell">
                  <div className="flex gap-2 justify-center">
                  <button onClick={() => editar(inv)} className="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => setIdParaExcluir(inv.id)} className="text-red-600 hover:text-red-800 dark:hover:text-red-400">
                    <Trash2 size={18} />
                  </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

 {modalAberto && (
   <ModalNovoInvestimento
     key={editando?.id || 'novo'}
     investimento={editando || null}
     fechar={() => { setModalAberto(false); setEditando(null); buscarInvestimentos(); }}
   />
 )}
      {modalB3 && (
        <ModalImportarB3
          fechar={() => setModalB3(false)}
          onImportou={() => {
            setModalB3(false);
            buscarInvestimentos();
          }}
        />
      )}
      {idParaExcluir && (
        <ModalConfirmacao
          titulo="Excluir Investimento"
          mensagem="Tem certeza que deseja excluir este investimento? Essa ação não poderá ser desfeita."
          onCancelar={() => setIdParaExcluir(null)}
          onConfirmar={async () => {
            const token = localStorage.getItem('token');
            try {
              const res = await fetch(`/api/investimentos/${idParaExcluir}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) throw new Error();
              toast.success('Investimento excluído com sucesso');
              buscarInvestimentos();
            } catch {
              toast.error('Erro ao excluir investimento');
            } finally {
              setIdParaExcluir(null);
            }
          }}
        />
      )}
    </div>
    </RequireFeature>
  );
}

export default MeusInvestimentos;