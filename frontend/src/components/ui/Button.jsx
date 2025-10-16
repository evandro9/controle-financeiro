import React from "react";

const variants = {
  primary:
    "bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500",
  secondary:
    "bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100",
  ghost:
    "hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-100",
  danger:
    "bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-500",
};

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-3 text-sm",
};

export default function Button({
  as = "button",
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  const Comp = as;
  return (
    <Comp
      className={`inline-flex items-center justify-center rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </Comp>
  );
}