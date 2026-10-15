# Gehna repository instructions

Never commit `.env` files, customer data, local PostgreSQL data, API credentials, generated build output, or downloaded shipping labels.

## Deploy Configuration (configured by /setup-deploy)

- Platform: Railway
- Production URL: https://gehnadesigns.in
- API URL: https://api.gehnadesigns.in
- Deploy workflow: automatic on push to `main` after the Railway project is connected
- Deploy status command: Railway deployment status and logs
- Merge method: direct initial commit; pull requests for later changes
- Project type: Next.js storefront and Medusa API/admin monorepo
- Post-deploy health check: https://gehnadesigns.in and https://api.gehnadesigns.in/health

### Custom deploy hooks

- Pre-merge: `npm --prefix backend test`, `npm --prefix backend run typecheck`, `npm --prefix backend run build`, `npm --prefix storefront run typecheck`, and `npm --prefix storefront run build`
- Deploy trigger: automatic on push to `main`
- Deploy status: inspect both Railway service deployments
- Health check: storefront `/` and Medusa `/health`
