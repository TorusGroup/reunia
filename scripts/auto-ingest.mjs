#!/usr/bin/env node
// =============================================================
// Auto-Ingest Script — runs after app startup on Railway
// Called by: railway.toml startCommand (background process)
// Flow: wait for app ready → seed DataSources → ingest FBI → ingest Interpol
// =============================================================

const APP_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const ADMIN_KEY = process.env.ADMIN_INGESTION_KEY ?? 'reunia-admin'
const MAX_WAIT_SECONDS = 120
const POLL_INTERVAL_MS = 3000

function log(msg) {
  const ts = new Date().toISOString()
  console.log(`[auto-ingest ${ts}] ${msg}`)
}

async function waitForApp() {
  const healthUrl = `${APP_URL}/api/health`
  log(`Waiting for app to be ready at ${healthUrl} ...`)

  const deadline = Date.now() + MAX_WAIT_SECONDS * 1000

  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        log('App is ready.')
        return true
      }
      log(`Health check returned ${res.status} — retrying...`)
    } catch {
      log('Health check failed (app not up yet) — retrying...')
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }

  log(`ERROR: App did not become ready within ${MAX_WAIT_SECONDS}s. Aborting auto-ingest.`)
  return false
}

async function seedDataSources() {
  log('Seeding DataSources...')
  try {
    const res = await fetch(`${APP_URL}/api/v1/ingestion/seed`, {
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json()
    if (data.success) {
      log(`Seed OK: ${data.data?.message ?? JSON.stringify(data.data)}`)
    } else {
      log(`Seed returned error: ${JSON.stringify(data.error)}`)
    }
  } catch (err) {
    log(`Seed exception: ${err.message ?? String(err)}`)
  }
}

async function triggerIngestion(source, maxPages = 1) {
  log(`Triggering ingestion: source=${source}, maxPages=${maxPages}`)
  try {
    const res = await fetch(`${APP_URL}/api/v1/ingestion/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY,
      },
      body: JSON.stringify({ source, maxPages }),
      // FBI is fast; Interpol can take up to 60s per page
      signal: AbortSignal.timeout(300_000),
    })
    const data = await res.json()
    if (data.success) {
      const s = data.data?.summary
      log(
        `Ingestion OK [${source}]: fetched=${s?.totalFetched ?? 0}, inserted=${s?.totalInserted ?? 0}, ` +
        `updated=${s?.totalUpdated ?? 0}, failed=${s?.totalFailed ?? 0} (${data.data?.totalDurationMs ?? 0}ms)`
      )
    } else {
      log(`Ingestion error [${source}]: ${JSON.stringify(data.error)}`)
    }
  } catch (err) {
    log(`Ingestion exception [${source}]: ${err.message ?? String(err)}`)
  }
}

async function main() {
  log('=== ReunIA Auto-Ingest Starting ===')
  log(`Target: ${APP_URL}`)

  const ready = await waitForApp()
  if (!ready) process.exit(0) // Don't fail deployment — just skip

  // Step 1: Seed data sources
  await seedDataSources()

  // Small pause to let DB operations settle
  await new Promise((r) => setTimeout(r, 1000))

  // Step 2: FBI (fast, ~2s/page, 50 records/page, 5 pages = ~250 records)
  await triggerIngestion('fbi', 5)

  // Small pause between sources
  await new Promise((r) => setTimeout(r, 2000))

  // Step 3: NCMEC (public, no auth, 25 records/page — fetch 20 pages = ~500 records)
  await triggerIngestion('ncmec', 20)

  // Small pause between sources
  await new Promise((r) => setTimeout(r, 2000))

  // Step 4: Interpol (returns 0 gracefully — API blocks cloud IPs with 403)
  await triggerIngestion('interpol', 1)

  // Small pause between sources
  await new Promise((r) => setTimeout(r, 2000))

  // Step 5: AMBER (RSS feed — real-time alerts, usually few or zero items)
  await triggerIngestion('amber', 1)

  log('=== Auto-Ingest Complete ===')
  process.exit(0)
}

main().catch((err) => {
  log(`FATAL: ${err.message ?? String(err)}`)
  process.exit(0) // Always exit 0 — don't fail the deployment
})
