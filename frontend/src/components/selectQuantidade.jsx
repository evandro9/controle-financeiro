import React, { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Check, ChevronsUpDown } from 'lucide-react';

const opcoes = [
  { label: '10', value: '10' },
  { label: '30', value: '30' },
  { label: '50', value: '50' },
  { label: 'Todos', value: '9999' }
];

export default function SelectQuantidade({ quantidade, setQuantidade, className }) {
  const selecionado = opcoes.find(o => o.value === Number(quantidade)) || opcoes[0];

  return (
    <div className={className ?? 'w-28'}>
      <Listbox value={selecionado.value} onChange={setQuantidade}>
        <div className="relative mt-1">
          <Listbox.Button
            className="relative w-full h-9 cursor-pointer rounded-lg border border-gray-300
                       bg-white px-2 pr-7 text-left text-sm text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
          >
            <span className="block truncate">{selecionado.label}</span>
            <ChevronsUpDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted"
              aria-hidden="true"
            />
          </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-darkCard
                       py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none
                       border border-gray-200 dark:border-white/10"
          >
            {opcoes.map((opcao) => (
              <Listbox.Option
                key={opcao.value}
                value={opcao.value}
                className={({ active }) =>
                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                    active
                      ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-300'
                      : 'text-gray-900 dark:text-darkText'
                  }`
                }
              >
                {({ selected }) => (
                  <>
                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>{opcao.label}</span>
                    {selected ? (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                    ) : null}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
        </div>
      </Listbox>
    </div>
  );
}