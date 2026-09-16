/* ==========================================================
   S!aP — Kuwait Network Map
   Owns: this file (network-map.js) + network-map.css. Registers its own
   SIAP view; reads OWNERS/randPlate/randAccount from data.js (same shared
   top-level scope every other classic script here already uses -- see
   app.js's own `OWNERS[...]` reference). Does NOT touch SIAP.state: the
   real Al Dhaher station is still driven end to end by the core sim
   (SIAP.state.bays); the other 25 stations are a small, self-contained,
   deterministically-seeded synthetic model with a light per-tick jitter,
   exactly as scoped -- this is a map overview, not a second simulation
   engine.

   Client ask (verbatim, Teams 13 Sep): "DT is OK, but we have to show a
   geographical map for Kuwait, these are 26 locations around Kuwait, each
   with two bay. We dont have all bays at one location." See
   docs/KUWAIT_NETWORK_MAP_BRIEF.md for the full research (station table,
   base-map licence/bounding-box, projection formula).
   ========================================================== */
(function () {
  "use strict";

  const SVG_URL = "assets/images/map/kuwait-base-map.svg?v=2"; // bump on every asset change -- fetch() is otherwise cached by the browser across reloads

  /* ---------- 26 station locations (see docs/KUWAIT_NETWORK_MAP_BRIEF.md §2) ---------- */
  // lat/lon -> % is a linear approximation (see project() below) -- fine for the interior of the
  // country, but the brief itself flags it as inexact "at demo scale", and along the coast that
  // slack is enough to land a pin in the Gulf outright, invisible when the whole country is
  // shown at once but obvious once zoomed in on that stretch of coastline (reported: dots
  // drifting into the water on/after zoom). Verified against the actual rendered SVG (sampling
  // its fill colour under each pin, then walking outward to the nearest point with a safe margin
  // from the coastline) rather than re-guessing the correction constants: every coastal station
  // below gets a small, fixed xPct/yPct override that pins it to that verified on-land spot --
  // "sticks to one point" regardless of pan/zoom/container size, no projection math involved.
  const NETWORK_STATIONS = [
    { id: 1, name: "Al Dhaher", governorate: "Ahmadi", lat: 29.055, lon: 48.105, flagship: true },
    { id: 2, name: "Fahaheel", governorate: "Ahmadi", lat: 29.083, lon: 48.128, xPct: 69.75, yPct: 61.77 },
    { id: 3, name: "Abu Halifa", governorate: "Ahmadi", lat: 29.114, lon: 48.117, xPct: 69.29, yPct: 60.28 },
    { id: 4, name: "Mina Abdullah", governorate: "Ahmadi", lat: 29.028, lon: 48.146, xPct: 70.12, yPct: 63.09 },
    { id: 5, name: "Shuaiba", governorate: "Ahmadi", lat: 29.027, lon: 48.178, xPct: 70.51, yPct: 65.57 },
    { id: 6, name: "Wafra", governorate: "Ahmadi", lat: 28.633, lon: 47.933 },
    { id: 7, name: "Fintas", governorate: "Ahmadi", lat: 29.164, lon: 48.128, xPct: 68.83, yPct: 57.39 },
    { id: 8, name: "Sabah Al-Ahmad City", governorate: "Ahmadi", lat: 28.972, lon: 48.086 },
    { id: 9, name: "Jahra", governorate: "Jahra", lat: 29.347, lon: 47.660 },
    { id: 10, name: "Sulaibiya", governorate: "Jahra", lat: 29.296, lon: 47.752 },
    { id: 11, name: "Amghara", governorate: "Jahra", lat: 29.323, lon: 47.807 },
    { id: 12, name: "Saad Al-Abdullah", governorate: "Jahra", lat: 29.417, lon: 47.683 },
    { id: 13, name: "Abdali", governorate: "Jahra", lat: 29.786, lon: 47.555 },
    { id: 14, name: "Taima", governorate: "Jahra", lat: 29.360, lon: 47.628 },
    { id: 15, name: "Naeem", governorate: "Jahra", lat: 29.336, lon: 47.678 },
    { id: 16, name: "Farwaniya", governorate: "Farwaniya", lat: 29.277, lon: 47.939 },
    { id: 17, name: "Jleeb Al-Shuyoukh", governorate: "Farwaniya", lat: 29.263, lon: 47.925 },
    { id: 18, name: "Khaitan", governorate: "Farwaniya", lat: 29.297, lon: 47.966 },
    { id: 19, name: "Ardiya", governorate: "Farwaniya", lat: 29.280, lon: 47.900 },
    { id: 20, name: "Sabah Al-Nasser", governorate: "Farwaniya", lat: 29.240, lon: 47.867 },
    { id: 21, name: "Andalous", governorate: "Farwaniya", lat: 29.291, lon: 47.953 },
    { id: 22, name: "Qurain", governorate: "Mubarak Al-Kabeer", lat: 29.267, lon: 48.080, xPct: 67.75, yPct: 52.91 },
    { id: 23, name: "Sabah Al-Salem", governorate: "Mubarak Al-Kabeer", lat: 29.243, lon: 48.098, xPct: 68.38, yPct: 55.02 },
    { id: 24, name: "Adan", governorate: "Mubarak Al-Kabeer", lat: 29.250, lon: 48.070 },
    { id: 25, name: "Shuwaikh", governorate: "Al Asimah (Capital)", lat: 29.343, lon: 47.933, xPct: 64.53, yPct: 49.04 },
    { id: 26, name: "Sulaibikhat", governorate: "Al Asimah (Capital)", lat: 29.343, lon: 47.905, xPct: 63.90, yPct: 49.48 },
  ];

  /* ---------- lat/lon -> % projection (see brief §1 for the bounding box + correction) ---------- */
  const BOUNDS = { north: 30.2, south: 28.4, west: 46.4, east: 48.8 };
  function project(lat, lon) {
    const xFrac = (lon - BOUNDS.west) / (BOUNDS.east - BOUNDS.west);
    const rawYFrac = (BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south);
    const yFrac = 0.5 + (rawYFrac - 0.5) / 1.15; // corrects for the base map's N/S stretch
    return { xPct: xFrac * 100, yPct: yFrac * 100 };
  }
  /** A station's on-map position: its own verified xPct/yPct override when it has one (see the
   *  comment above NETWORK_STATIONS), otherwise the lat/lon projection. */
  function stationPct(st) {
    return st.xPct != null ? { xPct: st.xPct, yPct: st.yPct } : project(st.lat, st.lon);
  }

  const STATUS_DOT_COLOR = {
    idle: "var(--text-faint)", filling: "var(--accent)", done: "var(--green)", fault: "var(--red)",
  };

  /* ---------- small deterministic RNG so each station's synthetic bays are stable across
     re-renders/re-mounts, but still distinct per station (no shared Math.random() drift) ---------- */
  function seededRng(seedStr) {
    let seed = 0;
    for (const ch of String(seedStr)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    return function next() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function weightedStatusFrom(rnd) {
    const r = rnd();
    if (r < 0.08) return "fault";
    if (r < 0.55) return "filling";
    if (r < 0.85) return "done";
    return "idle";
  }

  function seedStationBays(station) {
    const rnd = seededRng(`nm-${station.id}-${station.name}`);
    const bays = [];
    for (let i = 0; i < 2; i++) {
      const status = weightedStatusFrom(rnd);
      const target = 3000 + Math.floor(rnd() * 3) * 1000;
      const dispensed = status === "filling" ? Math.floor(target * (0.2 + rnd() * 0.6)) : status === "done" ? target : 0;
      bays.push({
        status, target, dispensed,
        owner: OWNERS[Math.floor(rnd() * OWNERS.length)],
        plate: randPlate(),
        lastActivity: Date.now() - Math.floor(rnd() * 90) * 60000,
      });
    }
    return bays;
  }

  /* ---------- module state ---------- */
  const nm = {
    bays: {},          // stationId -> [bay, bay] for the 25 non-flagship stations
    selectedId: null,
    mapLoaded: false,
    svgEl: null,       // the injected <svg> -- its viewBox IS the pan/zoom state (see below)
    view: { x: 0, y: 0, w: 1134.275, h: 979.207 }, // current viewBox window, in map user-units
    searchTerm: "",
  };

  function ensureSeeded() {
    if (Object.keys(nm.bays).length) return;
    NETWORK_STATIONS.forEach((st) => { if (!st.flagship) nm.bays[st.id] = seedStationBays(st); });
  }

  function aggregateStatus(bays) {
    if (!bays || !bays.length) return "idle";
    if (bays.some((b) => b.status === "fault")) return "fault";
    if (bays.some((b) => b.status === "filling")) return "filling";
    if (bays.every((b) => b.status === "done")) return "done";
    return "idle";
  }

  function bayArrayFor(station) {
    return station.flagship ? SIAP.state.bays : nm.bays[station.id];
  }

  /* ---------- light per-tick jitter: a couple of random non-flagship bays change status,
     so the map doesn't look like a static screenshot -- deliberately NOT a second sim engine ---------- */
  function jitterStations() {
    const ids = Object.keys(nm.bays);
    if (!ids.length) return;
    const hits = 1 + Math.floor(Math.random() * 2); // 1-2 bay changes per tick
    for (let i = 0; i < hits; i++) {
      const id = ids[Math.floor(Math.random() * ids.length)];
      const bays = nm.bays[id];
      const bay = bays[Math.floor(Math.random() * bays.length)];
      bay.status = weightedStatusFrom(Math.random);
      if (bay.status === "filling") bay.dispensed = Math.floor(bay.target * (0.1 + Math.random() * 0.6));
      else if (bay.status === "done") bay.dispensed = bay.target;
      else bay.dispensed = 0;
      bay.lastActivity = Date.now();
    }
  }

  /* ---------- base map: fetch once and inject inline. The SVG already ships pre-coloured for the
     dark theme (see docs/KUWAIT_NETWORK_MAP_BRIEF.md §1 update: swapped from the plain NordNordWest
     locator outline to TUBS' "administrative divisions" file, which shares the exact same
     coastline geometry/viewBox -- our lat/lon projection didn't need to change -- but additionally
     colours each of the 6 governorates distinctly instead of one flat land tone). No runtime
     recolouring needed any more; the file's own fills are already final. ---------- */
  function loadBaseMap(host) {
    fetch(SVG_URL)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((svgText) => {
        host.innerHTML = svgText;
        const svgEl = host.querySelector("svg");
        if (svgEl) {
          svgEl.removeAttribute("width");
          svgEl.removeAttribute("height");
          svgEl.setAttribute("preserveAspectRatio", "xMidYMid slice");
          svgEl.setAttribute("aria-hidden", "true");
          nm.svgEl = svgEl;
        }
        nm.mapLoaded = true;
        applyView(document.getElementById("view-network-map"));
      })
      .catch((e) => {
        console.warn("[network-map] failed to load base map svg", e);
        host.innerHTML = '<div class="util-text" style="padding:24px; text-align:center;">Kuwait base map unavailable.</div>';
      });
  }

  /* ---------- pins: plain HTML overlay, positioned each frame from the current view (see
     repositionPins) -- never inside the SVG's own transformed coordinate space, so a pin's on-
     screen SIZE never changes with zoom (no counter-scale hack needed), only its position. ---------- */
  function renderPins(section) {
    const pinsEl = section.querySelector("#nm-pins");
    if (!pinsEl) return;
    pinsEl.innerHTML = NETWORK_STATIONS.map((st) => {
      const label = st.flagship ? `${st.name}<span class="nm-pin-flag">FLAGSHIP</span>` : st.name;
      const aria = st.flagship
        ? `${st.name} — ${st.governorate} Governorate — flagship site, opens the full 3D digital twin`
        : `${st.name} — ${st.governorate} Governorate — 2 bays`;
      return `<button type="button" class="nm-pin${st.flagship ? " nm-pin-flagship" : ""}" data-station="${st.id}" aria-label="${aria}">
        <span class="nm-pin-dot"></span><span class="nm-pin-label">${label}</span>
      </button>`;
    }).join("");
    updatePinColors(section);
    repositionPins(section);
  }

  function updatePinColors(section) {
    NETWORK_STATIONS.forEach((st) => {
      const dot = section.querySelector(`.nm-pin[data-station="${st.id}"] .nm-pin-dot`);
      if (!dot) return;
      dot.style.background = STATUS_DOT_COLOR[aggregateStatus(bayArrayFor(st))] || STATUS_DOT_COLOR.idle;
    });
  }

  /** Places every pin at its on-screen % position for the CURRENT viewBox window. A pin whose
   *  station falls outside the visible window lands outside [0,100]% and is clipped by
   *  `.nm-map-wrap`'s `overflow:hidden` -- no separate visibility bookkeeping needed.
   *
   *  IMPORTANT: this must mirror the SVG's own `preserveAspectRatio="xMidYMid slice"` placement,
   *  not a naive per-axis %. The wrap's rendered aspect ratio does not always equal MAP_W:MAP_H
   *  (its CSS `aspect-ratio` gets overridden whenever `max-height` clamps it on a short viewport,
   *  and the mobile breakpoint sets a plain vh height) -- when that happens the browser scales the
   *  viewBox *uniformly* to cover the box and crops whichever axis has the mismatch, so a plain
   *  `(ux - v.x) / v.w * 100` for top/left drifts pins off their true spot on that axis (most
   *  visible as dots sliding out of bounds / into the sea when panning vertically, since height is
   *  the dimension usually being squeezed). Replicating the same uniform cover+centre transform
   *  here keeps pins glued to the map at any container size. */
  function repositionPins(section) {
    const pinsEl = section.querySelector("#nm-pins");
    const wrap = section.querySelector("#nm-map-wrap");
    if (!pinsEl || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const v = nm.view;
    const scale = Math.max(rect.width / v.w, rect.height / v.h);
    const renderedW = v.w * scale, renderedH = v.h * scale;
    const offX = (rect.width - renderedW) / 2, offY = (rect.height - renderedH) / 2;
    pinsEl.querySelectorAll(".nm-pin").forEach((pin) => {
      const st = NETWORK_STATIONS.find((s) => s.id === parseInt(pin.dataset.station, 10));
      if (!st) return;
      const { xPct, yPct } = stationPct(st);
      const ux = (xPct / 100) * MAP_W, uy = (yPct / 100) * MAP_H;
      const screenX = offX + (ux - v.x) * scale;
      const screenY = offY + (uy - v.y) * scale;
      pin.style.left = ((screenX / rect.width) * 100).toFixed(3) + "%";
      pin.style.top = ((screenY / rect.height) * 100).toFixed(3) + "%";
    });
  }

  /* ---------- pan/zoom, implemented by moving the SVG's own `viewBox` (NOT a CSS transform).
     Dense clusters (e.g. Al Dhaher/Farwaniya/Al Asimah, ~10 stations within a few % of each
     other) are unclickable at the full zoomed-out view -- individually invisible/overlapping hit
     targets read as "clicking does nothing", and CSS-transform-scaling a rasterized/composited
     SVG layer to fake that zoom is what caused the "pixel quality" complaint (Chromium caches a
     transformed layer's backing texture at its un-scaled size and stretches it on the GPU).
     Changing the viewBox instead asks the SVG to (re)draw a smaller region of its own coordinate
     space into the same fixed CSS pixel box, which is always vector-crisp at any zoom level, no
     matter how deep. Pins (HTML, not SVG) are repositioned to match on every change (above). The
     station LIST is still the reliable fallback for picking a station without fighting the map at
     all, which is the real fix for "how do they actually pick one" in a dense cluster. ---------- */
  const MAP_W = 1134.275, MAP_H = 979.207;
  const ZOOM_MAX_FACTOR = 8; // most zoomed-in: viewBox width = MAP_W / 8
  const MIN_VB_W = MAP_W / ZOOM_MAX_FACTOR;

  function clampView() {
    const v = nm.view;
    v.w = Math.min(MAP_W, Math.max(MIN_VB_W, v.w));
    v.h = v.w * (MAP_H / MAP_W);
    v.x = Math.min(MAP_W - v.w, Math.max(0, v.x));
    v.y = Math.min(MAP_H - v.h, Math.max(0, v.y));
  }

  function applyView(section) {
    if (!section) return;
    if (nm.svgEl) nm.svgEl.setAttribute("viewBox", `${nm.view.x} ${nm.view.y} ${nm.view.w} ${nm.view.h}`);
    const wrap = section.querySelector("#nm-map-wrap");
    if (wrap) wrap.classList.toggle("nm-zoomed", nm.view.w < MAP_W - 0.01);
    repositionPins(section);
  }

  /** Converts a client (viewport) point to a point in the SVG's user-space coordinates, given the
   *  current viewBox window and the wrap element's on-screen rect. */
  function toMapPoint(wrap, clientX, clientY) {
    const rect = wrap.getBoundingClientRect();
    const v = nm.view;
    return {
      x: v.x + ((clientX - rect.left) / rect.width) * v.w,
      y: v.y + ((clientY - rect.top) / rect.height) * v.h,
      rect,
    };
  }

  /** Zooms so that the map point under (clientX, clientY) stays under the cursor -- the standard
   *  "zoom to cursor" trick, done in SVG user-space instead of screen pixels. */
  function zoomAt(section, wrap, clientX, clientY, factor) {
    const pt = toMapPoint(wrap, clientX, clientY);
    const v = nm.view;
    const fx = (pt.x - v.x) / v.w, fy = (pt.y - v.y) / v.h;
    v.w = v.w / factor;
    v.h = v.w * (MAP_H / MAP_W);
    clampView();
    v.x = pt.x - fx * v.w;
    v.y = pt.y - fy * v.h;
    clampView();
    applyView(section);
  }
  function resetView(section) {
    nm.view = { x: 0, y: 0, w: MAP_W, h: MAP_H };
    applyView(section);
  }
  /** Pans+zooms so a given station's pin lands at the centre of the viewport at a comfortable
   *  zoom level -- used by both "focus" on a dense pin and by picking a station from the list. */
  function focusStation(section, st, targetW = MAP_W / 3) {
    const { xPct, yPct } = stationPct(st);
    const ux = (xPct / 100) * MAP_W, uy = (yPct / 100) * MAP_H;
    const v = nm.view;
    v.w = Math.min(v.w, targetW);
    v.h = v.w * (MAP_H / MAP_W);
    v.x = ux - v.w / 2;
    v.y = uy - v.h / 2;
    clampView();
    applyView(section);
  }

  function wireMapInteraction(section) {
    const wrap = section.querySelector("#nm-map-wrap");
    if (!wrap) return;

    wrap.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = Math.pow(1.0015, -e.deltaY);
      zoomAt(section, wrap, e.clientX, e.clientY, factor);
    }, { passive: false });

    let dragging = false, lastX = 0, lastY = 0, moved = false;
    wrap.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY;
      wrap.classList.add("nm-dragging");
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const rect = wrap.getBoundingClientRect();
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      lastX = e.clientX; lastY = e.clientY;
      const v = nm.view;
      v.x -= dx * (v.w / rect.width);
      v.y -= dy * (v.h / rect.height);
      clampView();
      applyView(section);
    });
    window.addEventListener("mouseup", () => { dragging = false; wrap.classList.remove("nm-dragging"); });
    // A drag that actually moved the map shouldn't also register as a pin click on mouseup.
    wrap.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); moved = false; } }, true);

    // Single-finger touch pan (pinch-zoom omitted -- this is a control-room desktop view; the
    // zoom buttons + station list cover touch devices).
    let touchId = null;
    wrap.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      touchId = e.touches[0].identifier;
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    }, { passive: true });
    wrap.addEventListener("touchmove", (e) => {
      const t = Array.from(e.touches).find((t) => t.identifier === touchId);
      if (!t) return;
      const rect = wrap.getBoundingClientRect();
      const dx = t.clientX - lastX, dy = t.clientY - lastY;
      lastX = t.clientX; lastY = t.clientY;
      const v = nm.view;
      v.x -= dx * (v.w / rect.width);
      v.y -= dy * (v.h / rect.height);
      clampView();
      applyView(section);
    }, { passive: true });

    section.querySelector("#nm-zoom-in").addEventListener("click", () => {
      const rect = wrap.getBoundingClientRect();
      zoomAt(section, wrap, rect.left + rect.width / 2, rect.top + rect.height / 2, 1.6);
    });
    section.querySelector("#nm-zoom-out").addEventListener("click", () => {
      const rect = wrap.getBoundingClientRect();
      zoomAt(section, wrap, rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.6);
    });
    section.querySelector("#nm-zoom-reset").addEventListener("click", () => resetView(section));

    const ro = new ResizeObserver(() => repositionPins(section));
    ro.observe(wrap);
  }

  /* ---------- station picker list: the reliable way to reach any of the 26 stations regardless
     of how tightly its pin overlaps its neighbours on the map ---------- */
  function stationStatusLabel(st) {
    return SIAP.statusLabel(aggregateStatus(bayArrayFor(st)));
  }
  function renderStationList(section) {
    const listEl = section.querySelector("#nm-station-list");
    if (!listEl) return;
    const term = nm.searchTerm.trim().toLowerCase();
    const rows = NETWORK_STATIONS
      .filter((st) => !term || st.name.toLowerCase().includes(term) || st.governorate.toLowerCase().includes(term))
      .map((st) => {
        const status = aggregateStatus(bayArrayFor(st));
        const bays = st.flagship ? 42 : 2;
        return `<button type="button" class="nm-list-row${st.id === nm.selectedId ? " nm-list-row-active" : ""}" data-station="${st.id}">
          <span class="nm-list-dot" style="background:${STATUS_DOT_COLOR[status] || STATUS_DOT_COLOR.idle}"></span>
          <span class="nm-list-text">
            <span class="nm-list-name">${st.name}${st.flagship ? '<span class="nm-pin-flag">FLAGSHIP</span>' : ""}</span>
            <span class="nm-list-sub">${st.governorate} &middot; ${bays} bays</span>
          </span>
          <i data-lucide="chevron-right" class="chev"></i>
        </button>`;
      }).join("") || `<div class="util-text" style="padding:10px 2px;">No stations match "${nm.searchTerm}".</div>`;
    listEl.innerHTML = rows;
    if (window.lucide) lucide.createIcons();
  }

  /* ---------- station detail panel ---------- */
  function renderDetail(section) {
    const body = section.querySelector("#nm-detail-body");
    const panel = section.querySelector("#nm-detail-panel");
    const listWrap = section.querySelector("#nm-list-panel");
    if (!body) return;
    if (nm.selectedId == null) {
      if (panel) panel.hidden = true;
      if (listWrap) listWrap.hidden = false;
      return;
    }
    const st = NETWORK_STATIONS.find((s) => s.id === nm.selectedId);
    const bays = st ? nm.bays[st.id] : null;
    if (!st || !bays) { nm.selectedId = null; renderDetail(section); return; }

    const todayIG = bays.reduce((sum, b) => sum + (b.status === "done" ? b.target : b.dispensed), 0);
    const online = bays.every((b) => b.status !== "offline");
    const tiles = bays.map((b, i) => `
      <div class="bay-tile ${b.status}">
        <div class="bay-id">BAY ${i + 1}</div>
        <div class="bay-status"><span class="bay-dot"></span>${SIAP.statusLabel(b.status)}</div>
      </div>`).join("");
    const rows = bays.map((b, i) => `
      <div class="metric-line"><span class="k">Bay ${i + 1} &middot; owner</span><span class="v">${b.owner}</span></div>
      <div class="metric-line"><span class="k">Bay ${i + 1} &middot; plate</span><span class="v mono">${b.plate}</span></div>
      <div class="metric-line"><span class="k">Bay ${i + 1} &middot; volume</span><span class="v">${Math.round(b.dispensed).toLocaleString()} / ${Math.round(b.target).toLocaleString()} IG</span></div>
      <div class="metric-line"><span class="k">Bay ${i + 1} &middot; last activity</span><span class="v">${SIAP.timeAgo(b.lastActivity)}</span></div>`).join("");

    body.innerHTML = `
      <div class="nm-detail-name">${st.name}${st.flagship ? '<span class="nm-pin-flag">FLAGSHIP</span>' : ""}</div>
      <div class="nm-detail-sub">${st.governorate} Governorate &middot; ${bays.length} bays</div>
      <div class="metric-line"><span class="k">Connectivity</span><span class="v" style="color:${online ? "var(--green)" : "var(--red)"}">${online ? "Online" : "Offline"}</span></div>
      <div class="metric-line"><span class="k">Dispensed today</span><span class="v">${Math.round(todayIG).toLocaleString()} Imp.gal</span></div>
      <div class="bay-grid nm-detail-bays">${tiles}</div>
      ${rows}
      <div class="util-text" style="margin-top:10px;">Full 3D twin available for the flagship site (Al Dhaher).</div>
    `;
    if (panel) panel.hidden = false;
    if (listWrap) listWrap.hidden = true;
  }

  function selectStation(section, id) {
    section.querySelectorAll(".nm-pin.nm-pin-active").forEach((p) => p.classList.remove("nm-pin-active"));
    const pinEl = section.querySelector(`.nm-pin[data-station="${id}"]`);
    if (pinEl) pinEl.classList.add("nm-pin-active");
    nm.selectedId = id;
    renderDetail(section);
    renderStationList(section);
  }

  function onStationActivate(section, id) {
    const st = NETWORK_STATIONS.find((s) => s.id === id);
    if (!st) return;
    if (st.flagship) { SIAP.showView("twin3d"); return; }
    selectStation(section, id);
    focusStation(section, st);
  }

  /* ---------- view HTML ---------- */
  const HTML = `
    <div class="grid-2" style="align-items:start;">
      <div class="card">
        <div class="card-title"><span data-i18n>Kuwait Network Map</span> <span class="hint" data-i18n>26 stations &middot; flagship 3D twin at Al Dhaher</span></div>
        <div class="nm-map-wrap" id="nm-map-wrap">
          <div class="nm-canvas" id="nm-canvas">
            <div class="nm-svg-host" id="nm-svg-host"></div>
            <div class="nm-pins" id="nm-pins"></div>
          </div>
          <div class="legend nm-legend">
            <span><span class="bay-dot" style="background:var(--text-faint)"></span> <span data-i18n>Idle</span></span>
            <span><span class="bay-dot" style="background:var(--accent)"></span> <span data-i18n>Filling</span></span>
            <span><span class="bay-dot" style="background:var(--green)"></span> <span data-i18n>Done</span></span>
            <span><span class="bay-dot" style="background:var(--red)"></span> <span data-i18n>Fault</span></span>
          </div>
          <div class="nm-zoom-ctrl" id="nm-zoom-ctrl" title="Zoom the map">
            <button id="nm-zoom-in" title="Zoom in" aria-label="Zoom in"><i data-lucide="plus"></i></button>
            <button id="nm-zoom-reset" title="Reset view" aria-label="Reset view"><i data-lucide="maximize"></i></button>
            <button id="nm-zoom-out" title="Zoom out" aria-label="Zoom out"><i data-lucide="minus"></i></button>
          </div>
          <div class="nm-map-hint" data-i18n>Scroll or drag to pan/zoom &middot; click a pin, or use the list &rarr;</div>
        </div>
        <div class="nm-attribution" data-i18n>Base map: TUBS, CC BY-SA 3.0, via Wikimedia Commons (governorate boundaries derived from NordNordWest's coastline data)</div>
      </div>

      <div class="stack">
        <div class="card" id="nm-list-panel">
          <div class="card-title"><span data-i18n>All Stations</span> <span class="hint" data-i18n>click any row to open it</span></div>
          <div class="nm-search">
            <i data-lucide="search"></i>
            <input type="text" id="nm-search-input" placeholder="Search by name or governorate&hellip;" data-i18n-placeholder />
          </div>
          <div id="nm-station-list" class="nm-station-list"></div>
        </div>
        <div class="card" id="nm-detail-panel" hidden>
          <div class="card-title">
            <button class="btn btn-sm" id="nm-detail-back" title="Back to station list" aria-label="Back to station list"><i data-lucide="chevron-left"></i> <span data-i18n>All Stations</span></button>
            <button class="btn btn-sm" id="nm-detail-close" title="Close" aria-label="Close station detail"><i data-lucide="x"></i></button>
          </div>
          <div id="nm-detail-body"></div>
        </div>
        <div class="card">
          <div class="card-title" data-i18n>Network Summary</div>
          <div class="metric-line"><span class="k" data-i18n>Stations</span><span class="v">26</span></div>
          <div class="metric-line"><span class="k" data-i18n>Bays per station (network-wide)</span><span class="v">2</span></div>
          <div class="metric-line"><span class="k" data-i18n>Flagship site</span><span class="v" data-i18n>Al Dhaher &middot; 42 bays &middot; full 3D twin</span></div>
          <div class="util-text" style="margin-top:10px;" data-i18n>Al Dhaher is a confirmed MEW/CAPT lorry-filling-station project (Ahmadi Governorate); the other 25 locations illustrate the country-wide network coverage.</div>
        </div>
      </div>
    </div>
  `;

  SIAP.registerView({
    id: "network-map",
    group: "operations",
    icon: "map",
    title: "Kuwait Network Map",
    navLabel: "Network Map",
    sub: "26 stations · 52 bays across Kuwait",
    html: HTML,

    onMount(section) {
      // twin3d.js is a `type="module"` script, which browsers defer and execute *before*
      // DOMContentLoaded but strictly after every ordinary blocking <script> tag that precedes it
      // in the document -- including this one. SIAP.registerView()'s own nav-item mount is itself
      // deferred to DOMContentLoaded whenever the document is still parsing at call time (true for
      // every plain classic script here), so twin3d's nav item actually lands in the sidebar
      // *before* this one, even though this file's <script> tag sits earlier in index.html. Move
      // this nav item back in front of "3D Digital Twin" so the Operations group reads Dashboard
      // -> Bay Control -> CCTV -> Network Map -> 3D Digital Twin, as intended.
      const navItem = document.querySelector('.nav-item[data-view="network-map"]');
      const twinItem = document.querySelector('.nav-item[data-view="twin3d"]');
      if (navItem && twinItem && twinItem.parentNode) twinItem.parentNode.insertBefore(navItem, twinItem);

      ensureSeeded();
      loadBaseMap(section.querySelector("#nm-svg-host"));
      renderPins(section);
      renderStationList(section);
      renderDetail(section);
      applyView(section);
      wireMapInteraction(section);

      const pinsEl = section.querySelector("#nm-pins");
      pinsEl.addEventListener("click", (e) => {
        const pin = e.target.closest(".nm-pin");
        if (pin) onStationActivate(section, parseInt(pin.dataset.station, 10));
      });
      // Double-click a pin to zoom straight into it -- handy inside a dense cluster.
      pinsEl.addEventListener("dblclick", (e) => {
        const pin = e.target.closest(".nm-pin");
        if (!pin) return;
        const st = NETWORK_STATIONS.find((s) => s.id === parseInt(pin.dataset.station, 10));
        if (st) focusStation(section, st, Math.max(nm.view.scale * 1.8, 3));
      });

      const closeDetail = () => {
        section.querySelectorAll(".nm-pin.nm-pin-active").forEach((p) => p.classList.remove("nm-pin-active"));
        nm.selectedId = null;
        renderDetail(section);
        renderStationList(section);
      };
      section.querySelector("#nm-detail-close").addEventListener("click", closeDetail);
      section.querySelector("#nm-detail-back").addEventListener("click", closeDetail);

      const listEl = section.querySelector("#nm-station-list");
      listEl.addEventListener("click", (e) => {
        const row = e.target.closest(".nm-list-row");
        if (row) onStationActivate(section, parseInt(row.dataset.station, 10));
      });

      const searchInput = section.querySelector("#nm-search-input");
      searchInput.addEventListener("input", () => {
        nm.searchTerm = searchInput.value;
        renderStationList(section);
      });
    },

    onShow() {
      if (window.lucide) lucide.createIcons();
    },

    onTick() {
      jitterStations();
      const section = document.getElementById("view-network-map");
      if (!section) return;
      updatePinColors(section);
      if (nm.selectedId != null) renderDetail(section);
      else renderStationList(section); // keep list status dots live while it's the visible panel
    },
  });
})();
