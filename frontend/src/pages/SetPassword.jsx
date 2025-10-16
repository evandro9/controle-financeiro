import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';

export default function SetPassword() {
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [saving, setSaving] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [marketingChecked, setMarketingChecked] = useState(false);
  const [versions, setVersions] = useState({ terms: 'v0', privacy: 'v0' });
  const navigate = useNavigate();

  const invalida =
    !senha ||
    !conf ||
    senha.length < 8 ||
    conf.length < 8 ||
    senha !== conf ||
    !termsChecked; // ✅ exige aceite obrigatório

  // Carrega versões atuais dos documentos legais para exibir nos links/labels
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/legal/versions');
        if (r.ok) {
          const j = await r.json();
          setVersions({ terms: j.terms || 'v0', privacy: j.privacy || 'v0' });
        }
      } catch {}
    })();
  }, []);

  async function salvar() {
    if (invalida || saving) return;
    try {
      setSaving(true);
      const token = localStorage.getItem('token');

      // 1) Grava consentimentos (obrigatório: termos+privacidade; opcional: marketing)
      try {
        await fetch('/api/consents/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`,
          },
          body: JSON.stringify({
            terms: true,
            privacy: true,
            marketingOptIn: !!marketingChecked,
          }),
        });
      } catch {}

      // 2) Define a senha
      await fetch('/api/usuarios/definir-senha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
          'x-access-token': token || '',
        },
        body: JSON.stringify({ senha }),
      });
      // limpa auth para não entrar direto no app
      localStorage.removeItem('token');
      // se tiver axios global, limpamos o header (ignora se não existir)
      try { if (window.axios) delete window.axios.defaults.headers.common['Authorization']; } catch {}
      // força hard replace para não herdar estado da SPA
      window.location.replace('/login');
    } catch {
      // mantém silêncio (padrão do projeto). Se quiser, dá pra por um toast aqui.
    } finally {
      setSaving(false);
    }
  }

  function onKey(e) {
    if (e.key === 'Enter') salvar();
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center text-white">
      <div className="w-full max-w-sm border border-gray-700 rounded-xl p-6 bg-gray-800 shadow-xl">
        <h1 className="text-2xl font-semibold mb-1 text-white">Definir nova senha</h1>
        <p className="text-sm text-gray-400 mb-4">
          Por segurança, crie uma senha com pelo menos 8 caracteres.
        </p>

        {/* Senha */}
        <div className="relative mb-3">
          <input
            className="w-full pl-10 pr-10 py-2 rounded bg-gray-900 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            type={show1 ? 'text' : 'password'}
            placeholder="Senha (mín. 8 caracteres)"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            onKeyDown={onKey}
            autoFocus
            name="new-password"
            autoComplete="new-password"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"            
          />
          <Lock className="absolute top-2.5 left-3 text-gray-400" size={18} />
          <button
            type="button"
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-200"
            onClick={() => setShow1(v => !v)}
            aria-label={show1 ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {show1 ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Confirmar senha */}
        <div className="relative mb-1.5">
          <input
            className="w-full pl-10 pr-10 py-2 rounded bg-gray-900 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            type={show2 ? 'text' : 'password'}
            placeholder="Confirmar senha"
            value={conf}
            onChange={e => setConf(e.target.value)}
            onKeyDown={onKey}
            name="confirm-password"
            autoComplete="new-password"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"            
          />
          <Lock className="absolute top-2.5 left-3 text-gray-400" size={18} />
          <button
            type="button"
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-200"
            onClick={() => setShow2(v => !v)}
            aria-label={show2 ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {show2 ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Erros inline */}
        <div className="min-h-[20px] mb-3">
          {senha && senha.length < 8 ? (
            <p className="text-xs text-rose-400">Use pelo menos 8 caracteres.</p>
          ) : null}
          {senha && conf && senha !== conf ? (
            <p className="text-xs text-rose-400">As senhas não coincidem.</p>
          ) : null}
        </div>

        {/* Consentimentos */}
        <div className="space-y-2 mb-4 text-sm">
          <label className="flex items-start gap-2 select-none cursor-pointer">
            <input
              type="checkbox"
              className="mt-1.5"
              checked={termsChecked}
              onChange={e => setTermsChecked(e.target.checked)}
            />
            <span className="text-gray-300">
              Li e concordo com os{' '}
              <a
                href="/legal/termos"
                target="_blank"
                rel="noreferrer"
                className="text-orange-400 hover:underline"
              >
                Termos de Uso (v{versions.terms})
              </a>{' '}
              e a{' '}
              <a
                href="/legal/privacidade"
                target="_blank"
                rel="noreferrer"
                className="text-orange-400 hover:underline"
              >
                Política de Privacidade (v{versions.privacy})
              </a>.
            </span>
          </label>

          <label className="flex items-start gap-2 select-none cursor-pointer">
            <input
              type="checkbox"
              className="mt-1.5"
              checked={marketingChecked}
              onChange={e => setMarketingChecked(e.target.checked)}
            />
            <span className="text-gray-300">
              Aceito receber comunicações de marketing (revogável a qualquer momento).
            </span>
          </label>
        </div>        

        <button
          className="w-full py-2 rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
          onClick={salvar}
          disabled={invalida || saving}
        >
          {saving ? 'Salvando…' : 'Salvar e ir para o login'}
        </button>
      </div>
    </div>
  );
}