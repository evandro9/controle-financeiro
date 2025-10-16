import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Plus, Edit2, Trash2, BarChart3, Target, PiggyBank, Home, Car, GraduationCap, Plane, Briefcase, ArrowDownUp } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import ModalNovoPlano from '../components/planos/ModalNovoPlano'; // ajuste o path conforme sua estrutura
import { toast } from 'react-toastify';
import ModalAportePlano from '../components/planos/ModalAportePlano';
import ModalExcluirPlano from '../components/planos/ModalExcluirPlano'; // ajuste o caminho se necessário
import ModalGraficoPlano from '../components/planos/ModalGraficoPlano'; // ajuste o path
import GraficoPlanosMensal from '../components/planos/GraficoPlanosMensal';
import useFirstLoginTour from '../hooks/useFirstLoginTour';
import { getPlanosSteps, getPlanosMobileNoticeSteps } from '../tour/steps/planos';

const ICONES_DISPONIVEIS = [
  { nome: 'PiggyBank', componente: PiggyBank },
  { nome: 'Home', componente: Home },
  { nome: 'Car', componente: Car },
  { nome: 'GraduationCap', componente: GraduationCap },
  { nome: 'Plane', componente: Plane },
  { nome: 'Briefcase', componente: Briefcase },
];

const iconeMap = Object.fromEntries(ICONES_DISPONIVEIS.map(({ nome, componente }) => [nome, componente]));

