// App.jsx
import React, { useEffect, useState, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ConsentGate from './pages/ConsentGate.jsx';
import Termos from './pages/legal/Termos.jsx';
import Privacidade from './pages/legal/Privacidade.jsx';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Toaster } from 'react-hot-toast';
import { ToastContainer } from 'react-toastify';
import Header from './components/Header';
import CadastroCategoria from './pages/CadastroCategoria';
import CadastroSubcategoria from './pages/CadastroSubcategoria';
import Layout from './pages/Layout';
import CadastroFormaPagamento from './pages/CadastroFormaPagamento';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeContext } from './context/ThemeContext';
import CadastroClassesInvestimento from './pages/CadastroClassesInvestimento';
import CadastroSubclassesInvestimento from './pages/CadastroSubclassesInvestimento';
import AppShell from './components/layout/AppShell';
import Sidebar from './components/Sidebar';
import BannerDemo from './components/BannerDemo';
import MinhaAssinatura from './pages/MinhaAssinatura.jsx';
import { PlanProvider } from './context/PlanContext.jsx';
import MagicLogin from './pages/MagicLogin';
import SetPassword from './pages/SetPassword';

function AppContent({ logado, setLogado, modoUso, setModoUso, sair }) {
  const { darkMode } = useContext(ThemeContext);

  return (
    <>
      <Routes>
        {/* Landing pública na raiz */}
        <Route path="/" element={<Landing />} />

        {/* Login público (se já estiver logado, envia para o dashboard) */}
        <Route
          path="/login"
          element={logado ? <Navigate to="/dashboard" replace /> : <Login onLogin={() => setLogado(true)} />}
        />

        {/* Rotas logadas embrulhadas no AppShell */}
        <Route
          path="/dashboard/*"
          element={
            logado ? (
               <PlanProvider authSignal={logado}>
 <AppShell
   sidebar={<Sidebar modoUso={modoUso} onSair={sair} />}
   headerRight={<Header modoUso={modoUso} setModoUso={setModoUso} onSair={sair} />}
>
                <Dashboard key={modoUso} modoUso={modoUso} onSair={sair} />
              </AppShell>
              </PlanProvider>
            ) : (
              <Navigate to="/" />
            )
          }
        />

 {/* Minha Assinatura (usa o mesmo AppShell do dashboard) */}
 <Route
   path="/dashboard/assinatura"
   element={
     logado ? (
      <PlanProvider authSignal={logado}>
       <AppShell
         sidebar={<Sidebar modoUso={modoUso} onSair={sair} />}
         headerRight={<Header modoUso={modoUso} setModoUso={setModoUso} onSair={sair} />}
       >
         <MinhaAssinatura />
       </AppShell>
       </PlanProvider>
     ) : (
       <Navigate to="/" />
     )
   }
 />

        <Route path="/entrar/magic" element={<MagicLogin />} />
        <Route path="/definir-senha" element={<SetPassword />} />

        {/* Suas páginas de Config também logadas, dentro do AppShell */}
        <Route path="/config/*" element={ logado ? (
          <PlanProvider authSignal={logado}>
            <AppShell
              sidebar={<Sidebar modoUso={modoUso} onSair={sair} />}
              headerRight={<Header modoUso={modoUso} setModoUso={setModoUso} onSair={sair} />}
            >
            <Layout modoUso={modoUso} onSair={sair} />
            </AppShell>
          </PlanProvider>
        ) : (
          <Navigate to="/" />
            )
          }
        >
          <Route path="categorias" element={<CadastroCategoria />} />
          <Route path="subcategorias" element={<CadastroSubcategoria />} />
          <Route path="formas-pagamento" element={<CadastroFormaPagamento />} />
          <Route path="investimentos/classes" element={<CadastroClassesInvestimento />} />
          <Route path="investimentos/subclasses" element={<CadastroSubclassesInvestimento />} />
        </Route>

        <Route path="/legal/aceite" element={<ConsentGate />} />
        <Route path="/legal/termos" element={<Termos />} />
        <Route path="/legal/privacidade" element={<Privacidade />} />

      </Routes>

      <Toaster position="top-center" reverseOrder={false} />
      <ToastContainer
        position="top-center"
        autoClose={3000}
        theme={darkMode ? 'dark' : 'light'}
        bodyClassName={() => (darkMode ? 'text-darkText' : 'text-gray-800')}
      />
    </>
  );
}

function App() {
  const [logado, setLogado] = useState(() => !!localStorage.getItem('token'));
  const [modoUso, setModoUso] = useState(localStorage.getItem('modoUso') || 'completo');

  const sair = () => {
    localStorage.clear();
    setLogado(false);
  };

  useEffect(() => {
    const verificarToken = () => {
      const token = localStorage.getItem('token');
      setLogado(!!token);
    };

    verificarToken();
    window.addEventListener('storage', verificarToken);
    return () => window.removeEventListener('storage', verificarToken);
  }, []);

  useEffect(() => {
    localStorage.setItem('modoUso', modoUso);
  }, [modoUso]);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent
          logado={logado}
          setLogado={setLogado}
          modoUso={modoUso}
          setModoUso={setModoUso}
          sair={sair}
        />
        {/* Banner mobile para modo demo (fora do header) */}
        <BannerDemo />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;