import './dev-proxy-compat';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { TourProvider } from './context/TourProvider.jsx';
import { PlanProvider } from './context/PlanContext.jsx';
import './services/api'; // ativa o patch global do fetch

// Resolve o ID do usuário a partir do token (JWT) ou do localStorage
function getUserId() {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
       if (payload && payload.id != null) return String(payload.id);
      }
    }
    const uid = localStorage.getItem('usuarioId');
    return uid ? String(uid) : null;
  } catch {
    return localStorage.getItem('usuarioId') || null;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <TourProvider getUserId={getUserId}>
    <App />
  </TourProvider>
);
