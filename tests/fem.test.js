// Run with: node tests/fem.test.js
const FEM = require("./fem-core.js");

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else { fail++; console.log("  FAIL", name, detail || ""); }
}
// relative tolerance, with an absolute floor for expected zeros
function near(name, actual, expected, rel = 1e-3, abs = 1e-9) {
  const ok = Math.abs(actual - expected) <= Math.max(rel * Math.abs(expected), abs);
  check(name, ok, `got ${actual}, expected ${expected}`);
}
function section(t) { console.log(t); }

const run = (id) => FEM.solve(FEM.getPreset(id));
const dofVal = (r, node, axis) => r.u[r.dim * (node - 1) + axis];
const reac = (r, node, axis) => r.R[r.dim * (node - 1) + axis];
const MM = 1e3, KN = 1e-3, MPA = 1e-6, MNM = 1e-6;

// ---------------------------------------------------------------- Preset 1
section("Preset 1: 2D triangle");
{
  const r = run("2d-triangle");
  check("state ok", r.state === "ok");
  check("free dofs", JSON.stringify(r.freeDofs) === "[3,5,6]", JSON.stringify(r.freeDofs));
  const ref = [[67.0677, -17.0677, 25.6015], [-17.0677, 34.1354, 0], [25.6015, 0, 76.8046]];
  ref.forEach((row, i) => row.forEach((v, j) => near(`Kff[${i}][${j}]`, r.Kff[i][j] * MNM, v, 1e-3, 1e-6)));
  near("K55 = 34.1354", r.K[4][4] * MNM, 34.1354);
  near("u2x", dofVal(r, 2, 0) * MM, 0.233333);
  near("u3x", dofVal(r, 3, 0) * MM, 0.409618);
  near("u3y", dofVal(r, 3, 1) * MM, -0.338179);
  near("R1x", reac(r, 1, 0) * KN, -10); near("R1y", reac(r, 1, 1) * KN, 2.5); near("R2y", reac(r, 2, 1) * KN, 17.5);
  near("L1", r.elements[0].L, 4); near("L2", r.elements[1].L, 3.6056, 1e-4); near("L3", r.elements[2].L, 3.6056, 1e-4);
  near("sigma1", r.members[0].stress * MPA, 11.667); near("N1", r.members[0].N * KN, 11.667);
  near("sigma2", r.members[1].stress * MPA, -21.032); near("N2", r.members[1].N * KN, -21.032);
  near("sigma3", r.members[2].stress * MPA, -3.0046); near("N3", r.members[2].N * KN, -3.0046);
  check("states", r.members.map((m) => m.state).join() === "tension,compression,compression");
}

// ---------------------------------------------------------------- Preset 2
section("Preset 2: 2D braced panel");
{
  const r = run("2d-braced-panel");
  near("u2x", dofVal(r, 2, 0) * MM, 0);
  near("u3x", dofVal(r, 3, 0) * MM, 1.015685); near("u3y", dofVal(r, 3, 1) * MM, -0.45);
  near("u4x", dofVal(r, 4, 0) * MM, 1.315685); near("u4y", dofVal(r, 4, 1) * MM, 0);
  near("R1x", reac(r, 1, 0) * KN, -20); near("R1y", reac(r, 1, 1) * KN, -20); near("R2y", reac(r, 2, 1) * KN, 30);
  [0, -30, -20, 0, 18.856].forEach((s, i) => near(`sigma${i + 1}`, r.members[i].stress * MPA, s, 1e-3, 1e-6));
  near("N5", r.members[4].N * KN, 28.284);
  check("zero-force e1,e4", r.members[0].state === "zero" && r.members[3].state === "zero");
}

