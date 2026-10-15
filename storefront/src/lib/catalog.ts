export type Product = { id: string; createdAt?: string; handle: string; title: string; subtitle: string; description: string; category: string; image: string; price: number; variantId: string; stock: number; options: string[]; variants?: { id: string; title: string; price: number; stock: number }[] };
export const sampleProducts: Product[] = [
  { id: 'sample-jhumka', handle: 'gul-jhumka-earrings', title: 'Gul Jhumka Earrings', subtitle: 'A little tradition. A little statement.', description: 'Intricate floral details, a sculptural bell silhouette and a fringe of luminous pearl-like drops. A statement pair for the moments you want to dress up. This is an illustrative sample; final materials and specifications will be supplied by Gehna.', category: 'Earrings', image: '/images/jhumkas.png', price: 2490, variantId: 'sample-jhumka', stock: 12, options: ['One size'] },
  { id: 'sample-necklace', handle: 'noor-layered-necklace', title: 'Noor Layered Necklace', subtitle: 'Your everyday, with a little more gold.', description: 'Two delicate layers and a quietly distinctive pendant, brought together in an effortless silhouette. Wear it on its own or make it part of your own story. This is an illustrative sample; final materials and specifications will be supplied by Gehna.', category: 'Necklaces', image: '/images/necklace.png', price: 1890, variantId: 'sample-necklace', stock: 18, options: ['One size'] }
];
export const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
export const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';
export const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';
export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
export const adminUrl = process.env.NEXT_PUBLIC_MEDUSA_ADMIN_URL || 'http://localhost:9000/app';

export const sampleCatalog = process.env.NEXT_PUBLIC_SAMPLE_CATALOG !== 'false';
