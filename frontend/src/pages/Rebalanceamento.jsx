import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
import useFirstLoginTour from '../hooks/useFirstLoginTour';
import { getRebalanceSteps, getRebalanceMobileNoticeSteps } from '../tour/steps/rebalanceamento';

import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer, Legend } from 'recharts';
import { SlidersHorizontal } from 'lucide-react';
import { toast } from 'react-hot-toast';
import InfoTip from '../components/ui/InfoTip';
import { ThemeContext } from '../context/ThemeContext';
import { RequireFeature } from '../context/PlanContext.jsx';
import UpsellPremium from '../components/UpsellPremium.jsx';

// ===== Cores Dinâmicas por GRÁFICO (HSL com ângulo áureo) =====
// Evita “cores parecidas” mesmo com poucas fatias, em light/dark.
const hash = (s='') => { let x=0; for (let i=0;i<s.length;i++) x=(x*31 + s.charCodeAt(i))>>>0; return x; };
const hsl = (h, s, l) => `hsl(${Math.round(h)%360} ${Math.round(s)}% ${Math.round(l)}%)`;
const buildChartPalette = (names = [], darkMode = false) => {
  const n = Math.max(1, names.length);
  const seed = names.reduce((acc, nm) => (acc + hash(String(nm))), 0) % 360;
  const step = 137.508; // golden-angle
  const sat = darkMode ? 72 : 68;
  const baseL = darkMode ? 52 : 52;
  const vary = 6;
  const arr = [];
  for (let i = 0; i < n; i++) {
    const hue = (seed + i * step) % 360;
    let l = baseL + ((i % 2 === 0) ? +vary : -vary);

    // Ajuste específico: clarear vermelhos (0–30° e 330–360°) e roxos (260–300°)
    if ((hue >= 330 || hue < 30) || (hue >= 260 && hue <= 300)) {
      l += darkMode ? 10 : 8;
    }

    arr.push(hsl(hue, sat, l));
  }
  return arr;
};

// ---- Formatadores ----
const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// ================== Normalização de percentuais (fecha 100,00%) ==================
const roundTo = (num, dec = 2) => {
  const f = Math.pow(10, dec);
  return Math.round((Number(num) || 0) * f) / f;
};

// Hamilton / Maiores Restos — garante soma = 100.00
const normalizeMapPercents = (obj = {}, dec = 2) => {
  const keys = Object.keys(obj || {});
  if (keys.length === 0) return {};
  const f = Math.pow(10, dec);

  // 1) coleta valores numéricos
  const raw = keys.map(k => ({ k, v: Number(obj[k]) || 0 }));
  // 2) corta para baixo (floor) em dec casas
  const floored = raw.map(({ k, v }) => ({ k, vFloor: Math.floor(v * f) / f, frac: (v * f) - Math.floor(v * f) }));
  let sum = floored.reduce((a, b) => a + b.vFloor, 0);
  // 3) quanto falta/sobra para 100.00?
  let resid = roundTo(100 - sum, dec); // pode ser positivo, zero ou negativo

  // 4) ordena por maior fração (se resid > 0) ou menor fração (se resid < 0)
  //    cada passo ajusta em 0.01 (ou 1/f) até consumir o resíduo
  const step = 1 / f;
  if (Math.abs(resid) >= step / 2) {
    const sorted = floored
      .map(x => ({ ...x }))
      .sort((a, b) => resid > 0 ? (b.frac - a.frac) : (a.frac - b.frac));
    let i = 0;
    const dir = resid > 0 ? 1 : -1;
    let ticks = Math.round(Math.abs(resid) * f); // quantidade de passos de 0.01
    while (ticks > 0 && sorted.length > 0) {
      sorted[i].vFloor = roundTo(sorted[i].vFloor + dir * step, dec);
      i = (i + 1) % sorted.length;
      ticks--;
    }
    // reconstrói nas chaves originais
    const out = {};
    sorted.forEach(({ k, vFloor }) => (out[k] = roundTo(vFloor, dec)));
    return out;
  } else {
    // já está “na tampa”
    const out = {};
    floored.forEach(({ k, vFloor }) => (out[k] = roundTo(vFloor, dec)));
    return out;
  }
};

// Tooltip no padrão dos gráficos do sistema (baseado no GraficoPizzaDistribuicao)
const CustomTooltip = ({ active, payload, isPercent, darkMode }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const nome = p?.payload?.name ?? p?.name ?? '';
  const valor = Number(p?.value || 0);
  const cor = p?.color || p?.payload?.fill || '#999';
  const percent = p?.payload && p?.payload.__totalGeral > 0
    ? (valor / p.payload.__totalGeral) * 100
    : 0;
  return (
    <div
      className="p-2 rounded shadow"
      style={{
        background: darkMode ? '#0b1220' : '#ffffff',
        border: darkMode ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
        color: darkMode ? '#cbd5e1' : '#1f2937',
      }}
    >
      <div className="flex items-center gap-2 font-semibold mb-1">
        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, backgroundColor: cor }} />
        {nome}
      </div>
      {!isPercent && (
        <div style={{ fontSize: 12 }}>
          <span style={{ opacity: 0.8 }}>Total:</span> {fmtBRL.format(valor)}
        </div>
      )}
      <div style={{ fontSize: 12 }}>
        <span style={{ opacity: 0.8 }}>Percentual:</span>{' '}
        {(isPercent ? valor : percent).toFixed(1)}%
      </div>
    </div>
  );
};

// Toggle com o MESMO padrão visual do GraficoPizzaDistribuicao
// (borda arredondada grande, hovers e cores iguais)
const ToggleNivel = ({ nivel, onChange }) => (
  <div className="inline-flex rounded-xl overflow-hidden border border-gray-200 dark:border-darkBorder">
    <button
      onClick={() => onChange('classe')}
      className={`px-3 py-1 text-xs sm:text-sm transition-colors ${
        nivel === 'classe'
          ? 'bg-blue-600 text-white dark:text-white'
          : 'bg-white text-gray-700 hover:bg-blue-50 dark:bg-darkBg dark:text-darkText dark:hover:bg-[#1e293b]'
      }`}
    >
      Classe
    </button>
    <button
      onClick={() => onChange('subclasse')}
      className={`px-3 py-1 text-xs sm:text-sm transition-colors ${
        nivel === 'subclasse'
          ? 'bg-blue-600 text-white dark:text-white'
          : 'bg-white text-gray-700 hover:bg-blue-50 dark:bg-darkBg dark:text-darkText dark:hover:bg-[#1e293b]'
      }`}
    >
      Subclasse
    </button>
  </div>
);

// Header: 3 colunas (toggle | título centralizado | infotip no canto)
// Aceita 'infoContent' (ReactNode) para textos mais ricos por gráfico.
const HeaderGrafico = ({ titulo, nivel, onNivelChange, infoText, infoContent, infoId }) => {
  return (
    <div className="grid [grid-template-columns:1fr_auto_1fr] items-center mb-2 min-w-0 relative">
      {/* Toggle (esq) */}
      <div className="flex items-center gap-2 min-w-0">
        <ToggleNivel nivel={nivel} onChange={onNivelChange} />
      </div>
      {/* Título 100% centralizado */}
      <h3 className="text-lg font-semibold text-gray-800 dark:text-darkText text-center whitespace-nowrap">
        {titulo}
      </h3>
      {/* InfoTip no canto superior direito (padrão da tabela) */}
      <div className="justify-self-end">
        <div id={infoId ?? 'infotip-grafico'} className="text-gray-500 dark:text-gray-400">
          <InfoTip title="Sobre este gráfico" ariaLabel="Informações do gráfico" width="w-80">
            {infoContent ? (
              // Força tipografia e cor idênticas à da InfoTip da tabela
              <div className="text-xs text-gray-700 dark:text-gray-200">{infoContent}</div>
            ) : (
              <ul className="list-disc pl-4 space-y-1 text-xs text-gray-700 dark:text-gray-200">
                <li className="leading-snug">{infoText}</li>
              </ul>
            )}
          </InfoTip>
        </div>
      </div>
    </div>
  );
};

