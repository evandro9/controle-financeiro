import React from 'react';
import { Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <main className="flex-1 h-full min-h-0 overflow-y-auto pb-16 sm:pb-20">
        <Outlet />
      </main>
    </div>
  );
}