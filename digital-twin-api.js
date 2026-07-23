/**
 * AMO Conference Campus — Digital Twin Embed API
 * ================================================
 * Your dashboard can embed the twin in two ways:
 *
 *  1. iframe (recommended — zero dependency on Three.js in your dashboard)
 *     <iframe id="dt-frame" src="http://localhost:8000/embed.html"></iframe>
 *     Then use window.postMessage to communicate (see INTEGRATION GUIDE below).
 *
 *  2. Same-page script (if hosted on same origin and you import Three.js yourself)
 *
 * ─────────────────────────────────────────────────────────────────
 * INTEGRATION GUIDE — iframe + postMessage
 * ─────────────────────────────────────────────────────────────────
 *
 * In your dashboard HTML:
 *
 *   <iframe id="dt-frame"
 *     src="http://localhost:8000/embed.html"
 *     style="width:100%;height:600px;border:none">
 *   </iframe>
 *
 *   <script>
 *     const frame = document.getElementById('dt-frame');
 *
 *     // 1. Receive events FROM the twin
 *     window.addEventListener('message', (e) => {
 *       if (e.data?.type === 'DT_READY') {
 *         console.log('Twin loaded!', e.data.zones);
 *       }
 *       if (e.data?.type === 'DT_ZONE_CLICK') {
 *         console.log('Zone clicked:', e.data.zone);
 *         // e.data.zone = { id, name, telemetry, alertLevel }
 *       }
 *       if (e.data?.type === 'DT_ZONES_LIST') {
 *         console.log('All zones:', e.data.zones);
 *       }
 *     });
 *
 *     // 2. Send commands TO the twin
 *
 *     // Focus camera on a zone
 *     frame.contentWindow.postMessage({ type: 'DT_FOCUS_ZONE', zoneId: 'zone-conf-centre' }, '*');
 *
 *     // Push live telemetry data into the twin
 *     frame.contentWindow.postMessage({
 *       type: 'DT_SET_TELEMETRY',
 *       zoneId: 'zone-conf-centre',
 *       data: { occupancy: '620 / 800', temp: '23.1C', power: '215 kW', aqi: '11 (Good)' }
 *     }, '*');
 *
 *     // Set a visual alert on a zone (highlights it in warning/danger color)
 *     frame.contentWindow.postMessage({
 *       type: 'DT_SET_ALERT',
 *       zoneId: 'zone-food-court',
 *       level: 'warning'    // 'normal' | 'warning' | 'danger'
 *     }, '*');
 *
 *     // Ask the twin for the full zones list
 *     frame.contentWindow.postMessage({ type: 'DT_GET_ZONES' }, '*');
 *
 *     // Reset the camera
 *     frame.contentWindow.postMessage({ type: 'DT_RESET_VIEW' }, '*');
 *   </script>
 *
 * ─────────────────────────────────────────────────────────────────
 * OUTBOUND EVENTS  (twin → your dashboard)
 * ─────────────────────────────────────────────────────────────────
 *  DT_READY         — twin finished loading all GLB models
 *                     payload: { zones: ZoneInfo[] }
 *  DT_ZONE_CLICK    — user clicked a zone
 *                     payload: { zone: ZoneInfo }
 *  DT_ZONE_HOVER    — user hovered a zone
 *                     payload: { zone: ZoneInfo }
 *  DT_ZONES_LIST    — response to DT_GET_ZONES
 *                     payload: { zones: ZoneInfo[] }
 *
 * ZoneInfo shape:
 *   { id, name, type, telemetry: { occupancy, temp, power, aqi }, alertLevel }
 *
 * ─────────────────────────────────────────────────────────────────
 * INBOUND COMMANDS  (your dashboard → twin)
 * ─────────────────────────────────────────────────────────────────
 *  DT_FOCUS_ZONE    — { zoneId }
 *  DT_SET_TELEMETRY — { zoneId, data: { occupancy, temp, power, aqi } }
 *  DT_SET_ALERT     — { zoneId, level: 'normal'|'warning'|'danger' }
 *  DT_GET_ZONES     — (no payload) — twin replies with DT_ZONES_LIST
 *  DT_RESET_VIEW    — (no payload) — resets camera
 */

