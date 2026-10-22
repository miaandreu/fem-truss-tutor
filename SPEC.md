# Claude Code Build Brief: Interactive FEM Truss Learning Tool

Oct 20, 2026 · @mia

## 1. How to use this brief

Export this doc as Markdown, save it as `SPEC.md` in an empty project folder, and point Claude Code at it. Do not paste the whole thing as one prompt and ask for everything at once; build in the phases in Section 10.

1. Create a folder (e.g. `fem-truss-tutor/`), put `SPEC.md` and the assignment PDF in it, then run `git init`.
2. Start Claude Code in that folder and run `/init`. Then ask it to add these rules to `CLAUDE.md`:
   - The product is ONE self-contained `index.html` (plus a `tests/` folder). No build step, no npm runtime dependencies.
   - The running app must never call an AI service, LLM, or any network API. All math is deterministic JavaScript.
   - Every numeric result must be verified against the reference solutions in `SPEC.md` Section 8 before a phase is considered done.
   - Read `SPEC.md` before starting any phase.
3. For each phase, switch to plan mode (Shift+Tab) first, review the plan, then let it build.
4. Commit after each phase passes its checklist, so you can roll back if a later phase breaks something.
5. Open `index.html` directly in a browser to test. Host it free on GitHub Pages (Settings → Pages → deploy from `main`) for the submission link.

Put the instructor's test-case PDF (Logan Example 3.9, space truss) in the folder too. It is built in as Preset 5 and is the primary acceptance test: matching it is the strongest proof the math is right.

## 2. Project overview and hard constraints

Build a browser-based tutor that walks a student through the full Finite Element solution of 2D and 3D pin-jointed truss (bar) problems, one stage at a time. Every matrix and number on screen must come from the app's own computation, and every stage must show *how* the numbers were produced, not only the result.

**Grading the product must satisfy (10 points):**

| Criterion | Points | Covered by stage |
| --- | --- | --- |
| Problem definition and visualization | 1 | Stage 1 |
| Element stiffness matrix formulation | 2 | Stage 2 |
| Global stiffness matrix assembly | 2 | Stage 3 |
| Boundary conditions and reduced system | 2 | Stage 4 |
| Displacements, reactions, element stresses | 2 | Stages 5–6 |
| User interface and educational clarity | 1 | All stages, Section 7 |

**Hard constraints (non-negotiable):**

- No AI at runtime. The app must not call any LLM, chatbot, or external API. No `fetch` to any service. Explanatory text is hand-written templates filled with computed values.
- Deterministic. Identical inputs always produce identical outputs. No randomness anywhere.
- Single file. Everything lives in one `index.html` with inline CSS and JS. The only external resources allowed are pinned CDN scripts for KaTeX (and optionally three.js), with the app still usable if they fail to load.
- Works offline after first load and by double-clicking the file.
- Units are explicit everywhere. Internally use SI (N, m, Pa); display with friendly prefixes (kN, mm, MPa, GPa).
- Out of scope: frames, beams, bending, dynamics, nonlinear analysis, arbitrary user-drawn geometry. The tool is a tutor, not a general solver.

## 3. Tech stack and architecture

One `index.html`, vanilla JavaScript (ES2020, no framework), organized internally into clearly separated sections so the math core can be tested on its own.

**Libraries (pinned CDN `<script>` tags only):**

- KaTeX 0.16.x from cdnjs for equations and matrices. Fallback: if KaTeX fails to load, show matrices as plain HTML tables.
- three.js r128 (UMD build) from cdnjs for the 3D view, OR a hand-written SVG isometric projection with mouse-drag rotation. Prefer the SVG approach if it keeps the file simpler; it must support rotating the view.
- No other dependencies. Write the linear solver yourself (the point is to show the steps).

**Internal layout of the script, top to bottom:**

| Section | Responsibility | Pure? |
| --- | --- | --- |
| `PRESETS` | Preset structures as plain data objects | Yes |
| `fem` core | Geometry, element k, assembly, BCs, solve, reactions, stress | Yes, no DOM |
| `trace` | Records every intermediate step (row ops, contributions) for display | Yes |
| `format` | Number formatting, unit conversion, LaTeX matrix strings | Yes |
| `render` | SVG/3D diagrams, matrix tables, highlighting | No |
| `ui` | Stage navigation, input panel, state, event handlers | No |

