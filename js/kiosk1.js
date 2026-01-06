// TTG Kiosk 1 prototüüp
// - Birthdays: Wikimedia "On this day" births feed (public)
// - Week plan: JSONPlaceholder demo data (public)
// - Posters: posters/posters.json + posters/ kaust, aegumine kuupäevaga failinimest või JSON-ist

const TTG = {
  posterIntervalSeconds: 10,
  postersManifestUrl: "posters/posters.json",
  postersBasePath: "posters/",
};

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("hidden");
}

function pad2(n) { return String(n).padStart(2, "0"); }

// --- Kell / kuupäev ---
function startClock() {
  const tick = () => {
    const now = new Date();
    setText("clock", `${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
    setText("date", now.toLocaleDateString("et-EE", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
  };
  tick();
  setInterval(tick, 1000 * 10);
}

// --- 1) Sünnipäevad (avalik näidis) ---
async function loadBirthdays() {
  hideError("birthdaysError");

  const now = new Date();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());

  // Wikimedia REST feed (English Wikipedia)
  // Docs: https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day
  const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/births/${mm}/${dd}`;

  const list = document.getElementById("birthdays");
  list.innerHTML = "<li>Laen andmeid…</li>";

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const births = Array.isArray(data.births) ? data.births : [];
    if (births.length === 0) {
      list.innerHTML = "<li>Täna ei leitud näidisandmeid.</li>";
      return;
    }

    // Võta 6 suvalist
    const picked = births
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .map(b => `${b.year} – ${b.text}`);

    list.innerHTML = "";
    for (const item of picked) {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    }
  } catch (err) {
    list.innerHTML = "<li>Andmeid ei õnnestunud laadida.</li>";
    showError("birthdaysError", `Sünnipäevade laadimine ebaõnnestus: ${err.message}. (Avaliku WiFi korral võib olla API blokeeritud.)`);
  }
}

// --- 2) "Nädalaplaan" (avalik näidis) ---
async function loadWeekPlan() {
  hideError("weekPlanError");
  const box = document.getElementById("weekPlan");
  box.textContent = "Laen andmeid…";

  // JSONPlaceholder demo
  const url = "https://jsonplaceholder.typicode.com/posts?_limit=5";

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const posts = await res.json();

    const days = ["Esmaspäev", "Teisipäev", "Kolmapäev", "Neljapäev", "Reede"];

    box.innerHTML = "";
    posts.forEach((p, idx) => {
      const wrap = document.createElement("div");
      wrap.className = "week-item";

      const day = document.createElement("div");
      day.className = "week-day";
      day.textContent = days[idx] || `Päev ${idx + 1}`;

      const title = document.createElement("div");
      title.className = "week-title";
      title.textContent = (p.title || "").slice(0, 70);

      const body = document.createElement("div");
      body.className = "week-body";
      body.textContent = (p.body || "").slice(0, 140) + "…";

      wrap.appendChild(day);
      wrap.appendChild(title);
      wrap.appendChild(body);

      box.appendChild(wrap);
    });
  } catch (err) {
    box.textContent = "Andmeid ei õnnestunud laadida.";
    showError("weekPlanError", `Nädalaplaani näidisandmed ei tulnud: ${err.message}.`);
  }
}

// --- 3) Plakatid (posters.json + aegumine) ---

function parseExpiryFromFilename(filename) {
  // Ootab kujul: YYYY-MM-DD_....
  const m = filename.match(/^(\d{4})-(\d{2})-(\d{2})_/);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);

  // Aegumine päeva lõpus (kohalik aeg): 23:59:59
  return new Date(y, mo, d, 23, 59, 59, 999);
}

function isExpired(expiryDate) {
  if (!expiryDate) return false;
  return new Date() > expiryDate;
}

async function loadPostersManifest() {
  hideError("postersError");

  try {
    const res = await fetch(TTG.postersManifestUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const manifest = await res.json();

    if (!manifest || !Array.isArray(manifest.items)) {
      throw new Error("posters.json peab sisaldama { items: [...] }");
    }

    const cleaned = manifest.items
      .filter(x => x && typeof x.file === "string")
      .map(x => {
        // expiry võib tulla JSON-ist või failinimest
        let expiry = null;

        if (typeof x.expires === "string" && x.expires.trim() !== "") {
          // eeldame YYYY-MM-DD
          const parts = x.expires.split("-");
          if (parts.length === 3) {
            const y = Number(parts[0]);
            const m = Number(parts[1]) - 1;
            const d = Number(parts[2]);
            expiry = new Date(y, m, d, 23, 59, 59, 999);
          }
        }

        if (!expiry) expiry = parseExpiryFromFilename(x.file);

        return {
          file: x.file,
          caption: x.caption || "",
          expiresAt: expiry
        };
      })
      .filter(x => !isExpired(x.expiresAt));

    return cleaned;
  } catch (err) {
    showError("postersError", `Plakatite nimekirja ei saanud lugeda: ${err.message}`);
    return [];
  }
}

function startPosterRotation(items) {
  setText("posterIntervalText", String(TTG.posterIntervalSeconds));

  const img = document.getElementById("posterImage");
  const placeholder = document.getElementById("posterPlaceholder");
  const caption = document.getElementById("posterCaption");

  if (!items || items.length === 0) {
    img.style.display = "none";
    placeholder.style.display = "grid";
    caption.textContent = "";
    return;
  }

  let idx = 0;

  const show = () => {
    const item = items[idx];
    const src = TTG.postersBasePath + item.file;

    placeholder.style.display = "none";
    img.style.display = "block";

    // laadimine “pehmelt”
    img.style.opacity = "0";
    img.onload = () => { img.style.opacity = "1"; };
    img.src = src;

    const expText = item.expiresAt
      ? ` • kuni ${item.expiresAt.toLocaleDateString("et-EE")}`
      : "";

    caption.textContent = (item.caption || item.file) + expText;

    idx = (idx + 1) % items.length;
  };

  show();
  setInterval(show, TTG.posterIntervalSeconds * 1000);
}

async function initPosters() {
  const items = await loadPostersManifest();
  startPosterRotation(items);

  // Reloadi manifest vahepeal (nt iga 5 min), et uued plakatid tuleksid sisse
  setInterval(async () => {
    const newItems = await loadPostersManifest();
    startPosterRotation(newItems);
  }, 5 * 60 * 1000);
}

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
  startClock();
  loadBirthdays();
  loadWeekPlan();
  initPosters();

  // Uuenda “väliseid” andmeid aeg-ajalt
  setInterval(loadBirthdays, 60 * 60 * 1000); // 1h
  setInterval(loadWeekPlan, 10 * 60 * 1000);  // 10 min
});
