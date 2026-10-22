# FEM Truss Tutor

An interactive, browser-based tutor that walks a student through the full finite element solution of 2D and 3D pin-jointed truss problems, one stage at a time. Every matrix and number on screen is computed by the app's own JavaScript, and every stage shows how the numbers were produced.

**Live tool:** `<paste your GitHub Pages link here>`

## Run it
- Double-click `index.html` (works offline), or open the GitHub Pages link above.
- Equations are rendered with KaTeX loaded from cdnjs. The first load needs internet; if KaTeX cannot load, equations fall back to plain text and everything else still works.

## What it does
Seven stages: problem definition, element geometry, element stiffness matrices, global assembly, boundary conditions, solving for displacements (step-by-step Gaussian elimination), and reactions / strains / stresses.

- Five presets: the instructor's test case (Logan Example 3.9, the default), a 2D triangle, a 2D braced panel, a 3D tripod, and a statically indeterminate 3D pyramid.
- Editable E, A and loads with validation; every edit re-solves instantly.
- Rotatable 3D view, deformed shape with magnification slider, colour-coded tension/compression.
- Hover any cell of the global stiffness matrix to see which elements contribute to it.
- Glossary tooltips, "Check yourself" questions, Help dialog, Guided demo, light/dark theme, and a print/export of the full solution.

## No AI at runtime
The app makes no calls to any AI service or network API. All math is deterministic JavaScript, and all explanatory text is hand-written templates filled with computed values. (`index.html` contains no `fetch`/`XMLHttpRequest`; the only external resources are the two pinned KaTeX tags.)

## Tests
```
node tests/fem.test.js    # 310 checks: all reference solutions, symmetry, equilibrium, determinism, mechanism detection, scaling
node tests/sync.test.js   # confirms the core inlined in index.html matches tests/fem-core.js
```
If you change `tests/fem-core.js`, run `node tools/inline-core.js` to re-inline it into `index.html`.

## Files
| File | Purpose |
| --- | --- |
| `index.html` | The whole app (inline CSS and JS) |
| `tests/fem-core.js` | The pure FEM core (also inlined in `index.html`) |
| `tests/fem.test.js`, `tests/sync.test.js` | Tests |
| `tools/inline-core.js` | Copies the core into `index.html` |
| `SPEC.md` | The build specification |
| `USER_GUIDE.md`, `DEMO_EXAMPLE.md` | Guide and worked example |
| `AI_DISCLOSURE.md` | AI usage statement (written by the author) |

## Scope
Straight pin-jointed bars only. Frames, bending, dynamics, nonlinear behaviour and arbitrary user-drawn geometry are out of scope.
