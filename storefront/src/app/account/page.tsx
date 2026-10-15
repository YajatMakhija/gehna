import { Suspense } from 'react';
import { Account } from '@/components/pages';
export default function Page() { return <Suspense fallback={<main id="main" className="loading-page">Loading Gehna...</main>}><Account /></Suspense>; }
