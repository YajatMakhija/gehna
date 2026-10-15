'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { sampleCatalog } from '@/lib/catalog';
import { CatalogState, ProductCard, useStore } from './store';

export function Home() {
  const { products } = useStore();
  const featured = [...products].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 4);

  return <main id="main">
    <section className="hero">
      <img className="hero-image" src="/images/campaign-modern.png" alt="A woman styling contemporary gold jewellery with an everyday outfit" fetchPriority="high" width="1536" height="1024" />
      <div className="hero-shade" />
      <div className="hero-copy wrap">
        <h1>Wear it <em>your way.</em></h1>
        <p>Jewellery for the plans you make, and the ones you don’t.</p>
        <div className="hero-actions">
          <Link className="button" href="/shop">Shop the collection <ArrowRight size={18} /></Link>
          <Link className="hero-secondary" href="/shop?sort=newest">See what’s new <ArrowUpRight size={17} /></Link>
        </div>
      </div>
      <a className="hero-scroll" href="#shop-by-style">Find your thing <ArrowRight size={16} /></a>
    </section>

    <div className="brand-ribbon" aria-label="Gehna style notes"><span>Your everyday</span><i /><span>Your rules</span><i /><span>Your Gehna</span></div>

    <section className="category-section wrap" id="shop-by-style">
      <div className="section-heading"><div><h2>What’s your <em>thing?</em></h2><p>Start with the pieces you always come back to.</p></div><Link className="text-link" href="/shop">Shop everything <ArrowUpRight size={19} /></Link></div>
      <div className="category-grid">
        <Link href="/shop?category=Earrings"><div><img src="/images/category-earrings-modern.png" alt="Everyday gold earrings styling" loading="lazy" /></div><span>The finishing touch</span><h3>Earrings <ArrowUpRight size={22} /></h3></Link>
        <Link href="/shop?category=Necklaces"><div><img src="/images/category-necklaces-modern.png" alt="Delicate layered gold necklaces styling" loading="lazy" /></div><span>Made to layer</span><h3>Necklaces <ArrowUpRight size={22} /></h3></Link>
      </div>
    </section>

    <section className="collection wrap" id="collection">
      <div className="section-heading"><div><h2>On your <em>repeat list.</em></h2><p>The pieces to style today, tomorrow, and your own way.</p></div><Link className="text-link" href="/shop">View all jewellery <ArrowUpRight size={19} /></Link></div>
      {sampleCatalog && <p className="preview-note collection-disclosure">Preview collection · Illustrative products and prices</p>}
      <CatalogState />
      <div className="featured-grid">{featured.map((product) => <ProductCard key={product.id} product={product} />)}</div>
    </section>

    <section className="story-band">
      <div className="story-image"><img src="/images/editorial-modern.png" alt="Contemporary gold jewellery styled for an everyday look" loading="lazy" /></div>
      <div className="story-copy"><h2>One piece.<br /><em>Endless you.</em></h2><p>Dress it up, wear it down, make it part of your everyday. The best way to style jewellery is the way that feels like you.</p><Link className="text-link" href="/story">Get to know Gehna <ArrowRight size={18} /></Link></div>
    </section>

    <section className="closing wrap"><h2>Found your next <em>favourite?</em></h2><p>Explore the collection and see what catches your eye.</p><Link className="button" href="/shop">Shop all jewellery <ArrowRight size={18} /></Link></section>
  </main>;
}
