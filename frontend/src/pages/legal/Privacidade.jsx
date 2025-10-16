import React, { useEffect, useState } from 'react';

export default function Privacidade() {
  const [v, setV] = useState('v0');
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/legal/versions');
        const j = await r.json();
        setV(j.privacy || 'v0');
      } catch {}
    })();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-gray-200">
      <h1 className="text-3xl font-semibold mb-2">Política de Privacidade</h1>
      <p className="text-sm text-gray-400 mb-6">Versão: v{v}</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">1. Dados coletados</h2>
      <p className="text-gray-300">
        Dados de conta (nome, e-mail), registros de uso e informações necessárias à prestação do serviço.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. Finalidades</h2>
      <p className="text-gray-300">
        Executar o serviço contratado, melhorar a experiência, cumprir obrigações legais e, quando autorizado, enviar comunicações.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. Base legal</h2>
      <p className="text-gray-300">
        Execução de contrato e legítimo interesse para o funcionamento do serviço; consentimento para marketing.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">4. Direitos do titular</h2>
      <p className="text-gray-300">
        Acesso, correção, portabilidade, revogação de consentimento e exclusão, nos termos da legislação aplicável.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">5. Retenção e segurança</h2>
      <p className="text-gray-300">
        Mantemos dados pelo tempo necessário às finalidades. Medidas técnicas e organizacionais protegem suas informações.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">6. Compartilhamento</h2>
      <p className="text-gray-300">
        Podemos compartilhar com provedores (ex.: processamento de pagamentos) estritamente para as finalidades informadas.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">7. Alterações</h2>
      <p className="text-gray-300">
        Podemos atualizar esta Política. Mudanças relevantes exigem novo aceite para continuidade do uso.
      </p>
    </div>
  );
}