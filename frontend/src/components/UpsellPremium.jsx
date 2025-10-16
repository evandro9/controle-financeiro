// src/components/UpsellPremium.jsx
import React from "react";
import { Lock } from "lucide-react";

export default function UpsellPremium({ title = "Recurso premium", children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-emerald-300" />
        <h4 className="text-lg font-semibold">{title}</h4>
      </div>
      <p className="mt-2 text-white/70">
        Este recurso faz parte da assinatura completa. Atualize seu plano para desbloquear.
      </p>
      {children}
      <a
        href="#planos"
        className="mt-4 inline-flex rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-900"
      >
        Ver planos
      </a>
    </div>
  );
}