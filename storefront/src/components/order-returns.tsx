'use client';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowUpRight, RotateCcw, Check } from 'lucide-react';
import { api } from '@/lib/api';

export function OrderReturns({ orderId }: { orderId: string }) {
  const [data, setData] = useState<any>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [open, setOpen] = useState(false), [message, setMessage] = useState('');
  async function load() { const result = await api('/store/gehna/returns?order_id=' + encodeURIComponent(orderId)); setData(result); }
  useEffect(() => { let active = true; api('/store/gehna/returns?order_id=' + encodeURIComponent(orderId)).then(result => { if (active) setData(result); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [orderId]);
  async function request(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setMessage('');
    const form = new FormData(e.currentTarget);
    const items = data.eligible_items.map((item: any) => ({ id: item.id, quantity: Number(form.get(item.id)) })).filter((item: any) => item.quantity > 0);
    if (!items.length) { setError('Choose at least one item to return.'); return; }
    setBusy(true);
    try { const result = await api('/store/gehna/returns', 'POST', { order_id: orderId, reason: form.get('reason'), items }); setMessage(result.message); setOpen(false); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const active = data?.returns.some((r: any) => !['canceled', 'received'].includes(r.status));
  return <div className="order-returns" aria-label="Returns for this order">
    <div className="return-heading"><span><RotateCcw size={17} aria-hidden="true"/>Returns</span>{data && !active && data.eligible_items.length > 0 && <button className="text-button" disabled={busy} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close form' : 'Request a return'}<ArrowUpRight size={16} aria-hidden="true"/></button>}</div>
    <p className="tax-note">Request a return within 2 days (48 hours) of delivery.</p>
    {data?.return_deadline && data.eligible_items.length > 0 && <p className="tax-note">Request by {new Date(data.return_deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST.</p>}
    {!data && !error && <p role="status" className="tax-note">Checking return availability…</p>}
    {message && <p className="return-success" role="status"><Check size={16} aria-hidden="true"/>{message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {data?.returns.map((r: any) => <div className="return-status" key={r.id}><div><strong>{r.status === 'awaiting_review' ? 'Awaiting review' : r.status === 'received' ? 'Return received' : r.status.replaceAll('_', ' ')}</strong><small>{new Date(r.created_at).toLocaleDateString('en-IN')}</small></div><p>{r.reason}</p><small>{r.items.reduce((n: number, i: any) => n + i.quantity, 0)} item(s) · Reference {r.id.slice(-8)}</small></div>)}
    {data && !data.returns.length && !data.eligible_items.length && <p className="tax-note">{data.return_window_expired ? 'The 2-day return window for this order has closed.' : 'Return requests are available for delivered items.'}</p>}
    {open && <form className="return-form" onSubmit={request}><h4>Let’s sort it out.</h4><p>Select your items and tell us what happened. Our team will review your request and share the next steps.</p>{data.eligible_items.map((item: any) => <label className="return-item" key={item.id}><span>{item.title}<small>{item.quantity} available to return</small></span><input type="number" name={item.id} min={0} max={item.quantity} step={1} defaultValue={0} required aria-label={'Return quantity for ' + item.title} /></label>)}<label className="field">Reason for return<textarea name="reason" required minLength={5} maxLength={1000} rows={3} placeholder="Tell us about the issue with your jewellery." /></label><p className="tax-note">Refunds and collection are arranged after review. Please wait for our team’s instructions before sending anything back.</p><button className="button" disabled={busy}>{busy ? 'Submitting…' : 'Submit return request'}</button></form>}
  </div>;
}
