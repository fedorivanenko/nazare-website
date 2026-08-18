# Nazare website

Astro landing page deployed on Vercel.

```sh
pnpm install
cp .env.example .env
pnpm dev
```

Set `RESEND_API_KEY` and `RESEND_SEGMENT_ID` in local `.env` and Vercel environment variables. Newsletter signups become Resend contacts in the configured segment.
