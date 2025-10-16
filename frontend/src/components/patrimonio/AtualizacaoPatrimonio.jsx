import React, { useMemo, useState, useEffect, useDeferredValue } from 'react';
import { toast } from 'react-toastify';
import { Plus, Trash2, X } from 'lucide-react';
import InfoTip from '../ui/InfoTip'

const MESES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const fmtBRL = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// máscaras numéricas
const fmtNoSymbolBR = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseMoneyInput = (s) => {
  const str = String(s);
  const sign = /^\s*-/.test(str) ? -1 : 1;   // aceita "-" no começo
  const digits = str.replace(/[^0-9]/g, ''); // mantém somente números
  if (!digits) return null;                  // permite ficar vazio
 return sign * (Number(digits) / 100);      // "123456" -> 1234.56 (com sinal)
};

function AtualizacaoPatrimonio({
  ano,
  mes,
  setMes,
  contas = [],
  onSaved,
  onCriarConta,     // opcional
  onExcluirConta,   // opcional
}) {
  const token = useMemo(() => localStorage.getItem('token'), []);
  const isDark = document.documentElement.classList.contains('dark');
  const toastStyle = isDark
    ? { background: '#1f2937', color: '#f3f4f6' }
    : { background: '#ffffff', color: '#1f2937', border: '1px solid #e5e7eb' };

  const [contaId, setContaId] = useState(null);

  // form state
const [saldoFmt, setSaldoFmt] = useState('');   // "1.234,56" (sem R$)
const [dolarFmt, setDolarFmt] = useState('');   // "R$ 5,57"
const saldoRaw = useMemo(() => {
  const v = parseMoneyInput(saldoFmt);
  return v == null ? 0 : v;
}, [saldoFmt]);
const dolarRaw = useMemo(() => {
  const v = parseMoneyInput(dolarFmt);
  return v == null ? 0 : v;
}, [dolarFmt]);
const saldoFinal = useMemo(() => {
  const s = Number(saldoRaw || 0);
  const d = Number(dolarRaw || 0);
  if (!d || d <= 0) return s;
  return s * d;
}, [saldoRaw, dolarRaw]);

  // Modal Nova Conta
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const criandoHabilitado = typeof onCriarConta === 'function';
  const excluirHabilitado = typeof onExcluirConta === 'function' && contaId != null;

  // Suaviza updates vindos do pai
  const contasDefer = useDeferredValue(contas);

  useEffect(() => {
    // Seleciona primeira conta quando lista chega
    if (!contaId && Array.isArray(contasDefer) && contasDefer.length) {
      setContaId(contasDefer[0].id);
    }
  }, [contasDefer, contaId]);

  async function handleCriarConta() {
    if (!criandoHabilitado) return;
    const nome = (novoNome || '').trim();
    if (!nome) {
      toast.warn('Informe um nome para a conta.', { style: toastStyle });
      return;
    }
    try {
      const nova = await onCriarConta(nome);  // espera { id, nome, ... }
      toast.success('Conta criada!', { style: toastStyle });
      setNovoNome('');
      setModalNovaAberto(false);
      if (nova?.id) setContaId(nova.id);      // já seleciona a conta criada
    } catch {
      toast.error('Erro ao criar conta.', { style: toastStyle });
    }
  }

  async function handleExcluirConta() {
    if (!excluirHabilitado) return;
    if (!confirm('Excluir esta conta? Essa ação não pode ser desfeita.')) return;
    try {
      await onExcluirConta(contaId);
      toast.success('Conta excluída!', { style: toastStyle });
      // Dica: recarregue contas no pai e atualize contaId
    } catch {
      toast.error('Erro ao excluir conta.', { style: toastStyle });
    }
  }

  async function handleSalvar(e) {
    e?.preventDefault?.();
    if (!contaId) {
      toast.warn('Escolha uma conta.', { style: toastStyle });
      return;
    }
    if (saldoFmt === '' || Number.isNaN(Number(saldoRaw))) {
      toast.warn('Informe um saldo válido.', { style: toastStyle });
      return;
    }
    if (dolarFmt && Number(dolarRaw) <= 0) {
      toast.warn('Dólar deve ser maior que zero.', { style: toastStyle });
      return;
    }

    try {
      const res = await fetch('/api/patrimonio/saldos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conta_id: contaId,
          ano,
          mes,
          saldo: Number(saldoFinal || 0), // sempre salva o final (convertido se dólar informado)
        })
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      toast.success('Patrimônio atualizado!', { style: toastStyle });
      if (onSaved) await onSaved();
      setSaldoFmt('');
      setDolarFmt('');
    } catch {
      toast.error('Erro ao salvar patrimônio.', { style: toastStyle });
    }
  }

const contaSelecionada = React.useMemo(() => {
  if (!Array.isArray(contas)) return null;
  return contas.find(c => Number(c.id) === Number(contaId)) || null;
}, [contas, contaId]);

const contaNome = contaSelecionada?.nome || '';

const mesLabel = React.useMemo(() => {
  if (!mes || !ano) return '';
  return `${MESES_NOMES[mes - 1]}/${String(ano).slice(-2)}`;
}, [mes, ano]);

