#!/usr/bin/env bash
# Issue (or renew) Let's Encrypt certs for LogIt Nginx TLS.
# Usage (this project):
#   ./scripts/init-letsencrypt.sh logit.koaimpact.app ops@koaimpact.app
#
# Requires: Docker, DNS A/AAAA already pointing at this host, ports 80/443 open.
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
STAGING="${STAGING:-0}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: $0 <domain> <email>"
  echo "Optional: STAGING=1 $0 <domain> <email>  # Let's Encrypt staging"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT/infra/certs"
WWW_DIR="$ROOT/infra/certbot/www"

mkdir -p "$CERT_DIR" "$WWW_DIR"

# Bootstrap dummy certs so Nginx can start before the first real issue.
if [[ ! -f "$CERT_DIR/fullchain.pem" || ! -f "$CERT_DIR/privkey.pem" ]]; then
  echo ">> Creating temporary self-signed certificate…"
  docker run --rm -v "$CERT_DIR:/certs" alpine/openssl \
    req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /certs/privkey.pem \
    -out /certs/fullchain.pem \
    -subj "/CN=$DOMAIN"
fi

echo ">> Starting stack with production TLS overlay…"
cd "$ROOT"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx

STAGING_FLAG=()
if [[ "$STAGING" == "1" ]]; then
  STAGING_FLAG=(--staging)
fi

echo ">> Requesting Let's Encrypt certificate for $DOMAIN…"
docker run --rm \
  -v "$CERT_DIR:/etc/letsencrypt" \
  -v "$WWW_DIR:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  "${STAGING_FLAG[@]}" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Point Nginx at the live certs (overwrite bootstrap).
cp -L "$CERT_DIR/live/$DOMAIN/fullchain.pem" "$CERT_DIR/fullchain.pem"
cp -L "$CERT_DIR/live/$DOMAIN/privkey.pem" "$CERT_DIR/privkey.pem"

echo ">> Reloading Nginx…"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T nginx nginx -s reload

echo ">> Done. Visit https://$DOMAIN/health/ready"
echo "   Renew later with: $0 $DOMAIN $EMAIL"
echo "   (or schedule certbot renew + copy + nginx reload)"
