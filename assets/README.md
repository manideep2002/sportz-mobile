# SPORTZ branding assets

Production branding is configured in `app.config.js` (this project does not use `app.json`).

| Asset | Purpose | Requirements |
| --- | --- | --- |
| `icon.png` | iOS and legacy Android app icon | 1024x1024 RGB; opaque dark court background |
| `adaptive-icon.png` | Android adaptive foreground | 1024x1024 RGBA; visible mark fits inside the centered 626px safe region |
| `splash.png` | Native portrait launch screen | 1290x2796 RGB; uses `contain` over the matching `#0A0907` background |
| `notification-icon.png` | Android status-bar notification glyph | 96x96 RGBA; white-only glyph on transparency |
| `favicon.png` | Web browser favicon | 64x64 RGB |
| `brand-mark.png` | Reusable source monogram | RGBA; transparent background |

The master icon, adaptive foreground, splash, notification icon, and favicon are generated from `brand-mark.png` by `scripts/generate_brand_assets.py`. The script uses SPORTZ's checked-in Barlow Condensed package and requires Pillow:

```powershell
python scripts\generate_brand_assets.py
```

After regeneration, run `npx expo config --type public` and an Android export before release. Do not add transparent pixels to `icon.png`, colored pixels to `notification-icon.png`, or move adaptive-icon content outside its documented safe region.
