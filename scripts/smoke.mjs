import { readFileSync } from 'node:fs';
const env=Object.fromEntries(readFileSync('storefront/.env.local','utf8').trim().split(/\r?\n/).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const base=env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
async function call(path,method='GET',body,token){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','x-publishable-api-key':env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(data)}`);return data;}
const result=await call(`/store/products?region_id=${env.NEXT_PUBLIC_MEDUSA_REGION_ID}&fields=id,title,subtitle,description,handle,thumbnail,created_at,*variants,*variants.calculated_price,variants.inventory_quantity,*categories`);
console.log('Catalog:',result.products.map(p=>({title:p.title,price:p.variants[0].calculated_price?.calculated_amount,stock:p.variants[0].inventory_quantity})));
const created=await call('/store/carts','POST',{region_id:env.NEXT_PUBLIC_MEDUSA_REGION_ID});const cartId=created.cart.id;
const added=await call(`/store/carts/${cartId}/line-items`,'POST',{variant_id:result.products[0].variants[0].id,quantity:1});console.log('Cart: added one item; total',added.cart.total);
try{await call(`/store/carts/${cartId}/line-items`,'POST',{variant_id:result.products[0].variants[0].id,quantity:99999});throw new Error('Oversell guard failed');}catch(e){if(e.message==='Oversell guard failed')throw e;console.log('Oversell guard: rejected');}
await call(`/store/carts/${cartId}`,'POST',{email:'qa@example.invalid',shipping_address:{first_name:'QA',last_name:'Test',address_1:'Test address',city:'Delhi',province:'Delhi',postal_code:'110001',country_code:'in',phone:'9999999999'}});
const delivery=await call(`/store/shipping-options?cart_id=${cartId}`);console.log('Shipping options:',delivery.shipping_options.map(s=>s.name));
if(!delivery.shipping_options.length)throw new Error('No shipping options');
const shipped=await call(`/store/carts/${cartId}/shipping-methods`,'POST',{option_id:delivery.shipping_options[0].id});console.log('Shipping total:',shipped.cart.shipping_total);
const creds=JSON.parse(readFileSync('.local/admin-credentials.json','utf8'));
const {token}=await call('/auth/user/emailpass','POST',creds);const overview=await call('/admin/gehna/overview','GET',undefined,token);console.log('Admin overview:',{products:overview.products,inventory:overview.inventory,shiprocket_ready:overview.couriers?.ready});
const anonymous=await fetch(base+'/admin/products');if(anonymous.status!==401)throw new Error('Admin authentication guard failed');console.log('Admin access guard: requires login');
const providers=await call(`/store/payment-providers?region_id=${env.NEXT_PUBLIC_MEDUSA_REGION_ID}`);console.log('Payment providers:',providers.payment_providers.map(p=>p.id));
console.log('Commerce smoke checks passed. No order or payment was created.');
