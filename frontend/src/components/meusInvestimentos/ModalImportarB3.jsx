import React, { useEffect, useState} from 'react';
import { toast } from 'react-toastify';
import ScrollArea from '../ui/ScrollArea'; // ajuste o path se não usar alias

export default function ModalImportarB3({ fechar, onImportou }) {
  const [aba, setAba] = useState('negociacoes'); // 'negociacoes' | 'eventos'
  const [preview, setPreview] = useState([]);
  const [arquivo, setArquivo] = useState(null);
  const [previewEventos, setPreviewEventos] = useState([]);
  const [arquivoEventos, setArquivoEventos] = useState(null);
  const [apenasBonificacao, setApenasBonificacao] = useState(true);
  const token = localStorage.getItem('token');
  const [classes, setClasses] = useState([]);
  const [subsCache, setSubsCache] = useState({}); // { [classeId]: [subclasses] }
  const [dragOver, setDragOver] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  const [fileKeyEventos, setFileKeyEventos] = useState(0);
 const [remapPrompt, setRemapPrompt] = useState(null); // { ticker, classe_id, subclasse_id, prev:{classe_id,subclasse_id} }
 const [tickersPerguntados, setTickersPerguntados] = useState({});
 const [hasMapByTicker, setHasMapByTicker] = useState({}); // { [ticker]: true/false }
 const [initialMapByTicker, setInitialMapByTicker] = useState({}); // { [ticker]: {classe_id, subclasse_id} }
// --- PREVIEW DE PROVENTOS (NOVO) ---
const [previewProventos, setPreviewProventos] = useState([]);
const [selecionadosProventos, setSelecionadosProventos] = useState([]);

 function validarArquivo(f) {
   if (!f) return false;
   const ok = /\.(csv|xlsx)$/i.test(f.name || '');
   if (!ok) {
     toast.error('Formato não suportado. Envie um arquivo CSV ou XLSX da B3.');
   }
   return ok;
 }

 function perguntarRetroativo(ticker, classe_id, subclasse_id) {
   if (!ticker || !classe_id || !subclasse_id) return;
   const init = initialMapByTicker[ticker] || {};
   const hadMap = Boolean(init.classe_id || init.subclasse_id); // só se veio mapeado do backend
   if (!hadMap) return;                // ativo novo → não pergunta
   if (tickersPerguntados[ticker]) return;
   setRemapPrompt({
     ticker,
     classe_id: String(classe_id),
     subclasse_id: String(subclasse_id),
     prev: {
       classe_id: init.classe_id || '',
       subclasse_id: init.subclasse_id || ''
     }
   });
 }
 
  function cancelarRemap() {
   if (!remapPrompt) return;
   // reverte visualmente TODAS as linhas desse ticker para o valor anterior
   const prevClasse = remapPrompt.prev?.classe_id ?? '';
   const prevSub    = remapPrompt.prev?.subclasse_id ?? '';
   if (prevClasse !== '' || prevSub !== '') {
     setPreview((rows) =>
       rows.map((row) =>
         row.nome_investimento === remapPrompt.ticker
           ? { ...row, classe_id: prevClasse, subclasse_id: prevSub }
           : row
       )
     );
   }
   // não marca como "perguntado" — se o usuário mudar de novo, perguntará de novo
   setRemapPrompt(null);
 }

 async function aplicarRetroativo() {
   if (!remapPrompt) return;
   try {
     const token = localStorage.getItem('token');
     const resp = await fetch('/api/investimentos/remap-ticker', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
       body: JSON.stringify({
         ticker: remapPrompt.ticker,
         to_classe_id: Number(remapPrompt.classe_id),
         to_subclasse_id: remapPrompt.subclasse_id ? Number(remapPrompt.subclasse_id) : null,
         escopo: 'all', // retroativamente para todos
       })
     });
     const data = await resp.json().catch(() => ({}));
     if (!resp.ok) throw new Error(data?.erro || 'Falha ao remapear lançamentos anteriores');
     toast.success(`Remapeados ${data.atualizados ?? 0} lançamento(s) anteriores`);
   } catch (e) {
     toast.error(e.message);
   } finally {
     setTickersPerguntados(prev => ({ ...prev, [remapPrompt.ticker]: true }));
     setRemapPrompt(null);
   }
 }

 function apenasFuturo() {
   if (!remapPrompt) return;
   // Não chama backend: manteremos só esta importação + mapa (já acontece no confirmar)
   setTickersPerguntados(prev => ({ ...prev, [remapPrompt.ticker]: true }));
   setRemapPrompt(null);
 }


 function voltarParaUpload() {
   setPreview(null);        // esvazia a prévia → some a tabela
   setArquivo(null);      // zera o arquivo atual
   setDragOver(false);    // garante dropzone “limpa”
   setFileKey(k => k + 1);// força remontar o <input>, permitindo re-selecionar o mesmo arquivo
 }

 // util: ISO -> dd/mm/aaaa (mesma lógica do Importar & Conciliar)
 const dataParaBR = (str) => {
   if (!str) return '-';
   const s = String(str).trim();
   let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
   if (m) return `${m[3]}/${m[2]}/${m[1]}`;
   m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
   if (m) return `${m[3]}/${m[2]}/${m[1]}`;
   const d = new Date(s);
   return isNaN(d) ? s : d.toLocaleDateString('pt-BR');
};

 useEffect(() => {
 const token = localStorage.getItem('token');
   fetch('/api/investimentos/classes?ocultas=0', {
     headers: { Authorization: `Bearer ${token}` }
   })
     .then(r => r.json())
     .then(d => setClasses(Array.isArray(d) ? d : []))
     .catch(() => setClasses([]));
 }, []);

 async function enviar(fileParam) {
   const fileToSend = fileParam || arquivo;
   if (!fileToSend) return toast.warn('Selecione um arquivo');
   const fd = new FormData();
   fd.append('arquivo', fileToSend);
    const resp = await fetch('/api/importacoes/investimentos/b3', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });
    const data = await resp.json();
    if (!resp.ok) return toast.error(data.erro || 'Falha no preview');
 const linhas = Array.isArray(data.preview) ? data.preview.map(l => ({
   ...l,
   incluir: l.incluir ?? !l.duplicado,    // se o backend marcar duplicado, default = !duplicado
   classe_id: l.classe_id || '',
   subclasse_id: l.subclasse_id || ''
 })) : [];
 const unificadas = unifyMappingByTicker(linhas);
 setPreview(unificadas);
 // guarda o mapeamento que veio do backend antes de qualquer alteração do usuário
 const initial = {};
 linhas.forEach(x => {
   const t = x.nome_investimento;
   if (!initial[t]) {
     initial[t] = {
       classe_id: x.classe_id ? String(x.classe_id) : '',
       subclasse_id: x.subclasse_id ? String(x.subclasse_id) : ''
     };
   }
 });
 setInitialMapByTicker(initial);
 // marca tickers que JÁ vieram com classe/subclasse do mapa
 const map = {};
 linhas.forEach(x => {
   const t = x.nome_investimento;
   map[t] = map[t] || Boolean(x.classe_id || x.subclasse_id);
 });
 setHasMapByTicker(map);
 const uniqClasses = [...new Set(unificadas.map(x => x.classe_id).filter(Boolean))];
 uniqClasses.forEach(id => getSubclasses(id));
  }

    // === Eventos (BONIFICAÇÃO) ===
  function voltarEventosParaUpload() {
    setPreviewEventos([]);
    setArquivoEventos(null);
    setDragOver(false);
    setFileKeyEventos(k => k + 1);
  }

  function dedupePreviewEventos(rows) {
  const seen = new Set();

  const asKey = (l) => {
    const isProv =
      String(l?.tipo_operacao).toLowerCase() === 'provento' ||
      l?.valor_bruto != null ||
      (l?.tipo && ['DIVIDENDO','JCP','RENDIMENTO','AMORTIZACAO'].includes(String(l.tipo).toUpperCase()));

    const data   = String(l.data_operacao || l.data || '').trim();
    const ticker = String(l.nome_investimento || l.ticker || '').toUpperCase().trim();
    if (isProv) {
      const tipo  = String(l.tipo || 'PROVENTO').toUpperCase();
      const total = Number(l.valor_total ?? l.valor_bruto ?? 0).toFixed(6);
      const qtd   = (l.quantidade != null ? Number(l.quantidade) : 0).toFixed(6);
      return `prov|${ticker}|${tipo}|${data}|${total}|${qtd}`;
    } else {
      const tipo  = String(l.tipo_operacao || '').toLowerCase();
      const unit  = Number(l.valor_unitario ?? 0).toFixed(6);
      const total = Number(l.valor_total ?? 0).toFixed(6);
      const qtd   = Number(l.quantidade || 0).toFixed(6);
      return `mov|${ticker}|${tipo}|${data}|${unit}|${total}|${qtd}`;
    }
  };

  const out = [];
  for (const r of rows) {
    const key = asKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

  async function enviarEventos(fileParam) {
    const fileToSend = fileParam || arquivoEventos;
    if (!fileToSend) return toast.warn('Selecione um arquivo de eventos');
    const fd = new FormData();
    fd.append('arquivo', fileToSend);
    // A aba "Movimentações" usa sempre o EXTRATO DE MOVIMENTAÇÃO unificado
      const resp = await fetch('/api/importacoes/investimentos/b3-movimentacao', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });
    const data = await resp.json();
    if (!resp.ok) {
      toast.error(data.erro || 'Falha no preview de eventos');
      return;
    }
    // A PARTIR DE AGORA: tratamos SEMPRE data.preview (unificado: proventos + eventos)
    const arr = Array.isArray(data.preview) ? data.preview : [];
    if (arr.length === 0) {
      toast.warn('Nenhuma movimentação foi detectada nesse arquivo.');
      return;
    }
    const linhas = arr.map(l => {
      const tipo = String(l.tipo_operacao || l.tipo || '').toLowerCase();
      const isProv = tipo === 'provento';
      const qtd    = Number(l.quantidade ?? l.qtd ?? l.qtd_creditada ?? l.qtd_evento ?? 0);
      const total  = Number(isProv ? (l.valor_total ?? l.valor_bruto ?? 0) : (l.valor_total ?? 0));
      const unit   = Number(isProv
        ? (l.valor_unitario ?? (qtd > 0 ? (total / qtd) : 0))
        : (l.valor_unitario ?? 0));
      return {
        ...l,
        incluir: l.incluir !== false,
        // garantir Data/Ativo
        data_operacao: l.data_operacao || (isProv ? l.data : l.data_operacao) || '',
        nome_investimento: l.nome_investimento || (isProv ? l.ticker : l.nome_investimento) || '',
        // campos visuais
        classe_id: l.classe_id || '',
        subclasse_id: l.subclasse_id || '',
        tipo_operacao: tipo, // 'provento' | 'bonificacao' | 'ajuste_bonificacao' | 'venda'
        quantidade: qtd,
        valor_unitario: unit,
        valor_total: total,
      };
    });
const unificadas = unifyMappingByTicker(linhas);
const semDuplicatas = dedupePreviewEventos(unificadas);
setPreviewEventos(semDuplicatas);
    // Pré-carrega subclasses apenas para linhas NÃO-provento (provento não usa classe/subclasse)
    const uniqClasses = [...new Set(unificadas
      .filter(x => x.tipo_operacao !== 'provento')
      .map(x => x.classe_id).filter(Boolean))];
    uniqClasses.forEach(id => getSubclasses(id));
  }

  async function confirmarEventos() {
    if (!Array.isArray(previewEventos) || previewEventos.length === 0) {
      toast.warn('Nada para importar.');
      return;
    }
    // Detecta se o preview está no formato de PROVENTOS (tem 'tipo' ou 'valor_bruto')
    const isProventoLike = previewEventos.some(l => l.tipo || l.valor_bruto != null);
    // Exige classe/subclasse apenas para linhas que NÃO são provento
    const faltando = previewEventos
      .filter(l => l.incluir && l.tipo_operacao !== 'provento')
      .filter(l => !l.classe_id || !l.subclasse_id).length;
    if (faltando) {
      toast.warn(`Selecione classe e subclasse em ${faltando} linha(s).`);
      return;
    }
    const selecionadas = previewEventos.filter(l => l.incluir);
    const linhasProv = selecionadas
      .filter(l => String(l.tipo_operacao).toLowerCase() === 'provento')
      .map(l => ({
        incluir: true,
        data: l.data_operacao || l.data,
        ticker: l.nome_investimento || l.ticker,
        tipo: l.tipo, // DIVIDENDO | JCP | RENDIMENTO | AMORTIZACAO
        valor_bruto: Number(l.valor_bruto ?? l.valor_total ?? 0),
        quantidade: l.quantidade != null ? Number(l.quantidade) : null,
        instituicao: l.instituicao || null,
      }));
    const linhasMov = selecionadas
      .filter(l => String(l.tipo_operacao).toLowerCase() !== 'provento')
      .map(l => ({
        ...l,
        tipo_operacao: l.tipo_operacao,
        valor_unitario: Number(l.valor_unitario ?? 0),
        valor_total: Number(l.valor_total ?? 0),
        classe_id: l.classe_id ? Number(l.classe_id) : null,
        subclasse_id: l.subclasse_id ? Number(l.subclasse_id) : null,
      }));

    let imp = 0, fal = 0;
    // 1) PROVENTOS (se houver)
    if (linhasProv.length) {
      const respP = await fetch('/api/importacoes/investimentos/b3-movimentacao/proventos/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ linhas: linhasProv })
      });
      const dataP = await respP.json();
      if (!respP.ok) return toast.error(dataP.erro || 'Falha ao importar proventos');
      imp += Number(dataP.importados || 0);
      fal += Number(dataP.falhas || 0);
    }
    // 2) MOVIMENTAÇÕES (bonificação/ajuste/leilão) — se houver
    if (linhasMov.length) {
      const respM = await fetch('/api/importacoes/investimentos/b3-movimentacao/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ linhas: linhasMov })
      });
      const dataM = await respM.json();
      if (!respM.ok) return toast.error(dataM.erro || 'Falha ao importar movimentações');
      imp += Number(dataM.importados || 0);
      fal += Number(dataM.falhas || 0);
    }
    if (imp === 0) {
      toast.warn('Nenhuma movimentação importada. Verifique as linhas e (se aplicável) Classe/Subclasse.');
    } else {
      toast.success(`Importadas ${imp} movimentação(ões)` + (fal ? ` • Falhas: ${fal}` : ''));
    }
    onImportou?.();
    fechar();
  }

  function unifyMappingByTicker(rows) {
  const memo = {}; // ticker -> {classe_id, subclasse_id}
  // 1ª passada: captura o primeiro mapping não-vazio de cada ticker
  rows.forEach(r => {
    const t = r.nome_investimento;
    memo[t] ||= { classe_id: '', subclasse_id: '' };
    if (r.classe_id && !memo[t].classe_id) memo[t].classe_id = String(r.classe_id);
    if (r.subclasse_id && !memo[t].subclasse_id) memo[t].subclasse_id = String(r.subclasse_id);
  });
  // 2ª passada: aplica defaults para manter consistência visual
  return rows.map(r => {
    const t = r.nome_investimento;
    const m = memo[t] || {};
    return {
      ...r,
      classe_id: String(r.classe_id || m.classe_id || ''),
      subclasse_id: String(r.subclasse_id || m.subclasse_id || ''),
    };
  });
}

  async function confirmar() {
 if (!Array.isArray(preview) || preview.length === 0) {
  toast.warn('Nada para importar.');
   return;
 }
 const faltando = preview.filter(l => l.incluir && (!l.classe_id || !l.subclasse_id)).length;
 if (faltando) {
   toast.warn(`Selecione classe e subclasse em ${faltando} linha(s).`);
   return;
 }
    const resp = await fetch('/api/importacoes/investimentos/b3/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({
   linhas: preview
     .filter(l => l.incluir)
     .map(l => ({
       ...l,
       classe_id: l.classe_id ? Number(l.classe_id) : null,
       subclasse_id: l.subclasse_id ? Number(l.subclasse_id) : null,
     }))
 })
    });
    const data = await resp.json();
