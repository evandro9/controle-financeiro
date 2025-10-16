import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

function ModalNovoInvestimento({ investimento, fechar }) {
  const [form, setForm] = useState({
    categoria: '',
    subcategoria: '',
    nome_investimento: '',
    tipo_operacao: 'compra',
    quantidade: '',
    valor_unitario: '',
    data_operacao: '',
    observacao: ''
  });

  // USD support
  const [isUSD, setIsUSD] = useState(false);
  // números "pu", "fx" e "custo" + textos com máscara (mesma lógica do ModalNovoLancamento)
  const [valorUnitarioNumero, setValorUnitarioNumero] = useState(0);
  const [valorUnitarioTexto, setValorUnitarioTexto] = useState('');
  const [cotacaoNumero, setCotacaoNumero] = useState(0);
  const [cotacaoTexto, setCotacaoTexto] = useState('');
  // Persistidos/antigos vindos do banco (se existirem)
  const [puBRLsalvo, setPuBRLsalvo] = useState(null); // valor_unitario em R$ salvo
  const [puUSDsalvo, setPuUSDsalvo] = useState(null); // valor_unitario_usd salvo
  const [fxSalvo, setFxSalvo] = useState(null);       // cotacao_usd_brl salva
  const [custoNumero, setCustoNumero] = useState(0);
  const [custoTexto, setCustoTexto] = useState('');
  const [totalUSD, setTotalUSD] = useState(0);
  // --- Renda Fixa ---
  const [indexador, setIndexador] = useState('');            // '', 'PRE', 'CDI', 'IPCA'
  const [taxaAAtexto, setTaxaAAtexto] = useState('');        // ex.: "12,00" (% a.a.) -> salva 0.12
  const [percentualCDI, setPercentualCDI] = useState('');    // ex.: "110" (% do CDI)
  const [dataInicio, setDataInicio] = useState('');          // YYYY-MM-DD
  const [vencimento, setVencimento] = useState('');          // YYYY-MM-DD
  const [baseDias, setBaseDias] = useState(252);
  const [metodoVal, setMetodoVal] = useState('AUTOMATICO');
  // Come-cotas (fundos) + prazo do fundo
  const [comeCotas, setComeCotas] = useState(false);
  const [prazoFundo, setPrazoFundo] = useState('LONGO'); // 'CURTO' | 'LONGO'
  const aliquotaComecotas = prazoFundo === 'LONGO' ? 15 : 20; // LONGO=15%, CURTO=20%

    // Detecta o tipo do wizard a partir do investimento (edição)
  function detectTipoWizardFromInvestment(inv) {
    if (!inv) return '';
    const cat  = String(inv.categoria||'').toLowerCase();
    const sub  = String(inv.subcategoria||'').toLowerCase();
    const nome = String(inv.nome_investimento||'').trim().toUpperCase();
    const idx  = String(inv.indexador||'').toUpperCase();
    // Ação/ETF BR (B3: TICKER + dígito, ou .SA)
    if (/^[A-Z]{4}\d{1,2}$/.test(nome) || /\.SA$/.test(nome)) return 'ACAO_ETF_BR';
    // Ação/ETF US (ticker comum sem .SA)
    if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(nome) && !/\.SA$/.test(nome)) return 'ACAO_ETF_US';
    // Tesouro Direto
    if (sub.includes('tesouro') || /^TESOURO\s/.test(nome)) return 'TD';
    // Renda Fixa privada (indexador presente ou categoria RF)
    if (cat.includes('renda fixa') || ['PRE','CDI','IPCA'].includes(idx)) return 'RF_PRIVADA';
    return 'OUTROS';
  }

  // =========================
  // WIZARD: passo e tipo
  // =========================
  const [passo, setPasso] = useState(1); // 1=tipo, 2=seleção, 3=detalhes
  const [tipoWizard, setTipoWizard] = useState(''); // 'ACAO_ETF_BR','ACAO_ETF_US','TD','RF_PRIVADA','OUTROS'

  // Autocomplete (Ações/ETFs via Yahoo)
  const [buscaTermo, setBuscaTermo] = useState('');
  const [resultadosYahoo, setResultadosYahoo] = useState([]);
  const [carregandoBusca, setCarregandoBusca] = useState(false);

  // Catálogo (Tesouro Direto / RF privada templates)
  const [resultadosCat, setResultadosCat] = useState([]);
  const [tdSyncing, setTdSyncing] = useState(false);
  const [tdSyncedOnce, setTdSyncedOnce] = useState(false); // evita loop de sync a cada tecla
  const [resultadosRFPriv, setResultadosRFPriv] = useState([]);
  const [rfMsg, setRfMsg] = useState('');

  // Reset (novo) e pré-config completa (edição)
  useEffect(() => {
    if (investimento) {
      // Preenche form e detecta tipo
      setForm(investimento);
      const tw = detectTipoWizardFromInvestment(investimento);
      setTipoWizard(tw || 'OUTROS');
      setPasso(3); // abre direto em "Detalhes"
      // Se for ativo US, marca isUSD para habilitar FX/cálculo correto
      const nome = String(investimento.nome_investimento||'').trim().toUpperCase();
      const ehUSD = (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(nome) && !/\.SA$/.test(nome));
      setIsUSD(ehUSD);
      // Guardar PU(BRL) salvo p/ eventual reconstituição
      setPuBRLsalvo(isFinite(Number(investimento.valor_unitario)) ? Number(investimento.valor_unitario) : null);
      // Se vierem as colunas novas, usar direto
      if (ehUSD) {
        const puUSD = isFinite(Number(investimento.valor_unitario_usd)) ? Number(investimento.valor_unitario_usd) : null;
        const fx    = isFinite(Number(investimento.cotacao_usd_brl)) ? Number(investimento.cotacao_usd_brl) : null;
        setPuUSDsalvo(puUSD);
        setFxSalvo(fx);
        if (puUSD) {
          setValorUnitarioNumero(puUSD);
          setValorUnitarioTexto(puUSD ? `US$ ${puUSD.toFixed(2).replace('.',',')}` : '');
        }
        if (fx) {
          setCotacaoNumero(fx);
          setCotacaoTexto(fx.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
        }
      }
      // Pré-preenche RF (se aplicável)
      setIndexador(String(investimento.indexador||'').toUpperCase());
      const taxaPct = isFinite(Number(investimento.taxa_anual)) ? (Number(investimento.taxa_anual)*100) : '';
      setTaxaAAtexto(taxaPct!=='' ? String(taxaPct.toFixed(2)).replace('.',',') : '');
      setPercentualCDI(
        isFinite(Number(investimento.percentual_cdi)) ? String(Number(investimento.percentual_cdi)) : ''
      );
      setDataInicio(investimento.data_inicio || investimento.data_operacao || '');
      setVencimento(investimento.vencimento || '');
      setBaseDias(isFinite(Number(investimento.base_dias)) ? Number(investimento.base_dias) : 252);
      setMetodoVal(investimento.metodo_valorizacao || 'AUTOMATICO');
      // Come-cotas
      if (typeof investimento.come_cotas !== 'undefined') {
        const cc = !!Number(investimento.come_cotas||0);
        setComeCotas(cc);
        if (cc) {
          const ali = Number(investimento.aliquota_comecotas);
          setPrazoFundo(ali === 20 ? 'CURTO' : 'LONGO');
        } else {
          setPrazoFundo('LONGO');
        }
      }
    } else {
      // novo: limpa estados
      setPasso(1);
      setTipoWizard('');
      setBuscaTermo('');
      setResultadosYahoo([]);
      setResultadosCat([]);
      setResultadosRFPriv([]);
      // zera campos chave
      setIsUSD(false);
      setValorUnitarioNumero(0); setValorUnitarioTexto('');
      setCotacaoNumero(0); setCotacaoTexto('');
      setCustoNumero(0); setCustoTexto('');
      setTotalUSD(0); setValorTotal(0);
      setPuBRLsalvo(null); setPuUSDsalvo(null); setFxSalvo(null);
      setIndexador(''); setTaxaAAtexto(''); setPercentualCDI('');
      setDataInicio(''); setVencimento('');
      setBaseDias(252); setMetodoVal('AUTOMATICO');
      setComeCotas(false); setPrazoFundo('LONGO');
    }
  }, [investimento]); 

    // Helper: reset total/PU/custos/buscas ao escolher um novo tipo no Passo 1
  function resetTipo(novo) {
    setTipoWizard(novo);
    setPasso(2);
    setBuscaTermo('');
    setResultadosYahoo([]);
    setResultadosCat([]);
    setResultadosRFPriv([]);
    setForm((f)=>({
      ...f,
      nome_investimento: '',
      quantidade: '',
      valor_unitario: '',
      observacao: ''
    }));
    // define automaticamente se é ativo em USD ou não
    if (novo === 'ACAO_ETF_US') {
      setIsUSD(true);
    } else {
      setIsUSD(false);
    }
    setValorUnitarioNumero(0); setValorUnitarioTexto('');
    setCotacaoNumero(0); setCotacaoTexto('');
    setCustoNumero(0); setCustoTexto('');
    setTotalUSD(0); setValorTotal(0);
    setIndexador(''); setTaxaAAtexto(''); setPercentualCDI('');
    setDataInicio(''); setVencimento('');
    setBaseDias(252);
  // 🔽 limpa mapeamento também
  setClasseId('');
  setSubclasseId('');
  setPendingSubId('');
  }

  // Se for RF (TD ou RF_PRIVADA), força quantidade = 1 para simplificar a digitação
  useEffect(()=>{
    if (tipoWizard==='TD' || tipoWizard==='RF_PRIVADA') {
      setForm((f)=>({ ...f, quantidade: 1 }));
    }
  }, [tipoWizard]);

  async function buscarYahoo(q) {
    if (!q || q.length < 2) { setResultadosYahoo([]); return; }
    setCarregandoBusca(true);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/autocomplete/yahoo?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json().catch(()=>({}));
      setResultadosYahoo(Array.isArray(j.items) ? j.items : []);
    } catch {
      setResultadosYahoo([]);
    } finally { setCarregandoBusca(false); }
  }

  async function buscarCatalogoTD(q) {
    const token = localStorage.getItem('token');
    // 1) tenta catálogo local
    let res = await fetch(`/api/catalogo/search?tipo=TD&q=${encodeURIComponent(q||'')}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r=>r.json()).catch(()=>null);
    let items = Array.isArray(res?.items) ? res.items : [];
    // 2) se vazio e ainda não tentamos sync nesta sessão, sincroniza e busca de novo
    if (!items.length && !tdSyncedOnce && !tdSyncing) {
      try {
        setTdSyncing(true);
        await fetch(`/api/catalogo/sync/td`, {
          method:'POST',
          headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }
        });
        setTdSyncedOnce(true);
        res = await fetch(`/api/catalogo/search?tipo=TD&q=${encodeURIComponent(q||'')}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r=>r.json()).catch(()=>null);
        items = Array.isArray(res?.items) ? res.items : [];
      } catch {/* ignora */}
      finally { setTdSyncing(false); }
    }
    setResultadosCat(items);
  }

    // Catálogo de RF privada (templates)
  async function buscarCatalogoRFPrivada(q) {
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/catalogo/search?tipo=RF_PRIVADA&q=${encodeURIComponent(q || '')}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json().catch(() => ({}));
      setResultadosRFPriv(Array.isArray(j.items) ? j.items : []);
    } catch {
      setResultadosRFPriv([]);
    }
  }

  async function salvarTemplateRF() {
    if (!form.nome_investimento || !indexador) {
      setRfMsg('Preencha nome e indexador para salvar como template.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const body = {
        tipo: 'RF_PRIVADA',
        nome_display: form.nome_investimento,
        indexador,
        percentual_cdi: (indexador==='CDI'
          ? (Number(String(percentualCDI).replace(',','.')) || null)
          : null),
        vencimento: vencimento || null,
        base_dias: Number(baseDias) || 252,
        ir_regra: 'regressivo'
      };
      const r = await fetch('/api/catalogo/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const j = await r.json().catch(() => ({}));
      setRfMsg(j?.ok ? 'Template salvo.' : 'Falha ao salvar template.');
      if (j?.ok) await buscarCatalogoRFPrivada(form.nome_investimento);
    } catch {
      setRfMsg('Falha ao salvar template.');
    }
  }

  // helpers iguais aos do Novo Lançamento
  const formatBRL = (n) => (n == null || isNaN(n)) ? '' :
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const brFormat = (n) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const onlyDigits = (s = '') => s.replace(/\D/g, '');
  const maskBRLInput = (raw) => {
    const digits = onlyDigits(raw);
    if (!digits) return { num: 0, text: '' };
    const num = Number(digits) / 100;
    return { num, text: formatBRL(num) };
  };
  const fmtUSD = (n = 0) =>
    'US$ ' + (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // máscara de entrada para USD (digita só números e vira "US$ 0,00")
  const maskUSDInput = (raw) => {
    const digits = onlyDigits(String(raw || ''));
    if (!digits) return { num: 0, text: '' };
    const num = Number(digits) / 100;
    return {
      num,
      text: 'US$ ' + num.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    };
  };

   const [pendingSubId, setPendingSubId] = useState('');

  // listas e seleção de classe/subclasse
const [classes, setClasses] = useState([]);
const [subclasses, setSubclasses] = useState([]);
const [classeId, setClasseId] = useState('');
const [subclasseId, setSubclasseId] = useState('');

  const [valorTotal, setValorTotal] = useState(0);

  useEffect(() => {
    if (investimento) {
      setForm(investimento);
    } else {
      const hoje = new Date().toISOString().slice(0, 10);
      setForm(f => ({ ...f, data_operacao: hoje }));
    }
  }, [investimento]);

  useEffect(() => {
    if (!investimento) return;
    const ehUS = Number(investimento?.valor_unitario_usd) > 0;
    setIsUSD(ehUS);
    if (ehUS) {
      const puUSD = Number(investimento.valor_unitario_usd || 0);
      const fx = Number(investimento.cotacao_usd_brl || 0);
      setValorUnitarioNumero(puUSD);
      setValorUnitarioTexto(fmtUSD(puUSD));
      setCotacaoNumero(fx);
      setCotacaoTexto(formatBRL(fx));
    } else {
      const puBRL = Number(investimento.valor_unitario || 0);
      setValorUnitarioNumero(puBRL);
      setValorUnitarioTexto(formatBRL(puBRL));
    }
  }, [investimento]);

  // calcula totais (US$ e R$) e mantém form.valor_unitario numérico
  useEffect(() => {
    const qtd = parseFloat(form.quantidade);
    const pu  = parseFloat(valorUnitarioNumero);
    const fx  = parseFloat(cotacaoNumero);
    if (isNaN(qtd) || isNaN(pu)) {
      setTotalUSD(0);
      setValorTotal(0);
      return;
    }
    const tUSD = qtd * pu;
    let tBRL = isUSD ? tUSD * (isNaN(fx) ? 0 : fx) : tUSD;
    // custo em R$ ? soma se compra, subtrai se venda
    if (Number(custoNumero) > 0) {
      tBRL = form.tipo_operacao === 'venda' ? (tBRL - custoNumero) : (tBRL + custoNumero);
    }
    setTotalUSD(Number.isFinite(tUSD) ? tUSD : 0);
    setValorTotal(Number.isFinite(tBRL) ? Number(tBRL.toFixed(2)) : 0);
    // manter no form o PU numérico (em BRL para BR; em USD para USD)
    setForm((f) => ({ ...f, valor_unitario: pu }));
  }, [form.quantidade, valorUnitarioNumero, cotacaoNumero, custoNumero, isUSD, form.tipo_operacao]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // máscaras dos campos monetários (BRL vs USD)
  const handleValorUnitarioChange = (e) => {
    const raw = String(e.target.value || '');
    const { num, text } = isUSD ? maskUSDInput(raw) : maskBRLInput(raw);
    setValorUnitarioNumero(num);
    setValorUnitarioTexto(text);
  };

  const handleCotacaoChange = (e) => {
    const { num, text } = maskBRLInput(e.target.value);
    setCotacaoNumero(num);
    setCotacaoTexto(text);
    // Se for USD e temos PU(BRL) salvo mas ainda não temos PU(USD) na tela, reconstituir
    if (isUSD && puBRLsalvo && (!valorUnitarioNumero || valorUnitarioNumero<=0) && num>0) {
      const puUSD = puBRLsalvo / num;
      setValorUnitarioNumero(Number(puUSD.toFixed(4)));
      setValorUnitarioTexto(`US$ ${puUSD.toFixed(2).replace('.',',')}`);
    }
  };
  const handleCustoChange = (e) => {
    const { num, text } = maskBRLInput(e.target.value);
    setCustoNumero(num);
    setCustoTexto(text);
  };

  const salvar = async () => {
  // Validação obrigatória
  const camposObrigatorios = [
    'nome_investimento',
    'tipo_operacao',
    'quantidade',
    'valor_unitario',
    'data_operacao'
  ];
  if (!classeId) { toast.error('Selecione a classe'); return; }
  if (!subclasseId) { toast.error('Selecione a subclasse'); return; }

  for (const campo of camposObrigatorios) {
    if (!form[campo] || form[campo].toString().trim() === '') {
      toast.error(`O campo "${campo.replace('_', ' ')}" é obrigatório.`);
      return;
    }
  }

    // Validação de ticker (se parecer BR/EUA)
  const nome = String(form.nome_investimento || '').trim().toUpperCase();
  const pareceB3 = /^[A-Z]{4}\d{1,2}$/.test(nome);
  const pareceUS = /^[A-Z][A-Z0-9.\-]{0,9}$/.test(nome) && !pareceB3;
  if (pareceB3 || pareceUS) {
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/investimentos/validar-ticker?symbol=${encodeURIComponent(nome)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dj = await r.json().catch(() => ({}));
      if (!r.ok || !dj?.ok) {
        toast.error('Ticker inválido no Yahoo. Corrija para continuar.');
        return;
      }
      // define USD/BRL a partir da resposta do Yahoo (sem depender do state ainda)
      const ehUSD = String(dj.currency || '').toUpperCase() === 'USD' || !String(dj.symbol || '').endsWith('.SA');
      setIsUSD(ehUSD);
      // se for USD e não tivermos FX, busca agora e usa o retorno na mesma execução
      if (ehUSD) {
        let fxLocal = Number(cotacaoNumero);
        if (!fxLocal || isNaN(fxLocal) || fxLocal <= 0) {
          fxLocal = (await obterCotacaoDolar()) || 0;
        }
        if (!fxLocal || isNaN(fxLocal) || fxLocal <= 0) {
          toast.error('Informe a cotação do dólar (R$).');
          return;
        }
      }
    } catch {
      toast.error('Falha ao validar ticker. Tente novamente.');
      return;
    }
  }

  // Regras específicas para US: precisamos dos dois campos
  if (isUSD) {
    if (!valorUnitarioNumero || valorUnitarioNumero <= 0) {
      toast.error('Informe o preço unitário em USD.');
      return;
    }
    if (!cotacaoNumero || cotacaoNumero <= 0) {
      toast.error('Informe a cotação USD→BRL (R$).');
      return;
    }
  }

  const token = localStorage.getItem('token');

  const classeSel = classes.find(c => String(c.id) === String(classeId));
  const subSel = subclasses.find(s => String(s.id) === String(subclasseId));
  // total em R$ já está em valorTotal; total em US$ mostramos apenas na UI
  const payload = {
    ...form,
    // compatibilidade com backend antigo:
    categoria: classeSel?.nome || '',
    subcategoria: subSel?.nome || '',
    // novo modelo com ids:
    classe_id: Number(classeId),
    subclasse_id: Number(subclasseId),
    quantidade: Number(form.quantidade),
    // Se for EUA: salvar PU em R$ e também mandar os campos USD
    ...(isUSD
      ? {
          valor_unitario: Number(((valorUnitarioNumero || 0) * (cotacaoNumero || 0)).toFixed(6)),
          valor_unitario_usd: Number(valorUnitarioNumero || 0),
          cotacao_usd_brl: Number(cotacaoNumero || 0),
        }
      : {
          valor_unitario: Number(valorUnitarioNumero || 0),
          valor_unitario_usd: null,
          cotacao_usd_brl: null,
        }),
    // valor_total sempre em BRL (já calculado)
    valor_total: Number(valorTotal || 0),
    // ----- Renda Fixa (somente se indexador for preenchido) -----
    indexador: indexador || null,
    taxa_anual:
      indexador === 'PRE' || indexador === 'IPCA'
        ? (() => {
            const n = Number(String(taxaAAtexto).replace(',', '.'));
            return isFinite(n) ? n / 100 : null;
          })()
        : null,
    percentual_cdi:
      indexador === 'CDI'
        ? (() => {
            const n = Number(String(percentualCDI).replace(',', '.'));
            return isFinite(n) ? n : null;
          })()
        : null,
    data_inicio: indexador ? (dataInicio || form.data_operacao || null) : null,
    vencimento: indexador ? (vencimento || null) : null,
    metodo_valorizacao: indexador ? (metodoVal || 'AUTOMATICO') : null,
    base_dias: indexador ? Number(baseDias || 252) : null,
    // Come-cotas
    come_cotas: indexador ? Boolean(comeCotas) : null,
    aliquota_comecotas: indexador && comeCotas ? Number(aliquotaComecotas) : null,
  };

  const url = investimento
    ? `/api/investimentos/${investimento.id}`
    : '/api/investimentos';

  const method = investimento ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const erro = await res.json();
      toast.error(erro.error || 'Erro ao salvar investimento');
      return;
    }

    toast.success(investimento ? 'Investimento editado com sucesso' : 'Investimento cadastrado com sucesso');
    fechar();
  } catch (err) {
    console.error('Erro na requisição:', err);
  }
};

// carrega classes (visíveis)
useEffect(() => {
  const token = localStorage.getItem('token');
  fetch('/api/investimentos/classes?ocultas=0', {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(r => r.json())
    .then(data => setClasses(Array.isArray(data) ? data : []))
    .catch(() => setClasses([]));
}, []);

// quando escolher uma classe, carrega as subclasses
useEffect(() => {
  if (!classeId) { setSubclasses([]); setSubclasseId(''); return; }
  const token = localStorage.getItem('token');
  fetch(`/api/investimentos/subclasses?classe_id=${classeId}&ocultas=0`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(r => r.json())
    .then(data => setSubclasses(Array.isArray(data) ? data : []))
    .catch(() => setSubclasses([]));
}, [classeId]);

 // aplica subclasse pendente quando as opções chegam (não zera antes da hora)
 useEffect(() => {
   if (!pendingSubId) return;
   const alvo = String(pendingSubId);
   const existe = subclasses.some((s) => String(s.id) === alvo);
   if (existe) {
     setSubclasseId(alvo);
     setPendingSubId('');
   }
 }, [subclasses, pendingSubId]);

// se estiver editando, pré-preenche ids (se existirem)
useEffect(() => {
  if (investimento?.classe_id) setClasseId(String(investimento.classe_id));
  if (investimento?.subclasse_id) setSubclasseId(String(investimento.subclasse_id));
}, [investimento]);

function baseTickerStr(sym) {
  // NORMALIZA: maiúsculas, tira tudo após o primeiro ponto (ex.: ".SA", ".SAO", ".NMS"…)
  let s = String(sym || '').trim().toUpperCase();
  if (!s) return '';
  // se houver sufixo após ponto, mantém também a versão sem sufixo para tentar
  return s;
}

function gerarVariantesTicker(sym) {
  const s = baseTickerStr(sym);
  if (!s) return [];
  const variantes = new Set();
  variantes.add(s);                          // original
  variantes.add(s.replace(/\..*$/, ''));     // sem sufixo (VALE3.SA -> VALE3)
  // heurística: se parece B3 (LETRAS + dígitos), tenta com ".SA"
  const semSuf = s.replace(/\..*$/, '');
  if (/^[A-Z]{4,}[0-9]{1,2}$/.test(semSuf)) variantes.add(`${semSuf}.SA`);
  return Array.from(variantes).filter(Boolean);
}

async function buscarMapaPorTicker(ticker) {
  const variantes = gerarVariantesTicker(ticker);
  if (!variantes.length) return;
  const token = localStorage.getItem('token');
  for (const v of variantes) {
    try {
      const resp = await fetch(
        `/api/investimentos/ticker-map?ticker=${encodeURIComponent(v)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data?.classe_id) {
        setClasseId(String(data.classe_id));
        setPendingSubId(data.subclasse_id ? String(data.subclasse_id) : '');
        return; // achou — para aqui
      }
    } catch {
      // tenta próxima variante
    }
  }
}

// Busca e preenche a cotação do dólar (USDBRL=X) usando a mesma rota /validar-ticker
async function obterCotacaoDolar() {
  try {
    const token = localStorage.getItem('token');
    const r = await fetch(`/api/investimentos/validar-ticker?symbol=USDBRL%3DX`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dj = await r.json().catch(() => ({}));
    if (r.ok && dj?.ok && dj?.price != null) {
      const fx = Number(dj.price);
      setCotacaoNumero(fx);
      setCotacaoTexto(formatBRL(fx));
      return fx; // ← devolve a cotação para quem chamou
    }
  } catch {}
  return null;
}

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-darkCard rounded-xl p-6 w-full max-w-2xl shadow-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-darkText">
          {investimento ? 'Editar' : 'Novo'} Investimento
        </h2>

        {/* ---------------------  STEPPER  --------------------- */}
        <div className="flex items-center justify-center gap-6 mb-4">
          {[1,2,3].map((n)=>(
            <div key={n} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
                ${passo>=n
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                {n}
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-300 hidden sm:block">
                {n===1?'Tipo':n===2?'Selecionar': 'Detalhes'}
              </span>
            </div>
          ))}
        </div>

        {/* ---------------------  PASSO 1: TIPO  --------------------- */}
        {passo === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">Escolha o tipo de investimento:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                className={`p-3 rounded border hover:bg-gray-50 dark:hover:bg-gray-800 ${tipoWizard==='ACAO_ETF_BR'?'border-blue-500':'border-gray-300 dark:border-gray-600'} dark:text-darkText`}
                onClick={()=> resetTipo('ACAO_ETF_BR')}>
                Ação/FII/ETF - Brasil
              </button>
              <button
                className={`p-3 rounded border hover:bg-gray-50 dark:hover:bg-gray-800 ${tipoWizard==='ACAO_ETF_US'?'border-blue-500':'border-gray-300 dark:border-gray-600'} dark:text-darkText`}
                onClick={()=> resetTipo('ACAO_ETF_US')}>
                Ação/REITs/ETF - EUA
              </button>
              <button
                className={`p-3 rounded border hover:bg-gray-50 dark:hover:bg-gray-800 ${tipoWizard==='TD'?'border-blue-500':'border-gray-300 dark:border-gray-600'} dark:text-darkText`}
                onClick={()=> resetTipo('TD')}>
                Tesouro Direto
              </button>
              <button
                className={`p-3 rounded border hover:bg-gray-50 dark:hover:bg-gray-800 ${tipoWizard==='RF_PRIVADA'?'border-blue-500':'border-gray-300 dark:border-gray-600'} dark:text-darkText`}
                onClick={()=> resetTipo('RF_PRIVADA')}>
                Renda Fixa - Privada
              </button>
            </div>
          </div>
        )}

        {/* ---------------------  PASSO 2: SELEÇÃO  --------------------- */}
        {passo === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-darkText"
                onClick={()=>{
                  setPasso(1);
                  setBuscaTermo('');
                  setResultadosYahoo([]); setResultadosCat([]); setResultadosRFPriv([]);
                  setForm((f)=>({ ...f, nome_investimento: '' }));
                }}>
                <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80"><path fill="currentColor" d="M15 18l-6-6l6-6"/></svg>
                Voltar
              </button>
              <div className="text-xs text-gray-500">Passo 2 de 3</div>
            </div>

            {(tipoWizard==='ACAO_ETF_BR' || tipoWizard==='ACAO_ETF_US') && (
              <>
                <label className="text-xs text-gray-600 dark:text-gray-300">Busque por nome ou ticker</label>
                <input
                  type="text" value={buscaTermo}
                  onChange={(e)=>{ setBuscaTermo(e.target.value); buscarYahoo(e.target.value); }}
                  placeholder="Ex.: PETR4, VALE3, VOO, AAPL"
                  className="w-full border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"
                />
                {carregandoBusca && <div className="text-xs text-gray-500">Buscando…</div>}
                <div className="max-h-56 overflow-auto border rounded dark:border-gray-600">
                  {resultadosYahoo.map((it, idx)=>(
                    <button key={idx}
                      onClick={async ()=>{
                        let symbol = it.symbol || '';
                        const ehBR = /\.SA$/i.test(symbol);
                        // 🔽 remove o sufixo .SA se for ativo BR
                        if (ehBR) {
                          symbol = symbol.replace(/\.SA$/i, '');
                        }
                        setIsUSD(!ehBR);
                        setForm(f=>({ ...f, nome_investimento: symbol, categoria: f.categoria || 'Ações/ETFs' }));
                        if (!ehBR && !cotacaoNumero) { await obterCotacaoDolar(); }
                        // 🔽 popula classe/subclasse se já houver mapeamento do usuário
                        await buscarMapaPorTicker(symbol);
                        setPasso(3);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 border-b last:border-b-0 dark:border-gray-600"
                    >
                      <div className="font-medium">{it.symbol} <span className="text-xs text-gray-500">{it.exch}</span></div>
                      <div className="text-xs text-gray-600">{it.name}</div>
                    </button>
                  ))}
                  {!resultadosYahoo.length && <div className="p-3 text-xs text-gray-500">Digite para buscar…</div>}
                </div>
              </>
            )}

            {tipoWizard==='TD' && (
              <>
                <input
                  type="text" value={buscaTermo}
                  onChange={(e)=>{ setBuscaTermo(e.target.value); buscarCatalogoTD(e.target.value); }}
                  placeholder="Ex.: IPCA 2045, Selic 2030, Renda+"
                  className="w-full border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"
                />
                {tdSyncing && <div className="text-xs text-gray-500">Atualizando catálogo…</div>}
                <div className="max-h-56 overflow-auto border rounded dark:border-gray-600">
                  {resultadosCat.map((it)=>(
                    <button key={it.id}
                      onClick={async ()=>{
                        setForm(f=>({ ...f, nome_investimento: it.nome_display, categoria: f.categoria || 'Renda Fixa', subcategoria: 'Tesouro Direto' }));
                        setIndexador(it.indexador || '');
                        setPercentualCDI(it.percentual_cdi ? String(it.percentual_cdi) : '');
                        setVencimento(it.vencimento || '');
                        setBaseDias(it.base_dias || 252);
                        setMetodoVal('AUTOMATICO');
                        setIsUSD(false);
                        // 🔽 se o usuário já mapeou esse "nome" antes, aplica
                        await buscarMapaPorTicker(it.nome_display);
                        setPasso(3);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 border-b last:border-b-0 dark:border-gray-600"
                    >
                      <div className="font-medium">{it.nome_display}</div>
                      <div className="text-xs text-gray-500">{it.indexador || '—'} · Venc: {it.vencimento || '—'}</div>
                    </button>
                  ))}
                  {!resultadosCat.length && <div className="p-3 text-xs text-gray-500">Digite para buscar…</div>}
                </div>
              </>
            )}

            {tipoWizard==='RF_PRIVADA' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Nome do título</label>
                    <input type="text" value={form.nome_investimento||''}
                      onChange={(e)=>{ setForm(f=>({...f, nome_investimento: e.target.value})); buscarCatalogoRFPrivada(e.target.value); }}
                      placeholder="Ex.: CDB Banco X 2028" className="w-full border p-2 rounded dark:bg-gray-700 dark:text-darkText"/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Indexador</label>
                    <select value={indexador} onChange={(e)=>setIndexador(e.target.value)}
                      className="w-full border p-2 rounded dark:bg-gray-700 dark:text-darkText">
                      <option value="">Selecione…</option>
                      <option value="PRE">Pré-fixado</option>
                      <option value="CDI">% do CDI</option>
                      <option value="IPCA">IPCA +</option>
                    </select>
                  </div>
                  {indexador==='PRE' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Taxa a.a. (%)</label>
                      <input type="text" inputMode="decimal" placeholder="Ex.: 12,00"
                        value={taxaAAtexto} onChange={(e)=>setTaxaAAtexto(e.target.value)}
                        className="w-full border p-2 rounded dark:bg-gray-700 dark:text-darkText"/>
                    </div>
                  )}
                  {indexador==='CDI' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">% do CDI</label>
                      <input type="number" step="0.01" placeholder="Ex.: 110"
                        value={percentualCDI} onChange={(e)=>setPercentualCDI(e.target.value)}
                        className="w-full border p-2 rounded dark:bg-gray-700 dark:text-darkText"/>
                    </div>
                  )}
                  {indexador==='IPCA' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Taxa real a.a. (%)</label>
                      <input type="text" inputMode="decimal" placeholder="Ex.: 6,00"
                        value={taxaAAtexto} onChange={(e)=>setTaxaAAtexto(e.target.value)}
                        className="w-full border p-2 rounded dark:bg-gray-700 dark:text-darkText"/>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Vencimento (opcional)</label>
                    <input type="date" value={vencimento} onChange={(e)=>setVencimento(e.target.value)}
                      className="w-full border p-2 rounded dark:bg-gray-700 dark:text-darkText"/>
                  </div>
                </div>
                {/* Templates existentes */}
                <div className="border rounded p-2 dark:border-gray-600">
                  <div className="text-xs text-gray-500 mb-1">Modelos salvos</div>
                  <div className="max-h-40 overflow-auto">
                    {resultadosRFPriv.map((it)=>(
                      <button key={it.id}
                        onClick={async ()=>{
                          setForm(f=>({ ...f, nome_investimento: it.nome_display, categoria: f.categoria || 'Renda Fixa' }));
                          setIndexador(it.indexador || '');
                          setPercentualCDI(it.percentual_cdi ? String(it.percentual_cdi) : '');
                          setVencimento(it.vencimento || '');
                          setBaseDias(it.base_dias || 252);
                          // 🔽 aplica mapeamento, se existir
                          await buscarMapaPorTicker(it.nome_display);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 border-b last:border-b-0 dark:border-gray-600"
                      >
                        <div className="font-medium">{it.nome_display}</div>
                        <div className="text-xs text-gray-500">{it.indexador || '—'} · Venc: {it.vencimento || '—'}</div>
                      </button>
                    ))}
                    {!resultadosRFPriv.length && <div className="text-xs text-gray-500">Nenhum template. Salve um abaixo.</div>}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={salvarTemplateRF} className="text-xs px-2 py-1 border rounded">Salvar como modelo</button>
                    {!!rfMsg && <span className="text-xs text-gray-500">{rfMsg}</span>}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    O modelo guarda só <strong>metadados</strong> (nome, indexador, vencimento) para facilitar o preenchimento no futuro.
                    Não cria investimento e não altera seus ativos.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------------  PASSO 3: DETALHES  --------------------- */}
        {passo === 3 && (
          <div className="space-y-3">
            {/** Booleans para mostrar/ocultar campos por tipo */}
            {(() => {
              var isRF = (tipoWizard==='TD' || tipoWizard==='RF_PRIVADA');
              var showTradeFields = !isRF; // ações/ETFs mantêm Qtd/PU/Custo/FX/Totais
              return (
                <>
            <div className="flex items-center justify-between">
              <button
                className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-darkText"
                onClick={()=>setPasso(2)}>
                <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80"><path fill="currentColor" d="M15 18l-6-6l6-6"/></svg>
                Voltar
              </button>
              <div className="text-xs text-gray-500">Passo 3 de 3</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome */}
              <input
                name="nome_investimento"
                value={form.nome_investimento}
                onChange={(e) => {
                  handleChange(e);
                  const v = String(e.target.value || '').trim().toUpperCase();
                  const b3 = /^[A-Z]{4}\d{1,2}$/.test(v);
                  const us = /^[A-Z][A-Z0-9.\-]{0,9}$/.test(v) && !b3;
                  setIsUSD(us);
                }}
                onBlur={async (e) => {
                  let v = String(e.target.value || '').trim().toUpperCase();
                  // 🔽 remove .SA se digitado manualmente
                  if (/\.SA$/i.test(v)) {
                    v = v.replace(/\.SA$/i, '');
                    setForm(f => ({ ...f, nome_investimento: v }));
                  }
                  await buscarMapaPorTicker(v);
                  const token = localStorage.getItem('token');
                  const t = String(v || '').trim();
                  if (!t) return;
                  try {
                    const r = await fetch(`/api/investimentos/validar-ticker?symbol=${encodeURIComponent(t)}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    const dj = await r.json().catch(() => ({}));
                    if (r.ok && dj?.ok) {
                      const usd = String(dj.currency || '').toUpperCase() === 'USD' || !String(dj.symbol || '').endsWith('.SA');
                      setIsUSD(usd);
                      if (usd) await obterCotacaoDolar();
                    }
                  } catch {}
                }}
                placeholder="Nome do investimento (ex.: ITUB4, VOO, CDB Banco X...)"
                className="border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"
              />

              {/* Classe */}
              <select
                name="classe_id"
                value={classeId}
                onChange={(e) => setClasseId(e.target.value)}
                className="border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"
              >
                <option value="">Selecione a Classe</option>
                {classes.map(c => (<option key={c.id} value={c.id}>{c.nome}</option>))}
              </select>

              {/* Subclasse */}
              <select
                name="subclasse_id"
                value={subclasseId}
                onChange={(e) => setSubclasseId(e.target.value)}
                className="border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText md:col-start-1"
                disabled={!classeId}
              >
                <option value="">{classeId ? 'Selecione a Subclasse' : 'Selecione uma Classe primeiro'}</option>
                {subclasses.map(s => (<option key={s.id} value={s.id}>{s.nome}</option>))}
              </select>

              <select name="tipo_operacao" value={form.tipo_operacao} onChange={handleChange}
                className="border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"
                disabled={false}>
                <option value="compra">Compra</option>
                <option value="venda">Venda</option>
              </select>

              {showTradeFields && (
                <input name="quantidade" value={form.quantidade} onChange={handleChange} placeholder="Quantidade" type="number"
                  className="border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText" />
              )}

              {/* Valor unitário (mask) */}
              <input
                type="text" inputMode="decimal"
                placeholder={
                  (tipoWizard==='TD' || tipoWizard==='RF_PRIVADA')
                    ? 'Valor aplicado (R$)'
                    : (isUSD ? 'Valor unitário (US$)' : 'Valor unitário (R$)')
                }
                value={valorUnitarioTexto}
                onChange={handleValorUnitarioChange}
                className="border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"
              />

              {/* Cotação do dólar (só se USD) */}
              {isUSD && showTradeFields && (
                <input
                  type="text" inputMode="decimal"
                  placeholder="R$ 0,00"
                  value={cotacaoTexto}
                  onChange={handleCotacaoChange}
                  title="Cotação do dólar (R$) – pode ajustar manualmente"
                  className="border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"
                />
              )}

              <input name="data_operacao" value={form.data_operacao} onChange={handleChange} type="date"
                className="border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText" />

              {/* Custo (R$) — só para ações/ETFs */}
              {showTradeFields && (
                <input
                  type="text" inputMode="decimal"
                  placeholder="Custo"
                  value={custoTexto}
                  onChange={handleCustoChange}
                  title="Custo de corretagem/fees (em R$). Em compra soma; em venda subtrai."
                  className="border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"
                />
              )}

 {/* ----- Renda Fixa ----- */}
 {(tipoWizard==='TD' || tipoWizard==='RF_PRIVADA') && (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:col-span-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">Indexador</label>
                  <select
                    value={indexador}
                    onChange={(e)=>setIndexador(e.target.value)}
                    className="w-full border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"
                  >
                    <option value="">(não é renda fixa)</option>
                    <option value="PRE">Pré-fixado (a.a.)</option>
                    <option value="CDI">% do CDI</option>
                    <option value="IPCA">IPCA + taxa (a.a.)</option>
                  </select>
                </div>
                {indexador==='PRE' && (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">Taxa a.a. (%)</label>
                    <input type="text" inputMode="decimal" placeholder="Ex.: 12,00"
                      value={taxaAAtexto} onChange={(e)=>setTaxaAAtexto(e.target.value)}
                      className="w-full border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"/>
                  </div>
                )}
                {indexador==='CDI' && (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">% do CDI</label>
                    <input type="number" step="0.01" placeholder="Ex.: 110"
                      value={percentualCDI} onChange={(e)=>setPercentualCDI(e.target.value)}
                      className="w-full border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"/>
                  </div>
                )}
                {indexador==='IPCA' && (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">Taxa real a.a. (%)</label>
                    <input type="text" inputMode="decimal" placeholder="Ex.: 6,00"
                      value={taxaAAtexto} onChange={(e)=>setTaxaAAtexto(e.target.value)}
                      className="w-full border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"/>
                  </div>
                )}
                {indexador && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">Vencimento (opcional)</label>
                      <input type="date" value={vencimento} onChange={(e)=>setVencimento(e.target.value)}
                        className="w-full border dark:border-gray-600 p-2 rounded dark:bg-gray-700 dark:text-darkText"/>
                    </div>
                  </>
                )}
                              {/* Come-cotas (apenas para fundos/RF) */}
              {indexador && (
                <div className="md:col-span-2 flex flex-col gap-2 p-3 rounded border dark:border-gray-600">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={comeCotas}
                      onChange={(e)=>setComeCotas(e.target.checked)}
                    />
                    Aplicar come-cotas (fundos)
                  </label>
                  {comeCotas && (
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span>Prazo do fundo:</span>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="prazoFundo"
                          value="CURTO"
                          checked={prazoFundo==='CURTO'}
                          onChange={()=>setPrazoFundo('CURTO')}
                        />
                        Curto (20%)
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="prazoFundo"
                          value="LONGO"
                          checked={prazoFundo==='LONGO'}
                          onChange={()=>setPrazoFundo('LONGO')}
                        />
                        Longo (15%)
                      </label>
                      <span className="opacity-70">Alíquota aplicada: {aliquotaComecotas}%</span>
                    </div>
                  )}
                </div>
              )}
              </div>
              )}

              {/* Totais — só para ações/ETFs */}
              {showTradeFields && (
                <>
                  {isUSD && (
                    <input value={fmtUSD(totalUSD)} readOnly
                      title="Total da operação em dólar (qtd × valor unitário USD)"
                      className="border dark:border-gray-600 p-2 rounded bg-gray-100 dark:bg-gray-600 dark:text-darkText"/>
                  )}
                  <input
                    value={formatBRL(valorTotal)} readOnly
                    title={isUSD ? 'Total da operação em real (USD × cotação)' : 'Total da operação em real'}
                    className="border dark:border-gray-600 p-2 rounded bg-gray-100 dark:bg-gray-600 dark:text-darkText"
                  />
                </>
              )}
              <textarea name="observacao" value={form.observacao} onChange={handleChange} placeholder="Observação"
                className="border dark:border-gray-600 p-2 rounded md:col-span-2 dark:bg-gray-700 dark:text-darkText" />
            </div>
                </>
              )
            })()}
          </div>
        )}

        <div className="flex justify-between items-center mt-6">
          <button onClick={fechar}
            className="bg-gray-400 dark:bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500 dark:hover:bg-gray-500">
            Cancelar
          </button>
          <div className="flex gap-2">
            {passo < 3 && (
              <button
                onClick={() => setPasso(passo + 1)}
                disabled={
                  (passo===1 && !tipoWizard) ||
                  (passo===2 && (
                    (tipoWizard==='ACAO_ETF_BR' || tipoWizard==='ACAO_ETF_US') ? !form.nome_investimento :
                    (tipoWizard==='TD') ? !form.nome_investimento :
                    (tipoWizard==='RF_PRIVADA') ? !(form.nome_investimento && indexador) : false
                  ))
                }
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                Avançar
              </button>
            )}
            {passo === 3 && (
              <button onClick={salvar}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-500">
                Salvar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModalNovoInvestimento;