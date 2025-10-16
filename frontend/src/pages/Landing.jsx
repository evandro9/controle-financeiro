import React, { useEffect, useRef, useState } from "react";
import FAQ from "../components/marketing/FAQ.jsx";
import Pricing from "../components/marketing/Pricing.jsx";
import NavLanding from "../components/marketing/NavLanding.jsx";
import { Sparkles, MessageSquare, Images, CircleDollarSign, ShieldCheck, HelpCircle, Quote, X, Table, Zap, LayoutDashboard, Target, CheckCircle2, Monitor, Smartphone, XCircle } from "lucide-react";
import Reveal from "../components/ui/Reveal.jsx";
import DeviceShowcase from "../components/marketing/DeviceShowcase.jsx";
import PrintsCarousel from "../components/marketing/PrintsCarousel.jsx";
import Counters from "../components/marketing/Counters.jsx";
import InlineCTA from "../components/marketing/InlineCTA.jsx";
import Steps from "../components/marketing/Steps.jsx";
import Resultados from "../components/marketing/Resultados.jsx";
import StickyCTA from "../components/marketing/StickyCTA.jsx";
import TestimonialsCarousel from "../components/marketing/TestimonialsCarousel.jsx";

export default function Landing() {
  const [zoom, setZoom] = useState(null); // {src, title} | null
  const BASE = import.meta.env.BASE_URL || "/";
  useBodyLock(!!zoom); // trava o scroll quando o lightbox está aberto
  useEffect(() => { if (!zoom) return; const onKey = (e) => e.key === "Escape" && setZoom(null); window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [zoom]);
  return (
    <div className="min-h-dvh bg-white text-slate-900 overflow-x-hidden">
      <NavLanding />

      <main>
        {/* HERO premium */}
        <section className="relative bg-slate-950 py-16 sm:py-20 lg:py-24 overflow-visible">
          {/* glows de fundo */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-3xl" />
          </div>
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            {/* Coluna esquerda: copy e CTAs */}
            <Reveal as="div" className="text-white text-center lg:text-left">
              <div className="space-y-5 sm:space-y-6 lg:space-y-10">
                <h1 className="text-4xl font-extrabold tracking-tight text-white/90 sm:text-5xl">
                  <span className="text-rose-400">Pare</span> de{" "}
                  <span className="underline decoration-rose-400 decoration-4 underline-offset-4">torcer</span>{" "}
                  para sobrar dinheiro no fim do mês
               </h1>
                <p className="max-w-xl text-lg leading-7 text-white/80 mx-auto lg:mx-0">
                  <span className="font-semibold text-rose-400">Corte os desperdícios</span> e assuma o{" "}
                  <span className="font-semibold text-white/90">controle</span> do seu{" "}
                  <span className="font-semibold text-emerald-300">dinheiro</span> com um sistema{" "}
                  <span className="font-semibold text-white/90">completo e fácil</span> de usar.{" "}
                  <span className="bg-white/10 text-white/90 px-1 rounded font-semibold">Tudo</span> em um só lugar.{" "}
                  Do jeito que bancos e planilhas{" "}
                  <span className="underline decoration-rose-400 decoration-4 underline-offset-4 font-semibold">nunca</span> te deram.
                </p>
                {/* CTA principal + micro-prova + badges */}
                <div className="flex flex-col items-center lg:items-start">
                  <a
                    href="#planos"
                    aria-label="Quero juntar mais dinheiro — ver planos"
                    title="Quero juntar mais dinheiro"
                    className="relative isolate inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 px-7 py-3.5 text-base font-semibold text-slate-900
                               ring-1 ring-emerald-300/30 shadow-xl shadow-emerald-400/30
                               transition-all duration-200 transform-gpu will-change-transform
                               hover:scale-105 active:scale-95 hover:from-emerald-300 hover:to-teal-300
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60
                               lg:px-9 lg:py-4 lg:text-lg
                               before:content-[''] before:absolute before:inset-0 before:-z-10 before:rounded-3xl
                               before:bg-gradient-to-r before:from-emerald-400/40 before:to-teal-400/40
                               before:blur-2xl before:opacity-70 hover:before:opacity-90"

                  >
                    Quero organizar minhas finanças
                  </a>
                  <p className="mt-2 flex items-center justify-center lg:justify-start gap-2 text-xs text-white/70">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                    <span>
                      Garantia de 7 dias. Receba 100% do seu dinheiro de volta se não gostar.
                    </span>
                  </p>                  
                </div>
              </div>
            </Reveal>
            {/* Coluna direita: dispositivos */}
            <DeviceShowcase
              macSrc={`${BASE}assets/hero/balanco.png`}
              phoneSrc={`${BASE}assets/hero/celular.png`}
            />
          </div>
        </section>

        {/* TRUST METRICS */}
        <Counters />

        {/* MANIFESTO / STORYTELLING (MAV) — fundo branco */}
        <section id="manifesto" className="relative scroll-mt-24 border-y border-white/10 bg-slate-900 py-12 sm:py-16 lg:py-20 overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 right-10 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
            {/* espelho para conectar com o topo esquerdo de Depoimentos */}
            <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            {/* Título não usa flex no h2 para não “picar” palavras no mobile */}
            <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight text-white/90">
              <span className="inline-flex items-center justify-center gap-2 whitespace-normal break-words hyphens-none">
                <Sparkles className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                <span>
                  Acabe com o <span className="text-rose-400">descontrole</span> financeiro de vez
                </span>
              </span>
            </h2>

            {/* Cards com ícone + título discreto + texto */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2">
              {[
                {
                  Icon: Table,
                  title: "Planilhas nunca resolvem",
                  text:
                    "Organize tudo sem perder tempo. Nada de categorias confusas ou lançamentos manuais cansativos. Aqui é fácil, visual e rápido.",
                },
                {
                  Icon: Zap,
                  title: "Feito para a sua rotina",
                  text:
                    "Fluxo simples e direto, pensado para caber no seu dia a dia. Filtros inteligentes e visualizações só do que realmente importa.",
                },
                {
                  Icon: LayoutDashboard,
                  title: "Veja onde seu dinheiro vai",
                  bullets: [
                    "Relatórios e insights prontos em segundos",
                    "Destaques do que mais pesa no mês",
                    "Compare meses, categorias e formas de pagamento",
                  ],
                },
                {
                  Icon: Target,
                  title: "Controle de verdade, sem complicação",
                  text:
                    "Acompanhe tudo de perto, sem esforço e sem entender de finanças. Mais dinheiro no bolso, menos preocupação todo mês.",  
                },
              ].map((it, i) => (
                <Reveal
                  key={it.title}
                  delay={i * 80}
                  className={`flex items-start gap-3 rounded-2xl border p-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    [
                      "border-emerald-400/15 bg-emerald-400/5 hover:shadow-emerald-400/10",
                      "border-teal-400/15 bg-teal-400/5 hover:shadow-teal-400/10",
                      "border-indigo-400/15 bg-indigo-400/5 hover:shadow-indigo-400/10",
                      "border-rose-400/15 bg-rose-400/5 hover:shadow-rose-400/10",
                    ][i]
                  }`}
                >
                  <it.Icon className="mt-0.5 h-7 w-7 sm:h-8 sm:w-8 text-emerald-300 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-semibold text-white/95">{it.title}</h3>
                    {it.text && <p className="mt-1 text-sm text-white/80">{it.text}</p>}
                    {it.bullets && (
                      <ul className="mt-1 list-none space-y-1 text-sm text-white/80">
                        {it.bullets.map((b, bi) => (
                          <li key={bi} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300 shrink-0" aria-hidden="true" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Convite discreto */}
            <p className="mt-6 text-center text-white/70">
              Se você busca clareza financeira de verdade,{" "}
              <a href="#planos" className="font-semibold text-emerald-300 hover:underline">experimente agora</a>
              {"."}
            </p>
          </div>
        </section>

        {/* PROVA SOCIAL — dark premium */}
        <section id="depoimentos" className="relative scroll-mt-24 border-y border-white/10 bg-slate-950 py-12 sm:py-16 overflow-hidden">
          {/* glows */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-10 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
            <div className="absolute -bottom-0 -right-10 h-60 w-60 rounded-full bg-teal-400/15 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal as="h3" className="flex items-center justify-center gap-2 text-center text-2xl sm:text-3xl font-bold tracking-tight text-white/90">
              <MessageSquare className="h-6 w-6 text-emerald-300" aria-hidden="true" />
              Não é só o que dizemos — é o que os usuários sentem
            </Reveal>
            {/* micro-statement para reforçar volume/autoridade */}
            <p className="mt-3 text-center text-sm text-white/70">
              Veja como milhares já destravaram seu controle financeiro
            </p>            
            <div className="mt-8">
              <TestimonialsCarousel
                items={[
                  { n: "Camila R.", t: "Descobri para onde ia meu dinheiro e cortei os supérfluos sem sofrer." },
                  { n: "João V.",   t: "Parei de adiar lançamentos. 10 minutos por semana e pronto." },
                  { n: "Marcos A.", t: "Fechei o mês no verde pela primeira vez em muito tempo." },
                  { n: "Luiza P.",  t: "Saí da planilha e ganhei clareza do que fazer no próximo mês." },
                  { n: "Pedro S.",  t: "Nunca mais levei susto na fatura do cartão." },
                  { n: "Ana L.",    t: "Comecei minha reserva e fiz meu primeiro aporte." },
                  { n: "Rafael M.", t: "Vejo o planejado x realizado e ajusto antes de estourar." },
                  { n: "Beatriz T.",t: "Relatórios simples que mostram só o que importa." },
                  { n: "Diego F.",  t: "Organizei categorias do meu jeito — ficou natural." },
                  { n: "Larissa K.",t: "Me sinto no controle sem ser ‘da área’." },
                  { n: "Bruno C.",  t: "Passei a guardar todo mês sem esforço." },
                  { n: "Carolina P.",t:"Meus investimentos e gastos no mesmo lugar — paz." },
                ]}
              />
            </div>
          </div>
        </section>   

        {/* CTA entre blocos – após Depoimentos (mesma cor do bloco acima) */}
        <InlineCTA
          id="cta-apos-depoimentos"
          tone="dark"
          primaryLabel="Quero controlar meu dinheiro agora"
        />

        {/* PRINTS DO PRODUTO — volta para branco */}
        <section id="prints" className="relative scroll-mt-24 border-y border-white/10 bg-slate-900 py-12 sm:py-16 lg:py-20 overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-10 h-60 w-60 rounded-full bg-teal-400/15 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal as="h3" className="text-center text-2xl sm:text-3xl font-bold tracking-tight text-white/90">
              <span className="inline-flex items-center justify-center gap-2 whitespace-normal break-words hyphens-none">
                <Images className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                <span>
                  Por dentro do sistema que faz{" "}
                  <span className="underline decoration-emerald-300 decoration-2 underline-offset-4">você</span>{" "}
                  assumir o <span className="text-emerald-300 font-semibold">controle</span> do seu dinheiro
                </span>
              </span>
            </Reveal>
            <p className="mt-3 text-center text-sm sm:text-base text-white/80">Uma espiada nos painéis que vão mudar sua relação com o dinheiro, dia após dia.</p>
            <div className="mt-8">
              <PrintsCarousel
                onOpen={(p) => setZoom(p)}
                items={[
                  { src: `${BASE}assets/prints/dashboard.png`, title: "Dashboard" },
                  { src: `${BASE}assets/prints/planos.png`, title: "Planejamento do mês" },
                  { src: `${BASE}assets/prints/analises.png`, title: "Analises de gastos" },
                  // adicione quantos quiser abaixo
                  { src: `${BASE}assets/prints/investimentos2.png`, title: "Acompanhe Proventos" },
                  { src: `${BASE}assets/prints/investimentos.png`, title: "Aportes e Rentabilidade" },
                  { src: `${BASE}assets/prints/investimentos3.png`, title: "Patrimônio Investido" },
                  { src: `${BASE}assets/prints/rebalanceamento.png`, title: "Rebalanceie seus investimentos" },
                  { src: `${BASE}assets/prints/dark.png`, title: "Modo Clear" },
                  { src: `${BASE}assets/prints/simulador.png`, title: "Simule Investimentos" },
                ]}
              />
            </div>
          </div>
        </section>     

        {/* COMO FUNCIONA (3 passos) */}
        <Steps />      

        {/* CTA entre blocos – após Como Funciona (mesma cor do bloco acima) */}
        <InlineCTA
          id="cta-apos-steps"
          tone="dark"
          primaryLabel="Quero ter mais dinheiro sobrando todo mês"
        />

        {/* RESULTADOS EM 7/30/90 DIAS */}
        <Resultados />        

        {/* ANCORAGEM (MAV) — alterna para verde-claro */}
        {/* BLOCO: Quanto vale resolver essa dor (novo) */}
        <section id="ancoragem" className="relative scroll-mt-24 border-y border-white/10 bg-slate-950 py-12 sm:py-16 lg:py-20">
          {/* glows sutis */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 right-10 h-64 w-64 rounded-full bg-rose-400/10 blur-3xl" />
            <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            {/* Título que ativa a dor */}
            <Reveal
              as="h3"
              className="text-center text-2xl sm:text-3xl font-bold tracking-tight text-white/90"
            >
              Não deixe o <span className="text-rose-400">descontrole</span> financeiro custar caro para você
            </Reveal>
            {/* Lembrete da dor (curto e concreto) */}
            <p className="mx-auto mt-3 max-w-3xl text-center text-white/80">
              Desorganização financeira custa caro: multas e juros do cartão, empréstimos desnecessários, tempo perdido
              e o estresse que atrasa sua vida.
            </p>

            {/* Comparação */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Consultoria / terceirizar */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white shadow-sm">
                <div className="text-center text-[15px] sm:text-base font-semibold text-white/90">Consultoria</div>
                <ul className="mt-4 space-y-2 text-sm text-white/80">
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                    <span className="leading-tight">Custo alto e recorrente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                    <span className="leading-tight">Tempo baixo, mas preso à agenda de terceiros</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="leading-tight">Resultados dependem de entregas contratadas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                    <span className="leading-tight">Liberdade/autonomia baixa no dia a dia</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                    <span className="leading-tight">Facilidade para você, com retrabalhos e alinhamentos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                    <span className="leading-tight">Dependência de prazos e custo alto</span>
                  </li>
                </ul>
              </div>

              {/* Resolver sozinho (planilha / apps genéricos) */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white shadow-sm">
                <div className="text-center text-[15px] sm:text-base font-semibold text-white/90">Resolver sozinho (planilhas / apps genéricos)</div>
                <ul className="mt-4 space-y-2 text-sm text-white/80">
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                    <span className="leading-tight">Custo parece baixo, mas o dinheiro some sem perceber</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                    <span className="leading-tight">Tempo alto em lançamentos e manutenções</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                    <span className="leading-tight">Resultados irregulares; clareza não se mantém</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="leading-tight">Liberdade/autonomia alta, do seu jeito (porém cansativo)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                    <span className="leading-tight">Complexidade de configuração e manutenção</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                    <span className="leading-tight">Fadiga e desistência são comuns</span>
                  </li>
                </ul>
              </div>

              {/* Site Finanças 2.0 (destaque sutil) */}
              <div className="relative rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5 text-white shadow-lg shadow-emerald-400/20 ring-1 ring-emerald-300/20">
                {/* selo recomendado */}
                <span className="absolute -top-3 right-3 inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 shadow-sm backdrop-blur-sm">
                  <Sparkles className="h-3 w-3 text-emerald-200" aria-hidden="true" />
                  Recomendado
                </span>
                <div className="text-center text-[15px] sm:text-base font-semibold text-white/90">Site Finanças 2.0</div>
                <ul className="mt-4 space-y-2 text-sm text-white/80">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="leading-tight">Custa uma fração dos outros cenários</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="leading-tight">Tempo ~10 min por semana</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="leading-tight">Resultados em minutos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="leading-tight">Liberdade/autonomia alta, guiada por automações</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="leading-tight">Facilidade de configuração</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="leading-tight">Menos fricção e zero burocracia</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="leading-tight">Entrega o que você sempre buscou</span>
                  </li>
                   <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="leading-tight">Ajuda você a juntar mais dinheiro</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Urgência + CTA */}
            <div className="mt-8 text-center text-sm text-white/70">
              Pronto para usar. Sem espera, sem taxas escondidas.{" "}
              <span className="text-white/80">Quanto você está deixando escapar por não resolver isso agora?</span>
            </div>
          </div>
        </section>

        {/* PLANOS — dark premium */}
        <section id="planos" className="scroll-mt-24 bg-slate-900 py-16 sm:py-20 lg:py-24 overflow-visible">
          <Reveal as="div" className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <h2
              className="inline-block mx-auto text-2xl sm:text-3xl font-bold tracking-tight text-white/90
                         whitespace-normal hyphens-none break-words lg:whitespace-nowrap"
            >
              Acabe com a <span className="text-rose-400">incerteza</span>. Chegou a hora de assumir o <span className="text-emerald-300">controle</span> do seu dinheiro
            </h2>
            <p className="mt-3 inline-block mx-auto text-white/80 whitespace-normal lg:whitespace-nowrap">
              A diferença entre não sobrar dinheiro e começar a ver resultado está a um clique de distância
            </p>
          </Reveal>
          <div className="mx-auto mt-10 max-w-6xl px-4 sm:px-6 lg:px-8">
            <Pricing />
          </div>
        </section>    

        {/* GARANTIA (MAV) — alterna para verde-claro */}
        <section id="garantia" className="scroll-mt-24 bg-slate-950 py-12 sm:py-16 lg:py-20 overflow-visible">
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <Reveal as="div" className="rounded-2xl border border-white/10 bg-white/5 p-8 text-white shadow-sm">
              <h3 className="flex items-center justify-center gap-2 text-2xl font-bold text-white/90">
                <ShieldCheck className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                Garantia incondicional de 7 dias
              </h3>
              <p className="mt-3 text-white/80">
                Se em <span className="font-semibold text-white">7 dias</span> você decidir que{" "}
                <span className="font-semibold text-rose-400">juntar dinheiro não é prioridade </span>
                é só enviar uma mensagem que devolvemos <span className="font-semibold text-white">100% do valor</span>.
                Sem perguntas. Sem burocracia.
              </p>
              <a
                href="#planos"
                aria-label="Quero começar sem risco"
                title="Quero começar sem risco"
                className="relative isolate mt-6 inline-flex items-center justify-center rounded-2xl
                           bg-gradient-to-r from-emerald-400 to-teal-400 px-7 py-3.5 text-base font-semibold text-slate-900
                           ring-1 ring-emerald-300/30 shadow-xl shadow-emerald-400/30
                           transition-all duration-200 transform-gpu will-change-transform
                           hover:scale-105 active:scale-95 hover:from-emerald-300 hover:to-teal-300
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60
                           before:content-[''] before:absolute before:inset-0 before:-z-10 before:rounded-3xl
                           before:bg-gradient-to-r before:from-emerald-400/40 before:to-teal-400/40
                           before:blur-2xl before:opacity-70 hover:before:opacity-90"
              >
                Quero começar sem risco
              </a>
              <p className="mt-2 text-xs text-white/60">Sem taxas escondidas. Sem letras miúdas.</p>
            </Reveal>
          </div>
        </section>

        {/* FAQ — dark premium */}
        <section id="faq" className="scroll-mt-24 bg-slate-900 py-12 sm:py-16 lg:py-20 overflow-visible">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <Reveal as="h3" className="flex items-center justify-center gap-2 text-2xl sm:text-3xl font-bold tracking-tight text-white/90">
              {/* ícone só no título */}
<HelpCircle className="h-6 w-6 text-emerald-300" />
              Perguntas frequentes
            </Reveal>
            <p className="mt-3 text-white/80">
              Dúvidas rápidas, respostas diretas. Segurança, cancelamento e como começar em minutos.
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-3xl px-4 sm:px-6 lg:px-8">
            <FAQ />
          </div>
          <p className="mt-6 px-4 text-center text-sm text-white/70">
            Sua dúvida não apareceu aqui? Fale com nosso{" "}
            <a
              href="/suporte"
              className="font-semibold text-emerald-300 underline decoration-emerald-400/40 underline-offset-4
                         hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40"
            >
              suporte
            </a>.
          </p>          
        </section>

        {/* CTA FINAL — provocação suave para converter */}
        <section id="cta-final" className="bg-slate-950 py-16 text-center overflow-visible">
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            {/* glow de fundo sutil */}
            <div className="pointer-events-none absolute -inset-x-0 -inset-y-24 -z-10">
              <div className="mx-auto h-40 w-[28rem] rounded-full bg-emerald-400/10 blur-3xl" />
            </div>

            <h3 className="inline-block mx-auto text-center text-2xl sm:text-3xl font-bold tracking-tight text-white/90 lg:whitespace-nowrap">
              Chega de adiar. Assuma o <span className="text-emerald-300">controle</span> e faça o dinheiro <span className="text-emerald-300">sobrar</span>
            </h3>
            <p className="mt-3 text-white/80 lg:whitespace-nowrap">
              Comece agora. Em minutos você sente a diferença.<span className="text-white/90"> Garantia de 7 dias</span> e <span className="text-white/90">sem taxas escondidas</span>.
            </p>

            <div className="mt-6 flex items-center justify-center">
              <a
                href="#planos"
                aria-label="Quero controlar meu dinheiro agora — ver planos"
                title="Quero controlar meu dinheiro agora"
                className="relative isolate inline-flex items-center justify-center rounded-2xl
                           bg-gradient-to-r from-emerald-400 to-teal-400 px-7 py-3.5 text-base font-semibold text-slate-900
                           ring-1 ring-emerald-300/30 shadow-xl shadow-emerald-400/30
                           transition-all duration-200 transform-gpu will-change-transform
                           hover:scale-105 active:scale-95 hover:from-emerald-300 hover:to-teal-300
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60
                           before:content-[''] before:absolute before:inset-0 before:-z-10 before:rounded-3xl
                           before:bg-gradient-to-r before:from-emerald-400/40 before:to-teal-400/40
                           before:blur-2xl before:opacity-70 hover:before:opacity-90"
              >
                Quero controlar meu dinheiro agora
              </a>
            </div>
            <p className="mt-2 text-xs text-white/60">Sem compromisso. Você pode mudar de plano ou cancelar quando quiser.</p>
          </div>
        </section>

                {/* LIGHTBOX (zoom dos prints) */}
        {zoom && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Ampliar ${zoom.title}`}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setZoom(null)}
          >
            <div
              className="relative w-full max-w-6xl transform rounded-2xl border border-white/10 bg-slate-950/95 p-3 text-white shadow-2xl transition duration-200 ease-out"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                aria-label="Fechar"
                onClick={() => setZoom(null)}
                className="absolute right-3 top-3 inline-flex rounded-full border border-white/10 bg-white/10 p-2 text-white shadow hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={zoom.src}
                alt={zoom.title}
                className="max-h-[80vh] w-full rounded-lg object-contain ring-1 ring-white/10"
              />
              <div className="mt-2 px-1 text-center text-sm text-white/80">{zoom.title}</div>
            </div>
          </div>
        )}

      </main>

      {/* Barra fixa de CTA ao rolar */}
      <StickyCTA />

      <footer className="border-t border-white/10 bg-slate-950 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="inline-block h-7 w-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-500 ring-1 ring-emerald-300/30" />
            <div>
              <p className="text-sm font-semibold text-white">Meu Orçamento Doméstico</p>
              <p className="text-xs text-white/60">© {new Date().getFullYear()}</p>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/privacidade" className="text-white/70 hover:text-white underline-offset-4 hover:underline">Privacidade</a>
            <a href="/termos" className="text-white/70 hover:text-white underline-offset-4 hover:underline">Termos</a>
            <a href="mailto:suporte@exemplo.com" className="text-white/70 hover:text-white underline-offset-4 hover:underline">Suporte</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// Hook utilitário: bloqueia o scroll do <body> quando "locked" = true
// Pode ficar aqui mesmo no arquivo ou em src/hooks/useBodyLock.js
export function useBodyLock(locked) {
  useEffect(() => {
    const original = document.body.style.overflow;
    if (locked) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = original || "";
    }
    return () => {
      document.body.style.overflow = original || "";
    };
  }, [locked]);
}