import { Suspense } from 'react';
import { Story } from '@/components/pages';
export default function Page() { return <Suspense fallback={<main id="main" className="loading-page">Loading Gehna...</main>}><Story /></Suspense>; }
