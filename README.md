# AdSpace Audio Autoplay Test

A tiny project to test whether a video can **autoplay with sound** with **no user click/action**.

## What it does

1. Upload a video on the home page
2. Get a short link like `https://your-app.vercel.app/x7k2m9ab`
3. Open that link anywhere — the page immediately tries to play the video **with sound**
4. The result is shown on the page:
   - `SOUND AUTOPLAY OK` → the browser allowed it
   - `BLOCKED` → the browser blocked it (typical autoplay policy)

## Run locally

```bash
npm install
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

Locally, files are stored in `uploads/` — no Blob token needed.

## Deploy on Vercel

Uploads on Vercel **require Blob storage**. The serverless filesystem cannot create `/uploads`.

1. Open the project in the [Vercel dashboard](https://vercel.com/dashboard)
2. Go to **Storage** → **Create** → **Blob**
3. Connect that Blob store to this project (this sets `BLOB_READ_WRITE_TOKEN`)
4. **Redeploy** the project (important — env vars apply on new deploys)

Without Blob you will get an error instead of `ENOENT mkdir uploads`.

### Size limit

Serverless API uploads on Vercel are limited to about **4.5MB**. That is enough for an autoplay test — use a short clip with audio.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Upload |
| `/{id}` | Autoplay + sound status report |

## Test note

Modern browsers usually block unmuted autoplay without a user gesture. This project intentionally tests that scenario so you can compare behavior across Safari iOS, Chrome Android, desktop, etc.
