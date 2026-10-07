TIME & MONEY — FINAL TOTAL QA

[Render]
- Upload the entire folder contents, preserving:
  index.html
  server.js
  package.json
  render.yaml
  session2_assets.json
  images/
- Start command: npm start
- Server now serves /images/* as static assets.
- Backgrounds are also embedded in index.html, so the game does not depend on external HTTP image hosts.

[GitHub Pages / static hosting]
- index.html can render without the background SVG files because backgrounds are embedded.
- Keep the images/ folder anyway for ending/character backup and server deployment.
- Do not use http:// image URLs from an HTTPS GitHub page; mixed content is blocked by browsers.

[Online Battle]
- Server is required. GitHub Pages alone cannot provide /api/rooms/*.
- Recommended players: 15 or fewer.
- Turn: 6 months / 2:30.
- Host can start once 2+ players are present; all players do not need to be ready to start.
- Each round uses ready N/N or timer expiry; host can force-progress with confirmation.
- Whole-player day battle: 15% chance per online turn, never the first turn; 30 seconds; 100 hidden tokens per player; winner receives +50% of pre-reward total assets as cash; tokens are removed after settlement.
- Empty room is cleaned after 5 minutes when everyone has left/disconnected.