const GraficoDistribuicaoAtual = React.memo(({ data, nivel, onNivelChange }) => {
  const { darkMode } = useContext(ThemeContext);
  // injeta total no payload para cálculo do % (memo p/ manter referência estável e evitar “piscar” no outro gráfico)
  const dataComTotal = useMemo(() => {
    const arr = Array.isArray(data) ? data : [];
    const total = arr.reduce((a, b) => a + Number(b?.value || 0), 0);
    return arr.map(d => ({ ...d, __totalGeral: total }));
  }, [data]);

  const paletteAtual = useMemo(
    () => buildChartPalette((dataComTotal||[]).map(d => d?.name ?? ''), darkMode),
    [dataComTotal, darkMode]
  );

  return (
    <>
      <HeaderGrafico
        titulo="Distribuição Atual"
        nivel={nivel}
        onNivelChange={onNivelChange}
        infoId="infotip-distribuicao-atual"
        infoContent={
          <ul className="list-disc pl-4 space-y-1 text-xs text-gray-700 dark:text-gray-200">
            <li className="leading-snug">Mostra como sua carteira está <b>hoje</b>, por <b>{nivel}</b> (Classe/Subclasse).</li>
            <li className="leading-snug">Passe o mouse para ver o <b>%</b> e o <b>total</b> de cada fatia.</li>
            <li className="leading-snug">Use o toggle para alternar a visão entre <b>Classe</b> e <b>Subclasse</b>.</li>
          </ul>
        }
      />
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={dataComTotal}
          dataKey="value"
          nameKey="name"
          cx="40%"
          cy="50%"
          innerRadius={55}          /* ROSCA */
          outerRadius={90}
          padAngle={2}              /* separação extra entre fatias */
          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
          labelLine={false}
          stroke={darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}
          strokeWidth={2}
        >
            {dataComTotal.map((entry, index) => (
              <Cell key={index} fill={paletteAtual[index % paletteAtual.length]} />
            ))}
        </Pie>
          <RTooltip
            cursor={{ fill: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
            content={<CustomTooltip isPercent={false} darkMode={darkMode} />}
          />
        <Legend layout="vertical" verticalAlign="middle" align="right" />
      </PieChart>
    </ResponsiveContainer>
    </>
  );
});

// ---------- GRAF. DISTRIBUIÇÃO DESEJADA ----------
// Regras:
//  • Nível = "classe": usa percentuaisDesejadosClasse diretamente.
//  • Nível = "subclasse": valor desejado da subclasse = pctClasse * pctInternoSub / 100,
//    onde pctClasse vem de percentuaisDesejadosClasse[classe] e pctInternoSub de percentuaisSubPorClasse[classe][sub].
//    Se uma subclasse existir em mais de uma classe, soma as contribuições.
const GraficoDistribuicaoDesejada = React.memo(
  ({
    nivel,
    onNivelChange,
    percentuaisDesejadosClasse,     // { classe: % }
    percentuaisSubPorClasse         // { classe: { sub: %dentroClasse } }
  }) => {
    const { darkMode } = useContext(ThemeContext);

    // dados (memo) conforme nível
    const dados = useMemo(() => {
      if (nivel === 'classe') {
        // classe → % direto
        return Object.entries(percentuaisDesejadosClasse || {}).map(([classe, pct]) => ({
          name: classe,
          value: Number(pct) || 0
        }));
      }
      // subclasse → somatório de (pctClasse × pctInterno / 100)
      const acc = {};
      Object.entries(percentuaisSubPorClasse || {}).forEach(([classe, mapaSubs]) => {
        const pctClasse = Number((percentuaisDesejadosClasse || {})[classe] || 0);
        Object.entries(mapaSubs || {}).forEach(([sub, pctInterno]) => {
          const contrib = (pctClasse * Number(pctInterno || 0)) / 100;
          acc[sub] = (acc[sub] || 0) + contrib;
        });
      });
      return Object.entries(acc).map(([sub, pct]) => ({ name: sub, value: Number(pct) || 0 }));
    }, [nivel, percentuaisDesejadosClasse, percentuaisSubPorClasse]);

    // injeta total (memo) para tooltip padronizada
    const dadosComTotal = useMemo(() => {
      const total = (dados || []).reduce((a, b) => a + Number(b.value || 0), 0);
      return (dados || []).map(d => ({ ...d, __totalGeral: total }));
    }, [dados]);

    const paletteDesejada = useMemo(
      () => buildChartPalette((dadosComTotal||[]).map(d => d?.name ?? ''), darkMode),
      [dadosComTotal, darkMode]
    );

    return (
      <>
        <HeaderGrafico
          titulo="Distribuição Desejada"
          nivel={nivel}
          onNivelChange={onNivelChange}
          infoId="infotip-distribuicao-desejada"
          infoContent={
            <ul className="list-disc pl-4 space-y-1 text-xs text-gray-700 dark:text-gray-200">
              <li className="leading-snug">Defina a <b>alocação alvo</b> por <b>{nivel}</b>. Cada nível deve somar <b>100%</b>.</li>
              <li className="leading-snug">Em <b>Subclasse</b>, o % de cada sub é <i>proporcional</i> à Classe: <code>pctClasse × pctInterno/100</code>.</li>
              <li className="leading-snug">A coluna “Movimentação” indica quanto investir/resgatar para atingir a meta.</li>
            </ul>
          }
        />
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={dadosComTotal}
              dataKey="value"
              nameKey="name"
              cx="40%"
              cy="50%"
              innerRadius={55}          /* ROSCA */
              outerRadius={90}
              padAngle={2}              /* separação extra entre fatias */
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              labelLine={false}
              stroke={darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}
              strokeWidth={2}
            >
              {dadosComTotal.map((d, index) => (
                <Cell key={index} fill={paletteDesejada[index % paletteDesejada.length]} />
              ))}
            </Pie>
            <RTooltip
              cursor={{ fill: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
              content={<CustomTooltip isPercent={true} darkMode={darkMode} />}
            />
            <Legend layout="vertical" verticalAlign="middle" align="right" />
          </PieChart>
        </ResponsiveContainer>
      </>
    );
  }
);

function Rebalanceamento() {
  const [porSubclasseAtual, setPorSubclasseAtual] = useState([]);
  const [porClasseAtual, setPorClasseAtual] = useState([]);
  // agrupado por SUBCLASSE (mantido para a edição de % e ativos)
  const [agrupado, setAgrupado] = useState({});
  // NOVO: agrupado por CLASSE → { total, subclasses: { sub: { total, ativos:{} } } }
  const [agrupadoPorClasse, setAgrupadoPorClasse] = useState({});
  const [mapaSubParaClasse, setMapaSubParaClasse] = useState({});
  const [percentuaisDesejados, setPercentuaisDesejados] = useState({});
  const [percentuaisDesejadosClasse, setPercentuaisDesejadosClasse] = useState({});
  const [classeExpandida, setClasseExpandida] = useState(null);
  const [subclasseExpandida, setSubclasseExpandida] = useState(null); // armazenaremos "Classe::Subclasse"
  const [percentuaisInternos, setPercentuaisInternos] = useState({});
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);
  // 🔸 Estados separados para os dois gráficos (independentes):
  const [nivelGraficoAtual, setNivelGraficoAtual] = useState('classe');    // 'classe' | 'subclasse'
  const [nivelGraficoDesejado, setNivelGraficoDesejado] = useState('classe'); // 'classe' | 'subclasse'
  // Handlers MEMOIZADOS para evitar passar novas referências e disparar re-render desnecessário no “outro” gráfico
  const onChangeNivelAtual = useCallback((nv) => setNivelGraficoAtual(nv), []);
  const onChangeNivelDesejado = useCallback((nv) => setNivelGraficoDesejado(nv), []);

  useEffect(() => {
    carregarDados();
  }, []);

  // % interno das subclasses DENTRO de cada classe (cada classe soma 100%)
  const [percentuaisSubPorClasse, setPercentuaisSubPorClasse] = useState({});

 // Atualiza % interno de uma subclasse dentro da classe
const handleChangeSubDentroClasse = (classe, sub, val) => {
  setPercentuaisSubPorClasse(prev => {
    const atual = prev?.[classe] || {};
    return { ...prev, [classe]: { ...atual, [sub]: Number(val) || 0 } };
  });
};

  // Gera % interno igualitário para cada classe com base no agrupadoPorClasse
  const gerarSubDentroClassePadrao = (mapaClasse) => {
    const novo = {};
    Object.entries(mapaClasse || {}).forEach(([classe, info]) => {
      const subs = Object.keys(info?.subclasses || {});
      if (subs.length === 0) return;
      const igual = +(100 / subs.length).toFixed(2);
      novo[classe] = {};
      subs.forEach(s => { novo[classe][s] = igual; });
    });
    setPercentuaisSubPorClasse(novo);
  };

// Quando existir distribuição FLAT por subclasse vinda do backend, normaliza por classe
const normalizarFlatParaInterno = (mapaClasse, percentuaisFlat) => {
  const novo = {};
  Object.entries(mapaClasse || {}).forEach(([classe, info]) => {
    const subs = Object.keys(info?.subclasses || {});
    const somaFlat = subs.reduce((acc, sub) => acc + parseFloat(percentuaisFlat?.[sub] || 0), 0);
    novo[classe] = {};
    subs.forEach(sub => {
      const flatSub = parseFloat(percentuaisFlat?.[sub] || 0);
      // se a classe não tiver flat somado (>0), cai no igualitário
      novo[classe][sub] = somaFlat > 0 ? +( (flatSub / somaFlat) * 100 ).toFixed(2) : +(100 / subs.length).toFixed(2);
    });
  });
  setPercentuaisSubPorClasse(novo);
};

  // pega "valor atual" com fallback:
  // 1) usa campos diretos (valor_atual, saldo_bruto, etc.);
  // 2) se não vier, calcula: quantidade × cotação (quando disponíveis).
  const valorAtualDe = (inv) => {
    const num = (v) =>
      typeof v === 'number'
        ? v
        : Number(String(v ?? '').replace(/[^\d,-.\d]/g, '').replace('.', '').replace(',', '.')) || 0;
    // tentativas de campos diretos enviados por diferentes rotas/controllers
    const direto =
      inv.valor_atual ?? inv.valorAtual ?? inv.atual ??
      inv.saldo_bruto ?? inv.saldoBruto ?? inv.saldo ??
      inv.valor ?? inv.market_value ?? inv.marketValue ?? null;
    const d = num(direto);
    if (d > 0) return d;
    // tenta construir via quantidade × preço/cotação
    const qtd =
      num(inv.quantidade ?? inv.qtd ?? inv.qtde ?? inv.qtd_total ?? inv.qtdTotal);
    const preco =
      num(inv.cotacao_atual ?? inv.cotacao ?? inv.preco_ultimo ?? inv.preco ?? inv.valor_unitario);
    if (qtd > 0 && preco > 0) return qtd * preco;
    return 0;
  };

const carregarDados = async () => {
  const token = localStorage.getItem('token');
  setCarregando(true);
  try {
    const [resHier, resDistrib] = await Promise.all([
      fetch('/api/investimentos/rentabilidade-hierarquica', {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch('/api/investimentos/rebalanceamento', {
        headers: { Authorization: `Bearer ${token}` }
      }),
    ]);

    const hier = await resHier.json();
    const distrib = await resDistrib.json();

    // Calcula agregados por CLASSE e SUBCLASSE a partir da hierarquia:
    // hier: [{ nome (classe), subclasses: [{ nome (subclasse), ativos: [{ nome, atual }] }] }]
    let atuais = [];
    const mapaClasse = {};   // { [classe]: totalR$ }
    const mapaSub = {};      // { [subclasse]: totalR$ }

    if (Array.isArray(hier)) {
      hier.forEach(cl => {
        const nomeClasse = cl?.nome || 'Outros';
        let totalClasse = 0;
        (cl.subclasses || []).forEach(sc => {
          const nomeSub = sc?.nome || 'Outros';
          let totalSub = 0;
          (sc.ativos || []).forEach(a => {
            const atual = Number(a?.atual || 0);
            atuais.push({
              classe: nomeClasse,
              subcategoria: nomeSub,
              nome_investimento: a?.nome || 'Desconhecido',
              valor_atual: atual,
            });
            totalSub += atual;
            totalClasse += atual;
          });
          mapaSub[nomeSub] = (mapaSub[nomeSub] || 0) + totalSub;
        });
        mapaClasse[nomeClasse] = (mapaClasse[nomeClasse] || 0) + totalClasse;
      });
    }

    processarDistribuicao(atuais, distrib, mapaClasse, mapaSub);
  } catch (e) {
    console.error('[Rebalanceamento] Falha ao carregar dados', e);
    // opcional: mostrar um toast/alerta aqui
    processarDistribuicao([], null, {}, {});
  } finally {
    setCarregando(false);
  }
};

  const gerarDistribuicaoPadrao = (subMap, agrupadoMap) => {
    const totalSubclasses = Object.keys(subMap).length;
    const igualPorSubclasse = (100 / totalSubclasses).toFixed(2);
    const desejados = {};

    for (let sub in subMap) {
      desejados[sub] = igualPorSubclasse;
    }

    const internos = {};
    for (let sub in agrupadoMap) {
      const ativos = Object.keys(agrupadoMap[sub].ativos);
      const igualPorAtivo = (100 / ativos.length).toFixed(2);
      internos[sub] = {};
      ativos.forEach(a => {
        internos[sub][a] = igualPorAtivo;
      });
    }

    setPercentuaisDesejados(desejados);
    setPercentuaisInternos(internos);
  };

const gerarDistribuicaoClassePadrao = (classeMap) => {
  const chaves = Object.keys(classeMap);
  if (chaves.length === 0) return;
  const igual = (100 / chaves.length).toFixed(2);
  const m = {};
  chaves.forEach(c => { m[c] = igual; });
  setPercentuaisDesejadosClasse(m);
};

const processarDistribuicao = (data, distrib = null, classeMap = {}, subMapArg = {}) => {
  // Mapas auxiliares
  const subMap = {};               // totais por subclasse
  const subParaClasse = {};        // subclasse -> classe
  const mapaSubclasse = {};        // { sub: { total, ativos: {} } }
  const mapaClasse = {};           // { classe: { total, subclasses: { sub: { total, ativos: {} } } } }

  data.forEach((inv) => {
    const classe = inv.classe || 'Outros';
    const sub = inv.subcategoria || 'Outros';
    const ativo = inv.nome_investimento || 'Desconhecido';
    const atual = valorAtualDe(inv);

    subParaClasse[sub] = subParaClasse[sub] || classe;

    // Subclasse
    subMap[sub] = (subMap[sub] || 0) + atual;
    if (!mapaSubclasse[sub]) mapaSubclasse[sub] = { total: 0, ativos: {} };
    mapaSubclasse[sub].ativos[ativo] = (mapaSubclasse[sub].ativos[ativo] || 0) + atual;
    mapaSubclasse[sub].total += atual;

    // Classe (com hierarquia)
    if (!mapaClasse[classe]) mapaClasse[classe] = { total: 0, subclasses: {} };
    if (!mapaClasse[classe].subclasses[sub]) mapaClasse[classe].subclasses[sub] = { total: 0, ativos: {} };
    mapaClasse[classe].total += atual;
    mapaClasse[classe].subclasses[sub].total += atual;
    mapaClasse[classe].subclasses[sub].ativos[ativo] =
      (mapaClasse[classe].subclasses[sub].ativos[ativo] || 0) + atual;
  });

  // Arrays p/ gráficos
  setPorSubclasseAtual(Object.entries(subMap).map(([name, value]) => ({ name, value })));
  setPorClasseAtual(Object.entries(classeMap).map(([name, value]) => ({ name, value })));

  // Estados estruturados p/ tabela
  setAgrupado(mapaSubclasse);
  setAgrupadoPorClasse(mapaClasse);
  setMapaSubParaClasse(subParaClasse);

  // Distribuições
  if (distrib) {
    // 1) Hidrata mapas vindos do back
    const mapClasse = distrib.percentuaisClasse || {};
    const mapSubDentro = distrib.percentuaisSubPorClasse || {};
    const mapFlatSub = distrib.percentuais || {};
    const mapAtivos = distrib.internos || {};

    setPercentuaisDesejadosClasse(mapClasse);
    setPercentuaisSubPorClasse(mapSubDentro);
    setPercentuaisInternos(mapAtivos);

    // 2) Preserve o que veio do back:
    const temSubDentro = Object.keys(mapSubDentro).length > 0;
    const temFlat      = Object.keys(mapFlatSub).length > 0;
    const temClasse    = Object.keys(mapClasse).length > 0;

    if (temSubDentro) {
      // Se temos o interno por classe vindo do back, NÃO sobrescreve!
      if (temFlat) {
        // Flat veio do back: usa direto
        setPercentuaisDesejados(mapFlatSub);
      } else if (temClasse) {
        // Sem flat: deriva flat = %classe * %internoDaClasse / 100
        const flat = {};
        Object.keys(mapClasse).forEach((c) => {
          const pctClasse = Number(mapClasse[c] || 0);
          const internos = mapSubDentro[c] || {};
          Object.keys(internos).forEach((sub) => {
            const pctInterno = Number(internos[sub] || 0);
            const pctGlobal = (pctClasse * pctInterno) / 100;
            flat[sub] = (flat[sub] || 0) + pctGlobal;
          });
        });
        setPercentuaisDesejados(flat);
      } else {
        // Não há classe definida (caso raro) — deixa vazio
        setPercentuaisDesejados({});
      }
      // IMPORTANTE: não chama normalizarFlatParaInterno aqui,
      // para NÃO sobrescrever mapSubDentro que veio do back.
    } else {
      // Não veio interno por classe do back:
      if (temFlat) {
        setPercentuaisDesejados(mapFlatSub);
        // Agora sim, derivamos o interno por classe a partir do flat:
        normalizarFlatParaInterno(mapaClasse, mapFlatSub); // hidrata percentuaisSubPorClasse
      } else {
        // Nada salvo: cai no igualitário gerado em outro fluxo
        // (se quiser, pode chamar gerarSubDentroClassePadrao(mapaClasse))
      }
    }
  } else {
    // gera padrões do zero
    gerarDistribuicaoPadrao(subMap, mapaSubclasse);
    gerarDistribuicaoClassePadrao(classeMap);
    gerarSubDentroClassePadrao(mapaClasse);
    // normalizações padrão
    setPercentuaisDesejadosClasse(prev => normalizeMapPercents(prev, 2));
    setPercentuaisSubPorClasse(prev => {
      const out = {};
      Object.keys(prev || {}).forEach(c => (out[c] = normalizeMapPercents(prev[c] || {}, 2)));
      return out;
    });
    setPercentuaisInternos(prev => {
      const out = {};
      Object.keys(prev || {}).forEach(s => (out[s] = normalizeMapPercents(prev[s] || {}, 2)));
      return out;
    });
  }
};

const handleChangeSub = (sub, val) => {
  const novo = { ...percentuaisDesejados, [sub]: val };
  setPercentuaisDesejados(novo);
};

const handleChangeClasse = (classe, val) => {
  setPercentuaisDesejadosClasse(prev => ({ ...prev, [classe]: Number(val) || 0 }));
};

const handleChangeInterno = (sub, ativo, val) => {
  setPercentuaisInternos(prev => {
    const atual = prev?.[sub] || {};
    return { ...prev, [sub]: { ...atual, [ativo]: Number(val) || 0 } };
  });
};

  // Tabela é por SUBCLASSE, então o totalGeral é sempre baseado em porSubclasseAtual
  const totalGeral = porSubclasseAtual.reduce((acc, cur) => acc + cur.value, 0);

  const podeSalvar = () => {
  const totalSub = Object.values(percentuaisDesejados).reduce((a, b) => a + parseFloat(b || 0), 0);
  if (Math.abs(totalSub - 100) > 0.01) return false;

 const chavesClasse = Object.keys(percentuaisDesejadosClasse || {});
 if (chavesClasse.length > 0) {
   const totalClasse = chavesClasse
     .reduce((a, k) => a + parseFloat(percentuaisDesejadosClasse[k] || 0), 0);
   if (Math.abs(totalClasse - 100) > 0.01) return false;
 }

  // Valida internos (se houver)
  for (const sub in percentuaisInternos) {
    const soma = Object.values(percentuaisInternos[sub]).reduce((a, b) => a + parseFloat(b || 0), 0);
    if (Math.abs(soma - 100) > 0.01) return false;
  }

  // Valida: para cada CLASSE, as subclasses devem somar 100%
  for (const c in (percentuaisSubPorClasse || {})) {
    const somaSub = Object
      .values(percentuaisSubPorClasse[c] || {})
      .reduce((a, b) => a + parseFloat(b || 0), 0);
    if (Math.abs(somaSub - 100) > 0.01) return false;
  }

  // Valida: para cada CLASSE, as subclasses devem somar 100%
  for (const c in (percentuaisSubPorClasse || {})) {
    const somaSub = Object
      .values(percentuaisSubPorClasse[c] || {})
      .reduce((a, b) => a + parseFloat(b || 0), 0);
    if (Math.abs(somaSub - 100) > 0.01) return false;
  }
  return true;
};

 // ---- helper de compatibilidade para backend antigo (flat por SUBCLASSE) ----
 function construirFlatSubclasse() {
   // Se já temos um flat explícito por subclasse (somando 100%), retorna ele
   if (percentuaisDesejados && Object.keys(percentuaisDesejados).length > 0) {
     return percentuaisDesejados;
   }
   // Caso contrário, deriva: %globalSub = %classe * %internoSub / 100
   const flat = {};
   const mapaInterno = percentuaisSubPorClasse || {};
   for (const classe in mapaInterno) {
     const pctClasse = parseFloat(percentuaisDesejadosClasse?.[classe] ?? 0) || 0;
     const internos = mapaInterno[classe] || {};
     for (const sub in internos) {
       const pctInterno = parseFloat(internos[sub] ?? 0) || 0;
       const pctGlobal = (pctClasse * pctInterno) / 100;
       flat[sub] = (flat[sub] || 0) + pctGlobal;
     }
   }
   return flat;
 }

const handleSalvar = async () => {
  // SANITIZA/FECHA 100% antes do POST
  const normClasse = normalizeMapPercents(percentuaisDesejadosClasse || {}, 2);
  const normSubPorClasse = {};
  Object.keys(percentuaisSubPorClasse || {}).forEach(c => {
    normSubPorClasse[c] = normalizeMapPercents(percentuaisSubPorClasse[c] || {}, 2);
  });
  const normInternos = {};
  Object.keys(percentuaisInternos || {}).forEach(s => {
    normInternos[s] = normalizeMapPercents(percentuaisInternos[s] || {}, 2);
  });
  if (!podeSalvar()) {
    alert("Certifique-se de que todas as distribuições somam exatamente 100%.");
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/investimentos/rebalanceamento", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
  // compat: flat por subclasse (para telas/rotas antigas)
    percentuais: construirFlatSubclasse(),     // compat
    percentuaisClasse: normClasse,
    percentuaisSubPorClasse: normSubPorClasse,
    internos: normInternos
      })
    });

if (res.ok) {
  toast.success('Distribuição salva com sucesso!');
} else {
  toast.error('Erro ao salvar. Tente novamente.');
}

  } catch (err) {
    console.error("Erro ao salvar distribuição:", err);
    toast.error('Erro ao salvar. Verifique a conexão ou tente novamente.');
  }
};

    const [hoverAviso, setHoverAviso] = useState(false);

  // Dados derivados para os gráficos conforme seus níveis selecionados
  const dataGraficoAtual = nivelGraficoAtual === 'classe' ? porClasseAtual : porSubclasseAtual;
  const percentuaisGraficoDesejado = nivelGraficoDesejado === 'classe' ? percentuaisDesejadosClasse : percentuaisDesejados;

  // Handlers independentes dos toggles
  const onToggleNivelAtual = (nivel) => {
    setNivelGraficoAtual(nivel);
    if (nivel === 'classe' && Object.keys(percentuaisDesejadosClasse).length === 0 && porClasseAtual.length > 0) {
      const mapa = Object.fromEntries(porClasseAtual.map(i => [i.name, i.value]));
      gerarDistribuicaoClassePadrao(mapa);
    }
  };
  const onToggleNivelDesejado = (nivel) => {
    setNivelGraficoDesejado(nivel);
    if (nivel === 'classe' && Object.keys(percentuaisDesejadosClasse).length === 0 && porClasseAtual.length > 0) {
      const mapa = Object.fromEntries(porClasseAtual.map(i => [i.name, i.value]));
      gerarDistribuicaoClassePadrao(mapa);
    }
  };   

  // ---- Tours (desktop x mobile)
  const stepsReb = useMemo(() => getRebalanceSteps(), []);
  const { maybeStart: maybeStartReb } = useFirstLoginTour('rebalanceamento_v1', stepsReb);
  const stepsRebMobile = useMemo(() => getRebalanceMobileNoticeSteps(), []);
  const { maybeStart: maybeStartRebMobile } = useFirstLoginTour('rebalanceamento_mobile_v1', stepsRebMobile);

  // Inicia o tour somente após o carregamento e com os alvos no DOM
  useEffect(() => {
    if (carregando) return;                        // 1) ainda carregando? sai
    if (!porClasseAtual.length && !porSubclasseAtual.length) return; // 2) sem dados? sai
    const haveTargets =
      typeof document !== 'undefined' &&
      document.querySelector('[data-tour="reb-dist-atual"]') &&
      document.querySelector('[data-tour="reb-dist-desejada"]') &&
      document.querySelector('[data-tour="reb-tabela-alocacao"]');
    if (!haveTargets) return;
    const isDesktop =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(min-width: 1024px)').matches; // >= lg
    const start = () => (isDesktop ? maybeStartReb() : maybeStartRebMobile());
    if ('requestAnimationFrame' in window) {
      requestAnimationFrame(() => setTimeout(start, 0));
    } else {
      setTimeout(start, 0);
    }
  }, [
    carregando,
    porClasseAtual.length,
    porSubclasseAtual.length,
    maybeStartReb,
    maybeStartRebMobile,
  ]);

  // Enquanto buscamos as cotações do Yahoo, mostra um loading e NÃO renderiza os gráficos/tabelas
  if (carregando) {
    return (
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
          <h2 className="text-lg sm:text-xl leading-tight font-semibold flex items-center gap-2 text-gray-800 dark:text-darkText">
            <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
            Rebalanceamento de Investimentos
          </h2>
          <p className="text-sm text-gray-600 dark:text-darkMuted">
            Defina a alocação ideal por subclasse e valide os percentuais antes de salvar.
          </p>
          <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
        </section>
        <section className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-sm bg-white dark:bg-darkCard border border-gray-200 dark:border-darkBorder">
            <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-indigo-500 animate-spin" />
            <span className="text-sm text-gray-700 dark:text-gray-200">Carregando cotações do Yahoo…</span>
          </div>
        </section>
      </div>
    );
  }

  return (
  <RequireFeature feature="investimentos" fallback={<UpsellPremium title="Rebalanceamento" />}>
  <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
    {/* Header */}
    <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
      <h2 className="text-lg sm:text-xl leading-tight font-semibold flex items-center gap-2 text-gray-800 dark:text-darkText">
        <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
        Rebalanceamento de Investimentos
      </h2>
      <p className="text-sm text-gray-600 dark:text-darkMuted">
        Defina a alocação desejada e ajuste os percentuais conforme sua estratégia.
      </p>
      <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
    </section>

    {/* Aviso MOBILE: experiência completa apenas no desktop */}
    <section className="sm:hidden px-4 py-4 rounded-xl shadow bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder">
      <p className="text-sm text-gray-700 dark:text-darkText">
        Esta página é otimizada para <strong>desktop</strong> (gráficos, tabela hierárquica e edição de percentuais).
        Acesse em um computador para usar todos os recursos.
      </p>
    </section>

    {/* Conteúdo principal (oculto no mobile) */}
    <section className="hidden sm:block space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 border border-gray-100 dark:border-darkBorder" data-tour="reb-dist-atual">
        <GraficoDistribuicaoAtual
          data={nivelGraficoAtual === 'classe' ? porClasseAtual : porSubclasseAtual}
          nivel={nivelGraficoAtual}
          onNivelChange={onChangeNivelAtual}
        />
        </div>
        <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 border border-gray-100 dark:border-darkBorder" data-tour="reb-dist-desejada">
        <GraficoDistribuicaoDesejada
          nivel={nivelGraficoDesejado}
          onNivelChange={onChangeNivelDesejado}
          percentuaisDesejadosClasse={percentuaisDesejadosClasse}
          percentuaisSubPorClasse={percentuaisSubPorClasse}
        />
        </div>
      </div>

      <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 overflow-auto border border-gray-100 dark:border-darkBorder" data-tour="reb-tabela-alocacao">
        {/* Header da Tabela: título CENTRALIZADO + InfoTip no canto superior direito */}
        <div className="relative mb-2">
          {/* InfoTip (canto superior direito) */}
          <div id="infotip-alocacao-classe" className="absolute top-0 right-3">
            <InfoTip
              title="Sobre esta tabela"
              ariaLabel="Informações da tabela de alocação por classe"
              width="w-80"
            >
              <ul className="list-disc pl-4 space-y-1">
                <li>Mostra a <b>distribuição atual</b> por <b>classe</b>, com detalhamento por <b>subclasse</b> e <b>ativos</b>.</li>
                <li>Edite <b>% Ideal</b> por classe e por subclasse (dentro da classe) para compor a alocação alvo.</li>
                <li>A coluna <b>Movimentação</b> indica quanto investir/resgatar para atingir a meta.</li>
                <li>Para salvar, todos os percentuais devem somar <b>100%</b> nos níveis exibidos.</li>
              </ul>
            </InfoTip>
          </div>
          {/* Título centralizado */}
          <h3 className="text-lg text-center font-semibold text-gray-800 dark:text-darkText">
            Alocação por Classe
          </h3>
        </div>
        <p className="sr-only">Tabela de alocação por classe, subclasse e ativo</p>

<table className="w-full text-sm table-auto border-separate border-spacing-y-2">
  <thead className="text-gray-600 dark:text-darkMuted text-xs uppercase">
    <tr>
      <th className="px-3">Classe</th>
      <th className="px-3">Atual</th>
      <th className="px-3">% Atual</th>
      <th className="px-3">% Ideal</th>
      <th className="px-3">Ideal R$</th>
      <th className="px-3">Movimentação</th>
      <th></th>
    </tr>
  </thead>

  <tbody>
    {Object.entries(agrupadoPorClasse || {}).map(([classe, cData]) => {
      const atualClasse = Number(cData?.total || 0);
 const pctIdealClasse = parseFloat(percentuaisDesejadosClasse[classe] || 0);
 const idealRClasse = (pctIdealClasse / 100) * totalGeral;
      const diffClasse = idealRClasse - atualClasse;

      return (
        <React.Fragment key={classe}>
          {/* Linha CLASSE */}
          <tr className="bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg shadow-sm">
            <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">{classe}</td>
            <td className="px-3 text-blue-600 dark:text-blue-400 font-semibold">{fmtBRL.format(atualClasse)}</td>
            <td className="px-3 text-gray-700 dark:text-gray-300">
              {(totalGeral > 0 ? (atualClasse / totalGeral) * 100 : 0).toFixed(2)}%
            </td>
 <td className="px-3">
   <input
     type="number"
     className="border dark:border-gray-600 rounded px-2 py-1 w-20 dark:bg-gray-700 dark:text-darkText"
     value={percentuaisDesejadosClasse[classe] ?? ''}
     onChange={(e) => handleChangeClasse(classe, e.target.value)}
     onBlur={(e) => handleChangeClasse(classe, Number(parseFloat(e.target.value || 0).toFixed(2)))}
   />%
 </td>
            <td className="px-3">{fmtBRL.format(idealRClasse)}</td>
            <td className={`px-3 ${diffClasse < 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {diffClasse >= 0 ? '+' : ''}{fmtBRL.format(diffClasse)}
            </td>
            <td className="px-3">
              <button
                className="text-blue-600 dark:text-blue-400 underline text-xs"
                onClick={() => setClasseExpandida(classeExpandida === classe ? null : classe)}
              >
                {classeExpandida === classe ? 'Fechar' : 'Detalhar'}
              </button>
            </td>
          </tr>

          {/* Subtabela de SUBCLASSES (quando a CLASSE está expandida) */}
          {classeExpandida === classe && (
            <tr className="bg-white dark:bg-darkCard">
              <td colSpan={7} className="pl-6">
                <table className="w-full mt-2 text-sm border-separate border-spacing-y-1">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase">
                      <th className="px-3">Subclasse</th>
                      <th className="px-3">Atual</th>
                      <th className="px-3">% Atual</th>
                      <th className="px-3">% Ideal</th>
                      <th className="px-3">Ideal R$</th>
                      <th className="px-3">Movimentação</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {Object.entries(cData?.subclasses || {}).map(([sub, sData]) => {
                      const atualSub = Number(sData?.total || 0);
  const pctIdealClasse = parseFloat(percentuaisDesejadosClasse[classe] || 0);        // % da Carteira (classe)
  const pctSubDentroClasse = parseFloat(percentuaisSubPorClasse?.[classe]?.[sub] || 0); // % dentro da classe
  const idealPctSub = (pctIdealClasse * pctSubDentroClasse) / 100;                   // % da Carteira para a subclasse
  const idealRSub = (idealPctSub / 100) * totalGeral;
                      const diffSub = idealRSub - atualSub;
                      const key = `${classe}::${sub}`; // chave única por classe+sub

                      return (
                        <React.Fragment key={sub}>
                          {/* Linha SUBCLASSE */}
                          <tr className="bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg shadow-sm">
                            <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">{sub}</td>
                            <td className="px-3 text-blue-600 dark:text-blue-400 font-semibold">{fmtBRL.format(atualSub)}</td>
                            <td className="px-3 text-gray-700 dark:text-gray-300">
                              {(totalGeral > 0 ? (atualSub / totalGeral) * 100 : 0).toFixed(2)}%
                            </td>
                            <td className="px-3 text-gray-700 dark:text-gray-300">
 <input
   type="number"
   className="border dark:border-gray-600 rounded px-2 py-1 w-20 dark:bg-gray-700 dark:text-darkText"
   value={percentuaisSubPorClasse?.[classe]?.[sub] ?? ''}
   onChange={(e) => handleChangeSubDentroClasse(classe, sub, e.target.value)}
   onBlur={(e) => handleChangeSubDentroClasse(classe, sub, Number(parseFloat(e.target.value || 0).toFixed(2)))}
/>%
                            </td>
                            <td className="px-3">{fmtBRL.format(idealRSub)}</td>
                             <td className={`px-3 ${diffSub < 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {diffSub >= 0 ? '+' : ''}{fmtBRL.format(diffSub)}
                            </td>
                            <td className="px-3">
                              <button
                                className="text-blue-600 dark:text-blue-400 underline text-xs"
                                onClick={() => setSubclasseExpandida(subclasseExpandida === key ? null : key)}
                              >
                                {subclasseExpandida === key ? 'Fechar' : 'Detalhar'}
                              </button>
                            </td>
                          </tr>

                          {/* Subtabela de ATIVOS (quando a SUBCLASSE está expandida) */}
                          {subclasseExpandida === key && (
                            <tr className="bg-white dark:bg-darkCard">
                              <td colSpan={7} className="pl-8">
                                <table className="w-full mt-2 text-sm border-separate border-spacing-y-1">
                                  <thead>
                                    <tr className="text-xs text-gray-500 uppercase">
                                      <th className="px-3">Ativo</th>
                                      <th className="px-3">Atual</th>
                                      <th className="px-3">% Atual</th>
                                      <th className="px-3">% Ideal</th>
                                      <th className="px-3">Ideal R$</th>
                                      <th className="px-3">Movimentação</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(sData?.ativos || {}).map(([ativo, valorAtual]) => {
                                      const totalSub = sData?.total || 1; // evita divisão por zero
                                      const pctInterno = parseFloat((percentuaisInternos[sub]?.[ativo] || 0));
                                      const idealRAtivo = (pctIdealClasse / 100)     // % da Carteira da CLASSE
                                            * (pctSubDentroClasse / 100) // % interno da SUB dentro da CLASSE
                                            * (pctInterno / 100)         // % interno do ATIVO dentro da SUB
                                            * totalGeral;
                                      const diffAtivo = idealRAtivo - Number(valorAtual || 0);

                                      return (
                                        <tr key={ativo} className="bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                          <td className="px-3 py-1 text-gray-700 dark:text-darkText">{ativo}</td>
                                          <td className="px-3 dark:text-gray-200">{fmtBRL.format(Number(valorAtual || 0))}</td>
                                          <td className="px-3 dark:text-darkText">
                                            {(totalSub > 0 ? (Number(valorAtual || 0) / totalSub) * 100 : 0).toFixed(2)}%
                                          </td>
                                          <td className="px-3 dark:text-darkText">
                                            <input
                                              type="number"
                                              className="border dark:border-gray-600 rounded px-2 py-1 w-20 dark:bg-gray-700 dark:text-darkText"
                                              value={percentuaisInternos[sub]?.[ativo] || ''}
                                              onChange={(e) => handleChangeInterno(sub, ativo, e.target.value)}
                                              onBlur={(e) => handleChangeInterno(sub, ativo, Number(parseFloat(e.target.value || 0).toFixed(2)))}
                                            />%
                                          </td>
                                          <td className="px-3 dark:text-gray-200">{fmtBRL.format(idealRAtivo)}</td>
  <td className={`px-3 ${diffAtivo < 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
    {diffAtivo >= 0 ? '+' : ''}{fmtBRL.format(diffAtivo)}
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    {/* Total da subclasse (validação % internos = 100%) */}
                                    <tr className="text-xs font-semibold border-t border-gray-200 dark:border-gray-700">
                                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">Total</td>
                                      <td></td>         {/* Atual */}
                                      <td></td>         {/* % Atual */}
                                      <td className={`px-3 ${
                                        (() => {
                                          const total = Object.values(percentuaisInternos[sub] || {})
                                            .reduce((a, b) => a + parseFloat(b || 0), 0);
                                          return Math.abs(total - 100) > 0.01 ? 'text-red-600' : 'text-green-600';
                                        })()
                                      }`}>
                                        {Object.values(percentuaisInternos[sub] || {})
                                          .reduce((a, b) => a + parseFloat(b || 0), 0).toFixed(2)}%
                                      </td>
                                      <td colSpan={2}></td>  {/* Ideal R$ + Movimentação */}
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                                                            })}

                    {/* TOTAL das SUBCLASSES (soma 100% DENTRO da classe) */}
                    {(() => {
                      const somaInterna = Object.values(percentuaisSubPorClasse?.[classe] || {})
                        .reduce((a, b) => a + parseFloat(b || 0), 0);
                      const ok = Math.abs(somaInterna - 100) < 0.01;
                      return (
                        <tr className="text-xs font-semibold border-t border-gray-200 dark:border-gray-700">
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                            Total
                          </td>
                          <td className="px-3"></td>
                          <td className="px-3"></td>
                          <td className={`px-3 font-semibold ${ok ? 'text-green-600 dark:text-green-600' : 'text-red-600 dark:text-red-600'}`}>
                            {somaInterna.toFixed(2)}%
                          </td>
                          <td className="px-3"></td>
                          <td className="px-3"></td>
                          <td className="px-3"></td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    })}
  </tbody>

  {/* Rodapé: total dos % ideais de SUBCLASSE (mantém a validação geral) */}
  <tfoot>
    <tr className="text-xs font-semibold border-t border-gray-200 dark:border-gray-700">
      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">Total</td>
      <td></td>  {/* Atual */}
      <td></td>  {/* % Atual */}
      <td className={`px-3 ${
        (() => {
          const total = Object.values(percentuaisDesejadosClasse || {})
            .reduce((a, b) => a + parseFloat(b || 0), 0);
          return Math.abs(total - 100) > 0.01 ? 'text-red-600' : 'text-green-600';
        })()
      }`}>
        {Object.values(percentuaisDesejadosClasse || {}).reduce((a, b) => a + parseFloat(b || 0), 0).toFixed(2)}%
      </td>
      <td colSpan={3}></td> {/* Ideal R$, Movimentação, Ações (ou o que houver à direita) */}
    </tr>
  </tfoot>
</table>
  
<div className="flex justify-between items-center gap-4">
  {/* Espaço para aviso (80%) */}
  <div className="w-full max-w-[80%]">
    {!podeSalvar() && (
      <div className="flex items-center bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-md shadow-sm">
        <svg className="w-4 h-4 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.763-1.36 2.723-1.36 3.486 0l6.518 11.638c.75 1.34-.213 3.01-1.743 3.01H3.482c-1.53 0-2.493-1.67-1.743-3.01L8.257 3.1zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-.25-3.75a.75.75 0 00-1.5 0v1.5a.75.75 0 001.5 0v-1.5z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm">
          Todas as Classes, Subclasses e Ativos devem estar preenchidos corretamente e somar 100% para poder salvar.
        </span>
      </div>
    )}
  </div>

  {/* Botão (20%) sempre à direita */}
  {(() => {
    const btnBase =
      "inline-flex items-center justify-center h-10 px-4 rounded-xl font-semibold " +
      "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 w-full max-w-[20%]";
    const btnSaveEnabled =
      `${btnBase} text-white bg-blue-600 hover:bg-blue-700 ` +
      "dark:bg-blue-600 dark:hover:bg-blue-700";
    const btnSaveDisabled =
      `${btnBase} text-white bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400`;
    return (
      <button
        onClick={handleSalvar}
        disabled={!podeSalvar()}
        className={podeSalvar() ? btnSaveEnabled : btnSaveDisabled}
      >
        Salvar Alocação
      </button>
    );
  })()}
  {mensagemSucesso && (
  <div className="mt-4 flex items-center gap-2 bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded shadow-sm transition">
    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
        clipRule="evenodd"
      />
    </svg>
    <span className="text-sm">{mensagemSucesso}</span>
  </div>
)}

      </div>
      </div>
    </section>
  </div>
  </RequireFeature>
  );
}

export default Rebalanceamento;