export default function PlanosMetas() {
  const apiBase = import.meta.env.VITE_API_URL ?? "/api";  
  const [planos, setPlanos] = useState([]);
  const anoAtual = new Date().getFullYear();
  const recarregarPlanos = async () => {
  const token = localStorage.getItem('token');
  const resPlanos = await fetch(`${apiBase}/planos`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resPlanos.ok) throw new Error('Erro ao recarregar planos');
  const dados = await resPlanos.json();

  const atualizados = dados.map((p) => {
    const valorTotal = Number(p.valor_total) || 0;
    const arrecadado = Number(p.arrecadado) || 0;
    const inicio = p.inicio || '';
    const fim = p.fim || '';
    const usarParcelas = !!p.usar_parcelas;

    let totalMeses = 0;
    if (inicio && fim) {
      const [ai, mi] = inicio.split('-').map(Number);
      const [af, mf] = fim.split('-').map(Number);
      totalMeses = (af - ai) * 12 + (mf - mi) + 1;
    }

    const valorRestante = Math.max(valorTotal - arrecadado, 0);
    const valorParcelaAuto = totalMeses > 0 ? valorRestante / totalMeses : 0;
    const parcelasRestantes = valorParcelaAuto > 0 ? Math.ceil(valorRestante / valorParcelaAuto) : 0;

    return {
      id: p.id,
      nome: p.nome || '',
      inicio, fim,
      valorTotal,
      valorParcela: Number(p.valor_parcela) || valorParcelaAuto,
      usarParcela: !!p.usar_parcela,
      usarParcelas,
      parcelasRestantes: usarParcelas ? p.parcelas : parcelasRestantes,
      arrecadado,
      status: p.status || 'ativo',
      icone: p.icone || 'PiggyBank'
    };
  });

  setPlanos(atualizados);
};

  const { darkMode } = useContext(ThemeContext);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const planosFiltrados = Array.isArray(planos)
  ? planos.filter(p => filtroStatus === 'todos' || p.status === filtroStatus)
  : [];
  const [modoLista, setModoLista] = useState(false);

  const [modalAporteAberto, setModalAporteAberto] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState(null);
  const [mostrarModalPlano, setMostrarModalPlano] = useState(false);
  const [planoParaVerGrafico, setPlanoParaVerGrafico] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [novoPlano, setNovoPlano] = useState({
    nome: '',
    inicio: '',
    fim: '',
    parcelas: '',
    usarParcelas: false,
    valorTotal: '',
    valorParcela: '',
    usarParcela: false,
    arrecadado: '',
    status: 'ativo',
    icone: 'PiggyBank'
  });

  // Tour "Meus Planos"
  // Desktop: tour completo; Mobile: aviso único
  const stepsPlanos = useMemo(() => getPlanosSteps(), []);
  const { maybeStart: maybeStartPlanos } = useFirstLoginTour('planos_v1', stepsPlanos);
  const stepsPlanosMobile = useMemo(() => getPlanosMobileNoticeSteps(), []);
  const { maybeStart: maybeStartPlanosMobile } = useFirstLoginTour('planos_mobile_v1', stepsPlanosMobile);

  function calcularQuantidadeMeses(inicio, fim) {
  if (!inicio || !fim) return 0;

  const [anoInicio, mesInicio] = inicio.split('-').map(Number);
  const [anoFim, mesFim] = fim.split('-').map(Number);

  const diferencaMeses = (anoFim - anoInicio) * 12 + (mesFim - mesInicio);
  return diferencaMeses + 1;
}

  function montarPayloadPlano(dados) {
  const nome         = String(dados.nome || '').trim();
  const inicio       = String(dados.inicio || '').trim();   // 'YYYY-MM'
  const fim          = String(dados.fim || '').trim();      // 'YYYY-MM'
  const usarParcelas = !!dados.usarParcelas;
  // raw do input de parcela (pode vir "1.234,56")
  const valorParcelaRaw = dados.valorParcela ?? '';
  // parse pt-BR seguro para número
  const toNumberBR = (v) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).trim();
    if (s === '') return 0;
    return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  };

 // respeita o seletor do modal; se o user trocou para "valor da parcela", confie nisso
 const modoPreencher = dados.modoPreencher || (dados.usarParcela ? 'parcela' : 'total'); // 'total' | 'parcela'
 const usarParcela = modoPreencher === 'parcela';
  const usarParcelaInput = String(valorParcelaRaw ?? '').trim() !== '';
  const valorTotal   = toNumberBR(dados.valorTotal);        // pode vir vazio quando usarParcela=true
  const arrecadado   = Number(dados.arrecadado) || 0;
  const parcelas     = Number(dados.parcelas) || 0;
  const valorParcDig = usarParcela ? toNumberBR(valorParcelaRaw) : 0;

  if (!nome || !inicio) return { ok:false, msg:'Preencha os campos obrigatórios (Nome e Início).' };

  let valorTotalEfetivo = valorTotal;

  if (!usarParcelas) {
    if (!fim) return { ok:false, msg:'Informe o mês/ano de término.' };
    const [ai, mi] = inicio.split('-').map(Number);
    const [af, mf] = fim.split('-').map(Number);
    const diff = (af - ai) * 12 + (mf - mi);
    if (isNaN(diff) || diff < 0) return { ok:false, msg:'A data de término deve ser igual ou posterior à data de início.' };
   if (usarParcela) {
     if (!valorParcDig || valorParcDig <= 0) {
       return { ok:false, msg:'Informe o valor da parcela (maior que 0).' };
     }
     const totalMeses = diff + 1; // se sua conta é inclusiva
     valorTotalEfetivo = (valorParcDig * totalMeses) + arrecadado;
   } else {
     if (!valorTotal || valorTotal <= 0) {
       return { ok:false, msg:'Informe o valor total (maior que 0).' };
     }
     valorTotalEfetivo = valorTotal;
   }
  } else {
    if (!parcelas || parcelas <= 0) return { ok:false, msg:'Informe a quantidade de parcelas (maior que 0).' };
    if (usarParcela) {
      if (!valorParcDig || valorParcDig <= 0) return { ok:false, msg:'Informe o valor da parcela (maior que 0).' };
      valorTotalEfetivo = (valorParcDig * parcelas) + arrecadado;
    } else {
      if (!valorTotal || valorTotal <= 0) return { ok:false, msg:'Informe o valor total (maior que 0).' };
      valorTotalEfetivo = valorTotal;
    }
  }

  if (valorTotalEfetivo < arrecadado) {
    return { ok:false, msg:'O valor arrecadado não pode ser maior que o valor total.' };
  }

  // auxiliares para preencher automaticamente quando modo período
  const totalMeses = calcularQuantidadeMeses(inicio, fim);
  const valorRestante = Math.max(valorTotalEfetivo - arrecadado, 0);
  const valorParcelaCalc = valorRestante > 0 && totalMeses > 0 ? (valorRestante / totalMeses) : 0;
  const parcelasCalculadas = valorParcelaCalc > 0 ? Math.ceil(valorRestante / valorParcelaCalc) : 0;

  const payload = {
    nome,
    inicio,
    fim,
    parcelas: usarParcelas ? parcelas : parcelasCalculadas,
    usar_parcelas: usarParcelas,
    valor_total: valorTotalEfetivo,
    valor_parcela: usarParcela ? valorParcDig : valorParcelaCalc,
    usar_parcela: usarParcela,
    arrecadado,
    status: dados.status,
    icone: dados.icone || 'PiggyBank',
  };

  return { ok:true, payload, valorTotalEfetivo };
}

 const handleSalvarPlano = async () => {
   const { ok, msg, payload } = montarPayloadPlano(novoPlano);
   if (!ok) { toast.warn(msg); return false; }
   try {
     const token = localStorage.getItem('token');
     const res = await fetch(`${apiBase}/planos`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
       body: JSON.stringify(payload)
     });
     if (!res.ok) throw new Error('Erro ao criar plano');
     const criado = await res.json();
     setPlanos(prev => [...(Array.isArray(prev) ? prev : []), {
       id: criado.id,
       nome: criado.nome || '',
       inicio: criado.inicio || '',
       fim: criado.fim || '',
       valorTotal: Number(criado.valor_total) || 0,
       valorParcela: Number(criado.valor_parcela) || payload.valor_parcela,
       usarParcela: !!criado.usar_parcela,
       usarParcelas: !!criado.usar_parcelas,
       parcelasRestantes: criado.parcelas || payload.parcelas,
       arrecadado: Number(criado.arrecadado) || 0,
       status: criado.status || 'ativo',
       icone: criado.icone || 'PiggyBank'
     }]);
     toast.success('Plano criado com sucesso!');
     setModalAberto(false);
     setNovoPlano({ nome:'', inicio:'', fim:'', parcelas:'', usarParcelas:false, valorTotal:'', valorParcela:'', usarParcela:false, arrecadado:'', status:'ativo', icone:'PiggyBank' });
     return true;
   } catch (e) {
     console.error(e);
     toast.error('Erro ao criar plano');
     return false;
   }
 };

  const abrirModal = () => {
    setNovoPlano({
      nome: '', inicio: '', fim: '', parcelas: '',
      usarParcelas: false, valorTotal: '', valorParcela: '', usarParcela: false,
      arrecadado: '', status: 'ativo', icone: 'PiggyBank'
    });
    setModalAberto(true);
  };

  const renderIcone = (nome) => {
    const Icone = ICONES_DISPONIVEIS.find(i => i.nome === nome)?.componente;
    return Icone ? <Icone className="w-10 h-10 text-gray-400" /> : null;
  };

