# Deploy Gehna on Railway

This repository contains two deployable services. Railway also provides the PostgreSQL, Redis, and S3-compatible bucket used by the backend.

## 1. Create the project

1. In Railway, create a new project from `YajatMakhija/gehna`.
2. Add a PostgreSQL database, Redis database, and Storage Bucket to the same project.
3. Use the GitHub service Railway already created from the repository as `storefront`. Leave its **Root Directory** empty and its **Config File Path** empty. Railway will automatically use the root `/railway.toml`, which builds and starts the app in `/storefront`.
4. Add a second GitHub service from the same repository and name it `backend`.
5. For the backend service, set **Root Directory** to `/backend` and **Config File Path** to `/backend/railway.toml`.

The root configuration is intentional: it lets Railway deploy the public storefront even when a service was created from the repository root. The backend remains a separate service because it has a different process, health check, environment, database, and Redis connection.

## 2. Backend variables

Set these only on the backend service. Generate new random values for both secrets; never reuse an account password.

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
STORE_CORS=https://gehnadesigns.in,https://www.gehnadesigns.in
ADMIN_CORS=https://api.gehnadesigns.in
AUTH_CORS=https://gehnadesigns.in,https://www.gehnadesigns.in,https://api.gehnadesigns.in
STOREFRONT_URL=https://gehnadesigns.in
MEDUSA_BACKEND_URL=https://api.gehnadesigns.in
JWT_SECRET=<random-secret>
COOKIE_SECRET=<different-random-secret>
PHONE_VERIFY_LOCAL=false
SEED_SAMPLE_CATALOG=false
STANDARD_SHIPPING_RATE_INR=<your-final-shipping-price-in-rupees>
WAREHOUSE_ADDRESS_LINE_1=<registered-pickup-address>
WAREHOUSE_CITY=<pickup-city>
WAREHOUSE_STATE=<pickup-state>
WAREHOUSE_POSTAL_CODE=<six-digit-pickup-postcode>
AUTO_SHIP=false
SHIPROCKET_AUTO_PICKUP=false
ORDER_EMAIL_FROM=Gehna <rajesh@gehnadesigns.in>
```

Add the private Shiprocket, Resend and Twilio values from `backend/.env.example`. Do not copy the local `DATABASE_URL` into Railway.

Map the Railway bucket's S3-compatible credentials to `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_ENDPOINT`. Set `S3_URL_STYLE=virtual-host` and set `S3_FILE_URL` to `https://api.gehnadesigns.in/store/files`. The backend serves images from the private bucket through that public read-only route.

## 3. First backend deployment

The backend service applies pending Medusa database migrations as part of `npm run start`, starts the compiled server, and checks `/health`. After its first successful deployment:

1. Add the custom domain `api.gehnadesigns.in`.
2. Run `npm run seed` once through a Railway shell to create the India region, fulfillment data and publishable API key.
3. Run `npx medusa user -e rajesh@gehnadesigns.in -p <a-new-strong-password>` in a Railway backend shell to create the owner account. Enter the real password only in the private Railway shell.
4. Copy the generated Medusa publishable key and region ID into the storefront variables below.

## 4. Storefront variables

Set these on the storefront service. `NEXT_PUBLIC_*` values are embedded during the build, so redeploy after changing them.

```env
NODE_ENV=production
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.gehnadesigns.in
NEXT_PUBLIC_MEDUSA_ADMIN_URL=https://api.gehnadesigns.in/app
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<publishable-key-from-seed>
NEXT_PUBLIC_MEDUSA_REGION_ID=<india-region-id-from-seed>
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SAMPLE_CATALOG=false
```

After a successful deployment, add `gehnadesigns.in` and `www.gehnadesigns.in` to the storefront service. Redirect `www` to the root domain in Railway or at the DNS provider.

## 5. DNS and email

Add the DNS records Railway displays for the three custom domains. Verify `gehnadesigns.in` in Resend and add its SPF/DKIM records without removing the records required by the existing `rajesh@gehnadesigns.in` mailbox.

## 6. Controlled launch check

1. Add one real product with its final price, stock, weight, dimensions, HSN and photos.
2. Register with a real mobile number and complete Twilio OTP verification.
3. Place one COD order to a serviceable postcode.
4. Keep `AUTO_SHIP=false`; use **Book courier** from `/app/overview` and verify the order, AWB, customer address and label in Shiprocket.
5. Verify both customer emails arrive and product inventory decreases.
6. Enable `AUTO_SHIP=true` only after the controlled order succeeds. Enable `SHIPROCKET_AUTO_PICKUP=true` only when parcels should request pickup immediately.

The code is deployable before this controlled check. The store should not accept real customers until the actual catalog, policies, taxes, shipping amount, email, OTP and courier flow have been verified.
