import React from "react";

/**
 * Filtro em linha: Classes (pills) à esquerda + Período (pills azuis) à direita.
 *
 * Props:
 * - classesOptions: Array<{ key: string|number, label: string }>
 * - classeValue: string|number
 * - onClasseChange: (key) => void
 * - periodoValue: 'ano' | '12m' | '24m' | 'inicio'
 * - onPeriodoChange: (key) => void
 * - title?: string
 */
export default function FiltroClassesPeriodoInline({
  classesOptions = [],
  classeValue,
  onClasseChange,
  periodoValue = "ano",
  onPeriodoChange,
  title = "Filtros",
}) {
  const periodOptions = [
    { key: "ano",    label: "No ano" },
    { key: "12m",    label: "Últimos 12m" },
    { key: "24m",    label: "Últimos 24m" },
    { key: "inicio", label: "Do início" },
  ];

  return (
    <div className="p-4 shadow-md rounded-xl bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder">
      {/* Título opcional */}
      {title && (
        <div className="mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-darkText">
            {title}:
          </span>
        </div>
      )}

      {/* Linha única: classes (esq) | período (dir) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Classes (pills) — com wrap + scroll horizontal no mobile se precisar */}
        <div className="flex gap-2 flex-wrap md:max-w-[65%] overflow-x-auto scrollbar-thin">
          {classesOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onClasseChange(opt.key)}
              className={
                "px-3 py-1.5 rounded-full text-sm transition " +
                (String(classeValue) === String(opt.key)
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700")
              }
              title={opt.label}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Período (mesmo visual do FiltroAnalises) */}
        <div className="flex flex-wrap gap-2 md:justify-end">
          {periodOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onPeriodoChange(opt.key)}
              className={
                "px-3 py-1.5 rounded-full text-sm transition " +
                (periodoValue === opt.key
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}