// ---------------------------------------------------------------- Preset 3
section("Preset 3: 3D tripod");
{
  const r = run("3d-tripod");
  near("u1x", dofVal(r, 1, 0) * MM, 2.352211); near("u1y", dofVal(r, 1, 1) * MM, 1.239443); near("u1z", dofVal(r, 1, 2) * MM, -3.035269);
  const R = { 2: [-16.6667, 0, 16.6667], 3: [5, -7.5, 10], 4: [1.6667, 2.5, 3.3333] };
  for (const n in R) R[n].forEach((v, d) => near(`R node${n}[${d}]`, reac(r, +n, d) * KN, v, 1e-3, 1e-6));
  [-47.14, -26.926, -8.9753].forEach((s, i) => near(`sigma${i + 1}`, r.members[i].stress * MPA, s));
  check("all compression", r.members.every((m) => m.state === "compression"));
}

// ---------------------------------------------------------------- Preset 4
section("Preset 4: 3D pyramid");
{
  const r = run("3d-pyramid");
  near("u1x", dofVal(r, 1, 0) * MM, 0); near("u1y", dofVal(r, 1, 1) * MM, 0.21904); near("u1z", dofVal(r, 1, 2) * MM, -0.389404);
  [-18.898, -18.898, -8.5898, -8.5898].forEach((s, i) => near(`sigma${i + 1}`, r.members[i].stress * MPA, s));
  const R = { 2: [-9.1667, -9.1667, 13.75], 3: [9.1667, -9.1667, 13.75], 4: [4.1667, 4.1667, 6.25], 5: [-4.1667, 4.1667, 6.25] };
  for (const n in R) R[n].forEach((v, d) => near(`R node${n}[${d}]`, reac(r, +n, d) * KN, v, 1e-3, 1e-6));
  check("all compression", r.members.every((m) => m.state === "compression"));
}

// ---------------------------------------------------------------- Preset 5
section("Preset 5: Logan Ex. 3.9 (acceptance)");
{
  const r = run("logan-3-9");
  check("default preset", FEM.DEFAULT_PRESET_ID === "logan-3-9" && FEM.PRESETS[0].id === "logan-3-9");
  [13, 3, 10.05].forEach((L, i) => near(`L${i + 1}`, r.elements[i].L, L, 1e-3));
  near("L3 exact", r.elements[2].L, Math.sqrt(101), 1e-12);
  const cos = [[-0.9231, 0.2308, 0.3077], [0, 0, -1], [0.199, 0.8955, 0.398]];
  cos.forEach((c, i) => {
    const e = r.elements[i];
    [e.cx, e.cy, e.cz].forEach((v, d) => near(`cos e${i + 1}[${d}]`, v, c[d], 1e-3, 1e-4));
  });
  const kref = [[14591.8, 282.9, -2933.0], [282.9, 17618.3, 8595.0], [-2933.0, 8595.0, 74839.6]];
  const kbook = [[69.519, 1.327, -13.985], [1.327, 83.879, 40.885], [-13.985, 40.885, 356.363]].map((row) => row.map((v) => v * 210));
  kref.forEach((row, i) => row.forEach((v, j) => {
    near(`Kff exact [${i}][${j}] kN/m`, r.Kff[i][j] * KN, v, 1e-3, 0.1);
    near(`Kff book [${i}][${j}] kN/m`, r.Kff[i][j] * KN, kbook[i][j], 1e-2, 5e-4 * 74839.6); // book rounds products to 3 dp; small entries differ by >1%
  }));
  near("d1x", r.u[0], 1.3837e-3); near("d1y", r.u[1], -5.157e-5); near("d1z", r.u[2], 6.015e-5);
  near("d1x book", r.u[0], 1.383e-3, 1e-2); near("d1y book", r.u[1], -5.119e-5, 1e-2); near("d1z book", r.u[2], 6.015e-5, 1e-2);
  [20.526, 4.2105, -5.2894].forEach((s, i) => near(`sigma${i + 1}`, r.members[i].stress * MPA, s));
  [20.51, 4.21, -5.29].forEach((s, i) => near(`sigma${i + 1} book`, r.members[i].stress * MPA, s, 1e-2));
  check("states", r.members.map((m) => m.state).join() === "tension,tension,compression");
  const R = { 2: [-18.947, 4.737, 6.316], 3: [0, 0, -4.211], 4: [-1.053, -4.737, -2.105] };
  for (const n in R) R[n].forEach((v, d) => near(`R node${n}[${d}]`, reac(r, +n, d) * KN, v, 1e-3, 1e-3));
}

