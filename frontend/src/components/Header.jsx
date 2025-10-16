// Header.jsx
import React, { useState, useEffect, useRef } from 'react';
import { UserCircle, ChevronDown, ChevronUp, LogOut, Settings, SlidersHorizontal, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BotaoTema from '../components/BotaoTema';
import { usePlan, useFeature } from '../context/PlanContext.jsx';

export default function Header({ modoUso, setModoUso, onSair }) {
  const nomeUsuario = localStorage.getItem('nomeUsuario') || 'Usuário';
  const descricaoConta = localStorage.getItem('descricaoConta') || 'Conta Pessoal';
  const [menuAberto, setMenuAberto] = useState(false);
  const [subMenuConfig, setSubMenuConfig] = useState(false);
  const menuRef = useRef();
  const navigate = useNavigate();
  const { sub, loading } = usePlan();
  const ativo = !loading && sub?.status === 'active';
  const invest = useFeature('investimentos');
  const premium = useFeature('premium');
  const canInvest = invest || premium;

  // --- Detecta conta demo (id=0 ou email demo@site.com) ---
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => {
    let flag = false;
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const [, b64] = token.split('.');
        if (b64) {
          const payload = JSON.parse(atob(b64));
          const pid = payload?.id;
          const pmail = (payload?.email || '').toLowerCase();
          flag = pid === 0 || String(pid) === '0' || pmail === 'demo@site.com';
        }
      }
    } catch {}
    if (!flag) {
      const uid = localStorage.getItem('usuarioId');
      const email = (localStorage.getItem('emailUsuario') || '').toLowerCase();
      flag = uid === '0' || email === 'demo@site.com';
    }
    setIsDemo(flag);
  }, []);

  const toggleModo = () => {
    setModoUso((prev) => (prev === 'completo' ? 'basico' : 'completo'));
  };

  useEffect(() => {
    const handleClickFora = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => {
      document.removeEventListener('mousedown', handleClickFora);
    };
  }, []);

  return (
    <div className="relative flex items-center gap-2 h-14 translate-y-[6px] lg:translate-y-[6px]" ref={menuRef} data-tour="header-user">
      {/* Menu do Usuário + Botão de Tema */}
      <div className="relative flex flex-col items-end">
        <div
          className="flex items-center gap-1 cursor-pointer hover:opacity-90"
          onClick={() => setMenuAberto(!menuAberto)}
        >
          <span data-tour="header-theme-toggle">
            <BotaoTema size={26} />
          </span>
          <div>
            {/* Linha do nome + badge Demo */}
            <p className="text-sm font-semibold text-gray-700 dark:text-darkText flex items-center gap-2">
              Olá, {nomeUsuario}
              {isDemo && (
                <span
                  title="Conta demo"
                  className="inline-flex items-center uppercase text-[10px] font-semibold
                             px-1.5 py-0.5 rounded-md border
                             bg-amber-100 text-amber-800 border-amber-300
                             dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-700"
                >
                  Demo
                </span>
              )}
            </p>
            {/* Descrição da conta */}
            <span className="text-xs text-gray-500 dark:text-darkMuted bg-gray-100 dark:bg-darkBorder rounded px-2 py-0.5 inline-block">
              {isDemo ? 'Conta Demo' : descricaoConta}
            </span>
          </div>
          <UserCircle size={36} className="text-teal-600 dark:text-teal-400" />
          {menuAberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>

        <div
          className={`absolute right-0 top-full mt-2 z-50 w-64 transition-all duration-200 ease-out transform origin-top-right ${
            menuAberto ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <div
            className="border rounded-lg shadow-lg p-3 w-64 text-sm backdrop-blur-md
                       bg-white dark:bg-darkCard
                       text-gray-700 dark:text-darkText
                       border-gray-200 dark:border-darkBorder"
          >
            {/* Minha Assinatura — SEMPRE leva à página, status será explicado lá */}
            {!loading && (
              <button
                type="button"
                onClick={() => {
                  navigate('/dashboard/assinatura');
                  setMenuAberto(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-2 rounded transition
                           hover:bg-gray-100 dark:hover:bg-darkBorder
                           text-gray-700 dark:text-darkText"
              >
                <Shield size={16} className="text-emerald-600" />
                <span className="text-sm font-medium">Minha assinatura</span>
              </button>
            )}
            <div className="flex flex-col">
              {/* Item pai: Configurações */}
              <div
                onClick={() => setSubMenuConfig(!subMenuConfig)}
                className="flex items-center justify-between px-2 py-2 hover:bg-gray-50 dark:hover:bg-darkBorder rounded transition cursor-pointer"
                data-tour="header-config"
              >
                <div className="flex items-center gap-2">
                  <Settings size={16} />
                  <span>Configurações</span>
                </div>
                {subMenuConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {/* Submenu de Configurações */}
              {subMenuConfig && (
                <div className="pl-6 mt-1 flex flex-col gap-1">
                  <button
                    onClick={() => {
                      navigate('/config/categorias');
                      setMenuAberto(false);
                    }}
                    className="text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-darkBorder rounded"
                  >
                    Cadastro de Categorias
                  </button>
                  <button
                    onClick={() => {
                      navigate('/config/subcategorias');
                      setMenuAberto(false);
                    }}
                    className="text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-darkBorder rounded"
                  >
                    Cadastro de Subcategorias
                  </button>
                  <button
                    onClick={() => {
                      navigate('/config/formas-pagamento');
                      setMenuAberto(false);
                    }}
                    className="text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-darkBorder rounded"
                  >
                    Cadastro de Formas de Pagamento
                  </button>
  {canInvest && (
    <>
      <button onClick={() => { navigate('/config/investimentos/classes'); setMenuAberto(false); }}
        className="text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-darkBorder rounded">
        Cadastro de Classes
      </button>
      <button onClick={() => { navigate('/config/investimentos/subclasses'); setMenuAberto(false); }}
        className="text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-darkBorder rounded">
        Cadastro de SubClasses
      </button>
    </>
  )}
                </div>
              )}
            </div>

            <div
              onClick={onSair}
              className="flex items-center gap-2 px-2 py-2 hover:bg-gray-100 dark:hover:bg-darkBorder rounded transition cursor-pointer text-red-600"
            >
              <LogOut size={16} />
              <span>Sair</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}