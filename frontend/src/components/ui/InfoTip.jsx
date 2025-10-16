import React from 'react';
import { Info } from 'lucide-react';

/**
 * InfoTip
 * Ícone “i” com tooltip padronizada (hover/focus).
 *
 * Props:
 * - title?: string         -> Título em negrito no topo do tooltip
 * - children?: ReactNode   -> Conteúdo do tooltip (pode ser <ul>, <p>, etc.)
 * - side?: 'right'|'left'  -> Lado de ancoragem do tooltip (padrão: 'right')
 * - size?: 'sm'|'md'       -> Tamanho do botão/ícone (padrão: 'sm')
 * - className?: string     -> Classes extras no wrapper externo
 * - tooltipClassName?: string -> Classes extras no tooltip
 * - ariaLabel?: string     -> Texto para leitores de tela do botão
 * - width?: 'w-64'|'w-72'|'w-80' -> Largura do tooltip (padrão: 'w-72')
 */
export default function InfoTip({
  title,
  children,
  side = 'right',
  size = 'sm',
  className = '',
  tooltipClassName = '',
  ariaLabel = 'Informações',
  width = 'w-72',
}) {
  const pad = size === 'md' ? 'p-2' : 'p-1.5';
  const icon = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  const sideClass = side === 'left' ? 'left-0' : 'right-0';

  return (
    <div className={`relative z-30 ${className}`}>
      <div className="group relative inline-block">
        <button
          type="button"
          aria-label={ariaLabel}
          className={`peer ${pad} rounded-full transition
                     bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
        >
          <Info className={`${icon} text-gray-500 dark:text-gray-300`} />
        </button>

        {/* Tooltip: aparece no hover da group ou foco do botão (peer-focus) */}
        <div
          className={`hidden group-hover:block peer-focus:block absolute ${sideClass} mt-2 ${width} z-50
                      rounded-md shadow-lg p-3 text-xs leading-relaxed
                      bg-white text-gray-800 border border-gray-200
                      dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700
                      ${tooltipClassName}`}
          style={{ pointerEvents: 'none' }}
          role="tooltip"
        >
          {title ? <div className="font-semibold mb-1">{title}</div> : null}
          {children}
        </div>
      </div>
    </div>
  );
}