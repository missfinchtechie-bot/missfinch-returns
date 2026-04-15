// Scrape every handle we don't have followers for. Outputs JSONL to scripts/scrape-results.jsonl.
// Usage: node scripts/backfill-scrape.mjs
import fs from 'node:fs';
import readline from 'node:readline';

function loadEnv() {
  try {
    const raw = fs.readFileSync('.env.local', 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) process.env[m[1]] = process.env[m[1]] || m[2];
    }
  } catch {}
}
loadEnv();

const APIFY = process.env.APIFY_API_TOKEN;
if (!APIFY) { console.error('APIFY_API_TOKEN missing'); process.exit(1); }
const ACTOR = 'shu8hvrXbJbY3Eb9W';

const HANDLES = process.argv.slice(2);
if (HANDLES.length === 0) {
  console.error('Pass handles as args: node backfill-scrape.mjs @handle1 @handle2 ...');
  process.exit(1);
}

const OUT = 'scripts/scrape-results.jsonl';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function scrape(handle) {
  const clean = handle.replace(/^@/, '').trim();
  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${APIFY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directUrls: [`https://www.instagram.com/${clean}/`],
      resultsType: 'details',
      resultsLimit: 1,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const p = data[0];
  const posts = Array.isArray(p.latestPosts) ? p.latestPosts.slice(0, 12) : [];
  let engagement = 0;
  if (posts.length > 0 && p.followersCount > 0) {
    const total = posts.reduce((s, x) => s + (Number(x.likesCount) || 0) + (Number(x.commentsCount) || 0), 0);
    engagement = (total / posts.length / p.followersCount) * 100;
  }
  return {
    username: p.username || clean,
    fullName: p.fullName || '',
    biography: p.biography || '',
    followersCount: Number(p.followersCount) || 0,
    followsCount: Number(p.followsCount) || 0,
    postsCount: Number(p.postsCount) || 0,
    isVerified: !!p.verified,
    isBusinessAccount: !!p.isBusinessAccount,
    profilePicUrl: p.profilePicUrl || '',
    externalUrl: p.externalUrl || '',
    recentPosts: posts.map(x => ({
      url: x.url || '',
      likesCount: Number(x.likesCount) || 0,
      commentsCount: Number(x.commentsCount) || 0,
      type: x.type || 'Image',
    })),
    engagementRate: Math.round(engagement * 100) / 100,
  };
}

async function main() {
  fs.writeFileSync(OUT, '');
  for (let i = 0; i < HANDLES.length; i++) {
    const h = HANDLES[i];
    console.log(`[${i + 1}/${HANDLES.length}] ${h}`);
    try {
      const p = await scrape(h);
      const line = JSON.stringify({ handle: h, profile: p, ok: !!p });
      fs.appendFileSync(OUT, line + '\n');
      console.log(p ? `  ✓ ${p.followersCount.toLocaleString()} followers · ${p.engagementRate}%` : '  ✗ no data');
    } catch (e) {
      fs.appendFileSync(OUT, JSON.stringify({ handle: h, ok: false, error: e.message }) + '\n');
      console.log(`  ✗ ${e.message}`);
    }
    if (i < HANDLES.length - 1) await sleep(5000);
  }
  console.log('done.');
}

main().catch(e => { console.error(e); process.exit(1); });
