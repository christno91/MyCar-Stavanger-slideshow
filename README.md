# MyCar Stavanger – FINN slideshow (Webflow embed)

Dette prosjektet publiserer en slideshow-side du kan embedde i Webflow via iframe.

## Hvorfor proxy
FINN krever `x-FINN-apikey` i header, og søk returnerer Atom XML. Derfor ligger kall og parsing i en serverless endpoint (`/api/ads`).

## Deploy på Vercel
1. Last opp prosjektet til GitHub
2. Import i Vercel
3. Sett Environment Variables:
   - `FINN_API_KEY`
   - `FINN_ORG_ID=387559925`
   - (valgfritt) `ACCESS_TOKEN` og bruk `?token=...` i URLen

Når deploy er ferdig får du en URL som f.eks. `https://mycar-tv.vercel.app`.

## Embed i Webflow
Legg inn en Code Embed med:

```html
<iframe src="https://mycar-tv.vercel.app/?slide=10&refresh=120" style="width:100%;height:720px;border:0" loading="lazy" allowfullscreen></iframe>
```

## Params
- `slide` = sekunder per bil (default 10)
- `refresh` = sekunder mellom oppdateringer (default 120)
- `token` = kun hvis du har satt `ACCESS_TOKEN`