// ---------------------------------------------------------- structural checks
section("Symmetry, rigid-body, closed form vs triple product, equilibrium, determinism");
const ids = FEM.PRESETS.map((p) => p.id);
for (const id of ids) {
  const r = run(id);
  check(`${id} ok`, r.state === "ok");
  const sym = (M, tol) => M.every((row, i) => row.every((v, j) => Math.abs(v - M[j][i]) <= tol * Math.max(1, Math.abs(v))));
  check(`${id} K symmetric`, sym(r.K, 1e-12));
  for (const e of r.elements) {
    check(`${id} e${e.id} k symmetric`, sym(e.kGlobal, 1e-12));
    const scale = e.EAoverL;
    check(`${id} e${e.id} zero row sums`, e.kGlobal.every((row) => Math.abs(row.reduce((a, b) => a + b, 0)) < 1e-9 * scale));
    check(`${id} e${e.id} closed form == T'kT`, e.selfCheck.ok, e.selfCheck.maxRelDiff);
  }
  check(`${id} equilibrium`, r.equilibrium.ok, JSON.stringify(r.equilibrium.total));
  const a = JSON.stringify(FEM.solve(FEM.getPreset(id))), b = JSON.stringify(FEM.solve(FEM.getPreset(id)));
  check(`${id} deterministic`, a === b);
  // contribution records sum to K
  const p = r.nDof;
  let okC = true;
  for (let i = 0; i < p; i++) for (let j = 0; j < p; j++)
    if (Math.abs(r.contributions[i][j].reduce((s, c) => s + c.value, 0) - r.K[i][j]) > 1e-9 * Math.max(1, Math.abs(r.K[i][j]))) okC = false;
  check(`${id} contributions sum to K`, okC);
  check(`${id} elimination steps recorded`, r.elimination.steps.some((s) => s.type === "back"));
}

// random orientations (seeded LCG, so the test itself is deterministic)
{
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let t = 0; t < 50; t++) {
    const dim = t % 2 ? 3 : 2;
    const m = {
      dim, nodes: [{ id: 1, x: rnd() * 10 - 5, y: rnd() * 10 - 5, z: dim === 3 ? rnd() * 10 - 5 : 0 },
                   { id: 2, x: rnd() * 10 - 5, y: rnd() * 10 - 5, z: dim === 3 ? rnd() * 10 - 5 : 0 }],
      elements: [{ id: 1, n1: 1, n2: 2, E: 1e11 + rnd() * 1e11, A: 1e-3 }],
    };
    const e = FEM.elementData(m, m.elements[0], new Map([[1, 0], [2, 1]]));
    check(`random orientation ${t}`, e.selfCheck.ok, e.selfCheck.maxRelDiff);
  }
}

// ----------------------------------------------------------- mechanism
section("Mechanism detection");
{
  const m = FEM.getPreset("2d-triangle");
  m.supports = [m.supports[0]]; // remove the roller
  const r = FEM.solve(m);
  check("state singular", r.state === "singular");
  check("message present", /singular/i.test(r.message));
  check("no NaN in result", !JSON.stringify(r).includes("null") || r.u === null);
  check("u not computed", r.u === null);
}

// ----------------------------------------------------------- scaling
section("Scaling (double E)");
for (const id of ["2d-triangle", "3d-tripod", "logan-3-9"]) {
  const base = run(id), m = FEM.getPreset(id);
  m.elements.forEach((e) => (e.E *= 2));
  const r = FEM.solve(m);
  base.u.forEach((v, i) => near(`${id} u[${i}] halves`, r.u[i], v / 2, 1e-9, 1e-15));
  base.members.forEach((s, i) => near(`${id} stress[${i}] same`, r.members[i].stress, s.stress, 1e-9, 1e-3));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
