import React, { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { NumericFormat } from 'react-number-format';
import MonthYearPicker from '../MonthYearPicker';

export default function ModalNovoPlano({ aberto, setAberto, plano, setPlano, onSalvar }) {

  const emitirRefreshPlanos = () => {
    window.dispatchEvent(new CustomEvent('planos:movimento:changed'));
  };

  const handleClose = () => {
    setAberto(false);
    emitirRefreshPlanos();           // 👈 atualiza gráfico ao fechar (cancelar/clicar fora)
  };

  const handleSalvar = async () => {
    try {
      const ok = await onSalvar?.(); // onSalvar deve retornar true/false
      if (!ok) return;               // ❌ validação falhou → mantém modal aberto
      setAberto(false);              // ✅ sucesso → fecha
      emitirRefreshPlanos();
    } catch (e) {
      // Em caso de exceção, também mantém aberto
      console.error(e);
    }
  };

  // 🔄 Atualiza valor da parcela ou valor total conforme tipo selecionado
  useEffect(() => {
    const parcelas = parseInt(plano.parcelas);
    const [anoI, mesI] = (plano.inicio || '').split('-').map(Number);
    const [anoF, mesF] = (plano.fim || '').split('-').map(Number);
    const meses = plano.usarParcelas ? 0 : (anoF && mesF && anoI && mesI)
      ? (anoF - anoI) * 12 + (mesF - mesI) + 1
      : 0;

    const divisor = plano.usarParcelas ? parcelas : meses;
    const arrecadado = parseFloat(plano.arrecadado) || 0;

    if (!plano.usarParcela && plano.valorTotal && divisor > 0) {
      const restante = parseFloat(plano.valorTotal) - arrecadado;
      const valorParcela = restante > 0 ? restante / divisor : '';
      setPlano(prev => ({ ...prev, valorParcela: valorParcela ? valorParcela.toFixed(2) : '' }));
    }

    if (plano.usarParcela && plano.valorParcela && divisor > 0) {
      const total = parseFloat(plano.valorParcela) * divisor + arrecadado;
      setPlano(prev => ({ ...prev, valorTotal: total ? total.toFixed(2) : '' }));
    }
  }, [
    plano.valorTotal,
    plano.valorParcela,
    plano.parcelas,
    plano.fim,
    plano.inicio,
    plano.usarParcela,
    plano.usarParcelas,
    plano.arrecadado
  ]);

  return (
     <Dialog open={aberto} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-2xl">
          <Dialog.Title className="text-lg font-bold text-gray-800 dark:text-darkText mb-4 text-center">
            {plano?.id ? 'Editar Plano' : 'Novo Plano'}
          </Dialog.Title>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300">Nome do plano</label>
                <input
                  type="text"
                  value={plano.nome}
                  onChange={(e) => setPlano(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
              </div>

              <div className="space-y-4">
  <MonthYearPicker
    label="Início"
    value={plano.inicio}
    onChange={(v) => setPlano(prev => ({ ...prev, inicio: v }))}
    startYear={2025}
    endYear={2060}
  />

  <div>
    <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">Tipo de prazo</label>
    <select
      value={plano.usarParcelas ? 'parcelas' : 'fim'}
      onChange={(e) => setPlano(prev => ({ ...prev, usarParcelas: e.target.value === 'parcelas' }))}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-white dark:border-gray-600"
    >
      <option value="fim">Mês/Ano final</option>
      <option value="parcelas">Número de parcelas</option>
    </select>
  </div>
</div>

              <div>
                {!plano.usarParcelas ? (
                  <>
<MonthYearPicker
  label="Mês/Ano final"
  value={plano.fim}
  onChange={(v) => setPlano(prev => ({ ...prev, fim: v }))}
  startYear={2025}
  endYear={2060}
/>
                  </>
                ) : (
                  <>
                    <label className="text-sm text-gray-600 dark:text-gray-300">Quantidade de parcelas</label>
                    <input
                      type="number"
                      min={1}
                      value={plano.parcelas}
                      onChange={(e) => setPlano(prev => ({ ...prev, parcelas: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                  </>
                )}
              </div>

              
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300">Preencher com</label>
                <select
                  value={plano.usarParcela ? 'parcela' : 'total'}
                  onChange={(e) =>
                    setPlano(prev => ({ ...prev, usarParcela: e.target.value === 'parcela' }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                >
                  <option value="total">Valor total</option>
                  <option value="parcela">Valor da parcela</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-300">Valor total</label>
                  <NumericFormat
                    value={plano.valorTotal}
                    onValueChange={({ floatValue }) =>
                      setPlano(prev => ({ ...prev, valorTotal: floatValue }))
                    }
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    allowNegative={false}
                    disabled={plano.usarParcela}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-300">Valor da parcela</label>
                  <NumericFormat
                    value={plano.valorParcela}
                    onValueChange={({ floatValue }) =>
                      setPlano(prev => ({ ...prev, valorParcela: floatValue }))
                    }
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    allowNegative={false}
                    disabled={!plano.usarParcela}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300">Valor arrecadado</label>
                <NumericFormat
                  value={plano.arrecadado}
                  onValueChange={({ floatValue }) =>
                    setPlano(prev => ({ ...prev, arrecadado: floatValue }))
                  }
                  thousandSeparator="."
                  decimalSeparator=","
                  prefix="R$ "
                  allowNegative={false}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300">Status</label>
                <select
                  value={plano.status}
                  onChange={(e) => setPlano(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            <div className="md:col-span-2 flex flex-col items-center">
  <label className="text-sm text-gray-600 dark:text-gray-300 mb-1">Ícone</label>
  <select
    value={plano.icone}
    onChange={(e) => setPlano(prev => ({ ...prev, icone: e.target.value }))}
    className="w-60 rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-white dark:border-gray-600"
  >
    <option value="PiggyBank">Cofrinho</option>
    <option value="Home">Casa</option>
    <option value="Car">Carro</option>
    <option value="GraduationCap">Estudos</option>
    <option value="Briefcase">Trabalho</option>
    <option value="Plane">Viagem</option>
  </select>
</div>
          </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="
            inline-flex items-center justify-center
            px-3 py-1.5 rounded-md text-sm
            border border-gray-300 dark:border-gray-600
            bg-white hover:bg-gray-50 active:bg-gray-100
            dark:bg-transparent dark:hover:bg-white/10
            text-gray-700 dark:text-gray-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60
            focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900
            transition-colors
          "
        >
          Cancelar
        </button>
        <button onClick={handleSalvar} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
          {plano?.id ? 'Salvar Alterações' : 'Criar'}
        </button>
      </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}