// src/components/SelectPadrao.jsx
import React from 'react';

const SelectPadrao = ({ value, onChange, options = [], placeholder }) => {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
    >
      <option value="" disabled hidden>{placeholder || 'Selecione'}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
};

export default SelectPadrao;