useEffect(() => {
  const carregarPlanos = async () => {
  try {
    const token = localStorage.getItem('token');
    console.log('🌐 Fazendo requisição GET /planos...');
    const res = await fetch('/api/planos', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const texto = await res.text();
    console.log('🧾 Texto cru da resposta:', texto);

    if (!texto) {
      console.warn('⚠️ Resposta vazia do backend');
      setPlanos([]); // <- definir como array vazio
      return;
    }

    let dados;
    try {
      dados = JSON.parse(texto);
      console.log('✅ JSON parseado:', dados);
    } catch (err) {
      console.error('❌ Falha ao fazer JSON.parse. Texto original:', texto);
      toast.error('Erro ao interpretar resposta do servidor.');
      return;
    }

    if (!Array.isArray(dados)) {
      console.error('❌ A resposta do backend NÃO É UM ARRAY. Veio:', dados);
      console.warn('🧨 DADOS INESPERADOS:', dados, typeof dados);
      toast.error('Erro: resposta inesperada do servidor');
      return;
    }

    console.log('✅ Planos recebidos:', dados);

setPlanos(
  dados.map(p => {
    const valorTotal = Number(p.valor_total) || 0;
    const arrecadado = Number(p.arrecadado) || 0;
    const valorParcela = Number(p.valor_parcela) || 0;
    const usarParcelas = !!p.usar_parcelas;

    const parcelasRestantes = usarParcelas
      ? p.parcelas
      : valorTotal > 0 && valorParcela > 0
        ? Math.ceil((valorTotal - arrecadado) / valorParcela)
        : 0;

    return {
      id: p.id,
      nome: p.nome || '',
      inicio: p.inicio || '',
      fim: p.fim || '',
      valorTotal,
      valorParcela,
      usarParcela: !!p.usar_parcela,
      usarParcelas,
      parcelasRestantes,
      arrecadado,
      status: p.status || 'ativo',
      icone: p.icone || 'PiggyBank'
    };
  })
);

  } catch (error) {
    console.error('❌ Erro ao carregar planos:', error);
    toast.error('Erro ao carregar planos');
  }
};

  carregarPlanos();
}, []);

// Dispara o tour desta página:
// - Desktop (>= lg): tour completo
// - Mobile  (< lg): apenas aviso (1 passo)
useEffect(() => {
  const isDesktop = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(min-width: 1024px)').matches; // >= lg
  if (isDesktop) {
    maybeStartPlanos();
  } else {
    maybeStartPlanosMobile();
  }
}, [maybeStartPlanos, maybeStartPlanosMobile]);
  const handleAporteRetirada = (plano) => {
  setPlanoSelecionado(plano);
  setModalAporteAberto(true);
};

const salvarAporte = async (planoId, tipo, valor, data) => {
  try {
    const token = localStorage.getItem('token');
    const p = (planos || []).find(x => x.id === planoId);
const tipoNorm = String(tipo || '').trim().toLowerCase(); // 'aporte' | 'retirada'
const v = Number(valor || 0);
if (!v || v <= 0) { toast.warn('Informe um valor válido (> 0).'); return; }
if (!data) { toast.warn('Informe a data do movimento.'); return; }
if (!['aporte','retirada'].includes(tipoNorm)) { toast.warn('Tipo inválido.'); return; }

const restante = Math.max((Number(p?.valorTotal||0) - Number(p?.arrecadado||0)), 0);
    // 1. Registrar o movimento (aporte ou retirada)
const res = await fetch(`${apiBase}/planos-movimentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planoId, tipo: String(tipo).toLowerCase(), valor: Number(valor), data })
    });

    if (!res.ok) throw new Error('Erro ao registrar aporte');

    // 2. Buscar novamente os planos atualizados
    const resPlanos = await fetch(`${apiBase}/planos`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!resPlanos.ok) throw new Error('Erro ao recarregar planos');

    const dados = await resPlanos.json();

    // 3. Recalcular parcelas restantes e valor da parcela para cada plano
    const atualizados = dados.map(p => {
      const valorTotal = Number(p.valor_total) || 0;
      const arrecadado = Number(p.arrecadado) || 0;
      const inicio = p.inicio || '';
      const fim = p.fim || '';
      const usarParcelas = !!p.usar_parcelas;

      // Quantidade de meses restantes
      let totalMeses = 0;
      if (inicio && fim) {
        const [anoInicio, mesInicio] = inicio.split('-').map(Number);
        const [anoFim, mesFim] = fim.split('-').map(Number);
        totalMeses = (anoFim - anoInicio) * 12 + (mesFim - mesInicio) + 1;
      }

      const valorRestante = Math.max(valorTotal - arrecadado, 0);
      const valorParcela = totalMeses > 0 ? valorRestante / totalMeses : 0;
      const parcelasRestantes = valorParcela > 0 ? Math.ceil(valorRestante / valorParcela) : 0;

      return {
        id: p.id,
        nome: p.nome || '',
        inicio,
        fim,
        valorTotal,
        valorParcela: Number(p.valor_parcela) || valorParcela,
        usarParcela: !!p.usar_parcela,
        usarParcelas,
        parcelasRestantes: usarParcelas ? p.parcelas : parcelasRestantes,
        arrecadado,
        status: p.status || 'ativo',
        icone: p.icone || 'PiggyBank'
      };
    });

    // 4. Atualizar estado do frontend
    setPlanos(atualizados);
toast.success(`${tipo === 'aporte' ? 'Aporte' : 'Retirada'} registrada com sucesso!`);
} catch (err) {
  console.error('❌ Erro ao registrar aporte ou recarregar planos:', err);
  if (err.message.includes('recarregar planos')) {
    toast.error('Erro ao recarregar lista de planos');
  } else {
    toast.error('Erro ao registrar aporte');
  }
}
};

const atualizarAporte = async (movimentoEditado) => {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${apiBase}/planos-movimentos/${movimentoEditado.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        tipo: movimentoEditado.tipo,
        valor: movimentoEditado.valor,
        data: movimentoEditado.data
      })
    });

    if (!res.ok) throw new Error('Erro ao atualizar aporte');

    await res.json();

    // agora basta chamar a função centralizada
    await recarregarPlanos();

    toast.success('Movimento atualizado com sucesso!');
    window.dispatchEvent(new CustomEvent('planos:movimento:changed'));
  } catch (err) {
    console.error('❌ Erro ao atualizar aporte:', err);
    toast.error('Erro ao atualizar aporte');
  }
};

const handleSalvarEdicao = async () => {
  // Usa o mesmo validador da criação
  const { ok, msg, payload } = montarPayloadPlano(planoSelecionado);
  if (!ok) { toast.warn(msg); return false; } // ❌ mantém modal aberto
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${apiBase}/planos/${planoSelecionado.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Erro ao atualizar plano');

    const planoAtualizado = await res.json();
    setPlanos((prev) =>
      prev.map((p) =>
        p.id === planoAtualizado.id
          ? {
              ...p,
              nome: planoAtualizado.nome,
              inicio: planoAtualizado.inicio,
              fim: planoAtualizado.fim,
              valorTotal: Number(planoAtualizado.valor_total),
              valorParcela: Number(planoAtualizado.valor_parcela),
              usarParcela: !!planoAtualizado.usar_parcela,
              usarParcelas: !!planoAtualizado.usar_parcelas,
              parcelasRestantes: planoAtualizado.parcelas,
              arrecadado: Number(planoAtualizado.arrecadado),
              status: planoAtualizado.status,
              icone: planoAtualizado.icone
            }
          : p
      )
    );
    toast.success('Plano atualizado com sucesso!');
    return true; // ✅ fecha modal
  } catch (error) {
    console.error('❌ Erro ao atualizar plano:', error);
    toast.error('Erro ao atualizar plano');
    return false; // ❌ mantém modal aberto
  }
};

const excluirPlano = async (id) => {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${apiBase}/planos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Erro ao excluir plano');

    await recarregarPlanos(); // mantém tudo em 1 só lugar
    toast.success('Plano excluído com sucesso!');
    window.dispatchEvent(new CustomEvent('planos:movimento:changed'));
    setPlanoParaExcluir(null);
  } catch (error) {
    toast.error('Erro ao excluir plano');
  }
};

// abrir para edição
const editarPlano = (plano) => {
  setPlanoSelecionado({
    ...plano,
    valorTotal: Number(plano.valorTotal) || 0,
    valorParcela: Number(plano.valorParcela) || 0,
    arrecadado: Number(plano.arrecadado) || 0,
    parcelasRestantes: plano.parcelasRestantes || 0,
    usarParcela: !!plano.usarParcela,
    usarParcelas: !!plano.usarParcelas
  });
  setMostrarModalPlano(true);
};

// 👉 SUBSTITUA a função alternarStatus atual por esta
const alternarStatus = async (id) => {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${apiBase}/planos/${id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Erro ao alternar status');

    const data = await res.json();
    // A API pode devolver { status }, { novoStatus } ou o plano completo
    const novoStatus =
      data?.status ??
      data?.novoStatus ??
      data?.status_plano ??
      data?.status ??
      null;

    if (novoStatus) {
      // ✅ Só atualiza o status, preservando o restante do objeto do card
      setPlanos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: novoStatus } : p))
      );
    } else {
      // Se a resposta não trouxer o status de forma clara, sincroniza geral
      await recarregarPlanos();
    }

    toast.success('Status do plano atualizado!');
  } catch (error) {
    // Em caso de erro, volta tudo ao estado correto via refetch
    await recarregarPlanos();
    toast.error('Erro ao alterar status');
  }
};

const [planoParaExcluir, setPlanoParaExcluir] = useState(null);

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Card do título separado, com barra interna */}
      <div className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-100 dark:border-darkBorder shadow">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-semibold flex items-center gap-2 justify-center sm:justify-start text-gray-800 dark:text-darkText">
              <Target className="w-5 h-5 text-green-600" />
              Planos e Metas
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-darkMuted">
              Seus planos, sua jornada. Organize metas e acompanhe cada passo rumo à realização.
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <button
              onClick={abrirModal}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm flex items-center justify-center gap-1.5"
            >
              <Plus size={16} /> Novo Plano
            </button>
          </div>
        </div>
        {/* barra de fora a fora (mais visível no dark) */}
        <div className="mt-4 h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
      </div>
      {/* Cards */}

 {/* Gráfico de balanço mensal — oculto no mobile */}
 <div className="hidden sm:block bg-white dark:bg-darkCard p-6 rounded-xl shadow w-full border border-gray-100 dark:border-darkBorder" data-tour="planos-grafico">
  <div className="h-72">
    <GraficoPlanosMensal />
  </div>
</div>

{/* Resumo geral dos planos */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4" data-tour="planos-cards">
  <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 text-center border border-gray-100 dark:border-darkBorder">
    <p className="text-sm text-gray-500 dark:text-gray-400">Total de Planos</p>
    <p className="text-xl font-bold text-gray-800 dark:text-darkText">{planos.length}</p>
  </div>
  <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 text-center border border-gray-100 dark:border-darkBorder">
    <p className="text-sm text-gray-500 dark:text-gray-400">Total Arrecadado</p>
    <p className="text-xl font-bold text-emerald-600">R$ {
  Array.isArray(planos)
    ? planos.reduce((soma, p) => soma + parseFloat(p.arrecadado || 0), 0).toLocaleString('pt-BR')
    : '0,00'
}</p>
  </div>
  <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 text-center border border-gray-100 dark:border-darkBorder">
    <p className="text-sm text-gray-500 dark:text-gray-400">Valor Restante</p>
    <p className="text-xl font-bold text-red-500">R$ {
  Array.isArray(planos)
    ? planos.reduce((soma, p) => soma + (parseFloat(p.valorTotal || 0) - parseFloat(p.arrecadado || 0)), 0).toLocaleString('pt-BR')
    : '0,00'
}</p>
  </div>
</div>

<div className="flex flex-wrap justify-between items-center gap-4 mb-4">
  <div className="flex items-center gap-3">
    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Filtrar por status:</p>
    {['todos', 'ativo', 'inativo'].map((filtro) => (
      <button
        key={filtro}
        onClick={() => setFiltroStatus(filtro)}
        className={`px-3 py-1 rounded-full text-sm font-medium border transition
          ${filtroStatus === filtro
            ? 'bg-green-700 text-white border-green-700 hover:bg-green-800'
            : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-darkText dark:border-gray-600'}
        `}
      >
        {filtro === 'todos' ? 'Todos' : filtro.charAt(0).toUpperCase() + filtro.slice(1)}
      </button>
    ))}
  </div>

  <div className="hidden sm:block">
    <button
      onClick={() => setModoLista(!modoLista)}
      className="flex items-center gap-2 text-sm px-3 py-1 rounded-full border border-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
    >
      {modoLista ? 'Modo grade' : 'Modo lista'}
    </button>
  </div>
</div>

{/* Cards de planos */}
<div data-tour="planos-lista">
{Array.isArray(planosFiltrados) && planosFiltrados.length === 0 ? (
  // 🔴 Estado vazio (sem planos)
  <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl bg-white dark:bg-darkCard border border-dashed border-gray-300 dark:border-gray-700">
    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
      {/* ícone simples */}
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v8m4-4H8" />
      </svg>
    </div>
    <p className="text-sm font-medium text-gray-700 dark:text-darkText">
      Você não tem nenhum plano cadastrado
    </p>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
      Planos cadastrados aparecerão aqui.
    </p>

    <button
      onClick={abrirModal}
      className="mt-4 px-3 py-1.5 rounded-md bg-green-700 hover:bg-green-800 text-white text-sm"
    >
      Criar primeiro plano
    </button>
  </div>
) : (
  // 🟢 Lista/grade de planos (o seu código de antes, intacto)
  <div className={`${modoLista || window.innerWidth < 640 ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}`}>
    {Array.isArray(planosFiltrados) && planosFiltrados.map((p, index) => {
      if (!p || typeof p !== 'object') return null;

      const arrecadado = Number(p.arrecadado) || 0;
      const valorTotal = Number(p.valorTotal) || 0;
      const pctRaw = valorTotal > 0 ? (arrecadado / valorTotal) * 100 : 0;
      const percentual = Math.min(100, Math.max(0, Number(pctRaw.toFixed(1))));
      const restante = valorTotal - arrecadado;

      const Icon = iconeMap[p.icone] || PiggyBank;

      const fmtAnoMes = (ym) => {
        if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || '';
        const [y, m] = ym.split('-').map(Number);
        const nomes = ['Jan.', 'Fev.', 'Mar.', 'Abr.', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const nomeMes = nomes[(m - 1) % 12] || '';
        return `${nomeMes} ${y}`;
      };

      return (
        <div key={p.id} className="bg-white dark:bg-darkCard rounded-xl shadow p-4">
          {/* Cabeçalho com ícone à esquerda e texto à direita */}
          <div className="relative mb-4">
            {/* Badge de status */}
            <div className="absolute top-1/2 right-0 transform -translate-y-1/2">
              <button
                onClick={() => alternarStatus(p.id)}
                title="Clique para ativar/inativar"
                className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap transition
                  ${p.status === 'ativo'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-800 dark:text-green-100 dark:hover:bg-green-700'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
              >
                {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </button>
            </div>

            {/* Linha com ícone e conteúdo central */}
            <div className="flex items-start justify-between gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center z-10">
                {Icon && React.createElement(Icon, { size: 28, className: 'text-gray-500' })}
              </div>
              <div className="absolute left-1/2 transform -translate-x-1/2 text-center">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-darkText">{p.nome}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {p.usarParcelas
                    ? (() => {
                        const q = Number(p.parcelasRestantes) || 0;
                        const label = q === 1 ? 'parcela' : 'parcelas';
                        return `${fmtAnoMes(p.inicio) || '—'} • ${q} ${label}`;
                      })()
                    : (p.fim
                        ? `${fmtAnoMes(p.inicio) || '—'} - ${fmtAnoMes(p.fim) || '—'}`
                        : (fmtAnoMes(p.inicio) || '—')
                      )
                  }
                </p>
              </div>
              <div className="w-20" />
            </div>
            <div className="w-12" />
          </div>

          {/* Valores */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Valor total</span>
              <p className="font-semibold text-green-600">R$ {(parseFloat(p.valorTotal || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Valor arrecadado</span>
              <p className="font-semibold text-emerald-500">R$ {(parseFloat(p.arrecadado || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Restante</span>
              <p className="font-semibold text-red-500">R$ {(parseFloat(restante || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Parcelas restantes</span>
              <p className="font-semibold text-blue-500">{p.parcelasRestantes}</p>
            </div>
          </div>

          {/* Progresso */}
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1 text-gray-500 dark:text-gray-400">
              <span>Progresso</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full dark:bg-gray-700 relative overflow-hidden border border-transparent dark:border-gray-600/40">
              <div className="h-full bg-green-500 rounded-full transition-[width] duration-300" style={{ width: `${percentual}%` }} />
              <span className="absolute inset-0 text-[10px] flex items-center justify-center text-gray-800 dark:text-gray-200">
                {percentual}%
              </span>
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => handleAporteRetirada(p)} className="text-gray-500 hover:text-gray-700 dark:text-gray-300" title="Aportar ou Retirar">
              <ArrowDownUp size={18} />
            </button>
            <button onClick={() => editarPlano(p)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400" title="Editar">
              <Edit2 size={18} />
            </button>
            <button onClick={() => setPlanoParaExcluir(p)} className="text-red-600 hover:text-red-800 dark:text-red-400" title="Excluir">
              <Trash2 size={18} />
            </button>
            <button onClick={() => setPlanoParaVerGrafico(p)} className="text-gray-500 hover:text-gray-700 dark:text-gray-300" title="Ver evolução">
              <BarChart3 size={18} />
            </button>
          </div>
        </div>
      );
    })}
  </div>
)}
</div>
      <ModalNovoPlano
  aberto={modalAberto}
  setAberto={setModalAberto}
  plano={novoPlano}
  setPlano={setNovoPlano}
  onSalvar={handleSalvarPlano}
/>

{mostrarModalPlano && (
  <ModalNovoPlano
    aberto={mostrarModalPlano}
    setAberto={setMostrarModalPlano}
    plano={planoSelecionado}
    setPlano={setPlanoSelecionado}
    onSalvar={handleSalvarEdicao} // retorna true/false para o modal decidir
  />
)}

{planoParaExcluir && (
  <ModalExcluirPlano
    plano={planoParaExcluir}
    onClose={() => setPlanoParaExcluir(null)}
    onConfirmar={async (plano) => {
     await excluirPlano(plano.id);    // chama o backend
   }}
  />
)}

{planoParaVerGrafico && (
  <ModalGraficoPlano
    plano={planoParaVerGrafico}
    onClose={() => setPlanoParaVerGrafico(null)}
  />
)}

{modalAporteAberto && planoSelecionado && (
  <ModalAportePlano
    aberto={modalAporteAberto}
    setAberto={setModalAporteAberto}
    plano={planoSelecionado}
    onSalvar={salvarAporte}
    onRefresh={recarregarPlanos}
  />
)}
    </div>
  );
}