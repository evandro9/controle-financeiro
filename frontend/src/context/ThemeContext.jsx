import React, { createContext, useEffect, useRef, useState } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Começa pelo valor local (evita flash), mas vamos hidratar do servidor após login
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const hydrated = useRef(false);       // só POSTa após tentarmos hidratar do servidor
  const [isThemeReady, setIsThemeReady] = useState(false); // gate visual

  const getToken = () => {
    try { return localStorage.getItem('token') || ''; } catch { return ''; }
  };

  // 1) Hidrata do backend assim que o token existir (faz retries curtos até o token aparecer)
useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 12; // ~3s (12 * 250ms) — não travar indefinidamente a tela    

    async function tryHydrate() {
      if (cancelled) return;
      const token = getToken();
      if (!token) {
        // espera o login colocar o token
        attempts += 1;
        if (attempts < MAX_ATTEMPTS) { // ~3s
          setTimeout(tryHydrate, 250);
        } else {
          // sem token mesmo — segue com local
          hydrated.current = true;
          setIsThemeReady(true);
        }
        return;
      }
      // temos token — busca do backend
      try {
        const res = await fetch('/api/user-preferences/theme', {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-access-token': token,
            Accept: 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && (data.theme === 'dark' || data.theme === 'light')) {
            setDarkMode(data.theme === 'dark');
          }
        }
      } catch {
        // ignora; se deu erro, ainda assim liberamos o fluxo normal
      } finally {
        hydrated.current = true;
        setIsThemeReady(true);
      }
    }

    tryHydrate();
    return () => { cancelled = true; };
  }, []);

  // 2) Aplica classe e localStorage SEMPRE que darkMode mudar
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // 3) Persiste no backend quando darkMode mudar (após hidratação)
  useEffect(() => {
    if (!hydrated.current) return;
    (async () => {
      try {
        const token = getToken();
        if (!token) return;
        await fetch('/api/user-preferences/theme', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-access-token': token,
          },
          body: JSON.stringify({ theme: darkMode ? 'dark' : 'light' }),
        });
      } catch {/* silencioso */}
    })();
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode, isThemeReady }}>
      {children}
    </ThemeContext.Provider>
  );
};