import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MagicLogin() {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get('token');
    (async () => {
      try {
        const r = await fetch('/api/auth/magic/consume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tok }),
        });
        const data = await r.json();
        if (data?.token) {
          localStorage.setItem('token', data.token);
          navigate(data.needsPassword ? '/definir-senha' : '/', { replace: true });
          return;
        }
      } catch {}
      navigate('/login', { replace: true });
    })();
  }, [navigate]);
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center text-white">
      <div className="h-6 w-6 rounded-full border-2 border-gray-600 border-t-transparent animate-spin"></div>
    </div>
  );
}