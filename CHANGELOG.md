# Changelog

All notable changes to Gehna are documented in this file.

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
