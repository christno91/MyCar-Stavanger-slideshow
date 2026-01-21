const qs = new URLSearchParams(location.search);
const slideSeconds = Number(qs.get('slide') || '10');
const refreshSeconds = Number(qs.get('refresh') || '120');
const token = qs.get('token') || ''; // optional; only needed if you set ACCESS_TOKEN on the server

const els = {
  img: document.getElementById('carImage'),
  title: document.getElementById('carTitle'),
  year: document.getElementById('carYear'),
  km: document.getElementById('carKm'),
  price: document.getElementById('carPrice'),
  url: document.getElementById('carUrl'),
  status: document.getElementById('status'),
  updated: document.getElementById('updated'),
  clock: document.getElementById('clock')
};

let cars = [];
let idx = 0;
let slideTimer = null;
let refreshTimer = null;

function setStatus(msg) {
  els.status.textContent = msg;
}

function tickClock() {
  const d = new Date();
  els.clock.textContent = d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.host + u.pathname;
  } catch {
    return url;
  }
}

function showCar(car) {
  if (!car) return;

  els.title.textContent = car.title || '';
  els.year.textContent = car.modelYear ?? '';
  els.km.textContent = car.mileageText || '';
  els.price.textContent = car.priceText || '';
  els.url.textContent = normalizeUrl(car.adUrl || '');

  if (car.imageUrl) {
    els.img.src = car.imageUrl;
  } else {
    els.img.removeAttribute('src');
  }
}

async function fetchCars() {
  const url = new URL('/api/ads', location.origin);
  if (token) url.searchParams.set('token', token);

  setStatus('Oppdaterer bilutvalg…');
  const r = await fetch(url.toString(), { cache: 'no-store' });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${r.status}`);
  }

  const data = await r.json();
  cars = Array.isArray(data.cars) ? data.cars : [];
  idx = 0;

  const updatedAt = data.updatedAt ? new Date(data.updatedAt) : null;
  els.updated.textContent = updatedAt ? `Oppdatert ${updatedAt.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}` : '';

  if (!cars.length) {
    setStatus('Ingen biler funnet.');
    return;
  }

  setStatus(`${cars.length} biler i rotasjon.`);
  showCar(cars[idx]);
}

function startSlideshow() {
  if (slideTimer) clearInterval(slideTimer);
  slideTimer = setInterval(() => {
    if (!cars.length) return;
    idx = (idx + 1) % cars.length;
    showCar(cars[idx]);
  }, Math.max(slideSeconds, 3) * 1000);
}

function startRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(async () => {
    try {
      await fetchCars();
    } catch (e) {
      setStatus(`Feil ved oppdatering: ${e.message}`);
    }
  }, Math.max(refreshSeconds, 30) * 1000);
}

(async function init() {
  tickClock();
  setInterval(tickClock, 1000);

  try {
    await fetchCars();
  } catch (e) {
    setStatus(`Kunne ikke hente biler: ${e.message}`);
  }

  startSlideshow();
  startRefresh();
})();
