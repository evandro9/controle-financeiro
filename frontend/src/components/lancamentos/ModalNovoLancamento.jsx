import React, { useEffect, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  X, Calendar, DollarSign, Tag, ClipboardList, FileText, CreditCard, Shuffle, CheckCircle 
} from 'lucide-react';
import { toast } from 'react-toastify';
import { addMonths, parseISO, format, setDate } from 'date-fns';
import ModalConfirmacaoParcelas from './ModalConfirmacaoParcelas';

const gerarEstadoInicial = () => {
  const hoje = format(new Date(), 'yyyy-MM-dd');
  return {
    tipo: 'despesa',
    data_lancamento: hoje,
    data_vencimento: hoje,
    valor: '',
    categoria_id: '',
    subcategoria_id: '',
    forma_pagamento_id: '',
    observacao: '',
    status: 'pendente'
  };
};

const ModalNovoLancamento = ({
  isOpen, onClose, onSalvar, categorias, formasPagamento,
  dadosIniciais, editando, setMsg,
  duracaoMesesInicial
}) => {
  const [form, setForm] = useState(() => gerarEstadoInicial());
  const [subcategorias, setSubcategorias] = useState([]);
  const [erro, setErro] = useState('');
  const [parcelar, setParcelar] = useState(false);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1);
  const [vencimentoCartao] = useState(10);
  const [editarGrupo, setEditarGrupo] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
 const [parcelasGeradas, setParcelasGeradas] = useState([]);
 const [dvTouched, setDvTouched] = useState(false);
  const [tipoLancamento, setTipoLancamento] = useState('simples');
  const [duracaoMeses, setDuracaoMeses] = useState(duracaoMesesInicial || 2);
  const [invalid, setInvalid] = useState(new Set());
  const [valorNumero, setValorNumero] = useState(0); // numérico
  const [valorTexto, setValorTexto] = useState('');  // máscara
  const [aplicouSugestao, setAplicouSugestao] = useState(false);

  const formatBRL = (n) => {
  if (n == null || isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const handleValorChange = (e) => {
  const digits = (e.target.value || '').replace(/\D/g, '');
  const asNumber = digits ? Number(digits) / 100 : 0;
  setValorNumero(asNumber);
  setValorTexto(digits ? formatBRL(asNumber) : '');
  setForm(prev => ({ ...prev, valor: asNumber })); // mantém no form
  setInvalid(prev => {
    const next = new Set(prev);
    next.delete('valor');
    return next;
  });
};

  // classes de borda p/ validação
const invalidCls =
  "border-red-500 dark:border-red-500 " +
  "focus:border-red-500 dark:focus:border-red-500 " +
  "focus:ring-2 focus:ring-red-500/40 dark:focus:ring-red-500/40";

const validCls =
  "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 " +
  "dark:focus:border-blue-400 dark:focus:ring-blue-400/40";

  // ——— Helpers para máscara BRL (sem prefixo R$) ———
const brFormat = (n) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const onlyDigits = (s = '') => s.replace(/\D/g, '');

const formatValorInput = (raw) => {
  const digits = onlyDigits(raw);
  if (!digits) return '';
  const num = Number(digits) / 100; // 123 -> 1,23
  return brFormat(num);
};

  useEffect(() => {
    if (!isOpen) return;

    if (dadosIniciais) {
      setForm(dadosIniciais);
      setForm(prev => ({ ...prev, valor: formatValorInput(String(prev.valor ?? '')) }));
 const inicial = Number(dadosIniciais.valor) || 0;
setValorNumero(inicial);
 setValorTexto(inicial ? formatBRL(inicial) : '');
 setForm(prev => ({ ...prev, valor: inicial }));
      setParcelar(!!dadosIniciais.grupo_parcela_id);
      setEditarGrupo(!!dadosIniciais.grupo_parcela_id);

      const tipo = dadosIniciais.grupo_recorrente_id
        ? 'recorrente'
        : dadosIniciais.grupo_parcela_id
        ? 'parcelado'
        : 'simples';

      setTipoLancamento(tipo);

      if (editando && dadosIniciais.grupo_recorrente_id && duracaoMesesInicial) {
        setDuracaoMeses(duracaoMesesInicial);
      }
    } else {
      setForm(prev => {
        if (prev.data_lancamento || prev.data_vencimento) return prev;
        const hoje = format(new Date(), 'yyyy-MM-dd');
        return { ...prev, data_lancamento: hoje, data_vencimento: hoje };
      });
      setParcelar(false);
      setEditarGrupo(false);
      setTipoLancamento('simples');
      setQuantidadeParcelas(2);
      setDuracaoMeses(2);
     setValorNumero(0);
     setValorTexto('');
    }
  }, [isOpen, dadosIniciais, editando, duracaoMesesInicial]);

  useEffect(() => {
    const categoriaSelecionada = categorias.find(c => c.id == form.categoria_id);
    setSubcategorias(categoriaSelecionada ? categoriaSelecionada.subcategorias : []);
  }, [form.categoria_id, categorias]);

const handleChange = (e) => {
  const { name, value } = e.target;
  setForm(prev => ({ ...prev, [name]: value }));
  setInvalid(prev => {
    const next = new Set(prev);
    next.delete(name);
    return next;
  });
};

// --- MATCH (lançamentos): busca sugestão de categoria/subcategoria pela observação ---
async function buscarSugestaoPorObservacao(obs) {
  const texto = String(obs || '').trim();
  if (!texto) return null;
  try {
    const token = localStorage.getItem('token');
    const url = `/api/regras-lancamentos/match?obs=${encodeURIComponent(texto)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(()=>({}));
    if (r.ok && j?.ok && j?.sugestao?.categoria_id) {
      return j.sugestao;
    }
  } catch {}
  return null;
}

// --- UPSERT (lançamentos): aprende regra após salvar ---
async function upsertRegraObservacao({ padrao, categoria_id, subcategoria_id }) {
  const texto = String(padrao || '').trim();
  if (!texto || !categoria_id) return;
  try {
    const token = localStorage.getItem('token');
    const body = {
      padrao: texto,
      tipo_match: 'contains', // padrão seguro
      categoria_id: Number(categoria_id),
      subcategoria_id: subcategoria_id ? Number(subcategoria_id) : null,
      prioridade: 100
    };
    await fetch('/api/regras-lancamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    }).catch(()=>{});
  } catch {}
}

  const camposObrigatorios = [
    'tipo', 'data_lancamento', 'data_vencimento', 'valor',
    'categoria_id', 'subcategoria_id', 'forma_pagamento_id', 'status'
  ];

  const isEmpty = (v) => v === '' || v === null || v === undefined;

const handleSubmit = async () => {
  // --- validação campos obrigatórios ---
  // (exceto 'valor', que tem regra própria)
  const obrig = [
    'tipo', 'data_lancamento', 'data_vencimento',
    'categoria_id', 'subcategoria_id', 'forma_pagamento_id', 'status'
  ];

  const faltando = obrig.filter(campo => isEmpty(form[campo]));
  if (faltando.length) {
    setErro('Preencha todos os campos obrigatórios.');
    setInvalid(new Set(faltando));
    return;
  }

  // --- validação do VALOR (obrigatório e > 0) ---
  if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
    setErro('Informe um valor maior que zero.');
    setInvalid(prev => new Set([...prev, 'valor']));
    return;
  }

  // --- validação de DATAS: lançamento <= vencimento ---
  try {
    const dL = parseISO(form.data_lancamento);
    const dV = parseISO(form.data_vencimento);
    if (dL.getTime() > dV.getTime()) {
      setErro('A data de lançamento não pode ser posterior à data de vencimento.');
      setInvalid(new Set(['data_lancamento', 'data_vencimento']));
      return;
    }
  } catch (_) {
    // se parse falhar, a validação de obrigatórios já cobre
  }

  setInvalid(new Set()); // ok, limpa marcações

  // 🟢 Novo recorrente (não editando)
  if (tipoLancamento === 'recorrente' && !editando) {
    try {
      const token = localStorage.getItem('token');
      const body = {
        ...form,
        valor: valorNumero,
        data_inicio: form.data_lancamento,
        duracao_meses: duracaoMeses
      };
      delete body.data_lancamento;

      const res = await fetch('/api/lancamentos/recorrente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        toast.success('✅ Lançamento recorrente salvo com sucesso');
        limparFormulario();
        setMsg(`recorrente-${Date.now()}`);
        return;
      } else {
        toast.error('Erro ao salvar lançamento recorrente');
        return;
      }
    } catch (err) {
      console.error('Erro ao salvar recorrente:', err);
      toast.error('Erro inesperado ao salvar recorrente');
      return;
    }
  }

  // 🟢 Parcelado
  if (tipoLancamento === 'parcelado' && quantidadeParcelas > 1) {
    // (datas da 1ª parcela já respeitam o vencimento no gerador)
    const parcelas = gerarParcelasLocal();
    setParcelasGeradas(parcelas);
    setMostrarConfirmacao(true);
    return;
  }

  // 🟢 Simples ou edição de recorrente/parcelado
  const dadosEnviar = { ...form, editarGrupo, valor: valorNumero };
  if (tipoLancamento === 'recorrente' && editando && editarGrupo) {
    dadosEnviar.editarTodosRecorrentes = true;
  }

  await onSalvar(dadosEnviar);
  // aprende a regra (observação -> categoria/subcategoria)
  await upsertRegraObservacao({
    padrao: form.observacao,
    categoria_id: form.categoria_id,
    subcategoria_id: form.subcategoria_id
  });
  toast.success(editando ? 'Lançamento editado com sucesso!' : 'Novo lançamento salvo com sucesso!');
  setDvTouched(false);
  limparFormulario();
};

  const handleCancel = () => {
    setDvTouched(false);
    setForm(gerarEstadoInicial());
    setParcelar(false);
    setTipoLancamento('simples');
    setQuantidadeParcelas(1);
    setEditarGrupo(false);
    onClose();
  };

function gerarParcelasLocal() {
  const parcelas = [];
  const grupoParcelaId = crypto.randomUUID();
  const total = Number(valorNumero) || 0;
  const valorParcela = +(total / quantidadeParcelas).toFixed(2);

  const dataBase = parseISO(form.data_lancamento);
  const dataBaseISO = format(dataBase, 'yyyy-MM-dd');

  // pega a forma selecionada (se houver)
  const forma = (formasPagamento || []).find(x => String(x.id) === String(form.forma_pagamento_id));
  const diaV = forma && Number(forma.dia_vencimento) ? Number(forma.dia_vencimento) : null;
  const diaF = forma && Number(forma.dia_fechamento) ? Number(forma.dia_fechamento) : null;

  // quando NÃO há dia de vencimento na forma → seguimos a data que está no formulário,
  // e incrementamos mês a mês (respeitando fim de mês)
  const primeiraDvManualISO = form.data_vencimento || dataBaseISO;
  const primeiraDvManual = parseISO(primeiraDvManualISO);
  const diaManual = primeiraDvManual.getDate();

  // cálculo automático do 1º vencimento pelo cartão (para detectar override)
  const autoPrimeiroVencISO = (diaV
    ? shiftToNextBusinessDayFront(
        computeDueDateFront(form.data_lancamento, diaV, diaF)
      )
    : null);
  const usuarioFezOverride = dvTouched && !!form.data_vencimento &&
    (!autoPrimeiroVencISO || autoPrimeiroVencISO !== form.data_vencimento);

  for (let i = 0; i < quantidadeParcelas; i++) {
    const dataLanc = addMonths(dataBase, i);
    let dvISO;

    // Se o usuário editou manualmente o vencimento da 1ª parcela,
    // ancoramos a série nesse valor, mesmo havendo 'dia_vencimento' na forma.
    if (usuarioFezOverride) {
      const ref = addMonths(primeiraDvManual, i);
      const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
      ref.setDate(Math.min(diaManual, last));
      dvISO = format(ref, 'yyyy-MM-dd');
    } else if (diaV) {
      // Regra padrão de cartão (fechamento + vencimento)
      const parcelaAtual = i + 1;
      const base = computeDueDateInstallmentFront(dataBaseISO, parcelaAtual, diaV, diaF);
      dvISO = shiftToNextBusinessDayFront(base);
    } else {
      // Sem dia_venc na forma → usa a data do formulário como referência da 1ª parcela
      const ref = addMonths(primeiraDvManual, i);
      // clamp do dia p/ meses mais curtos
      const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
      ref.setDate(Math.min(diaManual, last));
      dvISO = format(ref, 'yyyy-MM-dd');
    }

    parcelas.push({
      ...form,
      valor: valorParcela,
      parcela: i + 1,
      total_parcelas: quantidadeParcelas,
      grupo_parcela_id: grupoParcelaId,
      data_lancamento: format(dataLanc, 'yyyy-MM-dd'),
      data_vencimento: dvISO
    });
  }

  return parcelas;
}

  function limparFormulario() {
    setErro('');
    setForm(gerarEstadoInicial());
    setParcelar(false);
    setTipoLancamento('simples');
    setQuantidadeParcelas(1);
    setEditarGrupo(false);
    onClose();
  }

// --- helpers de datas (cartão) ---
const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function computeDueDateFront(dataLancISO, diaVenc, diaFech) {
  if (!dataLancISO || !diaVenc) return null;
  const [y, m, d] = dataLancISO.split('-').map(Number);
  const addMonth = (yy, mm, add) => {
    const dt = new Date(Date.UTC(yy, (mm - 1) + add, 1));
    return [dt.getUTCFullYear(), dt.getUTCMonth() + 1];
  };
  if (diaFech) {
    const dCompra = d || 1;
    const [cyY, cyM] = (dCompra <= Number(diaFech)) ? [y, m] : addMonth(y, m, 1);
    const [vy, vm] = [cyY, cyM];
    const dia = Math.min(Number(diaVenc), lastDayOfMonth(vy, vm));
    return `${vy}-${String(vm).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  } else {
    const dia = Math.min(Number(diaVenc), lastDayOfMonth(y, m));
    return `${y}-${String(m).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  }
}

function computeDueDateInstallmentFront(dataCompraISO, parcelaAtual, diaVenc, diaFech) {
  if (!dataCompraISO || !diaVenc || !Number.isFinite(Number(parcelaAtual))) return null;
  const [y, m, d] = dataCompraISO.split('-').map(Number);
  const addMonth = (yy, mm, add) => {
    const dt = new Date(Date.UTC(yy, (mm - 1) + add, 1));
    return [dt.getUTCFullYear(), dt.getUTCMonth() + 1];
  };
  const last = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();

  // competência da 1ª fatura
  let cyY = y, cyM = m;
  if (diaFech && d > Number(diaFech)) {
    [cyY, cyM] = addMonth(y, m, 1);
  }
  // 1º vencimento = MESMO mês da competência
  let [vy, vm] = [cyY, cyM];
  let dia = Math.min(Number(diaVenc), last(vy, vm));
  const n = Number(parcelaAtual);
  if (n > 1) {
    [vy, vm] = addMonth(vy, vm, n - 1);
    dia = Math.min(Number(diaVenc), last(vy, vm));
  }
  return `${vy}-${String(vm).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
}

const shiftToNextBusinessDayFront = (iso) => {
  if (!iso) return null;
  const dt = new Date(`${iso}T00:00:00Z`);
  const wd = dt.getUTCDay(); // 0=dom, 6=sáb
  if (wd === 6) dt.setUTCDate(dt.getUTCDate() + 2);
  else if (wd === 0) dt.setUTCDate(dt.getUTCDate() + 1);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

useEffect(() => {
  if (!form.forma_pagamento_id || !form.data_lancamento || dvTouched) return;

  const f = (formasPagamento || []).find(
    x => String(x.id) === String(form.forma_pagamento_id)
  );
  if (!f) return;

  const diaV = Number(f.dia_vencimento) || null;
  const diaF = Number(f.dia_fechamento) || null;
  if (!diaV) return; // sem dia de vencimento cadastrado → mantém como está

  const base = computeDueDateFront(form.data_lancamento, diaV, diaF);
  const dv = shiftToNextBusinessDayFront(base);

  if (dv && dv !== form.data_vencimento) {
    setForm(prev => ({ ...prev, data_vencimento: dv }));
  }
}, [form.forma_pagamento_id, form.data_lancamento, formasPagamento, dvTouched]);

  return (
    <>
      <Transition show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCancel}>
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="bg-white dark:bg-gray-800 w-full max-w-lg md:max-w-3xl rounded-2xl p-6 shadow-lg transition-all relative">
              <button
                onClick={handleCancel}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition"
              >
                <X size={22} />
              </button>

              {/* Cabeçalho */}
              <div className="mb-6 flex items-center justify-between relative">
                <h2 className="text-xl font-bold dark:text-gray-100">
                  {editando ? 'Editar Lançamento' : 'Novo Lançamento'}
                </h2>
                <div className="pr-10">
<div className="flex gap-1 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
  <button
    onClick={() => { setParcelar(false); setTipoLancamento('simples'); }}
    className={`px-3 py-1 text-sm font-medium transition ${
      tipoLancamento === 'simples'
        ? 'bg-blue-600 text-white'
        : 'text-gray-700 dark:text-gray-200'
    }`}
  >
    Simples
  </button>
  <button
    onClick={() => { setParcelar(true); setTipoLancamento('parcelado'); }}
    className={`px-3 py-1 text-sm font-medium transition ${
      tipoLancamento === 'parcelado'
        ? 'bg-blue-600 text-white'
        : 'text-gray-700 dark:text-gray-200'
    }`}
  >
    Parcelado
  </button>
  <button
    onClick={() => { setParcelar(false); setTipoLancamento('recorrente'); }}
    className={`px-3 py-1 text-sm font-medium transition ${
      tipoLancamento === 'recorrente'
        ? 'bg-blue-600 text-white'
        : 'text-gray-700 dark:text-gray-200'
    }`}
  >
    Recorrente
  </button>
</div>
                </div>
              </div>

              {erro && (
  <div className="mb-4 rounded-lg border px-3 py-2 text-sm
                  border-red-400 bg-red-50 text-red-800
                  dark:bg-red-900/40 dark:text-red-200 dark:border-red-600">
    {erro}
  </div>
)}

              {/* Formulário */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 dark:text-gray-100">
  {/* Tipo */}
  <div>
    <label className="text-sm block flex items-center gap-2">
      <Shuffle size={16} /> Tipo
    </label>
    <select
      name="tipo"
      value={form.tipo}
      onChange={handleChange}
      className={`w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:border-gray-600
                  ${invalid.has('tipo') ? invalidCls : validCls}`}
    >
      <option value="despesa">Despesa</option>
      <option value="receita">Receita</option>
    </select>
  </div>

    {/* 👉 Observação (vai para a coluna da direita, topo) */}
  <div>
    <label className="text-sm block flex items-center gap-2">
      <FileText size={16} /> Descrição / Observação
    </label>
    <input
      name="observacao"
      type="text"
      value={form.observacao}
      onChange={(e)=>{ setAplicouSugestao(false); handleChange(e); }}
      onBlur={async ()=>{
        if (aplicouSugestao) return;
        const sug = await buscarSugestaoPorObservacao(form.observacao);
        if (sug?.categoria_id) {
          setForm(prev => ({ ...prev, categoria_id: String(sug.categoria_id), subcategoria_id: sug.subcategoria_id ? String(sug.subcategoria_id) : '' }));
          setAplicouSugestao(true);
        }
      }}
      className="w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
    />
  </div>

  {/* 👉 Forma de Pagamento (vai para o lugar da Data) */}
  <div>
    <label className="text-sm block flex items-center gap-2">
      <CreditCard size={16} /> Forma de Pagamento
    </label>
    <select
      name="forma_pagamento_id"
      value={form.forma_pagamento_id}
      onChange={handleChange}
      className={`w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:border-gray-600
                  ${invalid.has('forma_pagamento_id') ? invalidCls : validCls}`}
    >
      <option value="">Selecione</option>
      {formasPagamento.map(fp => (
        <option key={fp.id} value={fp.id}>{fp.nome}</option>
      ))}
    </select>
  </div>

  {/* 👉 Data (vai para o lugar do Vencimento) */}
  <div>
    <label className="text-sm block flex items-center gap-2">
      <Calendar size={16} /> Data
    </label>
    <input
      name="data_lancamento"
      type="date"
      value={form.data_lancamento}
      onChange={handleChange}
      className={`w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:border-gray-600
                  ${invalid.has('data_lancamento') ? invalidCls : validCls}`}
    />
  </div>

  {/* 👉 Vencimento (vai para o lugar do Valor) */}
  <div>
    <label className="text-sm block flex items-center gap-2">
      <Calendar size={16} /> Vencimento
    </label>
    <input
      name="data_vencimento"
      type="date"
 value={form.data_vencimento}
 onChange={(e) => { handleChange(e); setDvTouched(true); }}
      className={`w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:border-gray-600
                  ${invalid.has('data_vencimento') ? invalidCls : validCls}`}
    />
  </div>

  {/* Categoria (mantém posição) */}
  <div>
    <label className="text-sm block flex items-center gap-2">
      <Tag size={16} /> Categoria
    </label>
    <select
      name="categoria_id"
      value={form.categoria_id}
      onChange={handleChange}
      className={`w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:border-gray-600
                  ${invalid.has('categoria_id') ? invalidCls : validCls}`}
    >
      <option value="">Selecione</option>
      {categorias.map(cat => (
        <option key={cat.id} value={cat.id}>{cat.nome}</option>
      ))}
    </select>
  </div>

  {/* Subcategoria (mantém posição) */}
  <div>
    <label className="text-sm block flex items-center gap-2">
      <ClipboardList size={16} /> Subcategoria
    </label>
    <select
      name="subcategoria_id"
      value={form.subcategoria_id}
      onChange={handleChange}
      className={`w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:border-gray-600
                  ${invalid.has('subcategoria_id') ? invalidCls : validCls}`}
    >
      <option value="">Selecione</option>
      {subcategorias.map(sub => (
        <option key={sub.id} value={sub.id}>{sub.nome}</option>
      ))}
    </select>
  </div>

  {/* 👉 Valor (vai para o lugar da Forma de Pagamento) */}
  <div>
    <label className="text-sm block flex items-center gap-2">
      <DollarSign size={16} /> Valor
    </label>
    <input
      type="text"
      inputMode="decimal"
      placeholder="R$ 0,00"
      value={valorTexto}
      onChange={handleValorChange}
      className={`w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:border-gray-600
                  ${invalid.has('valor') ? invalidCls : validCls}`}
    />
  </div>
</div>

              {/* Parcelas / Status / Duração */}
              <div className="pt-4 flex flex-col md:flex-row justify-center gap-4 items-center">
                {parcelar && (
                  <div className="w-full md:w-1/2">
                    <label className="text-sm block text-center">Qtd. Parcelas</label>
                    <input type="number" min={2} value={quantidadeParcelas}
                      onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value))}
                      className="w-full rounded-lg border px-3 py-2 text-center dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                )}
                                {tipoLancamento === 'recorrente' && (
                  <div className="w-full md:w-1/2">
                    <label className="text-sm block text-center">Duração (meses)</label>
                    <input type="number" min={1} value={duracaoMeses}
                      onChange={(e) => setDuracaoMeses(parseInt(e.target.value))}
                      className="w-full rounded-lg border px-3 py-2 text-center dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                )}
<div className="w-full md:w-1/2">
  <label className="text-sm block flex items-center justify-center gap-2">
    <CheckCircle size={16} /> Status
  </label>
<select
  name="status"
  value={form.status}
  onChange={handleChange}
  className={`w-full rounded-lg border px-3 py-2 text-center dark:bg-gray-700 dark:border-gray-600
              ${invalid.has('status') ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/40' : 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40'}`}
>
    <option value="pago">Pago</option>
    <option value="pendente">Pendente</option>
  </select>
</div>

              </div>

              {/* Botões */}
{/* Botões */}
<div className="pt-6 flex justify-end gap-3">
  {/* classes base, idênticas para ambos */}
  {(() => {
    const btnBase =
      "inline-flex items-center justify-center h-10 px-4 rounded-xl font-semibold " +
      "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0";

    const btnCancel =
      `${btnBase} text-white bg-red-600/80 hover:bg-red-700 ` +
      "dark:bg-red-600/80 dark:hover:bg-red-700";

    const btnSave =
      `${btnBase} text-white bg-blue-600 hover:bg-blue-700 ` +
      "dark:bg-blue-600 dark:hover:bg-blue-700";

    return (
      <>
        <button onClick={handleCancel} className={btnCancel}>
          Cancelar
        </button>
        <button onClick={handleSubmit} className={btnSave}>
          {editando ? 'Salvar Edição' : 'Salvar Lançamento'}
        </button>
      </>
    );
  })()}
</div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

{mostrarConfirmacao && (
  <ModalConfirmacaoParcelas
    parcelas={parcelasGeradas}
    onConfirmar={async () => {
      await onSalvar(parcelasGeradas);
      // aprende com base na 1ª parcela (mesma observação/categorização)
      const p0 = parcelasGeradas?.[0];
      if (p0) {
        await upsertRegraObservacao({
          padrao: p0.observacao,
          categoria_id: p0.categoria_id,
          subcategoria_id: p0.subcategoria_id
        });
      }
      toast.success('Lançamento parcelado salvo com sucesso');
      setMostrarConfirmacao(false);
      limparFormulario();
      setMsg(`parcelado-${Date.now()}`);
    }}
    onVoltar={() => setMostrarConfirmacao(false)}
  />
)}
    </>
  );
};

export default ModalNovoLancamento;
