# FEM Truss Tutor

Read SPEC.md before starting any phase. Build in the phases from SPEC.md Section 10.

## Rules
- The product is ONE self-contained `index.html` (plus a `tests/` folder). No build step, no npm runtime dependencies.
- The running app must never call an AI service, LLM, or any network API. All math is deterministic JavaScript.
- Every numeric result must be verified against the reference solutions in SPEC.md Section 8 before a phase is considered done.
- The FEM core is pure (`solve(model) -> result`, no DOM). The UI only reads `result`.
- Core lives in `tests/fem-core.js` (UMD: `window.FEM` in browser, `module.exports` in Node); inline it into index.html in Phase 2.
