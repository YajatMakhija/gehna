import { Suspense } from 'react';
import { ProductPage } from '@/components/pages';
export default function Page() { return <Suspense fallback={<main id="main" className="loading-page">Loading Gehna...</main>}><ProductPage /></Suspense>; }
