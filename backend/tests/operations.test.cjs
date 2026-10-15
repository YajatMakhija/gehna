const assert = require('node:assert/strict');
const { test } = require('node:test');
const { financials, csv, paid, cashOnDelivery, shippable, monthInIndia } = require('../src/lib/reporting.ts');
const { chooseCourier, shipmentPayload, courierConfig } = require('../src/lib/couriers.ts');
const { allowedLabelUrl } = require('../src/lib/labels.ts');
Object.assign(process.env, { SHIPROCKET_EMAIL:'qa@example.invalid', SHIPROCKET_PASSWORD:'fake-test-password', SHIPROCKET_PICKUP_LOCATION:'QA warehouse', SHIPROCKET_PICKUP_PIN:'110001', SHIPMENT_WEIGHT_GRAMS:'500', SHIPMENT_LENGTH_CM:'10', SHIPMENT_BREADTH_CM:'10', SHIPMENT_HEIGHT_CM:'5', AUTO_SHIP:'true', SHIPROCKET_AUTO_PICKUP:'false' });
const fixture = () => ({ id:'order_test', display_id:1, currency_code:'inr', status:'pending', created_at:'2026-09-30T19:00:00Z', email:'qa@example.invalid', total:1080, shipping_total:80, metadata:{}, shipping_address:{first_name:'QA', last_name:'Test', address_1:'Test address', city:'Delhi', province:'Delhi', postal_code:'110001', country_code:'in', phone:'+91 9999999999'}, items:[{id:'item_test', title:'Sample jewellery', quantity:2, unit_price:500, total:1000, tax_total:0, requires_shipping:true}], fulfillments:[], payment_collections:[{authorized_amount:1080,captured_amount:1080,refunded_amount:0,payments:[{captures:[{amount:1080,created_at:'2026-09-30T19:00:00Z'}],refunds:[]}]}] });
test('India month boundaries, capture/refund dates, canceled payments and mixed currencies', () => {
  const order = fixture(); order.payment_collections[0].payments[0].refunds.push({amount:200,created_at:'2026-10-31T19:00:00Z'});
  const foreign = {...fixture(),currency_code:'usd'}; const canceled = {...fixture(),status:'canceled'};
  const report = financials([order,foreign,canceled], '2026-10');
  assert.equal(monthInIndia('2026-09-30T19:00:00Z'), '2026-10'); assert.equal(report.selected.captured,2160); assert.equal(report.selected.refunded,0); assert.equal(report.selected.orders,1); assert.equal(financials([order], '2026-11').selected.refunded,200); assert.equal(report.lifetime_net,1960);
  assert(paid(fixture())); const partial=fixture(); partial.payment_collections[0].captured_amount=500; assert(!paid(partial)); assert(!paid(canceled));
});
test('authorized COD can ship but is not collected revenue', () => {
  const cod=fixture(); cod.payment_status='authorized'; cod.payment_collections[0].captured_amount=0; cod.payment_collections[0].payments=[{provider_id:'pp_system_default',captures:[],refunds:[]}];
  assert(cashOnDelivery(cod)); assert(shippable(cod)); assert(!paid(cod));
  assert.equal(financials([cod], '2026-10').selected.net,0);
  assert.equal(shipmentPayload(cod).payment_method,'COD');
  assert(!cashOnDelivery({...cod,status:'canceled'}));
  assert(!cashOnDelivery({...cod,payment_collections:[{...cod.payment_collections[0],refunded_amount:50}]}));
});
test('Shiprocket Best Recommended selection, blocked services and payload units', () => {
  const companies=[{courier_company_id:1,courier_name:'DTDC Surface',rate:50,blocked:0},{courier_company_id:2,courier_name:'Blue Dart Surface',rate:80,blocked:0}];
  assert.equal(chooseCourier(companies,2).courier_id,2); assert.equal(chooseCourier(companies,1).courier,'DTDC Surface'); assert.throws(()=>chooseCourier([{...companies[1],blocked:1}],2)); assert.throws(()=>chooseCourier(companies,99));
  const payload=shipmentPayload(fixture()); assert.equal(payload.weight,.5); assert.equal(payload.billing_phone,'9999999999'); assert.equal(payload.order_date,'2026-10-01 00:30'); assert.equal(payload.sub_total+payload.shipping_charges,1080); assert.equal(payload.payment_method,'Prepaid');
  assert.throws(()=>shipmentPayload({...fixture(),total:900})); assert.throws(()=>shipmentPayload({...fixture(),shipping_address:{...fixture().shipping_address,phone:'bad'}})); assert(courierConfig().ready);
});
test('CSV formula protection and exact PDF host trust boundary', () => {
  assert(csv([['=HYPERLINK("bad")','a,b','x"y',' +SUM(1)']]).includes("'=HYPERLINK")); assert(csv([['x"y']]).includes('x""y'));
  assert.equal(allowedLabelUrl('https://kr-shipmultichannel.s3.ap-southeast-1.amazonaws.com/1/labels/test.pdf').protocol,'https:'); assert.throws(()=>allowedLabelUrl('https://evil.example/a.pdf')); assert.throws(()=>allowedLabelUrl('https://s3-ap-southeast-1.amazonaws.com/other-bucket/test.pdf')); assert.throws(()=>allowedLabelUrl('http://127.0.0.1/a.pdf'));
});
test('booking, duplicate events, timeout hold, reconciliation and bulk labels (no external requests)', async () => {
  const corePath=require.resolve('@medusajs/medusa/core-flows'); const original=require(corePath); let fulfills=0;
  require.cache[corePath].exports={...original,createOrderFulfillmentWorkflow:()=>({run:async({input})=>{fulfills++;order.fulfillments.push({id:'ful_test',metadata:input.metadata});return{result:{id:'ful_test'}};}})};
  delete require.cache[require.resolve('../src/lib/shipping-flow.ts')];
  const { bookOrder, reconcileOrder, requestPickup, syncPickup }=require('../src/lib/shipping-flow.ts'); const { labelsPdf }=require('../src/lib/labels.ts');
  let order=fixture(),creates=0,assigns=0,timeout=false,remoteAwb=null,mode='normal',posts=[],pickups=0;
  const scope={resolve:key=> key==='query'?{graph:async()=>({data:[order]})}:key==='order'?{retrieveOrder:async()=>order,updateOrders:async(id,{metadata})=>{order.metadata=metadata;return order;}}:key==='__pg_connection__'?{transaction:async cb=>cb({raw:async()=>{}})}:(()=>{throw new Error('Unexpected '+key)})()};
  const before=global.fetch;
  global.fetch=async(url,init={})=>{
    const path=String(url); const body=init.body?JSON.parse(init.body):null; if(body)posts.push({path,body}); let data;
    if(path.includes('auth/login')) data={token:'fixture-token'};
    else if(path.includes('courier/serviceability')) data={data:{shiprocket_recommended_courier_id:2,recommended_by:{title:'Best in price'},available_courier_companies:[{courier_company_id:2,courier_name:'Blue Dart Surface',rate:80,blocked:0}]}};
    else if(path.includes('orders/create/adhoc')) { creates++; data={order_id:123,shipment_id:456}; }
    else if(path.includes('courier/assign/awb')) { assigns++; if(timeout)throw new Error('network timeout'); remoteAwb='1234567890'; data={awb_assign_status:1,response:{data:{awb_code:remoteAwb,shipment_id:456,courier_company_id:2,courier_name:'Blue Dart Surface'}}}; }
    else if(path.includes('orders/show/')) data={data:{id:123,channel_order_id:order.id,shipments:{id:456,awb:remoteAwb,courier_id:2,courier:'Blue Dart Surface',status:'NEW'}}};
    else if(path.includes('courier/generate/pickup')) { pickups++; data={pickup_status:1,response:{pickup_scheduled_date:'2026-10-02',pickup_token_number:'QA_TOKEN'}}; }
    else if(path.includes('manifests/generate')) data={manifest_url:'https://kr-shipmultichannel.s3.ap-southeast-1.amazonaws.com/1/labels/test.pdf'};
    else if(path.includes('shipments/456')) data={data:{id:456,order_id:123,awb:remoteAwb,pickup_generated_date:'2026-10-02',pickup_token_number:'QA_TOKEN'}};
    else if(path.includes('courier/generate/label')) data={label_created:1,label_url:'https://kr-shipmultichannel.s3.ap-southeast-1.amazonaws.com/1/labels/test.pdf',not_created:mode==='partial'?[456]:[]};
    else if(path.includes('amazonaws.com/')) return new Response('%PDF-1.4\nfixture', {status:200,headers:{'Content-Type':'application/pdf'}});
    else throw new Error('Unexpected request '+path);
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const booked=await bookOrder(scope,order.id,true); assert.equal(booked.status,'booked'); assert.equal(booked.courier,'Blue Dart Surface'); assert.equal(creates,1); assert.equal(assigns,1); assert.equal(fulfills,1); assert.equal(posts.find(p=>p.path.includes('courier/assign/awb')).body.courier_id,2);
    await bookOrder(scope,order.id,true); assert.equal(creates,1); assert.equal(assigns,1); assert.equal(fulfills,1);
    const bytes=await labelsPdf(scope,[order.id]); assert(bytes.toString().startsWith('%PDF-')); assert.deepEqual(posts.find(p=>p.path.includes('generate/label')).body.shipment_id,[456]);
    await requestPickup(scope,order.id); await requestPickup(scope,order.id); assert.equal(pickups,1); assert.equal(order.metadata.gehna_shipment.pickup_status,'scheduled');
    await labelsPdf(scope,[order.id],'manifest');
    order.metadata.gehna_shipment.pickup_status='needs_review'; await syncPickup(scope,order.id); assert.equal(order.metadata.gehna_shipment.pickup_status,'scheduled'); assert.equal(pickups,1);
    mode='partial'; await assert.rejects(labelsPdf(scope,[order.id]),/every selected label/); mode='normal';
    order=fixture(); order.payment_status='authorized'; order.payment_collections[0].captured_amount=0; order.payment_collections[0].payments=[{provider_id:'pp_system_default',captures:[],refunds:[]}];
    const codBooked=await bookOrder(scope,order.id,true); assert.equal(codBooked.status,'booked'); assert.equal(creates,2); assert.equal(posts.filter(p=>p.path.includes('orders/create/adhoc')).at(-1).body.payment_method,'COD');
    order=fixture(); timeout=true; remoteAwb=null;
    const unknown=await bookOrder(scope,order.id,true); assert.equal(unknown.status,'needs_review'); const count=assigns;
    await bookOrder(scope,order.id,true); assert.equal(assigns,count); assert.equal(creates,3);
    remoteAwb='1234567890'; const synced=await reconcileOrder(scope,order.id); assert.equal(synced.status,'booked'); assert.equal(assigns,count); assert.equal(creates,3);
    order=fixture(); order.payment_collections[0].captured_amount=0; await bookOrder(scope,order.id,true); assert.equal(creates,3);
  } finally { global.fetch=before; require.cache[corePath].exports=original; }
});
