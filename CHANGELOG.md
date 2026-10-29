# Changelog

All notable changes to Gehna are documented in this file.

## [0.1.4.0] - 2026-10-29

- Add persistent customer star ratings and written reviews for delivered purchases, including editing, public averages and pagination without exposing customer emails.
- Add a responsive review section to product pages, with a sign-in link that returns customers to their chosen piece.
- Preserve email casing during sign-in and keep valid sessions when order or address loading fails.
- Retry bag attachment before checkout and require the completed cart to belong to the signed-in customer.
- Extend the local checkout and returns check to cover review creation, editing, eligibility and customer isolation.

## [0.1.3.2] - 2026-10-26

- Add step-by-step tracking instructions to customer emails when an AWB is available.
- Show Shiprocket’s AWB rejection reason, including wallet funding errors, while preserving duplicate-booking protection.

## [0.1.3.1] - 2026-10-26

- Include the assigned Shiprocket tracking ID, courier and tracking link in order confirmations and courier-booking emails.
- Explain that tracking follows after booking when no AWB exists yet, and fall back to Shiprocket’s public tracker for unsafe or missing tracking URLs.

## [0.1.3.0] - 2026-10-26

- Add customer return requests for delivered items, with quantity selection, reasons and status in My orders.
- Add a staff return queue linked to Medusa’s review and receipt workflow; requests do not issue refunds, book pickups or restock items.
- Protect order ownership, prevent duplicate/over-quantity requests and block the native customer endpoint from bypassing staff review.
- Refine the light customer dashboard with clearer order cards and an accessible return form.

## [0.1.2.0] - 2026-10-26

- Refresh catalog changes when navigating, returning to the storefront, reconnecting, and every 30 seconds while the tab is visible.
- Load the entire published catalog beyond the first 100 products and recover the cover photo when a selected gallery photo is removed.

## [0.1.1.1] - 2026-10-25

- Keep product details and recommendations separated on mobile by using a fixed row gap instead of a percentage gap.

## [0.1.1.0] - 2026-10-25

- Manage recent products from a light Catalog studio with direct photo, price, inventory and category controls.
- Browse all product photos with a gallery that follows the saved cover and image order.
- Fix missing Earrings results and assign categories to AI drafts, including whole-word jewellery matching and concurrent category creation recovery.
- Verify saved image order, cover changes, category selection and existing commerce flows with regression tests.

## [0.1.0.3] - 2026-10-24

- Generate one studio product image and two distinct model-worn editorial close-ups featuring an adult Indian woman, each with its own high-quality image-edit request.
- Label all three dashboard previews and retain the product-only image as the thumbnail. Publish only after staff review.
- Verify three-shot ordering and ensure image-generation failures leave no partial product or uploaded files.

## [0.1.0.2] - 2026-10-24

- Serve product images through a public read-only route outside Medusa Store API authentication so browser image tags can display uploaded photos.

## [0.1.0.1] - 2026-10-24

- Added a light dashboard assistant that creates product drafts with OpenAI image edits, a short description, explicit INR pricing and stock, and a review step before publishing.
- Added confirmed cancellation for unshipped, uncaptured orders while preserving order records.
- Removed mandatory SMS verification from customer signup and COD checkout.
- Improved branded order and courier-booking emails with the Gehna logo and plain-text content.
- Added repeatable local commerce API checks, assistant validation and rollback tests, and image download verification.
- Return a missing-payment-collection error instead of a server error during payment-session creation.

## [0.1.0.0] - 2026-10-15

### Added

- Added a modern responsive jewellery storefront with product browsing, wishlist, customer accounts, verified-mobile checkout and Cash on Delivery.
- Added Medusa administration for products, pricing, inventory, customers and orders.
- Added the operations dashboard with revenue, COD, customer, shipment, label and bulk-export reporting.
- Added Shiprocket booking with Best Recommended courier selection, retry and reconciliation support.
- Added customer order-confirmation and shipment-booking email workflows.
- Added Railway deployment definitions for the storefront and backend.

### Changed

- Configured the production domain as `gehnadesigns.in` and the API/admin domain as `api.gehnadesigns.in`.
- Configured the storefront to run as a Next.js server in production.
