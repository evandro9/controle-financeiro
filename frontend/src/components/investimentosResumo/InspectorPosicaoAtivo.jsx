import React, { useEffect, useMemo, useState } from "react";
import InfoTip from "../ui/InfoTip";

function formatBRL(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pct(v) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toFixed(2)}%`;
}
function num(v, d = 6) {
  if (v === null || v === undefined) return "—";
  return Number(v).toFixed(d);
}

// 0.071 -> 7.10 ; 98.5 -> 98.50
function toPct(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? (n * 100) : n;
}

export default function InspectorPosicaoAtivo({ classeSelecionada }) {
  const [carregando, setCarregando] = useState(true);
  const [hierarquia, setHierarquia] = useState([]); // [{nome, subclasses:[{nome, ativos:[{nome,...}]}]}]
  const [subclasse, setSubclasse] = useState("");
  const [ativo, setAtivo] = useState("");

  const [dados, setDados] = useState(null);
  const [loadingDados, setLoadingDados] = useState(false);
  const [erro, setErro] = useState("");

  // 1) Carrega hierarquia (classe > subclasse > ativos)
  useEffect(() => {
    let mounted = true;
    setCarregando(true);
    setErro("");
    const raw = (localStorage.getItem("token") || "").trim();
    const auth = raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;

    fetch("/api/investimentos/rentabilidade-hierarquica", {
      headers: { Authorization: auth },
    })
      .then(async (r) => {
        if (!mounted) return;
        if (!r.ok) throw new Error("Falha ao carregar hierarquia");
        const data = await r.json();
        setHierarquia(Array.isArray(data) ? data : []);
      })
      .catch((e) => setErro(e.message || "Falha ao carregar hierarquia"))
      .finally(() => mounted && setCarregando(false));

    return () => {
      mounted = false;
    };
  }, []);

  // 1.1) Quando a classe global mudar, resetar seleção local
  useEffect(() => {
    setSubclasse("");
    setAtivo("");
    setDados(null);
    setErro("");
  }, [classeSelecionada]);

  const subclasses = useMemo(() => {
    if (!classeSelecionada) return [];
    const c = hierarquia.find((h) => h.nome === classeSelecionada);
    return c ? c.subclasses : [];
  }, [hierarquia, classeSelecionada]);

  const ativos = useMemo(() => {
    const s = subclasses.find((x) => x.nome === subclasse);
    return s ? s.ativos?.map((a) => a.nome) ?? [] : [];
  }, [subclasses, subclasse]);

  // 🧮 Peso do ativo dentro da subclasse (com base no 'atual' retornado pela hierarquia)
  const pesoNaSubclasse = useMemo(() => {
    if (!classeSelecionada || !subclasse || !ativo) return null;
    const c = hierarquia.find((h) => h.nome === classeSelecionada);
    const s = c?.subclasses?.find((x) => x.nome === subclasse);
    if (!s || !Array.isArray(s.ativos)) return null;
    const alvo = s.ativos.find((x) => x.nome === ativo);
    const totalSub = s.ativos.reduce((acc, x) => acc + (Number(x.atual) || 0), 0);
    const val = Number(alvo?.atual) || 0;
    if (!totalSub) return null;
    return (val / totalSub) * 100;
  }, [hierarquia, classeSelecionada, subclasse, ativo]);

  // 2) Ao escolher ativo, busca métricas
  useEffect(() => {
    if (!ativo) {
      setDados(null);
      return;
    }
    setLoadingDados(true);
    setErro("");
    const raw = (localStorage.getItem("token") || "").trim();
    const auth = raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
    const url = new URL("/api/investimentos/inspector", window.location.origin);
    url.searchParams.set("ativo", ativo);

    fetch(url.toString(), { headers: { Authorization: auth } })
      .then(async (r) => {
        if (!r.ok) throw new Error("Falha ao buscar dados do ativo");
        const data = await r.json();
        setDados(data);
      })
      .catch((e) => setErro(e.message || "Falha ao buscar dados do ativo"))
      .finally(() => setLoadingDados(false));
  }, [ativo]);

  return (
    <div className="w-full rounded-xl shadow p-4 border bg-white dark:bg-darkCard border-gray-100 dark:border-darkBorder">
      {/* Cabeçalho do card - título central e InfoTip à direita */}
      <div className="relative mb-4 flex items-center justify-center">
        <h3 className="text-base md:text-lg font-semibold text-gray-800 dark:text-darkText text-center">
          Detalhes do Ativo
        </h3>
        <div className="absolute right-0">
          <InfoTip title="Detalhes do Ativo" ariaLabel="Informações do componente">
            <ul className="list-disc pl-4 space-y-1">
              <li>Permite selecionar <b>subclasse</b> e <b>ativo</b> dentro da classe já escolhida no topo.</li>
              <li>Mostra informações como quantidade, preço médio, cotação, saldo e resultado.</li>
              <li>Inclui também o <b>peso do ativo</b> na subclasse.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      {/* Filtros (sem Classe) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-center text-gray-600 dark:text-darkMuted mb-1">
            Subclasse
          </label>
          <select
            className="w-full rounded border px-2.5 py-2 bg-white dark:bg-darkBg text-gray-800 dark:text-darkText border-gray-300 dark:border-darkBorder outline-none focus:ring-2 focus:ring-blue-500"
            value={subclasse}
            onChange={(e) => {
              setSubclasse(e.target.value);
              setAtivo("");
            }}
            disabled={!classeSelecionada || carregando}
          >
            <option value="">Selecione…</option>
            {subclasses.map((s) => (
              <option key={s.nome} value={s.nome}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-center text-gray-600 dark:text-darkMuted mb-1">
            Ativo
          </label>
          <select
            className="w-full rounded border px-2.5 py-2 bg-white dark:bg-darkBg text-gray-800 dark:text-darkText border-gray-300 dark:border-darkBorder outline-none focus:ring-2 focus:ring-blue-500"
            value={ativo}
            onChange={(e) => setAtivo(e.target.value)}
            disabled={!subclasse || carregando}
          >
            <option value="">Selecione…</option>
            {ativos.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado vazio/erros */}
      {erro && (
        <div className="mt-4 text-sm text-red-600 dark:text-red-400">{erro}</div>
      )}

      {!erro && !classeSelecionada && (
        <div className="mt-4 text-sm text-gray-600 dark:text-darkMuted">
          Selecione uma <span className="font-medium">Classe</span> no topo da
          página para continuar.
        </div>
      )}

      {!erro && classeSelecionada && !ativo && (
        <div className="mt-4 text-sm text-gray-600 dark:text-darkMuted">
          Selecione <span className="font-medium">subclasse</span> e{" "}
          <span className="font-medium">ativo</span> para visualizar as métricas.
        </div>
      )}

      {/* Cards de métricas */}
  {loadingDados ? (
    // Skeleton padrão enquanto calcula/busca
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
      <div className="h-24 rounded-xl bg-gray-200/70 dark:bg-gray-700/50" />
      <div className="h-24 rounded-xl bg-gray-200/70 dark:bg-gray-700/50" />
      <div className="h-24 rounded-xl bg-gray-200/70 dark:bg-gray-700/50" />
      <div className="h-24 rounded-xl bg-gray-200/70 dark:bg-gray-700/50" />
    </div>
  ) : (dados && (
    <>
      {(['rf','td'].includes(String(dados.tipo))) ? (
        // 🟦 Layout para Renda Fixa / Tesouro Direto
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <CardMetric titulo="Valor Aplicado" valor={formatBRL(dados.valor_aplicado)} />
          <CardMetric titulo="Saldo Bruto (Atual)" valor={formatBRL(dados.saldo_bruto)} />
          <CardMetric 
            titulo="Resultado" 
            valor={formatBRL(dados.resultado)} 
            destaque={dados.resultado > 0 ? "positivo" : (dados.resultado < 0 ? "negativo" : "neutro")}
          />
          <CardMetric
            titulo="Rentab. Acumulada"
            valor={
              (dados.valor_aplicado > 0)
                ? `${(((dados.saldo_bruto - dados.valor_aplicado) / dados.valor_aplicado) * 100).toFixed(2)}%`
                : "—"
            }
          />
          <CardMetric
            titulo="Indexador"
            valor={(() => {
              const rf = dados.rf || {};
              const idx = (rf.indexador || '').toUpperCase();
              if (!idx) return "—";
              if (idx === 'CDI') {
                const p = toPct(rf.percentual_cdi);
                return (p == null) ? 'CDI' : `${p.toFixed(2)}% do CDI`;
              }
              if (idx === 'IPCA') {
                const aa = toPct(rf.taxa_anual);
                return (aa == null) ? 'IPCA' : `IPCA + ${aa.toFixed(2)}% a.a.`;
              }
              if (idx === 'SELIC') return 'SELIC';
              if (idx === 'PRE') {
                const aa = toPct(rf.taxa_anual);
                return (aa == null) ? 'Pré' : `${aa.toFixed(2)}% a.a. (pré)`;
              }
              return idx;
            })()}
          />
          <CardMetric
            titulo="Vencimento"
            valor={dados?.rf?.vencimento ? new Date(dados.rf.vencimento + "T00:00:00").toLocaleDateString('pt-BR') : "—"}
          />
          <CardMetric
            titulo="Come-Cotas"
            valor={(dados?.rf?.come_cotas ? "Sim" : "Não")}
          />
          <CardMetric
            titulo="Peso na Subclasse"
            valor={pesoNaSubclasse == null ? "—" : pct(pesoNaSubclasse)}
          />
        </div>
      ) : (
        // 🟩 Layout para Renda Variável (como já era)
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"> 
          <CardMetric titulo="Quantidade" valor={num(dados.quantidade, 4)} />
          <CardMetric titulo="Preço Médio" valor={formatBRL(dados.preco_medio)} />
          <CardMetric
            titulo="Rentab. sobre PM"
            valor={pct(dados.rent_sobre_preco_medio)}
          />
          <CardMetric
            titulo="Última Cotação"
            valor={
              dados.ultima_cotacao != null
                ? formatBRL(dados.ultima_cotacao)
                : "—"
            }
          />
          <CardMetric titulo="Valor Aplicado" valor={formatBRL(dados.valor_aplicado)} />
          <CardMetric titulo="Saldo Bruto" valor={formatBRL(dados.saldo_bruto)} />
          <CardMetric
            titulo="Resultado"
            valor={formatBRL(dados.resultado)}
            destaque={
              dados.resultado > 0
                ? "positivo"
                : dados.resultado < 0
                ? "negativo"
                : "neutro"
            }
          />
          <CardMetric
            titulo="Peso na Subclasse"
            valor={pesoNaSubclasse == null ? "—" : pct(pesoNaSubclasse)}
          />
        </div>
      )}
    </>
  ))}
    </div>
  );
}

function CardMetric({ titulo, valor, destaque }) {
  const color =
    destaque === "positivo"
      ? "text-green-600 dark:text-[#3fb950]"
      : destaque === "negativo"
      ? "text-red-600 dark:text-[#f85149]"
      : "text-gray-800 dark:text-darkText";

  return (
    <div className="rounded border bg-white dark:bg-darkCard p-4 shadow border-gray-100 dark:border-darkBorder">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-darkMuted">
        {titulo}
      </div>
      <div className={`mt-1 text-lg font-semibold ${color}`}>{valor}</div>
    </div>
  );
}