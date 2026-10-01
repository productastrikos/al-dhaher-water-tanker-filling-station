/* 26 station locations (see docs/KUWAIT_NETWORK_MAP_BRIEF.md §2) — ported from legacy/network-map.js.
   lat/lon -> % is a linear approximation; coastal stations carry a small, fixed xPct/yPct override that was
   verified against the rendered SVG so their pins stay on land at any pan/zoom. */
export interface Station {
  id: number; name: string; governorate: string; lat: number; lon: number;
  flagship?: boolean; xPct?: number; yPct?: number;
}

export const NETWORK_STATIONS: Station[] = [
  { id: 1, name: 'Al Dhaher', governorate: 'Ahmadi', lat: 29.055, lon: 48.105, flagship: true },
  { id: 2, name: 'Fahaheel', governorate: 'Ahmadi', lat: 29.083, lon: 48.128, xPct: 69.75, yPct: 61.77 },
  { id: 3, name: 'Abu Halifa', governorate: 'Ahmadi', lat: 29.114, lon: 48.117, xPct: 69.29, yPct: 60.28 },
  { id: 4, name: 'Mina Abdullah', governorate: 'Ahmadi', lat: 29.028, lon: 48.146, xPct: 70.12, yPct: 63.09 },
  { id: 5, name: 'Shuaiba', governorate: 'Ahmadi', lat: 29.027, lon: 48.178, xPct: 70.51, yPct: 65.57 },
  { id: 6, name: 'Wafra', governorate: 'Ahmadi', lat: 28.633, lon: 47.933 },
  { id: 7, name: 'Fintas', governorate: 'Ahmadi', lat: 29.164, lon: 48.128, xPct: 68.83, yPct: 57.39 },
  { id: 8, name: 'Sabah Al-Ahmad City', governorate: 'Ahmadi', lat: 28.972, lon: 48.086 },
  { id: 9, name: 'Jahra', governorate: 'Jahra', lat: 29.347, lon: 47.660 },
  { id: 10, name: 'Sulaibiya', governorate: 'Jahra', lat: 29.296, lon: 47.752 },
  { id: 11, name: 'Amghara', governorate: 'Jahra', lat: 29.323, lon: 47.807 },
  { id: 12, name: 'Saad Al-Abdullah', governorate: 'Jahra', lat: 29.417, lon: 47.683 },
  { id: 13, name: 'Abdali', governorate: 'Jahra', lat: 29.786, lon: 47.555 },
  { id: 14, name: 'Taima', governorate: 'Jahra', lat: 29.360, lon: 47.628 },
  { id: 15, name: 'Naeem', governorate: 'Jahra', lat: 29.336, lon: 47.678 },
  { id: 16, name: 'Farwaniya', governorate: 'Farwaniya', lat: 29.277, lon: 47.939 },
  { id: 17, name: 'Jleeb Al-Shuyoukh', governorate: 'Farwaniya', lat: 29.263, lon: 47.925 },
  { id: 18, name: 'Khaitan', governorate: 'Farwaniya', lat: 29.297, lon: 47.966 },
  { id: 19, name: 'Ardiya', governorate: 'Farwaniya', lat: 29.280, lon: 47.900 },
  { id: 20, name: 'Sabah Al-Nasser', governorate: 'Farwaniya', lat: 29.240, lon: 47.867 },
  { id: 21, name: 'Andalous', governorate: 'Farwaniya', lat: 29.291, lon: 47.953 },
  { id: 22, name: 'Qurain', governorate: 'Mubarak Al-Kabeer', lat: 29.267, lon: 48.080, xPct: 67.75, yPct: 52.91 },
  { id: 23, name: 'Sabah Al-Salem', governorate: 'Mubarak Al-Kabeer', lat: 29.243, lon: 48.098, xPct: 68.38, yPct: 55.02 },
  { id: 24, name: 'Adan', governorate: 'Mubarak Al-Kabeer', lat: 29.250, lon: 48.070 },
  { id: 25, name: 'Shuwaikh', governorate: 'Al Asimah (Capital)', lat: 29.343, lon: 47.933, xPct: 64.53, yPct: 49.04 },
  { id: 26, name: 'Sulaibikhat', governorate: 'Al Asimah (Capital)', lat: 29.343, lon: 47.905, xPct: 63.90, yPct: 49.48 },
];

/* lat/lon -> % projection (brief §1 for the bounding box + N/S stretch correction) */
const BOUNDS = { north: 30.2, south: 28.4, west: 46.4, east: 48.8 };
export function project(lat: number, lon: number) {
  const xFrac = (lon - BOUNDS.west) / (BOUNDS.east - BOUNDS.west);
  const rawYFrac = (BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south);
  const yFrac = 0.5 + (rawYFrac - 0.5) / 1.15;
  return { xPct: xFrac * 100, yPct: yFrac * 100 };
}
/** A station's on-map position: its verified xPct/yPct override when it has one, else the lat/lon projection. */
export function stationPct(st: Station) {
  return st.xPct != null && st.yPct != null ? { xPct: st.xPct, yPct: st.yPct } : project(st.lat, st.lon);
}

export const MAP_W = 1134.275;
export const MAP_H = 979.207;
