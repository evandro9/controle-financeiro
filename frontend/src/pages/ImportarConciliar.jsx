// frontend/src/pages/ImportarConciliar.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { HiCloudUpload, HiPencil } from 'react-icons/hi';
import useFirstLoginTour from '../hooks/useFirstLoginTour';
import { getImportarSteps, getImportarMobileNoticeSteps, getImportarPreviewSteps } from '../tour/steps/importar';

// === util: formata 'yyyy-mm-dd' ou 'yyyyMMdd' -> 'dd/mm/yyyy'
const dataParaBR = (str) => {
  if (!str) return '-';
  const s = String(str).trim();

  // 'yyyy-mm-dd'
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  // 'yyyyMMdd'
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  // já estiver em 'dd/mm/yyyy'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  // fallback
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('pt-BR');
};

async function parseJsonSeguro(r) {
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const texto = await r.text();
    throw new Error(texto || `Resposta não é JSON (status ${r.status})`);
  }
  return r.json();
}

function StepUpload({ onParsed }) {
  const [origem, setOrigem] = useState('csv');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [autoRegras, setAutoRegras] = useState(true);
  const [tipoDoc, setTipoDoc] = useState('extrato'); // 'extrato' | 'fatura'
  const [fileObj, setFileObj] = useState(null);
const [mismatch, setMismatch] = useState(null); // { detected:'fatura'|'extrato', message, confidence }
  const [formas, setFormas] = useState([]);
  const [formaCartaoId, setFormaCartaoId] = useState('');
  const [ackMismatch, setAckMismatch] = useState(false);

  const enviarTexto = async (tipoOverride, opts = {}) => {
    try {
      const r = await fetch('/api/importacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          origem,
          nomeArquivo,
          conteudo,
          auto_regras: autoRegras ? 1 : 0,
          tipo_doc: tipoOverride || tipoDoc,
         ...(opts.force ? { force_tipo: 1 } : {})
        })
      });
      const j = await parseJsonSeguro(r);
      if (j?.status === 'mismatch' && j.detected_tipo_doc) {
        setMismatch({
          detected: j.detected_tipo_doc,
          confidence: j.confidence,
          message: j.message
        });
        return;
      }
      if (!r.ok) throw new Error(j.erro || 'Falha na importação');
 if (j?.auto_switched) {
   toast.info(`Importamos como ${String(j.used_tipo || '').toUpperCase()} (detectado automaticamente).`);
 }
      onParsed(j.loteId);
    } catch (e) { toast.error('Erro: ' + e.message); }
  };

  const enviarArquivo = async (file, tipoOverride, opts = {}) => {
    try {
      const form = new FormData();
      form.append('arquivo', file);
      form.append('origem', file.name.toLowerCase().endsWith('.ofx') ? 'ofx' : 'csv');
      form.append('auto_regras', autoRegras ? '1' : '0');
      form.append('tipo_doc', tipoOverride || tipoDoc);
      if (opts.force) form.append('force_tipo', '1');
      const r = await fetch('/api/importacoes/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: form
      });
      const j = await parseJsonSeguro(r);
      if (j?.status === 'mismatch' && j.detected_tipo_doc) {
        setMismatch({
          detected: j.detected_tipo_doc,
          confidence: j.confidence,
          message: j.message
        });
        return; // não avança; mostra aviso
      }
      if (!r.ok) throw new Error(j.erro || 'Falha na importação');
      onParsed(j.loteId);
    } catch (e) { toast.error('Erro: ' + e.message); }
  };

  const onDrop = (ev) => {
    ev.preventDefault();
    setDragOver(false);
  const file = ev.dataTransfer.files?.[0];
  if (file) { setFileObj(file); enviarArquivo(file); }
  };

  return (
    <div className="space-y-4">
{/* Tipo de importação (toggle) */}
<div className="flex items-center justify-center" data-tour="imp-tipo">
  <div className="flex flex-col items-center">
    <span className="text-xs text-gray-500 dark:text-darkMuted mb-1">
      Tipo de importação
    </span>

    {/* Segmented control menor e contido */}
    <div
      className="
        relative inline-flex w-[320px] max-w-full rounded-lg
        border border-gray-200 dark:border-darkBorder
        bg-gray-100 dark:bg-white/10
        p-0.5 shadow-sm overflow-hidden
      "
    >
      {/* highlight */}
      <span
        className={`
          absolute top-0.5 bottom-0.5 w-1/2
          rounded-md bg-white dark:bg-darkCard shadow
          transition-transform duration-200 ease-out
          ${tipoDoc === 'fatura' ? 'translate-x-full' : 'translate-x-0'}
        `}
        aria-hidden="true"
      />
      {/* opções */}
      <button
        type="button"
        onClick={() => setTipoDoc('extrato')}
        aria-pressed={tipoDoc === 'extrato'}
        className={`
          relative z-10 w-1/2 h-8 text-[13px] font-medium rounded-md
          ${tipoDoc === 'extrato'
            ? 'text-blue-700 dark:text-blue-300'
            : 'text-gray-700 hover:text-gray-900 dark:text-darkText/80 dark:hover:text-darkText'}
        `}
      >
        Extrato de conta
      </button>
      <button
        type="button"
        onClick={() => setTipoDoc('fatura')}
        aria-pressed={tipoDoc === 'fatura'}
        className={`
          relative z-10 w-1/2 h-8 text-[13px] font-medium rounded-md
          ${tipoDoc === 'fatura'
            ? 'text-blue-700 dark:text-blue-300'
            : 'text-gray-700 hover:text-gray-900 dark:text-darkText/80 dark:hover:text-darkText'}
        `}
      >
        Fatura de cartão
      </button>
    </div>
  </div>
</div>

{/* Preferência de categorização (toggle) */}
<div className="flex flex-col items-center gap-1" data-tour="imp-regras">
  {/* Preferência de categorização (toggle compacto) */}
<div className="flex items-center justify-center">
  <div className="flex items-center gap-3">
    <span className="text-[13px] text-gray-800 dark:text-darkText">
      Aplicar minhas regras automaticamente
    </span>

    <button
      type="button"
      role="switch"
      aria-checked={autoRegras}
      onClick={() => setAutoRegras(v => !v)}
      className={`
        relative inline-flex h-5 w-9 items-center rounded-full overflow-hidden
        transition-colors shadow-sm
        focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:ring-offset-1 dark:focus:ring-offset-darkBg
        ${autoRegras ? 'bg-blue-600' : 'bg-gray-300 dark:bg-darkBorder'}
      `}
      title={autoRegras ? 'Ligado' : 'Desligado'}
    >
      <span
        className={`
          inline-block h-4 w-4 rounded-full bg-white dark:bg-darkCard shadow
          transform transition-transform duration-200 ease-out
          ${autoRegras ? 'translate-x-4' : 'translate-x-1'}
        `}
      />
      <span className="sr-only">Alternar aplicação de regras</span>
    </button>
  </div>
</div>


  <div className="text-[12px] text-gray-600 dark:text-darkMuted text-center">
    Quando habilitado, preenche <em>Categoria/Subcategoria</em> com base na descrição das linhas. Você pode editar depois.
  </div>
</div>
      <div
        data-tour="imp-arquivo"
        onDragOver={(e)=>{e.preventDefault(); setDragOver(true);}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center ${dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-300 dark:border-darkBorder'}`}
      >
<p className="text-sm mb-3">
  Arraste aqui um arquivo .csv ou .ofx <span className="hidden sm:inline">ou</span>
</p>

<input
  id="upload-arquivo"
  type="file"
  accept=".csv,.ofx"
 onChange={e => {
   const f = e.target.files?.[0];
   if (f) { setFileObj(f); enviarArquivo(f); }
 }}
  className="sr-only"
/>

<label
  htmlFor="upload-arquivo"
  className="
    inline-flex items-center gap-2 h-9 px-4 rounded-lg
    bg-blue-600 text-white hover:bg-blue-700
    focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2
    dark:focus:ring-offset-darkBg cursor-pointer
  "
>
  Escolher arquivo
</label>

<small className="block mt-2 text-[11px] text-gray-600 dark:text-darkMuted">
  Aceita CSV ou OFX. O formato é detectado automaticamente.
</small>

{mismatch && (
  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800">
    <div className="font-medium">{mismatch.message}</div>
    <div className="text-xs opacity-80">Confiança: {(mismatch.confidence*100).toFixed(0)}%</div>
    
   {/* exigência de confirmação quando permitido manter */}
   {!mismatch.block && (
     <label className="mt-2 flex items-center gap-2 text-sm">
       <input
         type="checkbox"
         checked={ackMismatch}
         onChange={e => setAckMismatch(e.target.checked)}
       />
       <span>Entendo que os resultados podem ficar incorretos ao forçar esse tipo.</span>
     </label>
   )}

    <div className="mt-2 flex gap-2">
      <button
        type="button"
        className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
        onClick={async () => {
          const novoTipo = mismatch.detected; // 'fatura' | 'extrato'
          setTipoDoc(novoTipo);               // atualiza o toggle para o usuário ver
          setMismatch(null);
 // reenvia com o tipo detectado (sem force)
 if (fileObj) await enviarArquivo(fileObj, novoTipo);
 else if (conteudo?.trim()) await enviarTexto(novoTipo);
        }}
      >
        Trocar para {mismatch.detected} e reenviar
      </button>

     {/* “Manter como está” só aparece se block = false */}
     {!mismatch.block && (
       <button
         type="button"
         className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
         disabled={!ackMismatch}
         onClick={async () => {
           setMismatch(null);
           if (fileObj) await enviarArquivo(fileObj, tipoDoc, { force: true });
           else if (conteudo?.trim()) await enviarTexto(tipoDoc, { force: true });
         }}
       >
         Manter como está
       </button>
     )}
    </div>
  </div>
)}

      </div>

      <div>
        <label className="text-xs text-gray-500 dark:text-darkMuted">Ou cole o conteúdo</label>
        <textarea rows={10} value={conteudo} onChange={e=>setConteudo(e.target.value)}
          className="w-full rounded-lg border p-2 font-mono text-sm dark:bg-darkBg dark:text-darkText" placeholder="Cole o CSV ou OFX aqui..." />
      </div>

{!!conteudo.trim() && (
  <div className="flex items-end gap-3 flex-wrap">
    <div>
      <label className="text-xs text-gray-500 dark:text-darkMuted">Formato do conteúdo colado</label>
      <select
        value={origem}
        onChange={e=>setOrigem(e.target.value)}
        className="h-9 rounded-lg border px-2 dark:bg-darkBg dark:text-darkText"
      >
        <option value="csv">CSV</option>
        <option value="ofx">OFX</option>
      </select>
    </div>

    <div className="grow">
      <label className="text-xs text-gray-500 dark:text-darkMuted">Nome do arquivo (opcional)</label>
      <input
        value={nomeArquivo}
        onChange={e=>setNomeArquivo(e.target.value)}
        className="h-9 w-full rounded-lg border px-2 dark:bg-darkBg dark:text-darkText"
        placeholder={origem === 'ofx' ? 'ex.: extrato.ofx' : 'ex.: extrato.csv'}
      />
    </div>

    <button
      onClick={enviarTexto}
      className="h-9 px-4 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
    >
      Processar (texto)
    </button>
  </div>
)}

    </div>
  );
}

function StepPreview({ loteId, onConfirmado }) {
 const [itens, setItens] = useState([]);
 const [etapa, setEtapa] = useState(1); // 1=Seleção, 2=Categorias, 3=Regras/Confirmar
 const [aplicarRegras, setAplicarRegras] = useState(false);
 const [formas, setFormas] = useState([]);          // ← você usa setFormas() em carregarFormas()
 const [formaPadraoId, setFormaPadraoId] = useState(''); // ← usado na validação e no <select/>
 const [ignorados, setIgnorados] = useState([]);
 const [modalCat, setModalCat] = useState({ aberto: false, itemId: null, descricao: '' });
 const [insertedIds, setInsertedIds] = useState([]); // para conciliação
 const [pixId, setPixId] = useState(null);
 // mapas de nomes para exibir "Categoria / Subcategoria"
 const [catById, setCatById] = useState({});
 const [subById, setSubById] = useState({});
 const subsCarregadasRef = React.useRef(new Set());
 const precisaForma = !formaPadraoId; // obrigatório escolher
 const [regrasAplicadas, setRegrasAplicadas] = useState(false); // ← controla se já aplicamos regras
 const [confirmDup, setConfirmDup] = useState({ aberto: false, total: 0, certos: 0, provaveis: 0 });
// --- helpers de data (frontend) ---
const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

const computeDueDateFront = (dataLancISO, diaVenc, diaFech) => {
  if (!dataLancISO || !diaVenc) return null;
  const [y, m, d] = dataLancISO.split('-').map(Number);

  const addMonth = (yy, mm, add) => {
    const dt = new Date(Date.UTC(yy, (mm - 1) + add, 1));
    return [dt.getUTCFullYear(), dt.getUTCMonth() + 1];
  };

  if (diaFech) {
    // competência: se dia da compra <= fechamento → mês atual; senão → mês seguinte
    const dCompra = d || 1;
   const [cyY, cyM] = (dCompra <= Number(diaFech)) ? [y, m] : addMonth(y, m, 1);
   // vencimento: MESMO mês da competência
   const [vy, vm] = [cyY, cyM];
    const dia = Math.min(Number(diaVenc), lastDayOfMonth(vy, vm));
    return `${vy}-${String(vm).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  } else {
    // sem fechamento → mesmo mês da data_lancamento
    const dia = Math.min(Number(diaVenc), lastDayOfMonth(y, m));
    return `${y}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }
};

const shiftToNextBusinessDayFront = (iso) => {
  if (!iso) return null;
  const dt = new Date(`${iso}T00:00:00Z`); // UTC para não bater TZ
  const wd = dt.getUTCDay(); // 0=dom, 6=sáb
  if (wd === 6) dt.setUTCDate(dt.getUTCDate() + 2);
  else if (wd === 0) dt.setUTCDate(dt.getUTCDate() + 1);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

 // É fatura? (detecta por marcação do backend ou por presença de vencimento)
const isFatura = React.useMemo(() => {
  return (itens || []).some(it => it?.raw?.__tipoDoc === 'fatura');
}, [itens]);

useEffect(() => {
  // 1) forma selecionada?
  const f = formas.find(x => String(x.id) === String(formaPadraoId));
  // 2) sem forma → limpa tudo que foi auto-preenchido
  if (!f) {
    setItens(prev => prev.map(it => (it._autoVenc && it?.raw?.__tipoDoc === 'fatura')
      ? { ...it, preview: { ...(it.preview || {}), data_vencimento: null }, _autoVenc: false }
      : it
    ));
    return;
  }
  const diaV = Number(f.dia_vencimento) || null;
  const diaF = Number(f.dia_fechamento) || null;
  // 3) forma sem dia de vencimento → limpa autos
  if (!diaV) {
    setItens(prev => prev.map(it => it._autoVenc
      ? { ...it, preview: { ...(it.preview || {}), data_vencimento: null }, _autoVenc: false }
      : it
    ));
    return;
  }
  // 4) recalcula e SOBRESCREVE para todas as linhas (com flag _autoVenc)
  setItens(prev => prev.map(it => {
    const p = { ...(it.preview || {}) };
        // preferir ANCORADO (compra + parcela)
    const parcelaAtual = Number(p?.detect_parcela?.atual ?? p?.parcela_atual);
    const dataCompra = p?.data_compra || p?.dataCompra || null;
    let dvBase = null;
    if (dataCompra && Number.isFinite(parcelaAtual) && parcelaAtual >= 1) {
      dvBase = computeDueDateInstallmentFront(dataCompra, parcelaAtual, diaV, diaF);
    }
    if (!dvBase) {
      dvBase = computeDueDateFront(p.data_lancamento, diaV, diaF);
    }
    const dv = shiftToNextBusinessDayFront(dvBase);
    if (dv) {
      p.data_vencimento = dv;
      return { ...it, preview: p, _autoVenc: true };
    }
    // sem data válida: limpa se era auto
    return it._autoVenc
      ? { ...it, preview: { ...(it.preview || {}), data_vencimento: null }, _autoVenc: false }
      : it;
  }));
}, [formaPadraoId, formas]);

// ANCORADO (compra + parcela) — espelho do backend
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

   // validação: precisa de forma de pgto e todas as linhas (não ignoradas) com cat/sub
  const validarPronto = React.useMemo(() => {
    const faltaForma = !formaPadraoId;
    const pendentes = (itens || []).filter(it => {
      if (ignorados.includes(it.id)) return false;
      const p = it.preview || {};
      return !p.categoria_id || !p.subcategoria_id;
    });
    return {
      ok: !faltaForma && pendentes.length === 0,
      faltaForma,
      pendentesCount: pendentes.length,
    };
  }, [formaPadraoId, itens, ignorados]);

    const handleConfirmarClick = async () => {
    if (!validarPronto.ok) {
      if (validarPronto.faltaForma) {
        toast.warn('Selecione a forma de pagamento do arquivo antes de confirmar.');
      }
      if (validarPronto.pendentesCount > 0) {
        toast.warn(`${validarPronto.pendentesCount} linha(s) ainda estão sem Categoria/Subcategoria.`);
      }
      return; // não segue adiante
    }
    // tudo certo: chama seu fluxo atual de confirmar
    await tentarConfirmar();
  };

 // ao trocar de arquivo (lote), resetar flag (será ligada ao carregar se já vier categorizado)
 React.useEffect(() => { setRegrasAplicadas(false); }, [loteId]);

  const carregar = async () => {
    try {
      const r = await fetch(`/api/importacoes/${loteId}/preview`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      const j = await parseJsonSeguro(r);
      // Zera vencimento no preview de FATURA para recalcular via forma
      const arr = (j.itens || []).map(it => {
        const p = { ...(it.preview || {}) };
        if (it?.raw?.__tipoDoc === 'fatura') {
          p.data_vencimento = null;
        }
        return { ...it, preview: p, _autoVenc: false };
      });
      setItens(arr);
      // Se já vieram categorizados do backend, consideramos regras aplicadas (para exibir “Categoria/Sub”)
      try {
        const temAlguma = (j.itens || []).some(it => {
          const p = it.preview || {};
          return !!p.categoria_id && !!p.subcategoria_id;
        });
        if (temAlguma) setRegrasAplicadas(true);
      } catch {}
   // revalida duplicados sempre que recarregar a prévia
   checarDuplicados();
    } catch (e) { toast.error('Erro ao carregar preview'); }
  };

  React.useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [loteId]);

  const checarDuplicados = async () => {
  if (!loteId) return;
  try {
    const r = await fetch(`/api/importacoes/${loteId}/check-duplicados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const j = await parseJsonSeguro(r);
    if (j?.duplicados) {
      setItens(prev => prev.map(it => ({
        ...it,
        _dup: j.duplicados[it.id]?.status || 'ok',
        _dup_motivo: j.duplicados[it.id]?.motivo || ''
      })));
    }
  } catch (e) { /* silencioso */ }
};

   const temAlgumaCategoriaVisivel = React.useMemo(() => {
   return itens.some(it => {
     if (ignorados.includes(it.id)) return false;
     const p = it.preview || {};
     return !!p.categoria_id && !!p.subcategoria_id && (regrasAplicadas || it._manualCat);
   });
 }, [itens, ignorados, regrasAplicadas]);

    // Carregar formas de pagamento e detectar o ID do PIX
  const carregarFormas = async () => {
    try {
      const r = await fetch('/api/formas-pagamento', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const j = await parseJsonSeguro(r);
      const arr = j.formas || j || [];
      setFormas(arr);
      const pix = arr.find(f => String(f.nome || f.descricao || '').trim().toUpperCase() === 'PIX');
      setPixId(pix?.id || null);
    } catch (e) {
      // se der erro, só segue sem lista (usuario pode confirmar sem padrão)
    }
  };
  React.useEffect(() => { carregarFormas(); }, []);

    // Carrega nomes de categorias uma vez
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/categorias', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const j = await parseJsonSeguro(r);
        const arr = j.categorias || j || [];
        const map = {};
        arr.forEach(c => { map[Number(c.id)] = c.nome || c.descricao; });
        setCatById(map);
      } catch {}
    })();
  }, []);

  // Carrega subcategorias para cada categoria presente nos itens (uma vez por categoria)
  React.useEffect(() => {
    const catsUsadas = Array.from(new Set(
      (itens || []).map(it => Number((it.preview||{}).categoria_id)).filter(Boolean)
    ));
    catsUsadas.forEach(async (cid) => {
      if (subsCarregadasRef.current.has(cid)) return;
      try {
        const r = await fetch(`/api/categorias/${cid}/subcategorias`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const j = await parseJsonSeguro(r);
        const arr = j.subcategorias || j || [];
        setSubById(prev => {
          const n = { ...prev };
          arr.forEach(s => { n[Number(s.id)] = s.nome || s.descricao; });
          return n;
        });
        subsCarregadasRef.current.add(cid);
      } catch {}
    });
  }, [itens]);

  // checar duplicados assim que itens carregarem
  React.useEffect(() => {
    (async () => {
      if (!loteId || itens.length === 0) return;
      try {
        const r = await fetch(`/api/importacoes/${loteId}/check-duplicados`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const j = await parseJsonSeguro(r);
        if (j?.duplicados) {
          setItens(prev => prev.map(it => ({
            ...it,
            _dup: j.duplicados[it.id]?.status || 'ok',
            _dup_motivo: j.duplicados[it.id]?.motivo || ''
          })));
        }
      } catch (e) {}
    })();
    // eslint-disable-next-line
  }, [itens.length]);

    // ▶️ Tour da PRÉVIA — desktop apenas (2 passos)
  const stepsPrev = useMemo(() => getImportarPreviewSteps(), []);
  const { maybeStart: maybeStartImportarPreview } = useFirstLoginTour('importar_preview_v1', stepsPrev);
  React.useEffect(() => {
    // Espera existir DOM dos alvos (forma + tabela) e haver itens carregados
    const haveTargets =
      typeof document !== 'undefined' &&
      document.querySelector('[data-tour="imp-prev-forma"]') &&
      document.querySelector('[data-tour="imp-prev-tabela"]');
    if (!haveTargets) return;
    const isDesktop =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(min-width: 1024px)').matches;
    if (!isDesktop) return; // nada no mobile nesta etapa
    const start = () => maybeStartImportarPreview();
    if ('requestAnimationFrame' in window) {
      requestAnimationFrame(() => setTimeout(start, 0));
    } else {
      setTimeout(start, 0);
    }
    // dispara só quando os itens e formas já renderizaram
  }, [itens.length, formas.length, maybeStartImportarPreview]);

  // === CONTADORES para o header/CTA ===
const { validos, revisar, dupCount, temSugestoes } = React.useMemo(() => {
  let v = 0, r = 0, d = 0, ts = false;
  for (const it of itens) {
    const p = it.preview || {};
    const dup = it._dup;
    if (dup && dup !== 'ok') { d++; continue; } // ← DUPLICADOS não entram como “revisar”
    if (it._sug?.lancamento_id) ts = true;
    if (ignorados.includes(it.id)) continue;     // ignorados fora das contas
    const temCatVisivel = !!p.categoria_id && !!p.subcategoria_id && (regrasAplicadas || it._manualCat);
    const ok = temCatVisivel;
    ok ? v++ : r++;
  }
  return { validos: v, revisar: r, dupCount: d, temSugestoes: ts };
}, [itens, ignorados, regrasAplicadas]);

  const toggleIgnorar = (id) => {
    setIgnorados(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

const abrirModalCategoria = (it) => {
  const p = it.preview || {};
  const temCatVisivel = !!p.categoria_id && !!p.subcategoria_id && (regrasAplicadas || it._manualCat);
  setModalCat({
    aberto: true,
    itemId: it.id,
    descricao: p.descricao || '',
    valor: p.valor,
    catInicial: temCatVisivel ? Number(p.categoria_id) : '',
    subInicial: temCatVisivel && p.subcategoria_id ? Number(p.subcategoria_id) : ''
  });
};

const aplicarCategoriaNoPreview = async ({ categoria_id, subcategoria_id }) => {
  try {
    await fetch(`/api/importacoes/${loteId}/itens/${modalCat.itemId}/categoria`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ categoria_id, subcategoria_id })
    });

    // ✅ Atualiza o preview no estado para EXTRATO e FATURA
    setItens(prev => prev.map(it => {
      if (it.id !== modalCat.itemId) return it;
      const p = { ...(it.preview || {}) };
      p.categoria_id = categoria_id;
      p.subcategoria_id = subcategoria_id || null;
      // marque como edição manual para “contar” nas validações/render
      return { ...it, preview: p, _manualCat: true };
    }));
  } catch (e) {
    toast.error('Falha ao salvar categoria do item.');
  }
};

  const confirmar = async () => {
    try {
  const body = {
    selecionarIds: 'all',
    ignorarIds: ignorados,
    forma_pagamento_padrao_id: formaPadraoId || null,
    id_pix: pixId || null
  };
      const r = await fetch(`/api/importacoes/${loteId}/confirmar`, {  
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(body)
      });
      const j = await parseJsonSeguro(r);
      if (!r.ok) throw new Error(j.erro || 'Falha ao confirmar');
      toast.success(`Importados: ${j.totalInseridos}`);
      setInsertedIds(j.insertedIds || []);
      onConfirmado(j.insertedIds || []);
    } catch (e) {
      toast.error(e.message);
    }
  };

const reaplicarRegras = async () => {
  try {
    // 1) Snapshot antes: quantas linhas já têm cat/sub (estado atual da prévia)
    const antes = (itens || []).reduce((acc, it) => {
      const p = it.preview || {};
      return acc + (p.categoria_id && p.subcategoria_id ? 1 : 0);
    }, 0);

    // 2) Pede pro backend aplicar regras
    const r = await fetch(`/api/importacoes/${loteId}/aplicar-regras`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!r.ok) {
      const jerr = await r.json().catch(()=>({}));
      throw new Error(jerr.erro || 'Falha ao reaplicar regras');
    }

    // 3) Recarrega a PRÉVIA (mas aqui vamos buscar direto pra calcular o delta)
    const rPrev = await fetch(`/api/importacoes/${loteId}/preview`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const jPrev = await parseJsonSeguro(rPrev);
    const novosItens = jPrev.itens || [];

    // 4) Conta depois: quantas linhas ficaram com cat/sub após a aplicação
    const depois = novosItens.reduce((acc, it) => {
      const p = it.preview || {};
      return acc + (p.categoria_id && p.subcategoria_id ? 1 : 0);
    }, 0);

    // 5) Atualiza a tabela e decide feedback
    setItens(novosItens);

    const aplicadas = Math.max(0, depois - antes);
    setRegrasAplicadas(depois > 0);
    if (aplicadas > 0) {
      toast.success(`Categorias preenchidas automaticamente em ${aplicadas} linha${aplicadas>1?'s':''}.`);
    } else if (depois > 0) {
      toast.info('As categorias já estavam preenchidas pelas suas regras.');
    } else {
      toast.info('Nenhuma regra encontrada para estas descrições.');
    }

    // 6) Revalidar duplicados após reescrever a prévia
    await checarDuplicados();
  } catch (e) {
    toast.error('Erro ao reaplicar regras: ' + (e?.message || e));
  }
};

const sugerirConciliacao = async () => {
  try {
    if (!insertedIds.length) { toast.info('Nada para conciliar ainda. Confirme a importação primeiro.'); return; }
    const r = await fetch(`/api/conciliacao/sugerir`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ ids: insertedIds })
    });
    const j = await parseJsonSeguro(r);
    const mapSug = j.sugestoes || {};
    let total = 0;
    setItens(prev => prev.map(it => {
      const sug = mapSug[it.id];
      if (sug?.lancamento_id) total++;
      return (sug ? { ...it, _sug: sug } : it);
    }));
    if (total > 0) {
   toast[ total > 0 ? 'success' : 'info' ](
     total > 0
       ? `Sugestões de conciliação carregadas: ${total}.`
       : 'Nenhuma sugestão de conciliação encontrada.'
   );
    } else {
      toast.info('Nenhuma sugestão de conciliação encontrada.');
    }
  } catch (e) { toast.error('Erro ao sugerir conciliação: ' + e.message); }
};

  const aplicarConciliacao = async () => {
    try {
      const pairs = [];
      itens.forEach(it => {
        if (it._sug?.lancamento_id && it.preview?.external_id) {
          // precisamos do id de transação externa, não do item de preview.
          // Como estamos logo após o confirm, os insertedIds são os transacoes_externas criados.
          // Para versão simples, vamos casar por mesmo hash_dedupe:
        }
      });
      // versão prática: buscar as transacoes_externas recém inseridas e casar pelo hash
      if (!insertedIds.length) { toast.info('Nada para conciliar.'); return; }
      // Busca as transações externas recem-importadas
      const r = await fetch(`/api/minhas-transacoes-externas?ids=${insertedIds.join(',')}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const j = await parseJsonSeguro(r);
      const externas = j.transacoes || [];

      // monta pairs por match de descricao/valor/data com sugestão (_sug)
      externas.forEach(te => {
        const it = itens.find(i => {
          const p = i.preview || {};
          return i._sug?.lancamento_id
                 && p.data_lancamento === te.data_lancamento
                 && Number(p.valor).toFixed(2) === Number(te.valor).toFixed(2)
                 && (p.descricao||'').toLowerCase() === (te.descricao||'').toLowerCase();
        });
        if (it) {
          pairs.push({ transacao_externa_id: te.id, lancamento_id: it._sug.lancamento_id });
        }
      });

      if (!pairs.length) { toast.info('Nenhuma sugestão pronta para aplicar.'); return; }

      const r2 = await fetch(`/api/conciliacao/aplicar`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ pairs })
      });
      const j2 = await r2.json();
      if (!r2.ok) throw new Error(j2.erro || 'Falha ao conciliar');
      toast.success(`Conciliadas: ${j2.atualizados}`);
      onConfirmado(); // segue fluxo
    } catch (e) { toast.error('Erro ao conciliar automaticamente'); }
  };

  const contarDuplicadosSelecionados = React.useCallback(() => {
  let certos = 0, provaveis = 0;
  for (const it of itens) {
    if (ignorados.includes(it.id)) continue;                // só os incluídos contam
    if (it._dup === 'duplicado_certo') certos++;
    else if (it._dup === 'duplicado_provavel') provaveis++;
  }
  return { total: certos + provaveis, certos, provaveis };
}, [itens, ignorados]);

const tentarConfirmar = () => {
  const { total, certos, provaveis } = contarDuplicadosSelecionados();
  if (total > 0) {
    setConfirmDup({ aberto: true, total, certos, provaveis });
  } else {
    confirmar(); // segue direto se não houver duplicados
  }
};

const cancelarConfirmacaoDuplicados = () => {
  setConfirmDup(s => ({ ...s, aberto: false }));
};

const confirmarMesmoAssim = async () => {
  setConfirmDup(s => ({ ...s, aberto: false }));
  await confirmar(); // chama sua função original
};

  return (
    <div className="space-y-4">
 <div className="space-y-2">
   <div className="flex items-center justify-between">
     <h3 className="text-lg font-semibold ...">Prévia ({itens.length})</h3>
     <div className="text-sm text-gray-600 dark:text-darkMuted">
       {validos} válidos · {revisar} para revisar · {dupCount} possíveis duplicados
     </div>
   </div>
 <div className="space-y-3">
   {/* Linha centralizada: forma padrão + (opcional) auto-preencher */}
   
  <div className="flex items-end justify-center gap-4 flex-wrap">
  <div className="flex flex-col items-center text-center" data-tour="imp-prev-forma">
    <label className="text-xs text-gray-500 dark:text-darkMuted">
      Forma de pagamento do arquivo <span className="text-red-500">*</span>
    </label>
    <select
      className={`h-9 w-64 rounded-lg border px-2 dark:bg-darkBg dark:text-darkText ${precisaForma ? 'border-red-300 focus:ring-red-400' : ''}`}
      value={formaPadraoId || ''}
      onChange={e => setFormaPadraoId(e.target.value ? Number(e.target.value) : '')}
    >
      <option value="" disabled>Selecione...</option>
      {formas.map(f => (
        <option key={f.id} value={f.id}>{f.nome || f.descricao}</option>
      ))}
    </select>
    <span className="mt-1 text-[11px] text-gray-600 dark:text-darkMuted">
      Linhas com “PIX” na descrição serão marcadas como <strong>PIX</strong> automaticamente.
    </span>
  </div>
</div>

   {/* Confirmar centralizado */}
   <div className="flex justify-center">
 <button
   onClick={handleConfirmarClick}
   aria-disabled={!validarPronto.ok}
   className={`h-9 px-4 rounded-lg text-white 
               ${validarPronto.ok ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600/70'}
               ${!validarPronto.ok ? 'opacity-50 cursor-not-allowed' : ''}`}
   title={
     validarPronto.ok
       ? 'Importar e criar lançamentos'
       : (validarPronto.faltaForma
           ? 'Selecione a forma de pagamento'
           : 'Há linhas sem Categoria/Subcategoria')
   }
 >
   Confirmar
 </button>
   </div>
 </div>

{/* Alerta claro quando falta categorizar algo (centralizado) */}
{(revisar>0) && (
  <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-900/20 dark:text-amber-200 text-center">
    Para habilitar o <strong>Confirmar</strong>, defina <strong>categoria e subcategoria</strong> para todos os itens incluídos.
  </div>
)}
 </div>

<div className="overflow-y-auto overflow-x-hidden rounded-xl border dark:border-darkBorder" data-tour="imp-prev-tabela">
        
<table className="min-w-full text-sm table-fixed">
  {isFatura ? (
    <colgroup>
      <col className="w-[4%]" />   {/* Incluir */}
      <col className="w-[8%]" />   {/* Data */}
      <col className="w-[9%]" />   {/* Vencimento */}
      <col className="w-[34%]" />  {/* Descrição */}
      <col className="w-[7%]" />   {/* Parcela */}
      <col className="w-[12%]" />  {/* Valor */}
      <col className="w-[8%]" />   {/* Tipo */}
      <col className="w-[12%]" />  {/* Categoria/Sub */}
      <col className="w-[3%]" />   {/* Editar */}
      <col className="w-[3%]" />   {/* Flags */}
    </colgroup>
  ) : (
    <colgroup>
      <col className="w-[5%]" />   {/* Incluir */}
      <col className="w-[9%]" />   {/* Data */}
      <col className="w-[50%]" />  {/* Descrição (MAIOR em extrato) */}
      <col className="w-[12%]" />  {/* Valor */}
      <col className="w-[8%]" />   {/* Tipo */}
      <col className="w-[10%]" />  {/* Categoria/Sub (limitada com 25ch) */}
      <col className="w-[3%]" />   {/* Editar */}
      <col className="w-[3%]" />   {/* Flags */}
    </colgroup>
  )}
          <thead className="bg-gray-50 dark:bg-darkCard">
            <tr>
 <th className="p-2 text-center">Incluir</th>
 <th className="p-2">Data</th>
 {isFatura && <th className="p-2 whitespace-nowrap">Vencimento</th>}
 <th className="p-2">Descrição</th>
 {isFatura && <th className="p-2 whitespace-nowrap">Parcela</th>}
 <th className="p-2 text-right whitespace-nowrap">Valor</th>
 <th className="p-2">Tipo</th>
 <th className="p-2">Categoria / Sub</th>
 <th className="p-2">Editar</th>
 <th className="p-2">Flags</th>
            </tr>
          </thead>
          <tbody>
          {itens.map(it => {
            const p = it.preview || {};
            const dup = it._dup;
            const ignorado = ignorados.includes(it.id);
    // só considera categoria/sub quando (A) regras aplicadas ou (B) houve edição manual da linha
    const temCatVisivel = !!p.categoria_id && !!p.subcategoria_id && (regrasAplicadas || it._manualCat);
    const ok = (dup === 'ok' || !dup) && temCatVisivel;
    const isDup = dup && dup !== 'ok'; // ← duplicado (certo ou provável)
             // Mapear tipo para Receita/Despesa (C/D -> receita/despesa; fallback pelo sinal do valor)
 const tRaw = String(p.tipo || it.tipo || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 let tipoRD;
 if (['c','cr','cred','credito','credit','creditado'].includes(tRaw)) tipoRD = 'receita';
 else if (['d','db','deb','debito','debit','dr'].includes(tRaw))      tipoRD = 'despesa';
 else tipoRD = (Number(p.valor) >= 0 ? 'receita' : 'despesa');
 const tipoDisplay = tipoRD === 'despesa' ? 'Despesa' : 'Receita';
            return (
 <tr
   key={it.id}
   className={`transition-opacity transition-colors duration-150
               ${ignorado
                 ? 'opacity-60 hover:opacity-75 hover:bg-gray-100 dark:hover:bg-black/20'
                 : 'opacity-100 hover:bg-gray-50 dark:hover:bg-white/5'}`}
   aria-disabled={ignorado ? 'true' : undefined}
 >
 <td className="p-2 text-center">
    <label
    className="group inline-flex h-6 w-6 items-center justify-center relative cursor-pointer select-none"
    title={ignorados.includes(it.id) ? 'Marcar para incluir' : 'Desmarcar para ignorar'}
    aria-label={ignorados.includes(it.id) ? 'Incluir este item' : 'Remover este item'}
  >
    {/* input invisível mas acessível */}
    <input
      type="checkbox"
      className="sr-only peer"
      checked={!ignorados.includes(it.id)}
      onChange={() => toggleIgnorar(it.id)}
    />
    {/* caixinha */}
    <span
      className="
        absolute h-4 w-4 rounded-[4px] border border-gray-300 bg-white shadow-sm
        transition-colors duration-150 ease-out
        group-hover:border-blue-400
        peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400/60
        peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white
        peer-checked:bg-blue-600 peer-checked:border-blue-600
        dark:border-darkBorder dark:bg-darkBg
        dark:group-hover:border-blue-400/70
        dark:peer-focus-visible:ring-offset-darkBg
      "
      aria-hidden="true"
    />
    {/* check como IRMÃO do input (sobreposto) */}
    <svg
      className="pointer-events-none absolute h-3 w-3 text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  </label>
 </td>
<td className="p-2 whitespace-nowrap text-center">
  {dataParaBR(
    p.data_lancamento
    || it?.raw?.date   
    || (it?.raw?.DTPOSTED
         ? String(it.raw.DTPOSTED).replace(/\[.*\]$/,'').slice(0,8) // yyyyMMdd
         : null)
  )}
</td>
 {isFatura && (
   <td className="p-2 whitespace-nowrap text-center">{dataParaBR(p.data_vencimento)}</td>
 )}
<td className="p-2">
  {(() => {
    const full =
      (p.descricao && p.descricao.trim()) ||
      it?.raw?.memo || it?.raw?.MEMO ||
      it?.raw?.name || it?.raw?.NAME ||
      it?.raw?.payee ||
      it?.raw?.Descricao || it?.raw?.DESCRICAO || it?.raw?.descricao ||
      it?.raw?.DESC || it?.raw?.desc ||
      '(sem descrição)';
    return  <span
   className="block truncate
              max-w-[36ch] sm:max-w-[44ch] md:max-w-[50ch] lg:max-w-[56ch]"
   title={full}
 >
   {full}
 </span>
  })()}
</td>
  {isFatura && (
    <td className="p-2 text-center">
     {p.detect_parcela ? `${p.detect_parcela.atual}/${p.detect_parcela.total}` : '—'}
   </td>
 )}
  <td className={`p-2 whitespace-nowrap text-center tabular-nums font-semibold ${tipoRD === 'despesa' ? 'text-red-500' : 'text-blue-600'}`}>
  {(p.valor??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
</td>
  <td className="p-2 text-center">{tipoDisplay}</td>
  <td className="p-2 text-center">
   {( (p.categoria_id || p.subcategoria_id) && (regrasAplicadas || it._manualCat) )
     ? (
   (() => {
     const catName = catById[Number(p.categoria_id)] || `Cat ${p.categoria_id || '-'}`;
     const subName = p.subcategoria_id
       ? (subById[Number(p.subcategoria_id)] || `Sub ${p.subcategoria_id}`)
       : '—';
     const full = `${catName} / ${subName}`;
     return (
 <span
   className="inline-block max-w-[25ch] truncate align-middle
                    px-2 py-0.5 rounded-md border border-emerald-300/40
                    text-emerald-700 dark:border-emerald-700/40 dark:text-emerald-300 text-xs bg-transparent"
         title={full}
       >
         {full}
       </span>
     );
   })()
     )
 : (
     <button
       onClick={()=>abrirModalCategoria(it)}
       className="text-xs text-amber-600 underline hover:text-amber-700"
       title="Definir categoria e subcategoria"
     >
       Definir
     </button>
   )}
 </td>
 <td className="p-2">
   <button
     onClick={()=> temCatVisivel && abrirModalCategoria(it)}
     disabled={!temCatVisivel}
     aria-disabled={!temCatVisivel}
     className={`inline-flex items-center justify-center h-8 w-8 rounded-md focus:outline-none focus:ring-2
                 ${temCatVisivel
                   ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 focus:ring-blue-500/50'
                   : 'text-gray-400 cursor-not-allowed opacity-50'}`}
     title={temCatVisivel ? 'Editar categoria' : 'Defina categoria e subcategoria primeiro'}
     aria-label="Editar categoria"
   >
     <HiPencil className="h-4 w-4" />
     <span className="sr-only">Editar categoria</span>
   </button>
 </td>
                <td className="p-2 space-x-2">
                  {p.detect_parcela?.ehParcela && <span className="text-xs bg-purple-200 dark:bg-purple-900/40 px-2 py-0.5 rounded">Parcela</span>}
                  {p.detect_recorrente?.ehRecorrente && <span className="text-xs bg-blue-200 dark:bg-blue-900/40 px-2 py-0.5 rounded">Recorrente</span>}
                  {dup === 'duplicado_certo' && <span className="text-xs bg-rose-300 dark:bg-rose-900/50 px-2 py-0.5 rounded" title={it._dup_motivo}>Duplicado</span>}
                  {dup === 'duplicado_provavel' && <span className="text-xs bg-amber-300 dark:bg-amber-900/50 px-2 py-0.5 rounded" title={it._dup_motivo}>Provável</span>}
 {!isDup && (
   ok
     ? <span className="text-xs bg-emerald-200 dark:bg-emerald-900/40 px-2 py-0.5 rounded">OK</span>
     : <span className="text-xs bg-amber-200 dark:bg-amber-900/40 px-2 py-0.5 rounded">Revisar</span>
 )}
                  {it._sug?.lancamento_id && <span className="text-xs bg-emerald-300 dark:bg-emerald-800/60 px-2 py-0.5 rounded">Sug.: #{it._sug.lancamento_id}</span>}
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>

<CategoryPickerModal
  aberto={modalCat.aberto}
  descricao={modalCat.descricao}
  catInicial={modalCat.catInicial}
  subInicial={modalCat.subInicial}
  onApply={aplicarCategoriaNoPreview}
  onClose={()=>setModalCat({ aberto:false, itemId:null, descricao:'' })}
/>  

{confirmDup.aberto && (
  <div className="fixed inset-0 z-[60]">
    {/* fundo escuro */}
    <div className="absolute inset-0 bg-black/40" onClick={cancelarConfirmacaoDuplicados} />
    {/* caixa */}
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-darkCard shadow-xl border border-gray-200 dark:border-darkBorder">
        <div className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-darkText">
            Itens duplicados detectados
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-darkMuted">
            Você está prestes a confirmar a importação com
            {' '}
            <strong>{confirmDup.total}</strong> item{confirmDup.total !== 1 ? 's' : ''} que parecem duplicados
            { (confirmDup.certos || confirmDup.provaveis) ? (
              <> — <span className="text-rose-600 dark:text-rose-300">{confirmDup.certos} duplicado{confirmDup.certos!==1?'s':''}</span>
              {confirmDup.provaveis ? <> e <span className="text-amber-600 dark:text-amber-300">{confirmDup.provaveis} provável{confirmDup.provaveis!==1?'eis':''}</span></> : null}
              </>
            ) : null }.
            Deseja continuar mesmo assim?
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={cancelarConfirmacaoDuplicados}
              className="h-9 px-3 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-darkBg dark:text-darkText"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarMesmoAssim}
              className="h-9 px-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Importar mesmo assim
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

    </div>
  );
}

function CategoryPickerModal({ aberto, onClose, descricao, onApply, catInicial, subInicial }) {
  const [categorias, setCategorias] = useState([]);
  const [subs, setSubs] = useState([]);
  const [catId, setCatId] = useState('');
  const [subId, setSubId] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const podeAplicar = !!catId && !!subId;

  // Carregar categorias quando abre
  useEffect(() => {
    if (!aberto) return;
    (async () => {
      try {
        const r = await fetch('/api/categorias', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const j = await parseJsonSeguro(r);
        setCategorias(j.categorias || j || []);
      } catch (e) {
        console.error('Erro ao carregar categorias', e);
      }
    })();
  }, [aberto]);

  // Resetar/preencher sempre que o modal abrir
  useEffect(() => {
    if (!aberto) return;
    const cid = (catInicial !== undefined && catInicial !== null && catInicial !== '') ? Number(catInicial) : null;
    const sid = (subInicial !== undefined && subInicial !== null && subInicial !== '') ? Number(subInicial) : null;
    if (cid) {
      setCatId(cid);
      (async () => {
        await carregarSubs(cid);             // carrega as subs da categoria atual
        setSubId(sid || '');
      })();
    } else {
      setCatId('');
      setSubId('');
      setSubs([]);                           // limpa até escolher categoria
    }
    setLembrar(true);
  }, [aberto, catInicial, subInicial]);

  // Buscar subcategorias ao mudar categoria
  const carregarSubs = async (categoriaId) => {
    setSubs([]);
    setSubId('');
    if (!categoriaId) return;
    try {
      const r = await fetch(`/api/categorias/${categoriaId}/subcategorias`, {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
   const j = await parseJsonSeguro(r);
setSubs(j.subcategorias || j || []);
    } catch (e) {
      console.error('Erro ao carregar subcategorias', e);
    }
  };

  const aplicar = async () => {
    try {
   if (!catId || !subId) {
    toast.warn('Selecione categoria e subcategoria para aplicar.');
     return;
   }
      if (lembrar && descricao && catId) {
        const padrao = descricao.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        await fetch('/api/regras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ padrao, tipo_match: 'contains', categoria_id: catId, subcategoria_id: subId, prioridade: 100, valor_fixo: Number(valorDaLinha) })
        });
      }
      onApply({ categoria_id: catId, subcategoria_id: subId, lembrar });
      onClose();
    } catch (e) { 
      console.error('Erro ao aplicar categoria', e);
      onClose();
    }
  };

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="w-full max-w-md rounded-xl p-5 bg-white dark:bg-darkCard shadow-xl space-y-4">
        <h4 className="text-lg font-semibold dark:text-darkText">Definir categoria</h4>
        <div className="space-y-2">
          {/* Categoria */}
          <div>
            <label className="text-xs text-gray-500 dark:text-darkMuted">Categoria</label>
            <select
              className="w-full h-9 rounded-lg border px-2 dark:bg-darkBg dark:text-darkText"
              value={catId || ''}
              onChange={e => {
                const v = e.target.value ? Number(e.target.value) : null;
                setCatId(v);
                carregarSubs(v);
              }}
            >
              <option value="">Selecione...</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nome || c.descricao}</option>
              ))}
            </select>
          </div>

          {/* Subcategoria */}
          <div>
            <label className="text-xs text-gray-500 dark:text-darkMuted">Subcategoria</label>
            <select
              className="w-full h-9 rounded-lg border px-2 dark:bg-darkBg dark:text-darkText"
              value={subId || ''}
              onChange={e => setSubId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Selecione...</option>
              {subs.map(s => (
                <option key={s.id} value={s.id}>{s.nome || s.descricao}</option>
              ))}
            </select>
          </div>

          {/* Checkbox lembrar */}
          <label className="flex items-center gap-2 text-sm dark:text-darkText">
            <input type="checkbox" checked={lembrar} onChange={e => setLembrar(e.target.checked)} />
            Lembrar para descrições semelhantes no futuro
          </label>
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 rounded-lg bg-gray-200 dark:bg-darkBg">Cancelar</button>
 <button
   onClick={aplicar}
   disabled={!podeAplicar}
   className={`h-9 px-4 rounded-lg text-white ${podeAplicar ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600/60 cursor-not-allowed'}`}
   title={!podeAplicar ? 'Selecione categoria e subcategoria' : 'Aplicar'}
 >
   Aplicar
 </button>
        </div>
      </div>
    </div>
  );
}

export default function ImportarConciliar() {
  const [step, setStep] = useState(0);
  const [loteId, setLoteId] = useState(null);
  const [finalInsertedIds, setFinalInsertedIds] = useState([]);
  // Tours (desktop x mobile) — apenas na etapa 0 (Upload)
  const stepsImport = useMemo(() => getImportarSteps(), []);
  const { maybeStart: maybeStartImportar } = useFirstLoginTour('importar_v1', stepsImport);
  const stepsImportMobile = useMemo(() => getImportarMobileNoticeSteps(), []);
  const { maybeStart: maybeStartImportarMobile } = useFirstLoginTour('importar_mobile_v1', stepsImportMobile);

  // ✅ Dispara tour/aviso SOMENTE na etapa 0 (Upload), com o DOM já pronto
  useEffect(() => {
    if (step !== 0) return;
    const isDesktop =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(min-width: 1024px)').matches; // >= lg
    const start = () => (isDesktop ? maybeStartImportar() : maybeStartImportarMobile());
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      requestAnimationFrame(() => setTimeout(start, 0));
    } else {
      setTimeout(start, 0);
    }
  }, [step, maybeStartImportar, maybeStartImportarMobile]);
 
  const sugerirConciliacaoFinal = async () => {
    try {
      if (!finalInsertedIds.length) { toast.info('Nada para conciliar.'); return; }
      const r = await fetch('/api/conciliacao/sugerir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ ids: finalInsertedIds })
      });
      const j = await parseJsonSeguro(r);
      const mapSug = j.sugestoes || {};
      const total = Object.values(mapSug).filter(s => s && s.lancamento_id).length;
      toast[ total > 0 ? 'success' : 'info' ](
        total > 0 ? `Sugestões de conciliação carregadas: ${total}.` : 'Nenhuma sugestão de conciliação encontrada.'
      );
    } catch (e) {
      toast.error('Erro ao sugerir conciliação: ' + e.message);
    }
  };

const steps = [
  { title: 'Upload', comp: <StepUpload onParsed={(id)=>{ setLoteId(id); setStep(1); }} /> },
  { title: 'Prévia & Confirmar', comp: <StepPreview loteId={loteId} onConfirmado={(ids)=>{ setFinalInsertedIds(ids||[]); setStep(2); }} /> },
  { title: 'Concluído', comp:
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-darkText">Importação concluída</h3>
      <p className="text-gray-600 dark:text-darkMuted">
        Agora você pode revisar os lançamentos em <strong>Movimentações</strong> ou, se quiser, executar a conciliação automática.
      </p>
      {finalInsertedIds.length > 0 && (
        <div>
          <button onClick={sugerirConciliacaoFinal}
                  className="px-4 h-9 rounded-lg bg-gray-200 dark:bg-darkBg">
            Sugerir conciliação (opcional)
          </button>
          <p className="mt-1 text-xs text-gray-600 dark:text-darkMuted">
            Não cria lançamentos. Procura correspondências entre os itens importados e lançamentos existentes
            (mesma data/valor e descrição semelhante) para <em>vincular</em> e marcar como conciliados, evitando duplicidade.
          </p>
        </div>
      )}
    </div>
  }
];

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-darkText flex items-center gap-2">
          <HiCloudUpload className="w-5 h-5 text-blue-600" />
          Importar & Conciliar
        </h2>
        <p className="text-sm text-gray-600 dark:text-darkMuted">
          Importe extratos <strong>CSV/OFX</strong> para criar lançamentos automaticamente. Revise a prévia, categorize, evite duplicados e concilie com lançamentos existentes.
        </p>
        {/* Linha decorativa */}
        <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 
                        dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
      </section>

      {/* Aviso MOBILE: experiência completa apenas no desktop */}
      <section className="sm:hidden px-4 py-4 rounded-xl shadow bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder">
        <p className="text-sm text-gray-700 dark:text-darkText">
          Esta tela está otimizada para <strong>desktop</strong> (upload, prévia tabular, categorização e conciliação).
          Acesse em um computador para utilizar todos os recursos.
        </p>
      </section>

      {/* Conteúdo principal: oculto no mobile */}
      <section className="hidden sm:block p-6 shadow-md rounded-xl bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder">
        <div className="flex items-center gap-2 mb-4">
          {steps.map((s, i) => (
            <div key={i} className={`text-sm px-3 py-1 rounded-full ${i===step?'bg-blue-600 text-white':'bg-gray-200 dark:bg-darkBg'}`}>
              {i+1}. {s.title}
            </div>
          ))}
        </div>
        {steps[step].comp}
      </section>
    </div>
  );
}