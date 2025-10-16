export async function fetchDashboardResumo({ ano, mes, forma_pagamento_id = 'ALL', limitUltimos = 10 }) {
  const token = localStorage.getItem('token');
  const url = new URL('/api/dashboard/resumo');
  const mesStr = String(mes).padStart(2, '0'); // sempre '01'..'12'
  url.searchParams.set('ano', String(ano));
  url.searchParams.set('mes', mesStr);
  // Envia forma_pagamento_id só quando for um ID válido
  if (forma_pagamento_id && forma_pagamento_id !== 'ALL' && forma_pagamento_id !== 'todas') {
    url.searchParams.set('forma_pagamento_id', String(forma_pagamento_id));
  }
  url.searchParams.set('limitUltimos', String(limitUltimos));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Erro ${res.status} ao buscar /dashboard/resumo: ${text}`);
  }
  return res.json();
}