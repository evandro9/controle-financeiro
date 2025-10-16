import React, { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronsUpDown } from 'lucide-react';

function SelectMes({ mes, setMes, mesesDisponiveis, className }) {
  const nomeDosMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril',
    'Maio', 'Junho', 'Julho', 'Agosto',
    'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const mesSelecionado = mesesDisponiveis?.includes(mes) ? mes : mesesDisponiveis[0];

  return (
    <div className={className ?? 'w-40'}>
      <Listbox value={mesSelecionado} onChange={setMes}>
        <div className="relative">
          <Listbox.Button
            className="relative w-full h-9 cursor-pointer rounded-lg border border-gray-300
                       bg-white px-2 pr-7 text-left text-sm text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
          >
            <span className="block truncate">
              {nomeDosMeses[mesSelecionado - 1]}
            </span>
            <ChevronsUpDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted"
            />
          </Listbox.Button>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options
              className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-darkCard
                         py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none
                         border border-gray-200 dark:border-white/10"
            >
              {mesesDisponiveis.map((m) => (
                <Listbox.Option
                  key={m}
                  value={m}
                  className={({ active }) =>
                    `cursor-pointer select-none py-2 px-4 ${
                      active
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'text-gray-700 dark:text-darkText'
                    }`
                  }
                >
                  {nomeDosMeses[m - 1]}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
}

export default SelectMes;