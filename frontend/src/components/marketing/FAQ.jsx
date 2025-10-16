import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import Reveal from "../ui/Reveal.jsx";

const DATA = [
  {
    q: "Recebo acesso imediato?",
    a: "Sim. Após entrar pelo login, você já acessa o app e pode começar a usar o plano escolhido.",
  },
  {
    q: "Como funciona a importação de extratos?",
    a: "Você pode importar CSV/OFX dos seus bancos e cartões. O sistema ajuda a mapear categorias e formas de pagamento.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. O cancelamento é imediato e você mantém acesso até o final do período já pago.",
  },
  {
    q: "Meus dados são seguros?",
    a: "Aplicamos boas práticas de segurança, criptografia em repouso e backups diários. Você também pode exportar seus dados.",
  },
  {
    q: "E se eu não tiver experiência nenhuma?",
    a: "O fluxo é direto: lançamentos rápidos, planejamento por mês e gráficos que explicam o que está acontecendo. Você aprende usando.",
  },
  {
    q: "O módulo de investimentos está incluso?",
    a: "No Pro você tem o essencial. O Complete adiciona análises avançadas de carteira, com comparativos claros de desempenho.",
  },
  {
    q: "Existe garantia?",
    a: "Sim. Garantia incondicional de 7 dias: não curtiu, devolvemos 100% do valor. Sem burocracia.",
  },
];

export default function FAQ({ items = DATA }) {
  const [open, setOpen] = useState(null);
  const onToggle = (i) => setOpen((curr) => (curr === i ? null : i));
  return (
    <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <Reveal key={item.q}>
            <div className="p-4 sm:p-5">
              <button
                type="button"
                onClick={() => onToggle(i)}
                aria-expanded={isOpen}
                className="group flex w-full items-center justify-between rounded-xl px-1 text-left text-white
                           transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40"
              >
                <span className="text-sm sm:text-base font-semibold text-white/90 group-hover:text-white">{item.q}</span>
                <ChevronDown
                  className={`h-5 w-5 flex-shrink-0 text-white/70 transition-transform duration-200
                    ${isOpen ? "rotate-180 text-white/90" : "rotate-0"}`}
                  aria-hidden="true"
                />
              </button>
              <div
                className={`grid transition-all duration-200 ${isOpen ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="overflow-hidden text-sm leading-relaxed text-white/80">
                  {item.a}
                </div>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}