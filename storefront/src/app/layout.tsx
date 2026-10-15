import type { Metadata } from 'next';
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/500.css';
import '@fontsource/nunito-sans/600.css';
import '@fontsource/nunito-sans/700.css';
import './globals.css';
import './modern.css';
import { StoreProvider, Header, Footer, CartDrawer, Toast } from '@/components/store';
export const metadata: Metadata = { title: 'Gehna | Wear it your way', description: 'Discover Gehna jewellery for every version of you. Explore earrings, necklaces and more.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body><StoreProvider><a href="#main" className="skip-link">Skip to content</a><Header />{children}<Footer /><CartDrawer /><Toast /></StoreProvider></body></html>;
}
