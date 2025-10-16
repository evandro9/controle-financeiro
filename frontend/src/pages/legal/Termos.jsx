import React, { useEffect, useState } from 'react';

export default function Termos() {
  const [v, setV] = useState('v0');
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/legal/versions');
        const j = await r.json();
        setV(j.terms || 'v0');
      } catch {}
    })();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-gray-200">
      <h1 className="text-3xl font-semibold mb-2">Termos de Uso</h1>
      <p className="text-sm text-gray-400 mb-6">Versão: v{v}</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">1. Aceite</h2>
      <p className="text-gray-300">
        Ao utilizar o sistema, você concorda com estes Termos. Se não concordar, não utilize o serviço.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. Conta e Segurança</h2>
      <p className="text-gray-300">
        Você é responsável por manter a confidencialidade de suas credenciais e pelas atividades na sua conta.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. Plano e Pagamentos</h2>
      <p className="text-gray-300">
        O acesso a funcionalidades pode depender do seu plano. Encargos e condições são definidos na página de assinatura.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">4. Uso Permitido</h2>
      <p className="text-gray-300">
        Proibido burlar limitações, reverter engenharia, compartilhar credenciais ou usar o serviço de forma ilegal.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">5. Disponibilidade</h2>
      <p className="text-gray-300">
        O serviço é fornecido “como está”. Poderão ocorrer interrupções para manutenção ou fatores externos.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">6. Suporte</h2>
      <p className="text-gray-300">
        Canais e prazos de suporte podem variar por plano. Consulte a página de suporte oficial.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">7. Alterações</h2>
      <p className="text-gray-300">
        Podemos atualizar estes Termos. Alterações relevantes exigem seu novo aceite antes do uso continuado.
      </p>
    </div>
  );
}