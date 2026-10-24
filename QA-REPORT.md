# Gehna deployment QA — 24 October 2026

## Verified locally

- 11 backend test groups passed; both TypeScript checks and production builds passed.
- 104 commerce requests across 53 endpoint/method combinations passed. Expected error responses below are intentional validation/authentication checks.
- Product create, image upload and byte-exact download, price and stock updates, storefront sync and deletion passed.
- Signup, login, profile, saved addresses, order history, cart, stock protection, delivery, COD completion without OTP, dashboard reporting and CSV export passed.
- Assistant authorization, draft publishing, repeat publishing, confirmation requirement and cancellation passed. Canceled records were preserved.
- Real OpenAI call passed: description, two image edits, real Medusa draft and inventory, public image download, publish, exact INR price and stock visible through Store API. Temporary product and photos were deleted. AI image fidelity must still be reviewed by staff for every product.
- Assistant rendered at desktop and mobile widths; raw photo input preview worked.
- Unit tests mock shipping and email APIs, and verify duplicate protection, escaping, courier selection, label host validation and image-workflow rollback. No real courier was booked.

## Local endpoint results

| Endpoint | Observed HTTP status |
|---|---|
| DELETE /admin/products/:id | 200 |
| DELETE /admin/uploads/:key | 200 |
| DELETE /store/carts/:id/line-items/:id | 200 |
| DELETE /store/customers/me/addresses/:id | 200 |
| GET /admin/customers | 200 |
| GET /admin/gehna/assistant | 401, 200 |
| GET /admin/gehna/export | 400 |
| GET /admin/gehna/overview | 200, 401, 400 |
| GET /admin/inventory-items | 200 |
| GET /admin/orders | 200 |
| GET /admin/products | 401, 200 |
| GET /admin/products/:id | 200, 404 |
| GET /admin/sales-channels | 200 |
| GET /admin/shipping-profiles | 200 |
| GET /admin/stock-locations | 200 |
| GET /admin/users/me | 200 |
| GET /health | 200 |
| GET /static/:key | 200 |
| GET /store/carts/:id | 200 |
| GET /store/customers/me | 200 |
| GET /store/customers/me/addresses | 200 |
| GET /store/files/%21invalid | 400 |
| GET /store/orders | 200 |
| GET /store/payment-providers | 200 |
| GET /store/products | 200 |
| GET /store/products/:id | 200 |
| GET /store/regions | 200 |
| GET /store/shipping-options | 200 |
| POST /admin/gehna/assistant | 401, 200, 400 |
| POST /admin/gehna/export | 401, 400, 200 |
| POST /admin/gehna/shipments | 401, 400 |
| POST /admin/inventory-items/:id/location-levels | 200 |
| POST /admin/inventory-items/:id/location-levels/:id | 200 |
| POST /admin/products | 200 |
| POST /admin/products/:id | 200 |
| POST /admin/products/:id/variants/:id | 200 |
| POST /admin/uploads | 200 |
| POST /auth/customer/emailpass | 200 |
| POST /auth/customer/emailpass/register | 200 |
| POST /auth/user/emailpass | 200 |
| POST /store/carts | 200 |
| POST /store/carts/:id | 200 |
| POST /store/carts/:id/complete | 200 |
| POST /store/carts/:id/customer | 200 |
| POST /store/carts/:id/line-items | 200, 400 |
| POST /store/carts/:id/line-items/:id | 200 |
| POST /store/carts/:id/promotions | 400, 200 |
| POST /store/carts/:id/shipping-methods | 200 |
| POST /store/customers | 200 |
| POST /store/customers/me | 200 |
| POST /store/customers/me/addresses | 200 |
| POST /store/payment-collections | 200 |
| POST /store/payment-collections/:id/payment-sessions | 200 |

## Production state and remaining launch checks

Railway account reauthenticated. Frontend uses the public API domain, with database, Redis, bucket and Shiprocket variables present. Resend and OpenAI keys were copied privately into the backend environment; secrets are excluded from this report and Git. OTP is not required by the new checkout.

Deployment status and authenticated production CRUD/checkout must be checked after merge. Production had zero catalog products in the pre-deploy read-only check. A real catalog, final shipping charge, policies/tax review, and one controlled Shiprocket booking with AWB/label/pickup verification are still required before customer launch. AUTO_SHIP and automatic pickup remain false until that check succeeds.
