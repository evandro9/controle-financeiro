import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ModalCategoria({ categoria, onClose }) {
  const [nome, setNome] = useState('');

  useEffect(() => {
    if (categoria) {
      setNome(categoria.nome);
    }
  }, [categoria]);

  const salvarCategoria = async () => {
    const token = localStorage.getItem('token');
    const url = categoria
      ? `/api/categorias/${categoria.id}`
      : '/api/categorias';
    const metodo = categoria ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ nome })
    });

if (res.ok) {
  toast.success('Categoria salva com sucesso');
  onClose();
} else {
  toast.error('Erro ao salvar categoria');
}

  };

 return (
  <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-darkCard rounded-lg shadow-lg p-6 w-full max-w-md">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-darkText">
        {categoria ? 'Editar Categoria' : 'Nova Categoria'}
      </h2>

      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome da categoria"
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
          onClick={salvarCategoria}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-500"
        >
          Salvar
        </button>
      </div>
    </div>
  </div>
);
}