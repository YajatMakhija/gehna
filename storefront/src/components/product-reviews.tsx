'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, Check } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useStore } from './store';
import './product-reviews.css';

type Review = { id: string; reviewer_name: string; rating: number; body: string; created_at: string };
type Page = { reviews: Review[]; count: number; average: number | null };
export function ProductReviews({ productId, handle }: { productId: string; handle: string }) {
  const { isDemo } = useStore();
  const [page, setPage] = useState<Page>({ reviews: [], count: 0, average: null });
  const [signedIn, setSignedIn] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [own, setOwn] = useState<Review | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const query = '?product_id=' + encodeURIComponent(productId);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setMessage(''); setOwn(null); setRating(0); setBody(''); setEligible(false);
    const token = sessionStorage.getItem('gehna-token');
    setSignedIn(!!token);
    if (isDemo) { setLoading(false); return; }
    Promise.all([api('/store/gehna/reviews' + query), token ? api('/store/gehna/reviews/me' + query).catch(err => {
      if (err instanceof ApiError && err.status === 401) { if (active) setSignedIn(false); return null; }
      throw err;
    }) : null])
      .then(([result, me]) => { if (!active) return; setPage(result); setEligible(!!me?.eligible); setOwn(me?.review || null); setRating(me?.review?.rating || 0); setBody(me?.review?.body || ''); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, isDemo, query]);
  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const result = await api('/store/gehna/reviews', 'POST', { product_id: productId, rating, body });
      setOwn(result.review); setPage(await api('/store/gehna/reviews' + query));
      setMessage('Thank you. Your review is now on this page.');
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }
  async function more() {
    setLoading(true); setError('');
    try { const next = await api('/store/gehna/reviews' + query + '&offset=' + page.reviews.length); setPage(current => ({ ...next, reviews: [...current.reviews, ...next.reviews] })); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }
  return <section id="reviews" className="product-reviews" aria-labelledby="reviews-heading">
    <div className="section-heading"><div><h2 id="reviews-heading">Ratings & reviews</h2><p>Honest reviews from customers who received this piece.</p></div>{page.count > 0 && <p className="review-summary"><Star size={21} fill="currentColor" aria-hidden="true"/><strong>{page.average?.toFixed(1)} / 5</strong><span>{page.count} {page.count === 1 ? 'review' : 'reviews'}</span></p>}</div>
    <div className="reviews-layout"><div className="review-list" aria-live="polite">
      {!page.count && !loading && <div className="reviews-empty"><h3>The first word could be yours.</h3><p>Once your piece arrives, tell us how you wear it and what you think.</p></div>}
      {page.reviews.map(review => <article className="customer-review" key={review.id}><div className="review-byline"><strong>{review.reviewer_name}</strong><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</time></div><div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{[1,2,3,4,5].map(value => <Star key={value} size={16} fill={value <= review.rating ? 'currentColor' : 'none'} aria-hidden="true"/>)}</div><p className="review-body">{review.body}</p><span className="review-purchase"><Check size={14} aria-hidden="true"/>Verified purchase</span></article>)}
      {loading && <p role="status">Loading reviews…</p>}
      {page.reviews.length < page.count && <button className="text-button" disabled={loading} onClick={more}>Show more reviews</button>}
    </div><div className="review-write"><h3>{own ? 'Your review' : 'How did you like your piece?'}</h3>
      {isDemo ? <p>Reviews will be available when the store is connected.</p> : !signedIn ? <><p>Sign in to review a piece you have received.</p><Link className="button" href={'/account?return_to=' + encodeURIComponent('/product?handle=' + handle + '#reviews')}>Sign in to review</Link></> : loading && !own ? <p>Checking your purchases…</p> : !eligible ? <p>You can rate and review this piece after your order is delivered. Find your order status in <Link className="text-link" href="/account">your account</Link>.</p> : <form onSubmit={save}><fieldset className="rating-picker"><legend>Your rating</legend><div>{[1,2,3,4,5].map(value => <label key={value} className={value <= rating ? 'selected' : ''}><input type="radio" name="rating" value={value} required checked={rating === value} onChange={() => setRating(value)}/><Star size={27} fill={value <= rating ? 'currentColor' : 'none'} aria-hidden="true"/><span className="sr-only">{value} {value === 1 ? 'star' : 'stars'}</span></label>)}</div></fieldset><label className="field" htmlFor="review-body">Your experience<textarea id="review-body" required minLength={10} maxLength={1500} rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="The fit, the details, your favourite way to style it…"/></label><p className="review-note">Your first name appears with your review. Your email stays private. One review per piece; you can update it here.</p><button className="button" disabled={saving || !rating}>{saving ? 'Saving…' : own ? 'Update review' : 'Publish review'}</button></form>}
      {message && <p role="status" className="review-success">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}
    </div></div>
  </section>;
}
