import React from "react";
import Card from "../ui/Card";

export default function ChartWrapper({ title, subtitle, height = "h-64", children }) {
  return (
    <Card className="p-4">
      {title && (
        <div className="text-sm font-medium text-gray-800 dark:text-zinc-100 mb-1">
          {title}
        </div>
      )}
      {subtitle && (
        <div className="text-xs text-gray-500 dark:text-zinc-400 mb-3">{subtitle}</div>
      )}
      <div className={height}>{children}</div>
    </Card>
  );
}