# Error screen illustration

`error-cat.webp` was generated for Budmo with the built-in imagegen tool on 2026-10-14.
The image keeps its transparent background and is bundled locally for offline error screens.
On 2026-10-16 it was downscaled from 1254×1254 to 720×720 px (premultiplied-alpha area averaging, same framing):
the error screen shows it at most 240×240 pt, which is 720 px on a 3x screen. 1.64 MB → 0.54 MB in the app and in OTA updates.
The same day the PNG became a WebP (quality 82, alpha lossless, `npx sharp-cli@5.1.0 -i error-cat.png -o error-cat.webp -f webp -q 82 --effort 6 --smartSubsample`): 0.54 MB → 0.09 MB. Android decodes WebP natively; iOS from iOS 14.

Final prompt:

```text
Use case: illustration-story
Asset type: local illustration for the error screen of Budmo, a mobile app with a near-black background and amber accents.
Primary request: a cute slightly disappointed ginger cat holding a completely empty clear stemmed wine glass in one front paw, looking at the empty glass with a gentle puzzled expression.
Style/medium: polished cozy hand-painted digital illustration, soft textured fur, simple friendly rounded silhouette, tasteful muted amber and cream tones. Clean readable shapes at 220px.
Composition/framing: single cat sitting, entire cat and entire glass visible, centered square composition with generous transparent margins. The glass must be unmistakably empty, clear bowl, stem and foot visible with light highlights readable against a dark UI.
Scene/backdrop: genuinely transparent background, no scenery.
Constraints: only one cat and one empty glass, no liquid, no text, no symbols, no watermark, no UI.
```
