import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Badge, Input } from '@medusajs/ui';
import { FormEvent, useEffect, useRef, useState } from 'react';

async function request(body?: any) {
  const response = await fetch('/admin/gehna/assistant', { credentials: 'include', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Could not complete your request. Please try again.');
  return data;
}
const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

function Assistant() {
  const [ready, setReady] = useState<boolean | null>(null), [message, setMessage] = useState(''), [image, setImage] = useState(''), [fileName, setFileName] = useState('');
  const [price, setPrice] = useState(''), [stock, setStock] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState<any>(null), [confirmed, setConfirmed] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    window.localStorage.setItem('medusa_admin_theme', 'light'); document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light');
    request().then(r => setReady(r.ready)).catch(e => setError(e.message));
  }, []);
  async function upload(photo?: File) {
    if (!photo) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 8 * 1024 * 1024) { setError('Choose a JPEG, PNG or WebP photo under 8 MB.'); return; }
    setError(''); setResult(null); setFileName(photo.name);
    const reader = new FileReader(); reader.onload = () => setImage(String(reader.result)); reader.onerror = () => setError('Could not read that photo. Please choose it again.'); reader.readAsDataURL(photo);
  }
  async function run(body: any) {
    if (busy) return;
    setBusy(true); setError('');
    try { setResult(await request(body)); setConfirmed(false); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  function submit(e: FormEvent) {
    e.preventDefault(); setResult(null);
    run({ action: 'request', message, ...(image ? { image } : {}), ...(price.trim() ? { price: Number(price) } : {}), ...(stock.trim() ? { stock: Number(stock) } : {}) });
  }
  return <main className="ga">
    <style>{`
      .ga{color:#292320;max-width:1180px;margin:0 auto;padding:32px 24px 64px;font-family:Inter,Arial,sans-serif}.ga *{box-sizing:border-box}.ga a{color:#80582d;text-underline-offset:3px}.ga h1{font-size:30px;font-weight:600;letter-spacing:-.025em;margin:0 0 8px}.ga h2{font-size:18px;font-weight:600;margin:0 0 16px}.ga p{line-height:1.6}.ga-header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:36px}.ga-header p{color:#665e62;max-width:62ch;margin:0}.ga-workspace{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:36px}.ga-compose{padding-right:32px;border-right:1px solid #e9e1df}.ga-upload{width:100%;min-height:210px;background:#faf6f0;border:1px dashed #a99580;border-radius:12px;padding:24px;text-align:center;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px}.ga-upload:hover{background:#f5ede3}.ga-upload:focus-visible,.ga textarea:focus-visible,.ga a:focus-visible{outline:2px solid #91344b;outline-offset:3px}.ga-upload img{max-height:240px;max-width:100%;object-fit:contain}.ga small{display:block;color:#665e62;font-size:12px;line-height:1.6}.ga label{display:block;font-size:13px;font-weight:500;margin:22px 0 8px}.ga textarea{width:100%;min-height:118px;resize:vertical;border:1px solid #cfc6c1;border-radius:8px;background:white;padding:12px;font-family:inherit;font-size:14px;line-height:1.5;color:inherit}.ga-fields{display:grid;grid-template-columns:1fr 1fr;gap:18px}.ga-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:24px}.ga-error{padding:14px 16px;background:#fff0ec;color:#8b3025;border-radius:8px;margin:20px 0}.ga-setup{padding:18px 22px;background:#fbf1e2;border-radius:10px;margin-bottom:28px}.ga-setup p{margin:6px 0}.ga-empty{padding:48px 24px;color:#665e62;border-top:1px solid #e9e1df}.ga-example{display:block;text-align:left;width:100%;padding:12px 0;border-bottom:1px solid #e9e1df;color:#80582d;background:transparent;cursor:pointer;font-size:14px}.ga-example:hover{text-decoration:underline}.ga-photos{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0}.ga-photos img{width:100%;border-radius:10px;aspect-ratio:1;object-fit:contain;background:#faf6f0}.ga-result{border-top:1px solid #e9e1df;padding-top:24px}.ga-result h3{font-size:23px;line-height:1.3;font-weight:600;margin:12px 0}.ga-summary{display:flex;gap:28px;margin:24px 0;font-variant-numeric:tabular-nums}.ga-confirm{display:flex!important;gap:10px;align-items:flex-start;font-weight:400!important}.ga-status{color:#80582d;margin-top:18px}.ga-items{margin:18px 0;padding-left:18px;list-style:disc}@media(max-width:850px){.ga-workspace{grid-template-columns:1fr}.ga-compose{padding:0 0 28px;border-right:0;border-bottom:1px solid #e9e1df}.ga-header{flex-direction:column}.ga{padding:24px 16px}.ga-empty{padding:24px 0}}
    `}</style>
    <header className="ga-header"><div><h1>Your Gehna assistant</h1><p>Turn a raw jewellery photo into a product listing, or manage an order with a simple request.</p></div><a href="/app/overview">Back to dashboard</a></header>
    {ready === false && <section className="ga-setup"><h2>Connect OpenAI to begin</h2><p>Add <code>OPENAI_API_KEY</code> to the backend environment and restart or redeploy. Your key stays on the server.</p><small>Product photos are sent to OpenAI when you request a draft. Image generation uses your API balance.</small><Button variant="secondary" onClick={() => request().then(r => setReady(r.ready)).catch(e => setError(e.message))}>Check connection</Button></section>}
    {error && <p className="ga-error" role="alert">{error}</p>}
    <div className="ga-workspace"><section className="ga-compose"><h2>What would you like to do?</h2><form onSubmit={submit}>
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Raw product photo" style={{ display: 'none' }} onChange={e => upload(e.target.files?.[0])}/>
      <button type="button" className="ga-upload" onClick={() => file.current?.click()} disabled={busy}>{image ? <><img src={image} alt="Your original jewellery photo"/><small>{fileName} · Click to change photo</small></> : <><strong>Add your raw product photo</strong><small>JPEG, PNG or WebP · up to 8 MB</small><small>We’ll improve the background and lighting while preserving the jewellery.</small></>}</button>
      {image && <button type="button" className="ga-example" disabled={busy} onClick={() => { setImage(''); setFileName(''); }}>Remove photo</button>}
      <label htmlFor="ga-request">Your request</label><textarea id="ga-request" maxLength={2000} required value={message} onChange={e => setMessage(e.target.value)} placeholder="Add this necklace at ₹1,499 with 10 pieces in stock. Create studio photos and a one-line description." disabled={busy}/>
      <div className="ga-fields"><div><label htmlFor="ga-price">Selling price (INR)</label><Input id="ga-price" type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)} disabled={busy} placeholder="Or include in your request"/></div><div><label htmlFor="ga-stock">Available stock</label><Input id="ga-stock" type="number" min="0" step="1" value={stock} onChange={e => setStock(e.target.value)} disabled={busy} placeholder="Or include in your request"/></div></div>
      <small style={{ marginTop: 12 }}>Price and stock are required for a product. They are never guessed from a photo.</small>
      <div className="ga-actions"><Button type="submit" disabled={busy || ready !== true}>{busy ? 'Working on your request…' : 'Send request'}</Button></div>{busy && <p role="status" className="ga-status">Photo editing can take a few minutes. Keep this page open.</p>}
    </form></section><section aria-label="Assistant result" aria-live="polite"><h2>Preview & activity</h2>{!result && <div className="ga-empty"><p>Your product preview or order details will appear here before anything changes in the store.</p><button className="ga-example" onClick={() => setMessage('Add this jewellery with two clean studio photos and a one-line description.')}>Create a product from a photo</button><button className="ga-example" onClick={() => setMessage('Cancel order #')}>Cancel an unshipped order</button><small style={{ marginTop: 24 }}>Cancellations preserve your sales records. Orders with payments or courier bookings need manual review.</small></div>}
      {result && <div className="ga-result"><p role="status">{result.message}</p>{result.product && <><Badge color={result.product.status === 'published' ? 'green' : 'orange'}>{result.product.status === 'published' ? 'Published' : 'Draft · review before publishing'}</Badge><h3>{result.product.title}</h3><p>{result.product.description}</p>{result.product.images && <div className="ga-photos">{result.product.images.map((src: string, i: number) => <img key={src} src={src} alt={`${result.product.title} studio photo ${i + 1}`}/>)}</div>}{result.product.price !== undefined && <div className="ga-summary"><div><small>Selling price</small><strong>{inr(result.product.price)}</strong></div><div><small>In stock</small><strong>{result.product.stock} pieces</strong></div></div>}<a href={'/app/products/' + result.product.id}>Open product editor</a>{result.product.status === 'draft' && <><label className="ga-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I checked that both images match the jewellery, and the description, price and stock are correct.</label><div className="ga-actions"><Button disabled={!confirmed || busy} onClick={() => run({ action: 'publish', product_id: result.product.id })}>Publish product</Button></div></>}</>}
      {result.order && <><h3>Order #{result.order.display_id}</h3>{result.order.total !== undefined && <p>Total: {inr(result.order.total)}</p>}<ul className="ga-items">{result.order.items?.map((i: any, n: number) => <li key={n}>{i.quantity} × {i.title}</li>)}</ul><a href={'/app/orders/' + result.order.id}>Open order</a>{result.order.status !== 'canceled' && <><label className="ga-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>Cancel this order and release its reserved stock. Keep its sales record.</label><div className="ga-actions"><Button variant="danger" disabled={!confirmed || busy} onClick={() => run({ action: 'cancel', order_id: result.order.id, confirm: true })}>Confirm cancellation</Button></div></>}</>}
      </div>}</section></div>
  </main>;
}
export const config = defineRouteConfig({ label: 'Gehna assistant' });
export default Assistant;
