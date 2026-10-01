import '../../styles/network-map.css';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ViewProps } from '../../shell/types';
import { useSiap } from '../../sim/store';
import { showView } from '../../shell/ui';
import { Icon } from '../../lib/Icon';
import { useT, statusLabel, timeAgo } from '../../i18n';
import { NETWORK_STATIONS, MAP_W, MAP_H, stationPct, type Station } from './stations';
import { useNm, aggregateStatus, FULL_VIEW, MIN_VB_W } from './store';

const SVG_URL = `${import.meta.env.BASE_URL}assets/images/map/kuwait-base-map.svg?v=2`; // bump on every asset change

const STATUS_DOT_COLOR: Record<string, string> = {
  idle: 'var(--text-faint)', filling: 'var(--accent)', done: 'var(--green)', fault: 'var(--red)',
};
const dotColor = (s: string) => STATUS_DOT_COLOR[s] || STATUS_DOT_COLOR.idle;

const Flag = () => <span className="nm-pin-flag">FLAGSHIP</span>;

export default function View({ active }: ViewProps) {
  const { t } = useT();
  const siapBays = useSiap((s) => s.bays);
  const tickCount = useSiap((s) => s.tickCount);

  const nmBays = useNm((s) => s.bays);
  const selectedId = useNm((s) => s.selectedId);
  const searchTerm = useNm((s) => s.searchTerm);
  const view = useNm((s) => s.view);
  const { select, setSearch, setView, zoomAt, focusStation, jitter } = useNm.getState();

  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);

  const baysFor = (st: Station) => (st.flagship ? siapBays : nmBays[st.id]);

  /* ---------- base map: fetch once and inject inline ---------- */
  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    fetch(SVG_URL)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((svgText) => {
        if (cancelled || !host) return;
        host.innerHTML = svgText;
        const svgEl = host.querySelector('svg');
        if (svgEl) {
          svgEl.removeAttribute('width');
          svgEl.removeAttribute('height');
          svgEl.setAttribute('preserveAspectRatio', 'xMidYMid slice');
          svgEl.setAttribute('aria-hidden', 'true');
          svgRef.current = svgEl;
        }
        setMapLoaded(true);
      })
      .catch((e) => {
        console.warn('[network-map] failed to load base map svg', e);
        if (!cancelled && host) host.innerHTML = '<div class="util-text" style="padding:24px; text-align:center;">Kuwait base map unavailable.</div>';
      });
    return () => { cancelled = true; };
  }, []);

  /* viewBox IS the pan/zoom state (vector-crisp at any depth) */
  useLayoutEffect(() => {
    if (svgRef.current) svgRef.current.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  }, [view, mapLoaded]);

  /* ---------- keep pin positions in sync with the wrap's rendered size ---------- */
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => { const r = wrap.getBoundingClientRect(); setSize((p) => (p.w === r.width && p.h === r.height ? p : { w: r.width, h: r.height })); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  /** Mirrors the SVG's own preserveAspectRatio="xMidYMid slice" placement (uniform cover + centre) so pins stay
   *  glued to the map at any container size. A pin outside the window lands outside [0,100]% and is clipped. */
  const pinPos = (st: Station) => {
    if (!size.w || !size.h) return {};
    const scale = Math.max(size.w / view.w, size.h / view.h);
    const offX = (size.w - view.w * scale) / 2, offY = (size.h - view.h * scale) / 2;
    const { xPct, yPct } = stationPct(st);
    const ux = (xPct / 100) * MAP_W, uy = (yPct / 100) * MAP_H;
    return {
      left: (((offX + (ux - view.x) * scale) / size.w) * 100).toFixed(3) + '%',
      top: (((offY + (uy - view.y) * scale) / size.h) * 100).toFixed(3) + '%',
    };
  };

  /* ---------- per-tick jitter (only while the view is on screen) ---------- */
  const lastTick = useRef(tickCount);
  useEffect(() => {
    if (!active) { lastTick.current = tickCount; return; }
    if (lastTick.current === tickCount) return;
    lastTick.current = tickCount;
    jitter();
  }, [active, tickCount, jitter]);

  /* ---------- pan / zoom interaction ---------- */
  const moved = useRef(false);

  const toMapPoint = (clientX: number, clientY: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const v = useNm.getState().view;
    return { x: v.x + ((clientX - rect.left) / rect.width) * v.w, y: v.y + ((clientY - rect.top) / rect.height) * v.h };
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = toMapPoint(e.clientX, e.clientY);
      zoomAt(pt.x, pt.y, Math.pow(1.0015, -e.deltaY));
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const panBy = (dx: number, dy: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const v = useNm.getState().view;
    setView({ ...v, x: v.x - dx * (v.w / rect.width), y: v.y - dy * (v.h / rect.height) });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    moved.current = false;
    let lastX = e.clientX, lastY = e.clientY;
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - lastX, dy = ev.clientY - lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved.current = true;
      lastX = ev.clientX; lastY = ev.clientY;
      panBy(dx, dy);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  // A drag that actually moved the map shouldn't also register as a pin click on mouseup.
  const onClickCapture = (e: React.MouseEvent) => { if (moved.current) { e.stopPropagation(); moved.current = false; } };

  // Single-finger touch pan (pinch-zoom omitted — the zoom buttons + station list cover touch devices).
  const touch = useRef<{ id: number; x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t0 = e.touches[0];
    touch.current = { id: t0.identifier, x: t0.clientX, y: t0.clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const tc = touch.current;
    if (!tc) return;
    const t0 = Array.from(e.touches).find((x) => x.identifier === tc.id);
    if (!t0) return;
    const dx = t0.clientX - tc.x, dy = t0.clientY - tc.y;
    tc.x = t0.clientX; tc.y = t0.clientY;
    panBy(dx, dy);
  };

  const zoomCentre = (factor: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const pt = toMapPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    zoomAt(pt.x, pt.y, factor);
  };

  /* ---------- selection ---------- */
  const onStationActivate = (st: Station) => {
    if (st.flagship) { showView('twin3d'); return; }
    select(st.id);
    focusStation(st);
  };
  // Double-click a pin to zoom straight into it. (Legacy referenced an undefined `nm.view.scale` here and
  // collapsed the view to NaN; intended behaviour is "zoom ~1.8x further", which is what this does.)
  const onStationDblClick = (st: Station) => {
    const v = useNm.getState().view;
    focusStation(st, Math.max(MIN_VB_W, v.w / 1.8));
  };

  const term = searchTerm.trim().toLowerCase();
  const filtered = NETWORK_STATIONS.filter((st) => !term || st.name.toLowerCase().includes(term) || st.governorate.toLowerCase().includes(term));

  const selSt = selectedId != null ? NETWORK_STATIONS.find((s) => s.id === selectedId) : undefined;
  const selBays = selSt ? nmBays[selSt.id] : undefined;
  const detailOpen = !!(selSt && selBays);

  const zoomed = view.w < MAP_W - 0.01;

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <div className="card-title"><span>{t('Kuwait Network Map')}</span> <span className="hint">{t('26 stations · flagship 3D twin at Al Dhaher')}</span></div>
        <div
          className={'nm-map-wrap' + (zoomed ? ' nm-zoomed' : '') + (dragging ? ' nm-dragging' : '')}
          id="nm-map-wrap" ref={wrapRef}
          onMouseDown={onMouseDown} onClickCapture={onClickCapture} onTouchStart={onTouchStart} onTouchMove={onTouchMove}
        >
          <div className="nm-canvas" id="nm-canvas">
            <div className="nm-svg-host" id="nm-svg-host" ref={hostRef}></div>
            <div className="nm-pins" id="nm-pins">
              {NETWORK_STATIONS.map((st) => {
                const aria = st.flagship
                  ? `${st.name} — ${st.governorate} Governorate — flagship site, opens the full 3D digital twin`
                  : `${st.name} — ${st.governorate} Governorate — 2 bays`;
                return (
                  <button
                    type="button" key={st.id} data-station={st.id} aria-label={aria}
                    className={'nm-pin' + (st.flagship ? ' nm-pin-flagship' : '') + (selectedId === st.id ? ' nm-pin-active' : '')}
                    style={pinPos(st)}
                    onClick={() => onStationActivate(st)} onDoubleClick={() => onStationDblClick(st)}
                  >
                    <span className="nm-pin-dot" style={{ background: dotColor(aggregateStatus(baysFor(st))) }}></span>
                    <span className="nm-pin-label">{st.name}{st.flagship && <Flag />}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="legend nm-legend">
            <span><span className="bay-dot" style={{ background: 'var(--text-faint)' }}></span> <span>{t('Idle')}</span></span>
            <span><span className="bay-dot" style={{ background: 'var(--accent)' }}></span> <span>{t('Filling')}</span></span>
            <span><span className="bay-dot" style={{ background: 'var(--green)' }}></span> <span>{t('Done')}</span></span>
            <span><span className="bay-dot" style={{ background: 'var(--red)' }}></span> <span>{t('Fault')}</span></span>
          </div>
          <div className="nm-zoom-ctrl" id="nm-zoom-ctrl" title={t('Zoom the map')}>
            <button id="nm-zoom-in" title={t('Zoom in')} aria-label={t('Zoom in')} onClick={() => zoomCentre(1.6)}><Icon name="plus" /></button>
            <button id="nm-zoom-reset" title={t('Reset view')} aria-label={t('Reset view')} onClick={() => setView({ ...FULL_VIEW })}><Icon name="maximize" /></button>
            <button id="nm-zoom-out" title={t('Zoom out')} aria-label={t('Zoom out')} onClick={() => zoomCentre(1 / 1.6)}><Icon name="minus" /></button>
          </div>
          <div className="nm-map-hint">{t('Scroll or drag to pan/zoom · click a pin, or use the list →')}</div>
        </div>
        <div className="nm-attribution">{t("Base map: TUBS, CC BY-SA 3.0, via Wikimedia Commons (governorate boundaries derived from NordNordWest's coastline data)")}</div>
      </div>

      <div className="stack">
        <div className="card" id="nm-list-panel" hidden={detailOpen}>
          <div className="card-title"><span>{t('All Stations')}</span> <span className="hint">{t('click any row to open it')}</span></div>
          <div className="nm-search">
            <Icon name="search" />
            <input type="text" id="nm-search-input" placeholder={t('Search by name or governorate…')} value={searchTerm} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div id="nm-station-list" className="nm-station-list">
            {filtered.length === 0 && <div className="util-text" style={{ padding: '10px 2px' }}>{t('No stations match')} "{searchTerm}".</div>}
            {filtered.map((st) => {
              const status = aggregateStatus(baysFor(st));
              const n = st.flagship ? 42 : 2;
              return (
                <button type="button" key={st.id} data-station={st.id} className={'nm-list-row' + (st.id === selectedId ? ' nm-list-row-active' : '')} onClick={() => onStationActivate(st)}>
                  <span className="nm-list-dot" style={{ background: dotColor(status) }}></span>
                  <span className="nm-list-text">
                    <span className="nm-list-name">{st.name}{st.flagship && <Flag />}</span>
                    <span className="nm-list-sub">{st.governorate} · {n} bays</span>
                  </span>
                  <Icon name="chevron-right" className="chev" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="card" id="nm-detail-panel" hidden={!detailOpen}>
          <div className="card-title">
            <button className="btn btn-sm" id="nm-detail-back" title={t('Back to station list')} aria-label={t('Back to station list')} onClick={() => select(null)}><Icon name="chevron-left" /> <span>{t('All Stations')}</span></button>
            <button className="btn btn-sm" id="nm-detail-close" title={t('Close')} aria-label={t('Close station detail')} onClick={() => select(null)}><Icon name="x" /></button>
          </div>
          <div id="nm-detail-body">
            {detailOpen && selSt && selBays && <Detail st={selSt} bays={selBays} t={t} />}
          </div>
        </div>

        <div className="card">
          <div className="card-title">{t('Network Summary')}</div>
          <div className="metric-line"><span className="k">{t('Stations')}</span><span className="v">26</span></div>
          <div className="metric-line"><span className="k">{t('Bays per station (network-wide)')}</span><span className="v">2</span></div>
          <div className="metric-line"><span className="k">{t('Flagship site')}</span><span className="v">{t('Al Dhaher · 42 bays · full 3D twin')}</span></div>
          <div className="util-text" style={{ marginTop: 10 }}>{t('Al Dhaher is a confirmed MEW/CAPT lorry-filling-station project (Ahmadi Governorate); the other 25 locations illustrate the country-wide network coverage.')}</div>
        </div>
      </div>
    </div>
  );
}

function Detail({ st, bays, t }: { st: Station; bays: ReturnType<typeof useNm.getState>['bays'][number]; t: (s: string) => string }) {
  const todayIG = bays.reduce((sum, b) => sum + (b.status === 'done' ? b.target : b.dispensed), 0);
  const online = bays.every((b) => b.status !== 'offline');
  return (
    <>
      <div className="nm-detail-name">{st.name}{st.flagship && <Flag />}</div>
      <div className="nm-detail-sub">{st.governorate} Governorate · {bays.length} bays</div>
      <div className="metric-line"><span className="k">{t('Connectivity')}</span><span className="v" style={{ color: online ? 'var(--green)' : 'var(--red)' }}>{online ? t('Online') : t('Offline')}</span></div>
      <div className="metric-line"><span className="k">{t('Dispensed today')}</span><span className="v">{Math.round(todayIG).toLocaleString()} Imp.gal</span></div>
      <div className="bay-grid nm-detail-bays">
        {bays.map((b, i) => (
          <div className={'bay-tile ' + b.status} key={i}>
            <div className="bay-id">BAY {i + 1}</div>
            <div className="bay-status"><span className="bay-dot"></span>{statusLabel(b.status)}</div>
          </div>
        ))}
      </div>
      {bays.map((b, i) => (
        <Fragment key={i}>
          <div className="metric-line"><span className="k">Bay {i + 1} · owner</span><span className="v">{b.owner}</span></div>
          <div className="metric-line"><span className="k">Bay {i + 1} · plate</span><span className="v mono">{b.plate}</span></div>
          <div className="metric-line"><span className="k">Bay {i + 1} · volume</span><span className="v">{Math.round(b.dispensed).toLocaleString()} / {Math.round(b.target).toLocaleString()} IG</span></div>
          <div className="metric-line"><span className="k">Bay {i + 1} · last activity</span><span className="v">{timeAgo(b.lastActivity)}</span></div>
        </Fragment>
      ))}
      <div className="util-text" style={{ marginTop: 10 }}>{t('Full 3D twin available for the flagship site (Al Dhaher).')}</div>
    </>
  );
}
