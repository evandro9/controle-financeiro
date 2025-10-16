import React from "react";
import Reveal from "../ui/Reveal.jsx";

/**
 * Mostra um "MacBook" e um "smartphone" com imagens do sistema.
 * Passe os caminhos das imagens via props (coloque os arquivos em /public/assets/hero).
 *
 * <DeviceShowcase macSrc="/assets/hero/dashboard-desktop.png"
 *                 phoneSrc="/assets/hero/dashboard-mobile.png" />
 */
export default function DeviceShowcase({
  macSrc,
  phoneSrc,
  macAlt = "Tela do sistema (desktop)",
  phoneAlt = "Tela do sistema (mobile)",
  /** Permite reduzir/aumentar o tamanho do smartphone sem afetar o Mac. Padrão: 0.9 (−10%). */
  phoneScale = 0.9,
}) {
  const BASE = import.meta.env.BASE_URL || "/";
  const finalMac = macSrc ?? `${BASE}assets/hero/dashboard-desktop.png`;
  const finalPhone = phoneSrc ?? `${BASE}assets/hero/celular.png`;    
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      {/* Glow de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 right-0 -z-10 h-72 w-72 rounded-full bg-gradient-to-tr from-emerald-400/25 to-teal-500/25 blur-3xl"
      />
      {/* MacBook */}
      <Reveal className="relative mx-auto w-[92%] max-w-[720px] rounded-[18px] border border-slate-300/50 bg-slate-900/90 shadow-2xl ring-1 ring-black/5 transition hover:-translate-y-1">
        {/* “tampa”/borda do mac */}
        <div className="rounded-[18px] border border-slate-700 bg-slate-900 p-2">
          {/* moldura da tela */}
          <div className="relative overflow-hidden rounded-[12px] bg-black">
            {/* câmera */}
            <div className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded-full bg-slate-700" style={{width:6,height:6}} />
            <img
              src={finalMac}
              alt={macAlt}
              className="block w-full select-none rounded-[12px] object-cover"
              onError={(e) => (e.currentTarget.style.opacity = 0.35)}
            />
          </div>
        </div>
        {/* base/“teclado” estilizado */}
        <div className="mx-auto h-2 w-[94%] rounded-b-[14px] bg-gradient-to-b from-slate-300 to-slate-200 shadow-inner" />
      </Reveal>

      {/* Smartphone sobreposto */}
      <Reveal
        delay={120}
        className="absolute -right-2 bottom-[-6%] w-[120px] rotate-3 sm:-right-4 sm:bottom-[-8%] sm:w-[160px] md:-right-10 md:bottom-[-14%] md:w-[200px] lg:-right-12 lg:bottom-[-1%]"
      >
        {/* Wrapper de escala: origem no canto inferior direito para não “descolar” do Mac */}
        <div className="origin-bottom-right" style={{ transform: `scale(${phoneScale})` }}>
          <div className="rounded-[28px] border border-slate-300/70 bg-slate-900/95 p-2 shadow-xl ring-1 ring-black/5 transition hover:-translate-y-0.5">
            {/* notch/speaker */}
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-700" />
            <div className="overflow-hidden rounded-[22px] bg-black">
              <img
                src={finalPhone}
                alt={phoneAlt}
                className="block h-[220px] w-full select-none object-cover sm:h-[300px] md:h-[380px]"
                onError={(e) => (e.currentTarget.style.opacity = 0.35)}
              />
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}