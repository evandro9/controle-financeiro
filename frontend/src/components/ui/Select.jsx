import React from "react";

export default function Select({ className = "", children, ...props }) {
  return (
    <div className="relative">
      <select
        className={`h-9 w-full appearance-none rounded-lg border bg-white pl-3 pr-7 text-sm text-gray-700
        focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none
        dark:bg-darkBg dark:text-zinc-100 dark:border-darkBorder dark:focus:ring-blue-500/50 ${className}`}
        {...props}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 select-none text-gray-500 dark:text-zinc-400">
        ▾
      </span>
    </div>
  );
}