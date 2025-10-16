import { useMemo } from 'react';

export default function usePeriodoRange(periodo) {
  return useMemo(() => {
    const today = new Date();
    const fim = today.toISOString().slice(0,10);
    const start = new Date(today);
    if (periodo === '12m') start.setMonth(start.getMonth() - 11, 1);
    else if (periodo === '24m') start.setMonth(start.getMonth() - 23, 1);
    else if (periodo === 'ano') start.setFullYear(today.getFullYear(), 0, 1);
    else start.setFullYear(1970, 0, 1); // 'inicio'
    const inicio = start.toISOString().slice(0,10);
    return { inicio, fim };
  }, [periodo]);
}