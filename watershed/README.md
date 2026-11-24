# 🏞️ Watershed

*Rain falls, rivers carve, mountains wear down, and the sand ends up in the sea.*

A hydraulic erosion sandbox. Raise a landscape, let it rain, and watch gullies, valleys, alluvial fans,
lakes and deltas form. Every raindrop is simulated.

**Run it:** open `index.html` in a browser. It has no build step, no dependencies and no network calls.
If your browser blocks local files, run `python3 -m http.server` in this folder and go to <http://localhost:8000>.

## What you can do

| | |
|---|---|
| 🗺️ **7 kinds of land** | Highlands, Archipelago, Volcanic island, Alpine ridges, Mesa country, Rolling hills, and a blank plateau for sculpting. Each comes from a seed you can type or roll. |
| 🌧️ **Weather** | Rainfall from drizzle to downpour, rain everywhere or mostly on high ground, and a sea level you can raise or drop. |
| 🪨 **Geology** | Erodibility, settling, carrying capacity, evaporation, momentum, scree (slopes collapse past ~48°) and tectonic uplift. |
| ✋ **Hands** | Storm cloud, springs that never run dry, raise, dig, smooth, flatten, and a survey tool that reads elevation, slope and upstream area. |
| 👁️ **Views** | Natural colours (moisture and altitude pick the biome), elevation tints, a glowing drainage map, and a red/blue map of what was worn away and laid down. Hold **B** to see the land before the rain. |
| 🏔️ **3D** | A ray-cast oblique view that circles the land. Drag to orbit, scroll to zoom. |
| 🔗 **Share** | The link stores terrain type, seed and size. Save a picture of the map or the 3D view. |

## How it works

- **Erosion** (`js/terrain.js`): particle erosion after Hans Theobald Beyer (2015). A droplet rolls downhill with some
  inertia. Its carrying capacity grows with speed, slope and water. Below capacity it erodes (spread over a small
  brush); above it, or going uphill, it deposits. When it reaches the sea it drops its whole load, which builds deltas.
- **Lakes and rivers**: a priority-flood pass fills every pit to its spill height, routes each cell to a neighbour and
  accumulates upstream area. Cells with a large upstream area are drawn as rivers, filled pits as lakes.
- **Scree**: material slides off slopes steeper than the angle of repose. **Uplift** raises high ground a little each frame.
- **Rendering** (`js/render2d.js`, `js/render3d.js`): hill shading plus a biome palette from altitude, slope and a blurred
  moisture field. The 3D view draws screen columns front to back with a height buffer.

`node tools/check.js` runs every terrain type headless and checks for NaNs, runaway heights and missing rivers.