const fmtDolar = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });




  return (
    <div className="bg-white dark:bg-darkCard p-6 rounded-xl shadow border border-gray-100 dark:border-darkBorder">
      {/* Header: título (lg) + i de informação (sem subtítulo) */}
      <div className="h-[36px] flex items-center justify-center mb-4 relative">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-darkText text-center">
          Atualizar Patrimônio Mensal
        </h3>
        <div className="absolute right-0">
          <InfoTip title="Como funciona" ariaLabel="Informações de atualização">
            <ul className="list-disc pl-4 space-y-1">
              <li>Escolha o <b>mês</b> e a <b>conta</b> que deseja atualizar.</li>
              <li>Informe o <b>saldo atualizado</b> da conta para o mês selecionado.</li>
              <li>Se a conta for em moeda estrangeira, preencha o campo <b>Dólar</b> para converter.</li>
              <li>Ao salvar, registramos o <b>valor final</b> (saldo × dólar, se informado) para esse mês/conta.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      <form onSubmit={handleSalvar} className="grid grid-cols-12 items-end gap-x-4 gap-y-3">
  {/* Mês */}
  <div className="col-span-12 md:col-span-2">
    <label className="text-xs font-medium dark:text-darkText">Mês</label>
    <select
      value={mes}
      onChange={(e) => setMes(Number(e.target.value))}
      className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-darkBg text-gray-800 dark:text-darkText border-gray-300 dark:border-darkBorder"
    >
      {MESES_NOMES.map((m, i) => (<option key={i+1} value={i+1}>{m}</option>))}
    </select>
  </div>

  {/* Conta + novo */}
  <div className="col-span-12 md:col-span-3">
    <label className="text-xs font-medium dark:text-darkText">Conta</label>
    {/* ⬇️ era gap-2, agora gap-4 para igualar ao grid */}
    <div className="flex items-center gap-4">
      {/* opções memorizadas para não recriar no clique */}
      <select
        value={contaId ?? ''}
        onChange={(e) => setContaId(Number(e.target.value))}
        className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-darkBg text-gray-800 dark:text-darkText border-gray-300 dark:border-darkBorder"
      >
        <option value="" disabled>Selecione...</option>
        {useMemo(
          () => (contasDefer || []).map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          )),
          [contasDefer]
        )}
      </select>

      <button
        type="button"
        onClick={() => setModalNovaAberto(true)}
        disabled={!criandoHabilitado}
        className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        title={criandoHabilitado ? 'Nova conta' : 'Ação indisponível'}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  </div>

  {/* Saldo atualizado */}
  <div className="col-span-12 md:col-span-3">
    <label className="text-xs font-medium dark:text-darkText">Saldo atualizado</label>
    <input
      type="text"
      inputMode="decimal"                 /* teclado com ponto/sinal em mobile */
      pattern="-?[0-9.,]*"               /* permite '-' */
      value={saldoFmt}
      onChange={(e) => {
        const v = e.target.value;
        // Se o usuário digitou só o sinal, preserva-o até vir o primeiro dígito
        if (/^\s*-$/.test(v)) { setSaldoFmt('-'); return; }
        const raw = parseMoneyInput(v);
        if (raw == null) setSaldoFmt('');       // vazio
        else setSaldoFmt(fmtNoSymbolBR(raw));  // formata mantendo o sinal
      }}
      placeholder="0,00"
      className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-darkBg text-gray-800 dark:text-darkText border-gray-300 dark:border-darkBorder text-right"
    />
  </div>

  {/* Dólar (opcional) */}
  <div className="col-span-12 md:col-span-2">
    <label className="text-xs font-medium dark:text-darkText whitespace-nowrap">Dólar (opcional)</label>
    <input
  type="text"
  inputMode="numeric"
  value={dolarFmt}
  onChange={(e) => {
    const raw = parseMoneyInput(e.target.value);
    if (raw == null) setDolarFmt('');
    else setDolarFmt(fmtBRL(raw));         // "R$ 5,57"
  }}
  placeholder="R$ 5,57"
      className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-darkBg text-gray-800 dark:text-darkText border-gray-300 dark:border-darkBorder text-right"
    />
  </div>

{/* Salvar — ocupa toda a coluna para manter o mesmo espaçamento lateral */}
<div className="col-span-12 md:col-span-2">
  <button
    type="submit"
    className="w-full bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition"
  >
    Salvar
  </button>
</div>

{saldoRaw > 0 && dolarRaw > 0 && contaNome && (
  <div className="col-span-12">
    <div className="rounded-lg border px-4 py-3 text-sm
                    bg-blue-50 border-blue-200 text-blue-800
                    dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200">
      <span className="font-medium">Confirmação:</span>{' '}
      Será atualizado em <span className="font-semibold">{contaNome}</span>, para
      <span className="font-semibold"> {mesLabel}</span>, o valor total de{' '}
      <span className="font-semibold">{fmtBRL(saldoFinal)}</span>{' '}
      (<span className="whitespace-nowrap">{fmtBRL(saldoRaw)}</span> ×{' '}
      <span className="whitespace-nowrap">dólar {fmtBRL(dolarRaw)}</span>).
    </div>
  </div>
)}

</form>

      {/* Modal Nova Conta */}
      {modalNovaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalNovaAberto(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-darkCard rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-semibold text-gray-800 dark:text-darkText">Crie sua nova conta</h4>
              <button
                type="button"
                onClick={() => setModalNovaAberto(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-darkBorder"
              >
                <X className="w-4 h-4 text-gray-500 dark:text-darkMuted" />
              </button>
            </div>
            <label className="text-xs font-medium dark:text-darkText">Nome da conta</label>
            <input
              type="text"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex: NU, C6, XP..."
              className="mt-1 w-full rounded-lg border px-3 py-2 bg-white dark:bg-darkBg text-gray-800 dark:text-darkText border-gray-300 dark:border-darkBorder"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalNovaAberto(false)}
                className="px-3 py-2 rounded-lg border dark:border-darkBorder text-gray-600 dark:text-darkText hover:bg-gray-50 dark:hover:bg-darkBorder/60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCriarConta}
                disabled={!criandoHabilitado}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default React.memo(AtualizacaoPatrimonio);