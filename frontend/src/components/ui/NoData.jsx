import React from 'react';

export default function NoData({ message = "Sem dados para exibir.", hint = null, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 ${className}`}>
      <svg width="36" height="36" viewBox="0 0 24 24" className="opacity-60">
        <path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v11.5A1.5 1.5 0 0 0 4.5 18H18l3 3V5a2 2 0 0 0-2-2Z"/>
      </svg>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{message}</p>
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}