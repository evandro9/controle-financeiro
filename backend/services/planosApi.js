export async function fetchPlanosMensal({ ano }) {
  const token = localStorage.getItem('token');
  const url = new URL('/api/planos-dashboard/mensal');
  url.searchParams.set('ano', String(ano));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Erro ${res.status} ao buscar /planos-dashboard/mensal`);
  return res.json(); // [{mes:'01', aporte:0, retirada:0, liquido:0, acumulado:0}, ...]
}