The `fem` core must be a pure function: `solve(model) → result`, where `result` contains every intermediate quantity (each element's L, direction cosines, T, k\_local, k\_global, DOF map, K, reduced K and F, elimination steps, u, R, strain, stress, force, state). The UI only reads `result`; it never computes physics.

Expose the core on `window.FEM` and also mirror it as `fem-core.js` inside `tests/` (or extract via a small script) so Node can run the tests in Section 8 without a browser.

## 4. Data model and preset examples

Ship five presets: four of our own (two 2D, two 3D) plus the instructor's textbook test case. Geometry, connectivity, and supports are fixed per preset; users may edit E and A per element and the load components per node.

**Model object shape:**

```js
{
  id: "2d-triangle",
  title: "2D three-bar triangular truss",
  dim: 2,                       // 2 or 3
  description: "...",           // short problem statement shown in Stage 1
  nodes: [ { id: 1, x: 0, y: 0, z: 0 }, ... ],          // metres
  elements: [ { id: 1, n1: 1, n2: 2, E: 200e9, A: 1e-3 }, ... ], // Pa, m²
  supports: [ { node: 1, fix: [true, true, false] }, ... ], // [x, y, z]
  loads: [ { node: 3, F: [10e3, -20e3, 0] }, ... ]          // N
}
```

**Editing rules:** E entered in GPa (range 1–1000), A in mm² (range 1–100 000), loads in kN (any sign, including 0). Validate on input; show an inline error and keep the last valid model. A "Reset preset" button restores defaults. Every edit re-runs `solve()` and refreshes all stages instantly.

**Robustness:** if the reduced K is singular (mechanism), stop at Stage 4 with a clear explanation instead of NaNs. Detect a zero pivot during elimination (|pivot| below 1e-12 × max diagonal).

### Preset 1: 2D three-bar triangular truss (2D walkthrough example)

Nodes (m): 1 (0, 0), 2 (4, 0), 3 (2, 3). Elements: 1 (1→2), 2 (2→3), 3 (1→3). All E = 200 GPa, A = 1000 mm². Supports: node 1 pinned (u1x = u1y = 0), node 2 roller (u2y = 0). Load at node 3: Fx = +10 kN, Fy = −20 kN. Free DOFs: u2x, u3x, u3y (3×3 reduced system). Small enough to show every number by hand.

### Preset 2: 2D braced square panel

Nodes (m): 1 (0, 0), 2 (3, 0), 3 (3, 3), 4 (0, 3). Elements: 1 (1→2), 2 (2→3), 3 (3→4), 4 (4→1), 5 (1→3, diagonal). E = 200 GPa for all; A = 1000 mm² except element 5 with A = 1500 mm² (shows per-element properties). Supports: node 1 pinned, node 2 roller (y fixed). Loads: node 4 Fx = +20 kN; node 3 Fy = −10 kN. Free DOFs: 5. Teaching point: elements 1 and 4 come out as zero-force members.

### Preset 3: 3D tripod

Nodes (m): 1 apex (0, 0, 4), 2 (4, 0, 0), 3 (−2, 3, 0), 4 (−2, −3, 0). Elements: 1 (1→2), 2 (1→3), 3 (1→4). All E = 70 GPa (aluminum), A = 500 mm². Supports: nodes 2, 3, 4 fully fixed (ball joints). Load at node 1: F = (+10, +5, −30) kN. Free DOFs: 3 (u1x, u1y, u1z). Statically determinate.

### Preset 4: 3D four-legged pyramid (statically indeterminate)

Nodes (m): 1 apex (0, 0, 3), 2 (2, 2, 0), 3 (−2, 2, 0), 4 (−2, −2, 0), 5 (2, −2, 0). Elements: 1–4 from node 1 to nodes 2–5. All E = 200 GPa, A = 1000 mm². Supports: nodes 2–5 fully fixed. Load at node 1: F = (0, +10, −40) kN. Teaching point: 4 bars but only 3 equilibrium equations at the apex, so hand statics fails and FEM handles it naturally.

### Preset 5: Instructor test case — space truss (Logan Example 3.9)

This is the assignment's official test case. Load it by default when the app opens, label it "Instructor test case (Logan Ex. 3.9)", and use it for the demonstration example.

Nodes (m): 1 (12, −3, −4), 2 (0, 0, 0), 3 (12, −3, −7), 4 (14, 6, 0). Elements, each with its local x̂ axis running from node 1 outward to match the book: 1 (1→2), 2 (1→3), 3 (1→4). All E = 210 GPa, A = 10 × 10⁻⁴ m² (1000 mm²). Supports: nodes 2, 3 and 4 pinned in x, y and z. Load at node 1: Fx = +20 kN. Free DOFs: d1x, d1y, d1z (3×3 reduced system).

For this preset, use the book's notation where practical (d1x rather than u1x, λ for the 3×3 direction-cosine block, k = (AE/L)\[λ −λ; −λ λ\]). Show the book's two tables for each element: direction cosines (Cx, Cy, Cz) and their products (Cx², CxCy, CxCz, Cy², CyCz, Cz²), since students will compare against them.

## 5. FEM math specification

Implement exactly these equations, and display them (with KaTeX) in the stage where they are used. Notation: node i has DOFs numbered from 1; in 2D node i owns DOFs 2i−1, 2i; in 3D node i owns 3i−2, 3i−1, 3i.

### 5.1 Geometry

For element e connecting node i to node j:

```latex
L = \sqrt{(x_j-x_i)^2 + (y_j-y_i)^2 + (z_j-z_i)^2}
```

```latex
C_x = \frac{x_j-x_i}{L},\quad C_y = \frac{y_j-y_i}{L},\quad C_z = \frac{z_j-z_i}{L}
```

In 2D also show the angle θ (measured from +x, counter-clockwise) with c = cos θ = Cx and s = sin θ = Cy.

### 5.2 Local stiffness and transformation

Local 1D bar stiffness along the bar axis:

```latex
[k'] = \frac{EA}{L}\begin{bmatrix} 1 & -1 \\ -1 & 1 \end{bmatrix}
```

Transformation matrix (2D shown; 3D uses \[Cx Cy Cz\] in each row):

```latex
[T] = \begin{bmatrix} c & s & 0 & 0 \\ 0 & 0 & c & s \end{bmatrix}, \qquad [k] = [T]^T [k'] [T]
```

The app must show this triple product being carried out (not just its result) for the selected element, then the closed form:

```latex
[k]_{2D} = \frac{EA}{L}\begin{bmatrix} c^2 & cs & -c^2 & -cs \\ cs & s^2 & -cs & -s^2 \\ -c^2 & -cs & c^2 & cs \\ -cs & -s^2 & cs & s^2 \end{bmatrix}
```

```latex
[k]_{3D} = \frac{EA}{L}\begin{bmatrix} [\lambda] & -[\lambda] \\ -[\lambda] & [\lambda] \end{bmatrix}, \quad [\lambda] = \begin{bmatrix} C_x^2 & C_xC_y & C_xC_z \\ C_xC_y & C_y^2 & C_yC_z \\ C_xC_z & C_yC_z & C_z^2 \end{bmatrix}
```

Compute k both ways in code and assert they agree to 1e-9 relative (a built-in self-check).

### 5.3 Assembly

Each element has a DOF map (its 4 or 6 global DOF numbers). Direct stiffness method:

```latex
K_{pq} \mathrel{+}= k^{(e)}_{ab}, \quad p = \text{map}_e(a),\ q = \text{map}_e(b)
```

Record, for every global entry K\_pq, the list of contributing elements and their values so the UI can show "K₅₅ = k⁽²⁾₃₃ + k⁽³⁾₃₃ = …".

### 5.4 Boundary conditions and reduction

Partition DOFs into free (f) and constrained (s, prescribed zero displacement). Use the elimination (row/column deletion) method:

```latex
\begin{bmatrix} K_{ff} & K_{fs} \\ K_{sf} & K_{ss} \end{bmatrix} \begin{Bmatrix} u_f \\ u_s \end{Bmatrix} = \begin{Bmatrix} F_f \\ R_s \end{Bmatrix}, \quad u_s = 0 \;\Rightarrow\; K_{ff}\, u_f = F_f
```

### 5.5 Solving

Solve K\_ff u\_f = F\_f by Gaussian elimination with partial pivoting, recording each step (pivot choice, row swap, each row operation as "R₃ ← R₃ − (m)·R₁", the matrix after each step, then back substitution). For systems larger than 6×6, show a condensed trace with an expand option.

### 5.6 Reactions, strain, stress

```latex
\{R\} = [K]\{u\} - \{F\} \quad (\text{non-zero only at constrained DOFs})
```

```latex
\delta = \begin{bmatrix} -C_x & -C_y & -C_z & C_x & C_y & C_z \end{bmatrix} \{d\}^{(e)}, \quad \varepsilon = \frac{\delta}{L}, \quad \sigma = E\varepsilon, \quad N = \sigma A
```

State: tension if σ > tol, compression if σ < −tol, zero-force otherwise, with tol = 1e-9 × max|σ|. Also run an equilibrium check: ΣF + ΣR ≈ 0 in every direction, and show it.

## 6. Step-by-step learning flow

The app is a sequence of seven stages. Each stage has three parts: a short plain-language "What's happening" paragraph (2–4 sentences), the governing equation(s), and the live numbers for the current model. Every stage must show the diagram of the structure with whatever is relevant highlighted.

1. **Stage 1 — Problem definition.** Diagram with node numbers, element numbers (in circles), support symbols (pin triangle, roller with wheels, 3D fixed ball), load arrows with values, and DOF arrows at every node labeled with global DOF numbers (d1, d2, …). Tables: node coordinates; element connectivity (element, node i, node j, E, A); supports; loads. A DOF table showing node → DOF numbers and whether each is free or fixed. Show the count: total DOFs, constrained DOFs, free DOFs.
2. **Stage 2 — Element geometry.** Per element table: Δx, Δy, (Δz), L, θ (2D), Cx, Cy, (Cz), EA/L. Clicking a row highlights that element in the diagram and draws its local x′ axis arrow.
3. **Stage 3 — Element stiffness matrices.** Element selector (tabs or dropdown). For the selected element: k′ (local), T, the product Tᵀk′T worked out, and the resulting k in global coordinates. Rows and columns labeled with that element's global DOF numbers. A toggle shows the symbolic form (c², cs, …) next to the numeric form. A note explains why k is symmetric and singular.
4. **Stage 4 — Global assembly.** Show the empty n×n global K, then let the user step through elements one at a time ("Add element 1", "Add element 2", …, plus "Add all"). Each step color-codes cells by contributing element; cells with multiple contributors get a striped or multi-dot marker. Hovering any K cell shows a tooltip like "K₅₅ = 17.07 (e2) + 17.07 (e3) = 34.14 MN/m". End with the complete K and the full system \[K\]{u} = {F} written out with unknowns marked.
5. **Stage 5 — Boundary conditions and reduced system.** Show K with constrained rows/columns struck through or greyed (animate the elimination on click). List each constraint with its reason ("node 2 is a roller → u₄ = 0"). Display reduced K\_ff and F\_f, and explain why displacements are found from these rows and reactions from the eliminated rows.
6. **Stage 6 — Solving for displacements.** Show \[K\_ff\]{u\_f} = {F\_f}, then the Gaussian elimination trace with a "Next step / Previous step" stepper through each row operation, then back substitution. Final table: every DOF with its value in mm (fixed ones shown as 0 with a lock icon). Deformed shape overlaid on the original with an adjustable magnification slider (default auto-scaled so the max displacement is about 10% of the structure size), with the scale factor printed.
7. **Stage 7 — Reactions, strains, stresses.** Reactions: show R = Ku − F row by row for each constrained DOF, then a table in kN with arrows drawn on the diagram. Equilibrium check table (ΣFx, ΣFy, ΣFz all ≈ 0). Per element: the displacement vector d⁽ᵉ⁾ extracted from u, δ, ε, σ (MPa), N (kN), and a Tension/Compression/Zero badge. Color the diagram: tension blue, compression red, zero grey, with line thickness scaled to |N|. A final summary card lists max displacement, max tensile and compressive stress, and which element carries them.

**Navigation:** a progress bar/stepper at the top with the 7 stage names (clickable), Previous/Next buttons, and keyboard ← / → support. Users can jump to any stage at any time. The current stage is reflected in the URL hash (e.g. `#stage-4`) so it can be linked.

## 7. Visualization and UI requirements

The interface should feel like a clean engineering textbook brought to life: calm, legible, and consistent. If a frontend-design skill is installed in Claude Code, follow it before writing UI code.

**Layout (desktop ≥ 1024 px):** left sidebar with preset selector and editable inputs; top stage stepper; main area split into a diagram panel (left, about 40%) and an explanation/math panel (right). On narrow screens, stack these vertically. No horizontal page scroll; wide matrices scroll inside their own container.

**Diagrams:**

- 2D: SVG, auto-fit to the structure with padding, y-axis pointing up, a small x-y axis triad, grid optional.
- 3D: rotatable view (mouse drag, touch drag), with an x-y-z triad, a "Reset view" button, and preset views (isometric, front, top). Node and element labels stay readable while rotating.
- Shared conventions everywhere: node circles with numbers, element numbers in small circles at midspan, loads as arrows labeled in kN, reactions as arrows of a different color, DOF arrows labeled with global numbers.
- Linked highlighting: hovering an element anywhere (diagram, table row, matrix tab) highlights it everywhere. Hovering a K cell highlights the element(s) contributing to it.

**Matrices:**

- Render as real bracketed matrices with row and column headers showing global DOF numbers.
- Display stiffness in MN/m with 4 significant figures and show the common factor where helpful (e.g. "× 10⁶ N/m").
- Free vs constrained DOFs use a consistent color across all stages.
- A "Copy as CSV" button under each matrix (students can check in Excel/MATLAB).

**Units:** a units toggle for display only (SI: kN, mm, MPa; optionally N, m, Pa). Internal math stays in SI base units.

**Accessibility and polish:** light and dark mode, text at least 15 px, color never the only signal (also use labels/patterns for tension vs compression), visible focus states, and tooltips with a short glossary for terms like DOF, stiffness, direction cosine, singular matrix.

**Extras that raise the education score (do these after the core works):**

- A "Check yourself" box per stage: a question with a reveal button, generated from the current numbers (e.g. "What is k₁₂ for element 2?" with the answer revealed). Templates only, no AI.
- A "Print / export solution" button that produces a clean printable page of all stages for the current model (browser print with a print stylesheet).
- An About/Help modal summarizing the method and how to use the tool.

## 8. Verification and testing

The math core is not done until it reproduces these reference results, which were computed independently and checked against hand statics. Tolerance: 0.1% relative (or 1e-9 absolute for zeros).

**Preset 1 (2D triangle) — full reference, use as the primary test:**

Reduced system over free DOFs (u2x, u3x, u3y), in MN/m:

```latex
\begin{bmatrix} 67.0677 & -17.0677 & 25.6015 \\ -17.0677 & 34.1354 & 0 \\ 25.6015 & 0 & 76.8046 \end{bmatrix} \begin{Bmatrix} u_{2x} \\ u_{3x} \\ u_{3y} \end{Bmatrix} = \begin{Bmatrix} 0 \\ 10 \\ -20 \end{Bmatrix} \text{ kN}
```

| Quantity | Value |
| --- | --- |
| u2x | 0.233333 mm |
| u3x | 0.409618 mm |
| u3y | −0.338179 mm |
| R1x, R1y | −10.000 kN, +2.500 kN |
| R2y | +17.500 kN |
| Element 1 (1→2) | L = 4.0000 m, σ = +11.667 MPa, N = +11.667 kN, tension |
| Element 2 (2→3) | L = 3.6056 m, σ = −21.032 MPa, N = −21.032 kN, compression |
| Element 3 (1→3) | L = 3.6056 m, σ = −3.0046 MPa, N = −3.0046 kN, compression |

**Preset 2 (2D braced panel):** u2x = 0, u3x = 1.015685 mm, u3y = −0.450000 mm, u4x = 1.315685 mm, u4y = 0. Reactions R1x = −20 kN, R1y = −20 kN, R2y = +30 kN. Stresses (MPa): e1 0 (zero-force), e2 −30.000, e3 −20.000, e4 0 (zero-force), e5 +18.856 (N = +28.284 kN).

**Preset 3 (3D tripod):** u1 = (2.352211, 1.239443, −3.035269) mm. Reactions (kN): node 2 (−16.6667, 0, +16.6667), node 3 (+5.0, −7.5, +10.0), node 4 (+1.6667, +2.5, +3.3333). Stresses (MPa): e1 −47.140, e2 −26.926, e3 −8.9753; all compression.

**Preset 4 (3D pyramid):** u1 = (0, 0.219040, −0.389404) mm. Stresses (MPa): e1 and e2 −18.898; e3 and e4 −8.5898; all compression. Reactions (kN): node 2 (−9.1667, −9.1667, +13.75), node 3 (+9.1667, −9.1667, +13.75), node 4 (+4.1667, +4.1667, +6.25), node 5 (−4.1667, +4.1667, +6.25).

**Preset 5 (instructor test case, Logan Ex. 3.9) — the acceptance test.** The app must match the exact column to 0.1%:

| Quantity | Exact (app must show) | Textbook printed |
| --- | --- | --- |
| L1, L2, L3 | 13.000, 3.000, 10.050 m | 13, 3, 10.05 m |
| Cosines, element 1 | (−0.9231, 0.2308, 0.3077) | (−12/13, 3/13, 4/13) |
| Cosines, element 2 | (0, 0, −1) | (0, 0, −1) |
| Cosines, element 3 | (0.1990, 0.8955, 0.3980) | (2, 9, 4)/10.05 |
| K\_ff row 1 | 14 591.8, 282.9, −2 933.0 kN/m | 210 × (69.519, 1.327, −13.985) kN/m |
| K\_ff row 2 | 282.9, 17 618.3, 8 595.0 kN/m | 210 × (1.327, 83.879, 40.885) kN/m |
| K\_ff row 3 | −2 933.0, 8 595.0, 74 839.6 kN/m | 210 × (−13.985, 40.885, 356.363) kN/m |
| d1x | 1.3837 × 10⁻³ m | 1.383 × 10⁻³ m |
| d1y | −5.157 × 10⁻⁵ m | −5.119 × 10⁻⁵ m |
| d1z | 6.015 × 10⁻⁵ m | 6.015 × 10⁻⁵ m |
| σ1 | +20.526 MPa, tension | 20.51 MPa |
| σ2 | +4.2105 MPa, tension | 4.21 MPa |
| σ3 | −5.2894 MPa, compression | −5.29 MPa |
| Reactions (kN) | node 2 (−18.947, +4.737, +6.316); node 3 (0, 0, −4.211); node 4 (−1.053, −4.737, −2.105) | not given |

The small gaps are the book's rounding, not errors in the app. The book rounds the direction-cosine products to 3 decimals before assembling, which shifts K by up to about 0.2% and d1y by about 0.7%. Tests compare against the exact column at 0.1% and the textbook column at 1%.

The printed λ⁽³⁾ also has a typo: row 2, column 1 reads 0.128, but symmetry requires 0.178. For this preset, Stages 6 and 7 should show a small "Compare with textbook" panel listing both columns and this explanation, so a grader can see the agreement at a glance.

**Required tests (`tests/fem.test.js`, run with `node tests/fem.test.js`, no test framework needed):**

- All five presets match the values above (Preset 5 against the exact column).
- Every element k and the global K are symmetric; each element k has zero row sums (rigid-body check).
- Closed-form k equals Tᵀk′T for random orientations.
- Equilibrium: ΣF + ΣR = 0 for every preset.
- Determinism: running solve() twice gives bit-identical output.
- Mechanism detection: removing the roller from Preset 1 produces a clear "singular system" result, not NaN.
- Scaling: doubling every E halves every displacement and leaves stresses unchanged for the determinate presets.

Also do a manual browser pass: every stage renders for all five presets, edits propagate, 3D rotation works, no console errors. Finally, grep the file for `fetch(`, `XMLHttpRequest`, `anthropic` and `openai` to confirm there are no network or AI calls.

## 9. Submission deliverables

The assignment requires five items. Have Claude Code create the first four in the repo; you write the fifth yourself so it is honest.

| Deliverable | What to produce | Where |
| --- | --- | --- |
| Working product | `index.html` hosted on GitHub Pages; link in README | repo root |
| User guide | 1–2 pages: how to open the tool, choose a preset, edit inputs, navigate stages, read each stage; screenshots of each stage | `USER_GUIDE.md` (export to PDF) |
| Demonstration example | Preset 5 (the instructor's Logan Ex. 3.9 test case) walked through all 7 stages with the numbers from Section 8, plus Preset 1 as a 2D walkthrough, as a document with screenshots; also reachable in-app via "Guided demo" mode that auto-loads Preset 5 and starts at Stage 1 | `DEMO_EXAMPLE.md` (export to PDF) |
| Source files | The repo: `index.html`, `tests/`, `SPEC.md`, `README.md` | GitHub repo / zip |
| AI usage disclosure | Your own short statement (see below) | `AI_DISCLOSURE.md` |

**AI disclosure template (edit to match what you actually did):** "Claude (Anthropic) was used during development. Claude in claude.ai helped draft the specification document. Claude Code generated most of the HTML/JavaScript from that specification. I verified the solver against hand calculations and independent reference results, reviewed the explanations for correctness, and tested the interface. The finished tool runs entirely in the browser and performs all calculations with its own JavaScript code; it makes no calls to any AI service or external API."

Before submitting, solve Preset 1 by hand yourself at least once. You may be asked to explain any step, and knowing the method is the actual point of the assignment.

## 10. Phased build plan and prompts

Build in five phases. Paste each prompt into Claude Code in plan mode, approve the plan, and only move on when the phase checklist passes.

**Phase 1 — Math core and tests**

```text
Read SPEC.md fully. Implement Phase 1 only: the pure FEM core (Sections 3 and 5) and the five presets (Section 4) as plain JS with no DOM code, plus tests/fem.test.js covering every item in Section 8. The core must record all intermediate quantities, including assembly contributions per K entry and every Gaussian elimination step. Run the tests with node and fix until all pass. Do not build any UI yet. Show me the test output.
```

- [ ] All Section 8 reference values match
- [ ] Symmetry, equilibrium, determinism, and singular-system tests pass

**Phase 2 — Shell, navigation, Stage 1**

```text
Phase 2: create index.html containing the Phase 1 core inline. Build the layout from SPEC.md Section 7, the preset selector, the editable E/A/load inputs with validation, the 7-stage stepper with Previous/Next, keyboard arrows and URL hash, and Stage 1 fully (2D SVG diagram with nodes, elements, supports, loads, DOF arrows, plus all Stage 1 tables). Use a placeholder for later stages. Keep the core and UI separated as in Section 3.
```

- [ ] Both 2D presets draw correctly, edits re-solve live, stepper works

**Phase 3 — 3D view and Stages 2–4**

```text
Phase 3: add the rotatable 3D view (Section 7) and Stages 2, 3 and 4 exactly as described in SPEC.md Section 6, including the Tᵀk′T worked product, the symbolic/numeric toggle, step-by-step assembly with color coding and cell tooltips showing contributions, and linked highlighting between diagram, tables and matrices. Render equations with KaTeX from a pinned cdnjs URL with an HTML-table fallback.
```

- [ ] 3D presets rotate and label correctly
- [ ] K cell tooltips show correct sums (spot-check K₅₅ for Preset 1 = 34.14 MN/m)

**Phase 4 — Stages 5–7**

```text
Phase 4: implement Stages 5, 6 and 7 per SPEC.md Section 6: BC elimination with animation, reduced system, Gaussian elimination stepper and back substitution, displacement table and deformed shape with magnification slider, reactions via R = Ku − F row by row, equilibrium check, element strain/stress/force with tension/compression badges and colored diagram, and the summary card. Verify on screen that Presets 1 and 5 show exactly the Section 8 values, and add the Compare with textbook panel for Preset 5.
```

- [ ] Every stage works for all five presets
- [ ] Removing a support shows the singular-system message, not NaN

**Phase 5 — Polish and deliverables**

```text
Phase 5: polish per SPEC.md Section 7 (dark mode, accessibility, glossary tooltips, Check-yourself boxes, print stylesheet, Help modal, Guided demo mode). Then write README.md, USER_GUIDE.md and DEMO_EXAMPLE.md per Section 9, with screenshot placeholders I will fill in. Finally run the tests again and grep index.html for fetch(, XMLHttpRequest, anthropic and openai and report the result.
```

- [ ] Tests still pass; grep finds no network or AI calls
- [ ] Hosted on GitHub Pages and the link works in a private browser window

**Final acceptance check against the grading rubric:** walk through Preset 5 (the instructor's test case) as if you were the grader, and confirm each rubric row in Section 2 is visibly answered on screen, with equations, matrices and units shown, before submitting.
