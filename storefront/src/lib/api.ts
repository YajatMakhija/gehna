import { backendUrl, publishableKey, Product } from './catalog';
export async function api(path: string, method = 'GET', body?: unknown, token?: string) {
  token = token || (typeof window !== 'undefined' ? sessionStorage.getItem('gehna-token') || undefined : undefined);
  const res = await fetch(`${backendUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', 'x-publishable-api-key': publishableKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `The store could not complete this request (${res.status}). Please try again.`);
  return data;
}
export function mapProduct(p: any): Product {
  const variants = (p.variants || []).map((v: any) => ({ id: v.id, title: v.title, price: v.calculated_price?.calculated_amount ?? 0, stock: v.manage_inventory ? Math.max(0, v.inventory_quantity ?? 0) : 999 }));
  const v = variants[0];
  const classify = (words: string) => /\b(earrings?|jhumkas?|hoops?|studs?)\b/.test(words) ? 'Earrings' : /\b(necklaces?|chains?|pendants?|chokers?)\b/.test(words) ? 'Necklaces' : /\b(bracelets?|bangles?|cuffs?)\b/.test(words) ? 'Bracelets' : /\brings?\b/.test(words) ? 'Rings' : '';
  const inferred = classify((p.title || '').toLowerCase()) || classify(`${p.handle || ''} ${p.description || ''}`.toLowerCase()) || 'Jewellery';
  const images = [...new Set([p.thumbnail, ...(p.images || []).map((image: any) => image.url)].filter(Boolean))] as string[];
  const image = images[0] || '/images/jhumkas.png';
  return { id: p.id, createdAt: p.created_at, handle: p.handle, title: p.title, subtitle: p.subtitle || '', description: p.description || '', category: p.categories?.[0]?.name || p.type?.value || inferred, image, images: images.length ? images : [image], price: v?.price || 0, variantId: v?.id || '', stock: v?.stock ?? 0, options: variants.map((v: any) => v.title), variants };
}
