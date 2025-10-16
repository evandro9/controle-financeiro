import { useEffect, useMemo, useState } from 'react';
import { fetchLancamentosResumoMensal, fetchPlanosMensalForBalanco } from '../services/balancoApi';

export function useBalancoAnual({ ano }) {
  const [status, setStatus] = useState('idle'); // idle|loading|success|error
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    async function run() {
      setStatus('loading'); setError(null);
      try {
        const [resumo, planos] = await Promise.all([
          fetchLancamentosResumoMensal({ ano }),
          fetchPlanosMensalForBalanco({ ano })
        ]);

        if (!alive) return;

        // index por mês '01'..'12'
        const idxResumo = Object.fromEntries((resumo || []).map(r => [String(r.mes).padStart(2,'0'), r]));
        const idxPlanos = Object.fromEntries((planos || []).map(p => [String(p.mes).padStart(2,'0'), p]));

        const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

        const merged = Array.from({length:12}, (_,i) => {
          const key = String(i+1).padStart(2,'0');
          const r = idxResumo[key] || { receita:0, despesa:0 };
          const p = idxPlanos[key] || { aporte:0, retirada:0 };

          const receita  = Number(r.receita || 0);
          const despesas = Number(r.despesa || 0);
          const aportes  = Number(p.aporte || 0);
          const retiradas= Number(p.retirada || 0);

          // saldo disponível do mês:
          // entradas - saídas - aportes + retiradas
          const saldo = receita - despesas - aportes + retiradas;

          return {
            mes: nomes[i],           // <- XAxis usa 'mes' textual
            receita,
            despesas,
            planos: aportes,         // label "Aportes em Planos"
            saldo
          };
        });

        setRows(merged);
        setStatus('success');
      } catch (e) {
        if (!alive) return;
        setError(e); setStatus('error');
      }
    }
    run();
    return () => { alive = false; };
  }, [ano]);

  return { status, error, data: rows };
}