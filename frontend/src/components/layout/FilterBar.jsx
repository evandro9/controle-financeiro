import React from "react";
import Card from "../ui/Card";

export default function FilterBar({ children, className = "" }) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="text-xs text-gray-500 dark:text-zinc-400 mb-2">Filtros:</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {children}
      </div>
    </Card>
  );
}