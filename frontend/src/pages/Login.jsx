// Login.jsx
import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Mail, Lock, User, KeyRound } from 'lucide-react';

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showCadastro, setShowCadastro] = useState(false);
  const [cadastro, setCadastro] = useState({ nome: '', email: '', senha: '', confirmar: '' });
  const [erros, setErros] = useState({ email: '', senha: '' });

  useEffect(() => {
    validarCadastro();
  }, [cadastro.email, cadastro.senha, cadastro.confirmar]);

  const fazerLogin = async () => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('nomeUsuario', data.nome);
        onLogin();
      } else {
        toast.error('Usuário ou senha inválidos');
      }
    } catch (err) {
      toast.error('Erro ao conectar com o servidor');
    }
  };

  async function enviarMagicLink() {
    if (!usuario || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usuario)) {
      return toast.error('Informe seu e-mail para receber o link');
    }
    try {
      await fetch('/api/auth/magic/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: usuario, purpose: 'reset' }),
      });
      toast.success('Se o e-mail existir, enviamos um link de acesso.');
    } catch {
      // Mantém a mesma mensagem para não expor enumeração de e-mails
      toast.success('Se o e-mail existir, enviamos um link de acesso.');
    }
  }

  const validarCadastro = () => {
    const novosErros = { email: '', senha: '' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cadastro.email)) {
      novosErros.email = 'Email inválido';
    }
    if (cadastro.senha !== cadastro.confirmar) {
      novosErros.senha = 'As senhas não coincidem';
    }
    setErros(novosErros);
    return !novosErros.email && !novosErros.senha;
  };

  const fazerCadastro = async () => {
    const { nome, email, senha, confirmar } = cadastro;
    if (!nome || !email || !senha || !confirmar) return toast.error('Preencha todos os campos');
    if (!validarCadastro()) return;

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha })
      });
      if (res.ok) {
        toast.success('Conta criada com sucesso! Faça login.');
        setShowCadastro(false);
        setCadastro({ nome: '', email: '', senha: '', confirmar: '' });
      } else {
        toast.error('Erro ao criar conta');
      }
    } catch (err) {
      toast.error('Erro de conexão');
    }
  };

  return (
  <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center text-white">
    <div className="text-center mb-12">
      <h1 className="text-4xl md:text-5xl font-bold text-white">
        Meu Orçamento Doméstico
      </h1>
      <p className="text-lg md:text-xl text-gray-400 mt-2">
        Controle suas finanças com facilidade
      </p>
    </div>

    <Toaster />
    <div className="bg-gray-800 shadow-lg rounded-xl p-8 w-96 text-center">
      <h2 className="text-3xl font-semibold mb-6 text-center text-white">Login</h2>
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Usuário ou Email"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="w-full pl-10 pr-3 py-2 rounded text-base bg-gray-900 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <Mail className="absolute top-2.5 left-3 text-gray-400" size={18} />
      </div>
      <div className="relative mb-6">
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full pl-10 pr-3 py-2 rounded text-base bg-gray-900 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <Lock className="absolute top-2.5 left-3 text-gray-400" size={18} />
      </div>
      <button
        onClick={fazerLogin}
        className="w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 transition text-base"
      >
        Entrar
      </button>
      {/* Ação secundária: esqueceu a senha (sem botão de compra) */}
      <div className="mt-3 flex items-center justify-center">
        <button
          type="button"
          onClick={enviarMagicLink}
          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md
                     text-gray-300 hover:text-white hover:bg-white/10
                     focus:outline-none focus:ring-2 focus:ring-orange-500/40
                     transition"
        >
          <KeyRound size={16} className="opacity-90" />
          Esqueci minha senha
        </button>
      </div>
    </div>

    {showCadastro && (
      <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-[460px] text-left animate-fade-in">
          <h3 className="text-2xl font-semibold mb-6 text-orange-400">Criar nova conta</h3>
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Nome completo"
                value={cadastro.nome}
                onChange={(e) => setCadastro({ ...cadastro, nome: e.target.value })}
                className="w-full pl-10 pr-3 py-2 rounded text-base bg-gray-900 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <User className="absolute top-2.5 left-3 text-gray-400" size={18} />
            </div>
            <div className="relative">
              <input
                type="email"
                placeholder="Email"
                value={cadastro.email}
                onChange={(e) => setCadastro({ ...cadastro, email: e.target.value })}
                className="w-full pl-10 pr-3 py-2 rounded text-base bg-gray-900 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <Mail className="absolute top-2.5 left-3 text-gray-400" size={18} />
              {erros.email && <p className="text-xs text-red-400 mt-1 ml-1">{erros.email}</p>}
            </div>
            <div className="relative">
              <input
                type="password"
                placeholder="Senha"
                value={cadastro.senha}
                onChange={(e) => setCadastro({ ...cadastro, senha: e.target.value })}
                className="w-full pl-10 pr-3 py-2 rounded text-base bg-gray-900 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <Lock className="absolute top-2.5 left-3 text-gray-400" size={18} />
            </div>
            <div className="relative">
              <input
                type="password"
                placeholder="Confirmar senha"
                value={cadastro.confirmar}
                onChange={(e) => setCadastro({ ...cadastro, confirmar: e.target.value })}
                className="w-full pl-10 pr-3 py-2 rounded text-base bg-gray-900 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <Lock className="absolute top-2.5 left-3 text-gray-400" size={18} />
              {erros.senha && <p className="text-xs text-red-400 mt-1 ml-1">{erros.senha}</p>}
            </div>
          </div>

          <div className="flex justify-between items-center mt-6">
            <button
              onClick={() => setShowCadastro(false)}
              className="text-base text-gray-400 hover:underline"
            >
              Cancelar
            </button>
            <button
              onClick={fazerCadastro}
              className="bg-orange-500 text-white px-5 py-2 rounded-lg hover:bg-orange-600 text-base"
            >
              Criar Conta
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}