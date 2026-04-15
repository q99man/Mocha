# Landing Page Implementation Prep

## Source

- Plan: `docs/LandingPage_UI_UX_PLAN.md`
- Current page: `frontend/src/pages/HomePage.tsx`
- Current styles: `frontend/src/app/styles.css`
- Reference assets:
  - `public/background/1.jpg`
  - `public/background/2.mp4`
  - `public/background/3.mp4`
  - `public/background/4.JPG`
  - `public/background/5.JPG`

## 1. Plan Interpretation

### Core direction

- Make the landing page compact.
- Remove decorative or explanatory noise.
- Follow the reference mood closely.
- Build the page to drive users into the challenge flow.

### Visual rules from the plan

- Base tone: black and white, monochrome first.
- Color: only as a controlled accent when needed.
- Typography: `Magarine` for the main text direction.
- Icons and ornaments: avoid by default.
- Copy: short, direct, action-oriented.

### Required landing sections

1. Feature
2. Showcase
3. Use case
4. CTA
5. Footer

## 2. What the references suggest

### Reference mood

The images strongly point to this structure:

- Full-bleed, cinematic hero background
- Minimal top navigation
- Large handwritten headline
- Small supporting sentence
- One strong rounded CTA
- Big soft-radius content blocks
- Clean monochrome sections below the hero
- Spacious, premium, almost poster-like composition

### Asset reading

#### `1.jpg`

- Snowy cinematic background with soft glow
- Best fit: main hero background reference
- Key takeaway:
  - immersive background
  - centered headline
  - floating minimal nav

#### `4.JPG`

- Dark hero card on black background
- Best fit: alternate hero composition and CTA treatment
- Key takeaway:
  - rounded container on pure black
  - very sparse typography
  - restrained monochrome button system

#### `5.JPG`

- Clean white footer with giant brand wordmark
- Best fit: footer layout reference
- Key takeaway:
  - footer can be bold without being busy
  - large typography works as structure, not decoration

#### `2.mp4`, `3.mp4`

- Video assets exist and should be considered for showcase/use-case sections.
- I have not yet inspected their visual frames directly in this session, so they should be treated as available media candidates rather than confirmed stylistic anchors.

## 3. Recommended landing structure for Mocha

### A. Hero

Purpose:

- Explain the product in one glance.
- Push users toward starting a challenge.

Recommended content:

- Minimal nav
- Short brand line
- Large handwritten headline
- One sentence subcopy
- Primary CTA: challenge entry
- Secondary CTA: challenge gallery or recent archive
- Cinematic background using image or muted video feel

Suggested message direction:

- Users do not need a long explanation first.
- The hero should answer:
  - what this is
  - why it feels different
  - where to click next

### B. Feature

Purpose:

- Explain why the product is useful without turning into a spec sheet.

Recommended content:

- 3 compact blocks max
- Short labels, one-line descriptions
- Focus on:
  - challenge selection
  - motion comparison/scoring
  - retry feedback loop

Important:

- This section should stay compact.
- Avoid metrics-heavy cards from the current home page.

### C. Showcase

Purpose:

- Make the challenge library feel desirable.

Recommended content:

- Horizontal or staggered gallery
- 3 featured challenge cards max
- Strong thumbnail/media emphasis
- Minimal metadata only

Use of assets:

- If video assets fit the brand mood, this is the best section to place motion media.

### D. Use Case

Purpose:

- Help users imagine themselves using the product.

Recommended content:

- 2 or 3 scenarios only
- Example:
  - practice and retry
  - compare with reference motion
  - review score and improve

Note:

- The plan mentions use cases and 후기, but the current product does not appear to have real testimonial content.
- This should be framed as usage scenarios, not fake reviews.

### E. CTA

Purpose:

- End the page with a clear conversion push.

Recommended content:

- One strong sentence
- One primary action
- Optional secondary link

Example intent:

- “Choose a challenge and start now.”

### F. Footer

Purpose:

- Close cleanly, not noisily.

Recommended content:

- Minimal brand block
- Product navigation links only
- Large visual type inspired by reference `5.JPG`

## 4. What should be removed from the current Home page

These parts do not match the new plan well:

- Dense status stat strip
- Detailed “Quick Flow” explanation block
- “Latest Signal” card in its current dashboard form
- The current page-level feeling of “product console”

In short:

- The current `HomePage` is closer to a stage dashboard.
- The new page should feel like a brand-first landing page.

## 5. Implementation implications

### Likely scope

This is not a light restyle.

Expected work:

- Rewrite `HomePage.tsx`
- Add new landing-only section classes in `styles.css`
- Possibly soften or hide global stage-shell framing for the landing page if it conflicts with the new look

### Important layout consideration

Current `AppLayout` wraps all public pages with:

- `stage-shell`
- `stage-topbar`
- `stage-nav`

This may conflict with a premium landing page.

Recommended implementation options:

1. Keep `AppLayout` and make the landing page work inside it
2. Make the landing page a special-case route layout

Recommendation:

- Start with option 1 for speed.
- If the top shell visually blocks the design, then split the landing route into a dedicated layout.

## 6. Technical gaps to resolve before or during build

### Typography

- `Magarine` is requested in the plan.
- The project does not currently load that font.

Needed:

- add web font import if allowed
- or add local font asset if available

### Media usage

- `public/background` assets are available at the repo root.
- Vite can serve root `public` assets, but the final references should be checked during implementation.

### Copy

- Current landing copy is old and much more functional/dashboard-like.
- New copy should be rewritten almost entirely.

### Video inspection

- `2.mp4` and `3.mp4` are present, but I did not inspect frames directly here.
- If they are visually strong, they should power showcase or hero support.

## 7. Recommended build order

1. Rewrite landing information architecture in `HomePage.tsx`
2. Add new landing section styles in `styles.css`
3. Connect `Magarine` typography
4. Wire in background assets
5. Tune spacing and mobile behavior
6. Decide whether `AppLayout` needs landing-specific treatment

## 8. Risks

### Risk 1. Global shell fights the landing page

- The current public layout already has a strong identity.
- A reference-driven premium landing may need more freedom.

### Risk 2. Font mismatch

- Without `Magarine`, the page will miss a key part of the intended mood.

### Risk 3. Overusing explanatory product copy

- The plan clearly prefers brevity.
- Existing page patterns in this repo lean verbose.

### Risk 4. Fake social proof

- “후기” should not be invented.
- Use scenario-based messaging unless real testimonial data exists.

## 9. Ready-to-build conclusion

The landing page is ready for implementation planning.

Best execution path:

- treat `HomePage` as a new landing page
- shift from dashboard language to campaign/brand language
- use monochrome, large hero typography, and compact sections
- keep the sections strictly to:
  - hero
  - feature
  - showcase
  - use case
  - CTA
  - footer

## 10. Recommended next coding task

Start with:

- `frontend/src/pages/HomePage.tsx`
- `frontend/src/app/styles.css`

Secondary files only if needed:

- `frontend/src/shared/components/AppLayout.tsx`
- `frontend/index.html`

## 11. Model note for the next task

For the next step, the best fit is a strong coding model that can both:

- preserve the reference mood
- make decisive frontend structure changes

Recommended:

- GPT-5.4 with medium or high reasoning for implementation
- high reasoning if the landing page also requires layout refactoring in `AppLayout`
