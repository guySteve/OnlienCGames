#!/bin/bash
################################################################################
# VegasCore v4.0.0 - Deploy with Environment Variables
################################################################################

set -e

PROJECT_ID="onlinecgames"

echo "🚀 Deploying VegasCore v4.0.0 with environment variables..."
echo ""

gcloud run deploy vegascore \
  --image gcr.io/$PROJECT_ID/vegascore:v4.0.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "PORT=8080" \
  --set-env-vars "DATABASE_URL=postgresql://postgres.kitqcxholtgtudojbhyd:2KF0pV31tAXJ4v1j@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1" \
  --set-env-vars "DIRECT_URL=postgresql://postgres.kitqcxholtgtudojbhyd:2KF0pV31tAXJ4v1j@aws-1-us-east-1.pooler.supabase.com:5432/postgres?connect_timeout=30" \
  --set-env-vars "REDIS_URL=rediss://default:Aas7AAIncDJjMTVhMjU4MWZhMzU0YWNlYjY1NzVlZTkyMjdkMjgyM3AyNDM4MzU@huge-jaybird-43835.upstash.io:6379" \
  --set-env-vars "UPSTASH_REDIS_REST_TOKEN=Aas7AAIncDJjMTVhMjU4MWZhMzU0YWNlYjY1NzVlZTkyMjdkMjgyM3AyNDM4MzU" \
  --set-env-vars "UPSTASH_REDIS_REST_URL=https://huge-jaybird-43835.upstash.io" \
  --set-env-vars "SESSION_SECRET=68680329dfa4b1200ffb74e14c9c264a27de0b6d998992b4ef518620fe6b1cc8" \
  --set-env-vars "GOOGLE_CLIENT_ID=212973396288-to81l9hqrughbrpg9n5ud0gqb3c2uo5t.apps.googleusercontent.com" \
  --set-env-vars "GOOGLE_CLIENT_SECRET=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" \
  --set-env-vars "GOOGLE_CALLBACK_URL=https://playwar.games/auth/google/callback" \
  --set-env-vars "PUBLIC_URL=https://playwar.games" \
  --set-env-vars "WEBAUTHN_RP_ID=playwar.games" \
  --set-env-vars "WEBAUTHN_ORIGIN_PROD=https://playwar.games" \
  --set-env-vars "RATE_LIMIT_MAX_REQUESTS=100" \
  --set-env-vars "RATE_LIMIT_WINDOW_MS=60000" \
  --project $PROJECT_ID

echo ""
echo "✅ Deployment complete with environment variables!"