if (!resp.ok) return toast.error(data.erro || 'Falha ao importar');

if ((data.importados ?? 0) === 0) {
  toast.warn('Nenhum investimento importado. Verifique se há linhas marcadas e se Classe/Subclasse foram selecionadas.');
} else {
  toast.success(`Importados ${data.importados} investimento(s)` + (data.falhas ? ` • Falhas: ${data.falhas}` : ''));
}
onImportou?.();
fechar();
  }

  async function getSubclasses(classe_id) {
  if (!classe_id) return [];
  if (subsCache[classe_id]) return subsCache[classe_id];
  const token = localStorage.getItem('token');
  const resp = await fetch(`/api/investimentos/subclasses?classe_id=${classe_id}&ocultas=0`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await resp.json();
  const list = Array.isArray(data) ? data : [];
  setSubsCache(prev => ({ ...prev, [classe_id]: list }));
  return list;
}

  const nomeClasse = (id) => {
    const c = (classes || []).find(c => String(c.id) === String(id));
    return c?.nome || '—';
  };
  const nomeSubclasse = (cid, sid) => {
    const list = subsCache?.[cid] || [];
    const s = list.find(s => String(s.id) === String(sid));
    return s?.nome || '—';
  };
  // pré-carrega as subclasses das classes que vieram na prévia
  useEffect(() => {
    const ids = Array.from(new Set((previewEventos || []).map(l => l.classe_id).filter(Boolean)));
    ids.forEach(id => getSubclasses(id));
  }, [previewEventos]);

  const tipoLabel = (t, origem) => {
    const v = String(t || '').toLowerCase();
    if (v === 'provento') return 'Provento';
    if (origem === 'leilao_fracao' || v === 'venda') return 'Leilão de Fração';
    if (v === 'ajuste_bonificacao') return 'Ajuste de Bonificação';
    return 'Bonificação';
  };

    // helper: diz se uma linha é provento (cobre casos onde vem só tipo/valor_bruto)
  const isLinhaProvento = (l) =>
    String(l?.tipo_operacao || (l?.tipo ? 'provento' : (l?.valor_bruto != null ? 'provento' : '')))
      .toLowerCase() === 'provento';

  // flag: true quando TODAS as linhas do preview são provento
  const hasOnlyProventos =
    Array.isArray(previewEventos) &&
    previewEventos.length > 0 &&
    previewEventos.every(isLinhaProvento);

  return (
 <div className="fixed inset-0 bg-black/40 z-[200] overflow-y-auto" role="dialog" aria-modal="true">
   <div className="min-h-full flex items-center justify-center p-6">
 <div className="bg-white dark:bg-darkCard border border-gray-200 dark:border-darkBorder rounded-2xl shadow-xl p-6 w-full max-w-6xl
                 max-h-[85vh] overflow-hidden flex flex-col">
               <div className="mb-4">
         <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-darkText">
            Importar da B3
          </h2>
           <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
             <button
               onClick={()=>setAba('negociacoes')}
               className={'px-3 py-1 text-xs rounded-md ' + (aba==='negociacoes' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-100')}
             >
               Negociações
             </button>
             <button
               onClick={()=>setAba('eventos')}
               className={'px-3 py-1 text-xs rounded-md ' + (aba==='eventos' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-100')}
             >
               Movimentações
             </button>
           </div>
         </div>
       </div>

        {aba === 'negociacoes' && !(preview?.length > 0) && (
          <>
{/* Dropzone no padrão Importar & Conciliar */}
<div
  onDragOver={(e)=>{ e.preventDefault(); setDragOver(true); }}
  onDragLeave={()=>setDragOver(false)}
  onDrop={(e)=>{ 
    e.preventDefault(); 
    setDragOver(false); 
 const f = e.dataTransfer.files?.[0];
 if (f && validarArquivo(f)) { setArquivo(f); enviar(f); }
  }}
 className={`border-2 border-dashed rounded-xl p-6 text-center
             ${dragOver
               ? 'border-blue-500 bg-blue-50 dark:bg-gray-800/40'
               : 'border-gray-300 dark:border-darkBorder dark:bg-transparent'}`}
>
  <p className="text-sm mb-3">
    Arraste aqui um arquivo .csv ou .xlsx <span className="hidden sm:inline">ou</span>
  </p>

  <input
    id="upload-b3"
    key={fileKey}
    type="file"
    accept=".csv,.xlsx"
    onChange={e=>{ 
 const f = e.target.files?.[0];
 if (f && validarArquivo(f)) { setArquivo(f); enviar(f); }
    }}
    className="sr-only"
  />

  <label
    htmlFor="upload-b3"
    className="inline-flex items-center gap-2 h-9 px-4 rounded-lg
               bg-blue-600 text-white hover:bg-blue-700
               focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2
               dark:focus:ring-offset-darkBg cursor-pointer"
  >
    Escolher arquivo
  </label>

  <small className="block mt-2 text-[11px] text-gray-600 dark:text-darkMuted">
    Aceita CSV ou XLSX. A pré-visualização abre automaticamente.
  </small>
</div>

<div className="mt-4 flex justify-end">
  <button
  onClick={fechar}
  className="inline-flex h-9 items-center px-4 rounded-lg
             border border-gray-300 bg-white text-gray-700
             hover:bg-gray-50 active:scale-95 transition
             focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2
             dark:border-gray-700 dark:bg-gray-800 dark:text-darkText dark:hover:bg-gray-700 dark:focus:ring-offset-darkBg"
>
  Cancelar
</button>
</div>  
          </>
        )}

                {/* === ABA EVENTOS — UPLOAD === */}
        {aba === 'eventos' && !(previewEventos?.length > 0) && (
          <>
            <div
              onDragOver={(e)=>{ e.preventDefault(); setDragOver(true); }}
              onDragLeave={()=>setDragOver(false)}
              onDrop={(e)=>{
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f && validarArquivo(f)) { setArquivoEventos(f); enviarEventos(f); }
              }}
              className={`border-2 border-dashed rounded-xl p-6 text-center
                ${dragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-gray-800/40'
                  : 'border-gray-300 dark:border-darkBorder dark:bg-transparent'}`}
            >
              <p className="text-sm mb-3">
                Arraste aqui um arquivo .csv ou .xlsx de <b>Movimentações</b> (proventos, leilões, bonificações)
                <span className="hidden sm:inline"> ou </span>
              </p>

              <input
                id="upload-b3-eventos"
                key={fileKeyEventos}
                type="file"
                accept=".csv,.xlsx"
                onChange={(e)=>{
                  const f = e.target.files?.[0];
                  if (f && validarArquivo(f)) { setArquivoEventos(f); enviarEventos(f); }
                }}
                className="sr-only"
              />

              <label
                htmlFor="upload-b3-eventos"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg
                           bg-blue-600 text-white hover:bg-blue-700
                           focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2
                           dark:focus:ring-offset-darkBg cursor-pointer"
              >
                Escolher arquivo de movimentações
              </label>

              <small className="block mt-2 text-[11px] text-gray-600 dark:text-darkMuted">
                Aceita CSV ou XLSX. A pré-visualização abre automaticamente.
              </small>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={fechar}
                className="inline-flex h-9 items-center px-4 rounded-lg border border-gray-300 bg-white text-gray-700
                           hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2
                           dark:border-gray-700 dark:bg-gray-800 dark:text-darkText dark:hover:bg-gray-700 dark:focus:ring-offset-darkBg"
              >
                Cancelar
              </button>
            </div>
          </>
        )}

         {/* === ABA EVENTOS — PREVIEW + CONTINUAÇÃO === */}
         {aba === 'eventos' && (previewEventos?.length > 0) && (
           <>
           
{/* TABELA ÚNICA DE MOVIMENTAÇÕES — mesmo layout da tabela de Negociações */}
<ScrollArea
  axis="y"
  size={8}
  className="rounded-xl border border-gray-200 dark:border-darkBorder max-h-[340px] sm:max-h-[360px]"
>
  <table className="min-w-full text-sm table-fixed">
    <colgroup>
      <col className="w-[6%]" />   {/* Incluir */}
      {!hasOnlyProventos && <>
        <col className="w-[12%]" />  {/* Classe */}
        <col className="w-[12%]" />  {/* Subclasse */}
      </>}
      <col className="w-[12%]" />  {/* Data */}
      <col className="w-[16%]" />  {/* Ticker (ganha espaço quando esconde classe) */}
      <col className="w-[10%]" />  {/* Tipo */}
      <col className="w-[10%]" />  {/* Qtd */}
      <col className="w-[12%]" />  {/* Preço */}
      <col className="w-[12%]" />  {/* Total */}
      <col className="w-[10%]" />  {/* Status */}
    </colgroup>
    <thead className="bg-gray-50 dark:bg-darkCard text-gray-700 dark:text-darkText text-xs sticky top-0 z-10">
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
        <th className="p-2 text-center">Incluir</th>
        {!hasOnlyProventos && <>
          <th className="p-2 text-center">Classe</th>
          <th className="p-2 text-center">Subclasse</th>
        </>}
        <th className="p-2 text-center">Data</th>
        <th className="p-2 text-center">Ticker</th>
        <th className="p-2 text-center">Tipo</th>
        <th className="p-2 text-right">Qtd</th>
        <th className="p-2 text-right">Preço</th>
        <th className="p-2 text-right">Total</th>
        <th className="p-2 text-center">Status</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                   {previewEventos.map((l, idx) => {
                     const isProv = l.tipo_operacao === 'provento';
                     return (
          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
<td className="p-2 text-center">
  <label className="group inline-flex h-6 w-6 items-center justify-center relative cursor-pointer select-none">
    <input
      type="checkbox"
      className="sr-only peer"
      checked={!!l.incluir}
      onChange={(e) => {
        const checked = e.target.checked;
        setPreviewEventos(rows =>
          rows.map((r, i2) => (i2 === idx ? { ...r, incluir: checked } : r))
        );
      }}
    />
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
    <svg
      className="pointer-events-none absolute h-3 w-3 text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  </label>
</td>
            {!hasOnlyProventos && (
              <>
                <td className="p-2">
                  {/* Provento não exige classe/subclasse → desabilita selects */}
                  <select
                    className="w-full h-6 px-2 rounded-md border border-gray-300 bg-white text-gray-800
                               focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 focus:ring-offset-white
                               dark:border-gray-700 dark:bg-gray-800 dark:text-darkText dark:focus:ring-offset-darkBg text-sm"
                    value={String(l.classe_id || '')}
                    disabled={isProv}
                    onChange={e => {
                      const cid = e.target.value;
                      setPreviewEventos(rows => rows.map((r,i)=> i===idx ? {...r, classe_id: cid, subclasse_id: ''} : r));
                      if (cid) getSubclasses(cid);
                    }}
                  >
                    <option value="">{isProv ? '—' : 'Selecione…'}</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </td>
                <td className="p-2">
                  <select
                    className="w-full h-6 px-2 rounded-md border border-gray-300 bg-white text-gray-800
                               focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 focus:ring-offset-white
                               dark:border-gray-700 dark:bg-gray-800 dark:text-darkText dark:focus:ring-offset-darkBg text-sm"
                    value={String(l.subclasse_id || '')}
                    disabled={isProv || !l.classe_id}
                    onChange={e => {
                      const sid = e.target.value;
                      setPreviewEventos(rows => rows.map((r,i)=> i===idx ? {...r, subclasse_id: sid} : r));
                    }}
                  >
                    <option value="">{isProv ? '—' : (l.classe_id ? 'Selecione…' : 'Classe primeiro')}</option>
                    {(subsCache[l.classe_id] || []).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </td>
              </>
            )}
            <td className="p-2 text-center">{dataParaBR(l.data_operacao || l.data)}</td>
            <td className="p-2 text-center">{l.nome_investimento || l.ticker}</td>
<td className="p-2 text-center">{tipoLabel(l.tipo_operacao, l.origem)}</td>
           <td className="p-2 text-right">{Number(l.quantidade || 0).toLocaleString('pt-BR')}</td>
            {(() => {
              const isProv =
                l.tipo_operacao === 'provento' ||
                l.valor_bruto != null ||
                (l.tipo && ['DIVIDENDO','JCP','RENDIMENTO','AMORTIZACAO'].includes(String(l.tipo).toUpperCase()));
              const qtd   = Number(l.quantidade || 0);
              const total = isProv
                ? Number(l.valor_total ?? l.valor_bruto ?? 0)
                : Number(l.valor_total ?? (qtd * Number(l.valor_unitario ?? 0)));
              const unit  = isProv
                ? Number(l.valor_unitario ?? (qtd > 0 ? total / qtd : 0))
                : Number(l.valor_unitario ?? 0);
              return (
                <>
                  <td className="p-2 text-right">
                    {unit.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}
                  </td>
                  <td className="p-2 text-right">
                    {total.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}
                  </td>
                </>
              );
            })()}
            <td className="p-2 text-center">
              {l.duplicado
                ? <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">Duplicado</span>
                : <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">Novo</span>}
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </ScrollArea>

             <div className="mt-4 flex items-center justify-between">
               <button
                 onClick={voltarEventosParaUpload}
                 className="inline-flex h-9 items-center gap-2 px-4 rounded-lg
                            border border-gray-300 bg-white text-gray-700
                            hover:bg-gray-50 active:scale-95 transition
                            focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2
                            dark:border-gray-700 dark:bg-gray-800 dark:text-darkText dark:hover:bg-gray-700 dark:focus:ring-offset-darkBg"
               >
                 Voltar
               </button>
               <button
                 onClick={confirmarEventos}
                 className="inline-flex h-9 items-center gap-2 px-5 rounded-lg
                            bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow transition
                            focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 dark:focus:ring-offset-darkBg
                            disabled:opacity-50 disabled:cursor-not-allowed"
                 disabled={!previewEventos?.some(l => l.incluir)}
               >
                 Importar Movimentações
               </button>
             </div>
           </>
         )}
        {aba === 'negociacoes' && (preview?.length > 0) && (
          <>
            <div className="text-sm opacity-80 mb-2">
              {preview.length} linhas detectadas
            </div>
<ScrollArea
  axis="y"
  size={8}
  className="rounded-xl border border-gray-200 dark:border-darkBorder max-h-[340px] sm:max-h-[360px]"
>
  <table className="min-w-full text-sm table-fixed">
     <colgroup>
       <col className="w-[6%]" />   {/* Incluir */}
       <col className="w-[12%]" />  {/* Classe  (mais curta) */}
       <col className="w-[12%]" />  {/* Subclasse (mais curta) */}
       <col className="w-[10%]" />  {/* Data */}
       <col className="w-[12%]" />  {/* Ticker */}
       <col className="w-[8%]" />   {/* Tipo */}
       <col className="w-[8%]" />   {/* Qtd */}
       <col className="w-[10%]" />  {/* Preço */}
       <col className="w-[12%]" />  {/* Total */}
       <col className="w-[10%]" />  {/* Status */}
     </colgroup>
     <thead className="bg-gray-50 dark:bg-darkCard text-gray-700 dark:text-darkText text-xs sticky top-0 z-10">
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
<th className="p-2 text-center">Incluir</th>
<th className="p-2 text-center">Classe</th>
<th className="p-2 text-center">Subclasse</th>
                    <th className="p-2 text-center">Data</th>
                    <th className="p-2 text-center">Ticker</th>
                    <th className="p-2 text-center">Tipo</th>
                    <th className="p-2 text-right">Qtd</th>
                    <th className="p-2 text-right">Preço</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700
                   [&>tr>td]:py-1.5 [&>tr>td]:px-2 [&>tr>td]:leading-tight [&>tr>td]:align-middle">
                  {preview.map((l,i)=>(
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
 <td className="p-2 text-center">
   <label className="group inline-flex h-6 w-6 items-center justify-center relative cursor-pointer select-none">
     <input
       type="checkbox"
       className="sr-only peer"
       checked={l.incluir}
       onChange={(e) => {
         const v = e.target.checked;
         setPreview(prev => prev.map((row, idx2) => idx2 === i ? { ...row, incluir: v } : row));
       }}
     />
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
     <svg
       className="pointer-events-none absolute h-3 w-3 text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
       viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
     >
       <path d="M20 6L9 17l-5-5" />
     </svg>
   </label>
 </td>
<td className="p-2">
<select
 className="w-full h-6 px-2 rounded-md border border-gray-300 bg-white text-gray-800
            focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 focus:ring-offset-white
            dark:border-gray-700 dark:bg-gray-800 dark:text-darkText dark:focus:ring-offset-darkBg text-sm"
    value={l.classe_id}
 onChange={async (e) => {
   const cid = e.target.value;
   await getSubclasses(cid); // cache para esta classe
   // aplica a classe a TODAS as linhas do mesmo ticker e zera a subclasse
   const novoPreview = (prev => prev.map(row =>
     row.nome_investimento === l.nome_investimento
       ? { ...row, classe_id: cid, subclasse_id: '' }
       : row
   ));
   setPreview(novoPreview);
   // ainda não pergunta — vamos perguntar quando escolher a subclasse
 }}
  >
    <option value="">Selecione…</option>
    {classes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
  </select>
</td>
<td className="p-2">
  <select
 className="w-full h-6 px-2 rounded-md border border-gray-300 bg-white text-gray-800
            focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 focus:ring-offset-white
            dark:border-gray-700 dark:bg-gray-800 dark:text-darkText dark:focus:ring-offset-darkBg text-sm"
    value={l.subclasse_id}
    onFocus={() => l.classe_id && getSubclasses(l.classe_id)}
 onChange={(e) => {
   const sid = e.target.value;
   // guarda o "antes" (da linha focada)
   const prevAntes = { classe_id: l.classe_id, subclasse_id: l.subclasse_id };
   // aplica a subclasse a todas as linhas do MESMO ticker e MESMA classe
   setPreview(prev => prev.map(row =>
     row.nome_investimento === l.nome_investimento &&
     String(row.classe_id) === String(l.classe_id)
       ? { ...row, subclasse_id: sid }
       : row
   ));
   // pergunta 1x: retroativo ou só daqui pra frente? (com "antes")
   perguntarRetroativo(l.nome_investimento, l.classe_id, sid);
 }}
    disabled={!l.classe_id}
  >
    <option value="">{l.classe_id ? 'Selecione…' : 'Classe primeiro'}</option>
    {(subsCache[l.classe_id] || []).map(s => (
      <option key={s.id} value={s.id}>{s.nome}</option>
    ))}
  </select>
</td>
                      <td className="p-2 whitespace-nowrap">{dataParaBR(l.data_operacao)}</td>
                      <td className="p-2">{l.nome_investimento}</td>
                      <td className="p-2 capitalize">{l.tipo_operacao}</td>
                      <td className="p-2 text-right">{l.quantidade}</td>
 {(() => {
   const isProv = (l.tipo === 'DIVIDENDO' || l.tipo === 'JCP' || l.tipo === 'RENDIMENTO'
                  || l.tipo_operacao === 'provento' || l.valor_bruto != null);
   const qtd    = Number(l.quantidade || 0);
   const unit   = isProv ? (qtd > 0 ? Number(l.valor_bruto || 0) / qtd : 0)
                         : Number(l.valor_unitario || 0);
   const total  = isProv ? Number(l.valor_bruto || 0)
                         : Number(l.valor_total ?? (qtd * Number(l.valor_unitario || 0)));
   return (
     <>
       <td className="p-2 text-right">
         {unit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
       </td>
       <td className="p-2 text-right">
         {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
       </td>
     </>
   );
 })()}
  <td className="p-2">
    {l.duplicado ? (
      <span className="text-xs px-2 py-0.5 rounded bg-rose-300 dark:bg-rose-900/50 text-rose-900 dark:text-rose-200">
        Duplicado
      </span>
    ) : (
      <span className="text-xs px-2 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
        Novo
      </span>
    )}
  </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

<div className="mt-4 flex items-center justify-between">
  {/* Voltar (volta para a tela de upload — se não tiver handler, use setPreview([])) */}
  <button
    onClick={voltarParaUpload}
    className="inline-flex h-9 items-center gap-2 px-4 rounded-lg
               border border-gray-300 bg-white text-gray-700
               hover:bg-gray-50 active:scale-95 transition
               focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2
               dark:border-gray-700 dark:bg-gray-800 dark:text-darkText dark:hover:bg-gray-700 dark:focus:ring-offset-darkBg"
  >
    Voltar
  </button>

  <div className="flex gap-2">
    <button
      onClick={confirmar}
      className="inline-flex h-9 items-center gap-2 px-5 rounded-lg
                 bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow transition
                 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 dark:focus:ring-offset-darkBg
                 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!preview?.some(l => l.incluir)}
    >
      Importar
    </button>
  </div>
</div>
          </>
        )}
      </div>
    </div>
 {remapPrompt && (
   <div className="fixed inset-0 z-[210] bg-black/40 flex items-center justify-center p-4">
     <div className="bg-white dark:bg-darkCard rounded-xl shadow-xl w-full max-w-md p-5 border border-gray-200 dark:border-darkBorder">
       <h3 className="text-lg font-semibold text-gray-800 dark:text-darkText">Aplicar retroativamente?</h3>
       <p className="mt-2 text-sm text-gray-600 dark:text-darkMuted">
         Você alterou a classe/subclasse para <b>{remapPrompt.ticker}</b>. Deseja aplicar essa mudança aos lançamentos <b>anteriores</b>?
       </p>
       <div className="mt-5 flex flex-wrap justify-end gap-2">
         <button
           onClick={cancelarRemap}
           className="inline-flex h-9 items-center px-3 rounded-lg text-sm whitespace-nowrap
                      border border-gray-300 bg-white text-gray-700
                      hover:bg-gray-50 active:scale-95 transition
                      focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2
                      dark:border-gray-700 dark:bg-gray-800 dark:text-darkText dark:hover:bg-gray-700 dark:focus:ring-offset-darkBg"
         >
           Cancelar
         </button>
         <button
           onClick={apenasFuturo}
           className="inline-flex h-9 items-center px-3 rounded-lg text-sm whitespace-nowrap
                      border border-gray-300 bg-white text-gray-700
                      hover:bg-gray-50 active:scale-95 transition
                      focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2
                      dark:border-gray-700 dark:bg-gray-800 dark:text-darkText dark:hover:bg-gray-700 dark:focus:ring-offset-darkBg"
         >
           Só daqui pra frente
         </button>
         <button
           onClick={aplicarRetroativo}
           className="inline-flex h-9 items-center px-4 rounded-lg text-sm whitespace-nowrap
                      bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow transition
                      focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 dark:focus:ring-offset-darkBg"
         >
           Retroativo
         </button>
       </div>
     </div>
   </div>
 )}

    </div>
  );
}   