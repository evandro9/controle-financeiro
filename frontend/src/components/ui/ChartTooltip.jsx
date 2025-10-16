import React from 'react';

/**
 * ChartTooltip
 * Tooltip padronizada (caixinha + dot colorido) para Recharts.
 *
 * Como usar com <Tooltip /> do Recharts:
 *   <Tooltip content={<ChartTooltip darkMode={darkMode} />} />
 *
 * Props adicionais (opcionais):
 * - darkMode?: boolean                      -> ajusta tema
 * - labelFormatter?: (label) => string      -> formata o título (ex.: mês por extenso)
 * - valueFormatter?: (number) => string     -> formata o valor (ex.: BRL, %)
 * - isVisible?: (name: string) => boolean   -> filtra chaves ocultas (ex.: via legenda)
 *
 * Observação: o Recharts injeta {active, label, payload} automaticamente.
 */
export default function ChartTooltip({
  active,
  label,
  payload,
  darkMode = false,
  labelFormatter,
  valueFormatter,
  isVisible,
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Filtra itens válidos (numéricos) e respeita "visibilidade" caso fornecida
  const itens = payload
    .filter((p) => typeof p?.value === 'number')
    .filter((p) => (isVisible ? isVisible(String(p.name ?? p.dataKey)) : true));

  if (!itens.length) return null;

  const title = labelFormatter ? labelFormatter(label) : label;
  const fmtVal = (v) => (valueFormatter ? valueFormatter(Number(v || 0)) : String(v));

  return (
    <div
      className={`rounded-lg shadow-md px-3 py-2 text-sm border ${
        darkMode
          ? 'bg-darkCard border-darkBorder text-darkText'
          : 'bg-white border-gray-200 text-gray-800'
      }`}
      style={{ minWidth: 180, pointerEvents: 'none' }}
      role="tooltip"
    >
      {title ? <div className="text-s font-medium mb-1 opacity-80">{title}</div> : null}

      <div className="space-y-1">
        {itens.map((p) => {
          const key = String(p.name ?? p.dataKey);
          const color = p.color || p.stroke || p.fill || p.payload?.fill || p.payload?.stroke || '#2563EB';
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block"
                  style={{ width: 10, height: 10, borderRadius: 2, background: color }}
                />
                <span className="text-s">{key}</span>
              </div>
              <span className="text-s font-semibold">{fmtVal(p.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}