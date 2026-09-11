# AI image prompts — GPT Image (2.5) — MEW Al Dhaher 3D digital-twin renders

Purpose: photoreal "3D" hero images for (a) the 3D Digital Twin fallback / **Render** tab, (b) the pitch deck, (c) the mobile app hero. Save outputs to `assets/images/twin/` with the filenames below (JPEG, quality 85, longest side 1920 px — keep the app offline-light).

## Style block — paste at the START of every prompt
> Photorealistic architectural-visualisation render of a modern water-tanker filling station in the Kuwait desert (MEW Al Dhaher Lorry Filling Station). Overcast late-afternoon light, soft shadows, slightly hazy sky. Materials: pale sand-coloured compacted ground with faint tyre marks, light-grey concrete aprons, galvanised steel pipework with cyan (#22d3ee) painted process lines, yellow/black safety striping on bollards and kerbs, white cylindrical water-tanker lorries (white cab, polished white tank, 3 axles), blue electromagnetic flow-meters and blue instrument transmitters, dark-navy control cabinets. Clean, new, no litter, no people unless stated. Camera: crisp 35 mm look, ¾ elevated view unless stated, no lens flare. **No text, no labels, no logos, no watermarks, no UI overlays** — the application will draw its own labels on top. 16:9.

## Consistency notes
* Reuse the same seed/style reference across the set (upload `reference/ai-render-bay-aerial-v1.png` as the style image where the tool allows). 
* Ask for **no text** every time — earlier renders had baked-in labels which clash with the live HUD.
* Generate 2–3 variants each; pick the one where the process line reads left → right (inlet → tanker) like the schematic.

---

### 1. `station-aerial.jpg` — whole station, overview hero (P0)
Aerial ¾ view from about 60 m, looking north-west, of the entire filling station: six long parallel filling lanes (manifolds), each lane serving seven tanker bays with a small kiosk pillar and an articulated loading arm per bay, white tanker lorries parked in roughly half the bays, a few driving on the internal loop road. At the north edge a DN800 grey inlet header pipe on concrete saddles feeding six branch headers; two white cylindrical storage silos and a squat white buffer tank; a two-storey local control centre building with dark glazing and a rooftop antenna mast; entry and exit gates at the south with barrier arms and camera poles; perimeter galvanised fence; parking area with queued tankers outside the entry gate. Sand desert beyond the fence. No text.

### 2. `bay-detail.jpg` — single bay, the schematic in 3D (P0)
Low ¾ view at eye level plus 3 m, one filling bay in the foreground: a white three-axle water tanker lorry parked with its top hatch open under an articulated stainless-steel loading arm mounted on a yellow gantry. Along the concrete apron beside the truck, a straight process line at waist height in this exact order from left to right: grey header pipe → blue actuated tight-shut-off valve with a small electric actuator on top → blue pressure transmitter on a vertical stub → blue flanged electromagnetic flow meter with a display head → blue temperature transmitter → second smaller blue control valve → riser up to the loading arm. A dark-navy RTU cabinet with a small kiosk screen and a QR/PIN keypad on a pillar near the cab; a CCTV camera on a pole aimed at the hatch. Neighbouring bays blurred in the background. No text.

### 3. `bay-detail-night.jpg` — same as 2, night (P1)
Identical composition to prompt 2 at night: high-mast LED floodlights, cool white light on the tanker, cyan pipe lines glowing faintly, kiosk screen lit, camera IR ring glowing red. No text.

### 4. `gate-entry.jpg` — LPR gate (P1)
Ground-level ¾ view of the station entry gate: two lanes with red-white barrier arms, a canopy over an intercom/RFID reader pillar, an LPR camera and an overview camera on a pole, a white water tanker stopped at the barrier with its front plate visible but **blank**, another tanker queued behind. Control centre building in the background. No text, no legible plates.

### 5. `control-centre.jpg` — LCC / Salmiya control room (P1)
Interior of a modern water-utility control room: curved desk with three operators (back view, high-visibility vests), a video wall of six large screens showing abstract dark-navy dashboards with cyan and green charts and a grid of small status tiles (no readable text), a wide window at the right overlooking the filling lanes and tankers outside. Cool blue lighting. No text.

### 6. `truck-side-elevation.png` — orthographic tanker for the HMI (P0, PNG with transparent background)
Orthographic **side elevation** (pure profile, no perspective) of a white three-axle water tanker lorry: white cab on the left, long white cylindrical tank with two manholes on top, grey chassis, black tyres, rear ladder. Clean vector-like realistic render, even studio lighting, **transparent background**, no ground, no shadow, no text. Square-ish framing with the truck centred. (Used as the truck in the PCS 7 style HMI; the app draws the green fill level over the tank.)

### 7. `instruments-sheet.png` — HUD icon sheet (P1, transparent PNG)
Six isolated product renders arranged in a 3×2 grid on a transparent background, each object centred with even lighting: (1) blue flanged electromagnetic flow meter with display head, (2) blue actuated tight-shut-off valve with electric actuator, (3) blue pressure transmitter, (4) blue temperature transmitter with thermowell, (5) dark-navy RTU cabinet with a small screen and keypad, (6) stainless articulated loading arm. Consistent scale, ¾ view, no text.

### 8. `mobile-hero.jpg` — driver at the kiosk (P1)
Close ¾ view of a tanker driver in a high-visibility vest holding up a smartphone showing a **blank glowing screen** to a kiosk QR scanner on a pillar beside a white tanker lorry, filling lane and cyan pipework softly out of focus behind. Late afternoon light. No text on the phone or kiosk.

### 9. `access-card.png` — RFID access card mock (P1, transparent PNG)
Front face of a plastic RFID access card, landscape, dark navy with a subtle cyan wave graphic, a chip contact pad on the left, a small QR square on the right, a blank rectangle for a photo, and empty text areas. **No readable text, no logo** (the app overlays "MEW · S!aP", card number and name). Slight perspective tilt, soft reflection, transparent background.

### 10. `storage-and-inlet.jpg` — tanks, pump house, DN800 header (P2)
¾ view of the station's water side: a DN800 grey steel inlet header arriving on concrete saddles from a fenced solar-powered flow-metering skid, into a pump house with two blue horizontal pumps visible through open roller doors, and out to two white cylindrical storage silos and a white buffer tank with an external ladder and level transmitter on top. Sand ground, yellow bollards. No text.

### 11. `exec-cockpit-bg.jpg` — abstract background for the executive cockpit / slides (P2)
Abstract dark-navy (#0a1424) background with a faint isometric line drawing of the filling station (six lanes, tankers, silos) in thin cyan lines, subtle depth-of-field glow, wide 21:9, no text.

---

## Naming & sizes
| File | Size | Used by |
|---|---|---|
| `station-aerial.jpg` | 1920×1080 | 3D twin "Render" tab / fallback, deck |
| `bay-detail.jpg` | 1920×1080 | 3D twin fallback hotspot image (WP-A places hotspots at fixed % coordinates) |
| `bay-detail-night.jpg` | 1920×1080 | optional theme toggle |
| `gate-entry.jpg` | 1920×1080 | CCTV lightbox background for CAM-01 (optional) |
| `control-centre.jpg` | 1920×1080 | S!a page header / deck |
| `truck-side-elevation.png` | 2048×1024 transparent | WP-C HMI truck (fallback is the SVG path) |
| `instruments-sheet.png` | 1536×1024 transparent | HUD icons (WP-A/WP-C) |
| `mobile-hero.jpg` | 1080×1350 | mobile wallet hero (replaces `assets/images/wallet-bg.jpg` if better) |
| `access-card.png` | 1536×1024 transparent | WP-B card mock |
| `storage-and-inlet.jpg` | 1920×1080 | deck |
| `exec-cockpit-bg.jpg` | 2560×1080 | deck |
