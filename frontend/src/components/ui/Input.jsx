import React from "react";

export default function Input({ className = "", ...props }) {
  return (
    <input
      className={`h-9 w-full rounded-lg border bg-white px-3 text-sm text-gray-700
      focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none
      dark:bg-darkBg dark:text-zinc-100 dark:border-darkBorder dark:focus:ring-blue-500/50 ${className}`}
      {...props}
    />
  );
}