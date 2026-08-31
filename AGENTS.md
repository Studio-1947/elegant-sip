# Deployment context

- Production domain: `elegantsip.in`
- Deployment model: single Hostinger VPS using `docker-compose.prod.yml`.
- VPS SSH target: `deploy@187.127.185.82` (do not use root for deployment).
- Public services: Caddy only, on ports 80 and 443. PostgreSQL, Redis, and the
  API port must remain private to the Docker network.
- Production API and storefront share one origin; the API is available under
  `/api` and Swagger under `/api/docs`.
- The production `.env` is intentionally gitignored. Never add passwords,
  private keys, SMTP credentials, payment credentials, or other secrets to the
  repository, this file, logs, or chat output.

## Deployment procedure

1. Ensure the `elegantsip.in` DNS A record points to the VPS.
2. On the VPS, copy `.env.prod.example` to `.env` and set a strong
   `POSTGRES_PASSWORD` plus any approved SMTP, payment, and GST values.
3. Run `docker compose -f docker-compose.prod.yml up -d --build`.
4. Verify `/api/health` and `/api/docs` through the HTTPS domain.

Do not attempt an SSH deployment unless the user explicitly requests it and
provides authentication through an approved secure channel.
