import React from "react";

export default function Card({ className = "", children }) {
  return (
    <div className={`rounded-xl shadow-[0_6px_20px_rgba(0,0,0,0.06)] bg-white dark:bg-darkCard ${className}`}>
      {children}
    </div>
  );
}