// ─────────────────────────────────────────────────────────────────
// Zone IDs — use these strings in your dashboard postMessage calls
// ─────────────────────────────────────────────────────────────────
export const ZONE_IDS = {
  CONFERENCE_CENTRE:  'zone-conf-centre',
  EXHIBITION_HALL:    'zone-exhib-hall',
  MAIN_PLAZA:         'zone-main-plaza',
  EMERGENCY_ASSEMBLY: 'zone-emerg-assembly',
  REGISTRATION_AREA:  'zone-reg-area',
  INFORMATION_DESK:   'zone-info-desk',
  FOOD_COURT:         'zone-food-court',
  MEDICAL_CENTRE:     'zone-med-centre',
  PARKING_AREA:       'zone-parking-area',
};

// ─────────────────────────────────────────────────────────────────
// Telemetry Schema — shape of the data object to push
// ─────────────────────────────────────────────────────────────────
export const TELEMETRY_SCHEMA = {
  occupancy: 'string  e.g. "420 / 800"',
  temp:      'string  e.g. "22.4°C"',
  power:     'string  e.g. "142 kW"',
  aqi:       'string  e.g. "18 (Good)"',
};

// ─────────────────────────────────────────────────────────────────
// postMessage bridge — auto-installed inside embed.html / index.html
// Call installPostMessageBridge(appState) once after scene loads.
// ─────────────────────────────────────────────────────────────────
export function installPostMessageBridge(appState) {
  if (typeof window === 'undefined') return;

  // Listen for commands from the parent dashboard
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('DT_')) return;

    switch (msg.type) {

      case 'DT_FOCUS_ZONE': {
        const zone = appState.campusZones?.find(z => z.id === msg.zoneId);
        if (zone) appState.focusOnZone?.(zone);
        break;
      }

      case 'DT_SET_TELEMETRY': {
        const zone = appState.campusZones?.find(z => z.id === msg.zoneId);
        if (zone && msg.data) {
          zone.telemetry = { ...zone.telemetry, ...msg.data };
          if (appState.selectedZone?.id === msg.zoneId) {
            appState.refreshInspector?.();
          }
        }
        break;
      }

      case 'DT_SET_ALERT': {
        const zone = appState.campusZones?.find(z => z.id === msg.zoneId);
        if (zone?.mesh) {
          const colorMap = { normal: 0x24688a, warning: 0xd97706, danger: 0xdc2626 };
          const hexColor = colorMap[msg.level] ?? colorMap.normal;
          zone.mesh.traverse(child => {
            if (child.isMesh && child.material) {
              if (!child.material._originalEmissive) {
                child.material._originalEmissive = child.material.emissive?.getHex() ?? 0x000000;
              }
              child.material.emissive?.setHex(msg.level === 'normal' ? 0x000000 : hexColor);
              child.material.emissiveIntensity = msg.level === 'normal' ? 0 : 0.4;
            }
          });
          zone.alertLevel = msg.level;
        }
        break;
      }

      case 'DT_GET_ZONES': {
        const zonesPayload = (appState.campusZones ?? []).map(z => ({
          id: z.id,
          name: z.name,
          type: z.type,
          telemetry: z.telemetry,
          alertLevel: z.alertLevel ?? 'normal',
        }));
        const target = event.source ?? window.parent;
        target?.postMessage({ type: 'DT_ZONES_LIST', zones: zonesPayload }, '*');
        break;
      }

      case 'DT_RESET_VIEW': {
        appState.resetCamera?.();
        break;
      }
    }
  });

  // Helper used by app.js to emit events up to the parent dashboard
  appState.emit = function (type, payload = {}) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, ...payload }, '*');
    }
  };
}
