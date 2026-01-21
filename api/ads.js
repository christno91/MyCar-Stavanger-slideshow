import { XMLParser } from 'fast-xml-parser';

let cache = { ts: 0, data: null };

function pickFirst(val) {
  if (val == null) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

function toInt(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function fmtNumber(n) {
  if (n == null) return '';
  return new Intl.NumberFormat('nb-NO').format(n);
}

function parseFinnAtom(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true
  });

  const obj = parser.parse(xmlText);
  const feed = obj?.feed;
  const entries = feed?.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];

  const cars = entries.map((e) => {
    const title = pickFirst(e?.title) ?? '';

    // FINN extensions live in "finn:adata" but with removeNSPrefix it becomes adata.
    const adata = e?.adata;
    const props = adata?.property ? (Array.isArray(adata.property) ? adata.property : [adata.property]) : [];

    // property nodes usually look like: { "@_name": "price", "#text": "199000" }
    const propMap = new Map();
    for (const p of props) {
      const key = p?.['@_name'];
      const val = p?.['#text'] ?? p?.text ?? p?.['@_value'];
      if (key) propMap.set(key, val);
    }

    const price = toInt(propMap.get('price'));
    const mileage = toInt(propMap.get('mileage'));
    const modelYear = toInt(propMap.get('modelYear'));

    // Try to find image in links. Atom uses <link rel="enclosure" type="image/jpeg" href="..."/>
    const links = e?.link ? (Array.isArray(e.link) ? e.link : [e.link]) : [];
    const img = links.find((l) => (l?.['@_type'] || '').startsWith('image/')) || links.find((l) => (l?.['@_rel'] || '') === 'enclosure');
    const imageUrl = img?.['@_href'] ?? null;

    const adUrl = links.find((l) => (l?.['@_rel'] || '') === 'alternate')?.['@_href'] ?? null;

    return {
      title,
      modelYear,
      mileage,
      price,
      priceText: price != null ? `${fmtNumber(price)} kr` : '',
      mileageText: mileage != null ? `${fmtNumber(mileage)} km` : '',
      imageUrl,
      adUrl
    };
  });

  return cars;
}

export default async function handler(req, res) {
  try {
    const apiKey = process.env.FINN_API_KEY;
    const orgId = process.env.FINN_ORG_ID;
    const accessToken = process.env.ACCESS_TOKEN || '';
    const cacheSeconds = Number(process.env.CACHE_SECONDS || '120');
    const maxAds = Number(process.env.MAX_ADS || '30');

    if (!apiKey) {
      res.status(500).json({ error: 'Missing FINN_API_KEY env var' });
      return;
    }
    if (!orgId) {
      res.status(500).json({ error: 'Missing FINN_ORG_ID env var' });
      return;
    }

    if (accessToken) {
      const token = req.query?.token;
      if (token !== accessToken) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    const now = Date.now();
    if (cache.data && now - cache.ts < cacheSeconds * 1000) {
      res.setHeader('Cache-Control', `public, max-age=${cacheSeconds}`);
      res.json(cache.data);
      return;
    }

    // FINN search endpoint is an Atom feed.
    // We'll query car-norway with the orgId, sorted by published desc.
    const url = new URL('https://cache.api.finn.no/iad/search/car-norway');
    url.searchParams.set('orgId', String(orgId));
    url.searchParams.set('sort', 'PUBLISHED_DESC');
    url.searchParams.set('rows', String(Math.min(Math.max(maxAds, 1), 200)));

    const resp = await fetch(url.toString(), {
      headers: {
        'x-FINN-apikey': apiKey,
        'accept': 'application/atom+xml, application/xml;q=0.9, */*;q=0.1'
      }
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      res.status(resp.status).json({
        error: 'FINN API error',
        status: resp.status,
        statusText: resp.statusText,
        body: text.slice(0, 500)
      });
      return;
    }

    const xml = await resp.text();
    const cars = parseFinnAtom(xml).slice(0, Math.min(Math.max(maxAds, 1), 200));

    const payload = {
      updatedAt: new Date().toISOString(),
      count: cars.length,
      cars
    };

    cache = { ts: now, data: payload };

    // If you embed via iframe, CORS isn't needed.
    // If you ever fetch directly from JS on another domain, enable CORS here.
    res.setHeader('Cache-Control', `public, max-age=${cacheSeconds}`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: 'Server error', message: String(err?.message || err) });
  }
}
