# Gehna deployment QA — updated 29 October 2026

## Verified locally

- The review release passed all 21 backend test groups, both TypeScript checks and both production builds. The local checkout-to-delivery flow passed review eligibility, creation, editing, public averages and customer isolation, followed by staff return receipt with exact restock.
- Local browser checks passed registration, mixed-case email login, logout, product reviews and customer return forms. Independent source and visual reviews passed. Deployment of the review release and authenticated production review API checks remain pending merge. These checks do not establish production readiness or verify a real courier booking, pickup or refund.
- Catalog studio and the light dashboard were checked at mobile, tablet and desktop widths. The image shortcut opens Medusa’s media editor.
- Multi-image upload, saved gallery reordering and cover-photo changes passed through the admin and Store APIs. Product-gallery thumbnail switching and the Earrings collection passed browser checks. Temporary products and uploads were removed.
- The earlier catalog release passed 13 backend/catalog test groups, both TypeScript checks and production builds.
- 108 commerce requests across 54 endpoint/method combinations passed. Expected error responses below are intentional validation/authentication checks.
- Product create, image upload and byte-exact download, price and stock updates, storefront sync and deletion passed.
- Signup, login, profile, saved addresses, order history, cart, stock protection, delivery, COD completion without OTP, dashboard reporting and CSV export passed.
- Assistant authorization, draft publishing, repeat publishing, confirmation requirement and cancellation passed. Canceled records were preserved.
- Real OpenAI call passed: description, two image edits, real Medusa draft and inventory, public image download, publish, exact INR price and stock visible through Store API. Temporary product and photos were deleted. AI image fidelity must still be reviewed by staff for every product.
- Assistant rendered at desktop and mobile widths; raw photo input preview worked.
- Unit tests mock shipping and email APIs, and verify duplicate protection, escaping, courier selection, label host validation and image-workflow rollback. No real courier was booked.

## Local endpoint results

| Endpoint | Observed HTTP status |
|---|---|
| GET /files/%21invalid (no API key) | 400, filename validation reached |
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

## Customer return requests — verified locally, production verification pending

The customer account now offers delivered-item return requests with quantities, a reason and status history. The custom authenticated `/store/gehna/returns` endpoint enforces ownership and quantity checks, while direct `POST /store/returns` is blocked. The dashboard queue opens the native order return draft for staff review. Requests do not trigger pickup, refunds or restocking; staff must confirm the receiving location, arrange collection manually, receive the actual goods, then decide any refund. The merchant’s published return policy remains a launch gate; no return window is defined by this feature.

`node scripts/returns-smoke.mjs` checks the local request-to-staff-receipt flow, ownership, delivered quantities, duplicates, native endpoint protection and restock timing. It requires email and automatic courier booking to be disabled and makes no email, courier or refund call. Temporary products are removed; local audit records remain. Local request-to-receipt integration passed, including exact restock and protected endpoints. The actual customer form passed zero-quantity validation, successful submission and awaiting-review status on mobile; 390px and 1280px screenshots were reviewed with no horizontal overflow. All 16 backend groups, both type checks and both production builds passed. Production verification follows deployment.

## Production state and remaining launch checks

Railway account reauthenticated. Frontend uses the public API domain, with database, Redis, bucket and Shiprocket variables present. Resend and OpenAI keys were copied privately into the backend environment; secrets are excluded from this report and Git. OTP is not required by the new checkout.

Deployment status and authenticated production CRUD/checkout must be checked after merge. Production had zero catalog products in the pre-deploy read-only check. A real catalog, final shipping charge, policies/tax review, and one controlled Shiprocket booking with AWB/label/pickup verification are still required before customer launch. AUTO_SHIP and automatic pickup remain false until that check succeeds.

Production testing found an incorrect storage secret and image URLs under Medusa's Store API guard. The correct bucket secret passed a write/read/delete test and was synced privately. The image-route fix exposes the same validated, read-only handler at `/files` and changes generated URLs to that public prefix; the legacy `/store/files` route remains available for API clients. Re-run deployed image download and checkout checks after this fix rolls out.

The backend runtime dependency audit reports 25 high and 57 moderate advisories, with no critical findings. These need compatibility/security review before customer launch. Railway also reports that its current TOML configuration support ends on 1 December 2026; migrate before that date.
