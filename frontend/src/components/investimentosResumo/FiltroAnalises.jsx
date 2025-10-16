import React from "react";

export default function FiltroAnalises(props) {
  const { value, onChange, options, title = "Análises", className = "", ...rest } = props;
  return (
    <div
      {...rest}
      className={
        "p-4 shadow-md rounded-xl bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder " +
        className
      }
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-darkText">{title}:</span>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onChange(opt.key)}
              className={
                "px-3 py-1.5 rounded-full text-sm transition " +
                (value === opt.key
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}