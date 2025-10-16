import React from "react";

/**
 * Filtro unificado em uma linha: Classes (pills) à esquerda + Período à direita.
 *
 * Props:
 * - classesOptions: Array<{ key: string|number, label: string }>
 * - classeValue: string|number
 * - onClasseChange: (key) => void
 * - periodoComponent: ReactNode (ex.: <FiltroPeriodo ... />)
 * - title: string (opcional)
 */
export default function FiltroPeriodoClasses({
  classesOptions,
  classeValue,
  onClasseChange,
  periodoComponent,
  title = "Filtros",
}) {
  return (
    <div className="p-4 shadow-md rounded-xl bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700 dark:text-darkText">
          {title}:
        </span>
      </div>

      {/* Linha única: classes (esq) + período (dir) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Classes (pills) */}
        <div className="flex flex-wrap gap-2">
          {classesOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onClasseChange(opt.key)}
              className={
                "px-3 py-1.5 rounded-full text-sm transition " +
                (classeValue === opt.key
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Período (reaproveita teu FiltroPeriodo pronto) */}
        <div className="shrink-0">{periodoComponent}</div>
      </div>
    </div>
  );
}