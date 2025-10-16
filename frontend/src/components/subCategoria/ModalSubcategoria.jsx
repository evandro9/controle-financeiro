import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

export default function ModalSubcategoria({ subcategoria, onClose }) {
  const [nome, setNome] = useState('');
  const [categoriaId, setCategoriaId] = useState(null);

useEffect(() => {
  if (subcategoria) {
    setNome(subcategoria.nome || '');

    // Confere se a categoria está no objeto ou tenta extrair da tela pai
    if ('categoria_id' in subcategoria && subcategoria.categoria_id !== null) {
      setCategoriaId(subcategoria.categoria_id);
    } else if ('categoriaId' in subcategoria && subcategoria.categoriaId !== null) {
      setCategoriaId(subcategoria.categoriaId);
    } else {
      console.warn('⚠️ Subcategoria sem categoria_id');
      setCategoriaId(null);
    }
  }
}, [subcategoria]);

const salvarSubcategoria = async () => {
  if (subcategoria?.usuario_id === null) {
    toast.warn('⚠️ Subcategorias padrão não podem ser editadas.');
    return;
  }

  const token = localStorage.getItem('token');
  const url = subcategoria?.id
    ? `/api/subcategorias/${subcategoria.id}`
    : '/api/subcategorias';
  const metodo = subcategoria?.id ? 'PUT' : 'POST';

  console.log('🔄 Enviando:', { nome, categoria_id: categoriaId });

  const res = await fetch(url, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ nome, categoria_id: categoriaId }),
  });

  if (res.ok) {
    toast.success('✅ Subcategoria salva com sucesso');
    onClose();
  } else {
    const err = await res.json().catch(() => ({}));
    console.error('Erro ao salvar:', err);
    toast.error(err.error || '❌ Erro ao salvar subcategoria');
  }
};

  return (
  <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-darkCard rounded-lg shadow-lg p-6 w-full max-w-md">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-darkText">
        {subcategoria?.id ? 'Editar Subcategoria' : 'Nova Subcategoria'}
      </h2>

      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome da subcategoria"
        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 mb-4 dark:bg-gray-700 dark:text-darkText"
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-darkText rounded hover:bg-gray-400 dark:hover:bg-gray-500"
        >
          Cancelar
        </button>
        <button
          onClick={salvarSubcategoria}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-500"
        >
          Salvar
        </button>
      </div>
    </div>
  </div>
);
}