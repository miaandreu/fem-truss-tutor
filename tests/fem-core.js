/* FEM core for the truss tutor: pure, deterministic, no DOM, no network.
 * Browser: window.FEM.  Node: module.exports.
 * Conventions: SI units (N, m, Pa). Matrices are 0-indexed arrays; every dofMap
 * and every DOF number shown to users is 1-based (node i owns dim*(i-1)+1 .. dim*i).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FEM = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ------------------------------------------------------------------ PRESETS
  const GPA = 1e9, MM2 = 1e-6, KN = 1e3;
  const bars = (list, E, A) => list.map(([n1, n2], i) => ({ id: i + 1, n1, n2, E, A }));
  const node = (id, x, y, z) => ({ id, x, y, z: z || 0 });
  const pin2 = (n) => ({ node: n, fix: [true, true, false] });
  const fix3 = (n) => ({ node: n, fix: [true, true, true] });

  const PRESETS = [
    {
      id: "logan-3-9",
      title: "Instructor test case (Logan Ex. 3.9)",
      dim: 3,
      description: "Space truss with three bars meeting at node 1, which carries a 20 kN load in +x. Nodes 2, 3 and 4 are pinned in x, y and z.",
      nodes: [node(1, 12, -3, -4), node(2, 0, 0, 0), node(3, 12, -3, -7), node(4, 14, 6, 0)],
      elements: bars([[1, 2], [1, 3], [1, 4]], 210 * GPA, 1000 * MM2),
      supports: [fix3(2), fix3(3), fix3(4)],
      loads: [{ node: 1, F: [20 * KN, 0, 0] }],
    },
    {
      id: "2d-triangle",
      title: "2D three-bar triangular truss",
      dim: 2,
      description: "Triangle with a pin at node 1 and a roller at node 2. Node 3 carries 10 kN in +x and 20 kN down.",
      nodes: [node(1, 0, 0), node(2, 4, 0), node(3, 2, 3)],
      elements: bars([[1, 2], [2, 3], [1, 3]], 200 * GPA, 1000 * MM2),
      supports: [pin2(1), { node: 2, fix: [false, true, false] }],
      loads: [{ node: 3, F: [10 * KN, -20 * KN, 0] }],
    },
    {
      id: "2d-braced-panel",
      title: "2D braced square panel",
      dim: 2,
      description: "Square panel with a diagonal. Pin at node 1, roller at node 2. Elements 1 and 4 turn out to be zero-force members.",
      nodes: [node(1, 0, 0), node(2, 3, 0), node(3, 3, 3), node(4, 0, 3)],
      elements: bars([[1, 2], [2, 3], [3, 4], [4, 1], [1, 3]], 200 * GPA, 1000 * MM2)
        .map((e) => (e.id === 5 ? Object.assign(e, { A: 1500 * MM2 }) : e)),
      supports: [pin2(1), { node: 2, fix: [false, true, false] }],
      loads: [{ node: 4, F: [20 * KN, 0, 0] }, { node: 3, F: [0, -10 * KN, 0] }],
    },
    {
      id: "3d-tripod",
      title: "3D tripod",
      dim: 3,
      description: "Aluminum tripod: apex node 1 loaded by (10, 5, -30) kN, legs ending in ball joints at nodes 2, 3, 4. Statically determinate.",
      nodes: [node(1, 0, 0, 4), node(2, 4, 0, 0), node(3, -2, 3, 0), node(4, -2, -3, 0)],
      elements: bars([[1, 2], [1, 3], [1, 4]], 70 * GPA, 500 * MM2),
      supports: [fix3(2), fix3(3), fix3(4)],
      loads: [{ node: 1, F: [10 * KN, 5 * KN, -30 * KN] }],
    },
    {
      id: "3d-pyramid",
      title: "3D four-legged pyramid",
      dim: 3,
      description: "Four bars meet at the apex but there are only three equilibrium equations there, so the structure is statically indeterminate.",
      nodes: [node(1, 0, 0, 3), node(2, 2, 2, 0), node(3, -2, 2, 0), node(4, -2, -2, 0), node(5, 2, -2, 0)],
      elements: bars([[1, 2], [1, 3], [1, 4], [1, 5]], 200 * GPA, 1000 * MM2),
      supports: [fix3(2), fix3(3), fix3(4), fix3(5)],
      loads: [{ node: 1, F: [0, 10 * KN, -40 * KN] }],
    },
  ];
  const DEFAULT_PRESET_ID = "logan-3-9";
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const getPreset = (id) => clone(PRESETS.find((p) => p.id === id));

  // ------------------------------------------------------------------ helpers
  const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
  const copyM = (M) => M.map((row) => row.slice());
  const matMul = (A, B) => {
    const C = zeros(A.length, B[0].length);
    for (let i = 0; i < A.length; i++)
      for (let k = 0; k < B.length; k++)
        for (let j = 0; j < B[0].length; j++) C[i][j] += A[i][k] * B[k][j];
    return C;
  };
  const transpose = (A) => A[0].map((_, j) => A.map((row) => row[j]));
  const maxAbs = (M) => M.reduce((m, row) => row.reduce((a, v) => Math.max(a, Math.abs(v)), m), 0);

  // ------------------------------------------------------------ element level
  function elementData(model, el, nodeIdx) {
    const dim = model.dim;
    const ni = model.nodes[nodeIdx.get(el.n1)], nj = model.nodes[nodeIdx.get(el.n2)];
    const dx = nj.x - ni.x, dy = nj.y - ni.y, dz = dim === 3 ? nj.z - ni.z : 0;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const cx = dx / L, cy = dy / L, cz = dz / L;
    const EA = el.E * el.A, EAoverL = EA / L;
    const kLocal = [[EAoverL, -EAoverL], [-EAoverL, EAoverL]];
    const kUnit = [[1, -1], [-1, 1]]; // k' = (EA/L) * kUnit
    const dir = dim === 3 ? [cx, cy, cz] : [cx, cy];
    const T = [dir.concat(new Array(dim).fill(0)), new Array(dim).fill(0).concat(dir)];
    const kLocalT = matMul(kLocal, T);          // k' T
    const kTriple = matMul(transpose(T), kLocalT); // T^T k' T

    // closed form: (EA/L) [[lam, -lam], [-lam, lam]]
    const lam = zeros(dim, dim);
    for (let a = 0; a < dim; a++) for (let b = 0; b < dim; b++) lam[a][b] = dir[a] * dir[b];
    const kGlobal = zeros(2 * dim, 2 * dim);
    for (let a = 0; a < dim; a++)
      for (let b = 0; b < dim; b++) {
        kGlobal[a][b] = EAoverL * lam[a][b];
        kGlobal[a + dim][b + dim] = EAoverL * lam[a][b];
        kGlobal[a][b + dim] = -EAoverL * lam[a][b];
        kGlobal[a + dim][b] = -EAoverL * lam[a][b];
      }
    const scale = maxAbs(kGlobal) || 1;
    let diff = 0;
    for (let a = 0; a < 2 * dim; a++) for (let b = 0; b < 2 * dim; b++) diff = Math.max(diff, Math.abs(kGlobal[a][b] - kTriple[a][b]));
    const selfCheck = { maxRelDiff: diff / scale, ok: diff / scale < 1e-9 };

    const dofMap = [];
    for (const n of [el.n1, el.n2]) for (let d = 0; d < dim; d++) dofMap.push(dim * nodeIdx.get(n) + d + 1);

    return {
      id: el.id, n1: el.n1, n2: el.n2, E: el.E, A: el.A,
      dx, dy, dz, L, cx, cy, cz,
      theta: dim === 2 ? Math.atan2(dy, dx) : null, // rad, CCW from +x
      thetaDeg: dim === 2 ? (Math.atan2(dy, dx) * 180) / Math.PI : null,
      EA, EAoverL,
      lambda: lam,
      lambdaProducts: { cx2: cx * cx, cxcy: cx * cy, cxcz: cx * cz, cy2: cy * cy, cycz: cy * cz, cz2: cz * cz },
      kLocal, T, kLocalT, kTriple, kGlobal, selfCheck, dofMap,
    };
  }

  // -------------------------------------------------------- Gaussian elimination
  // Augmented-matrix elimination with partial pivoting; records every step.
  // Returns { ok, x, steps, singular }.  Each step carries a snapshot of [A|b].
  function gaussSolve(A, b, tol) {
    const n = A.length;
    const M = A.map((row, i) => row.concat([b[i]]));
    const steps = [];
    const snap = () => copyM(M);
    steps.push({ type: "start", matrix: snap() });
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      const pivot = M[p][k];
      if (Math.abs(pivot) < tol) {
        steps.push({ type: "singular", col: k, pivot, matrix: snap() });
        return { ok: false, x: null, steps, singular: { col: k, pivot, tol } };
      }
      if (p !== k) {
        [M[p], M[k]] = [M[k], M[p]];
        steps.push({ type: "swap", col: k, rowA: k, rowB: p, pivot: M[k][k], matrix: snap() });
      } else {
        steps.push({ type: "pivot", col: k, row: k, pivot, matrix: snap() });
      }
      for (let i = k + 1; i < n; i++) {
        const m = M[i][k] / M[k][k];
        if (m === 0) continue;
        for (let j = k; j <= n; j++) M[i][j] -= m * M[k][j];
        M[i][k] = 0;
        steps.push({ type: "eliminate", col: k, row: i, pivotRow: k, multiplier: m, matrix: snap() });
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = M[i][n], terms = [];
      for (let j = i + 1; j < n; j++) { s -= M[i][j] * x[j]; terms.push({ j, coeff: M[i][j], xj: x[j] }); }
      x[i] = s / M[i][i];
      steps.push({ type: "back", row: i, diag: M[i][i], rhs: M[i][n], terms, value: x[i] });
    }
    return { ok: true, x, steps, singular: null };
  }

  // -------------------------------------------------------------------- solve
  function solve(model) {
    const dim = model.dim;
    if (dim !== 2 && dim !== 3) throw new Error("model.dim must be 2 or 3");
    const nN = model.nodes.length, nDof = nN * dim;
    const nodeIdx = new Map(model.nodes.map((n, i) => [n.id, i]));
    const elements = model.elements.map((e) => elementData(model, e, nodeIdx));

    // assembly with per-entry contribution records
    const K = zeros(nDof, nDof);
    const contributions = Array.from({ length: nDof }, () => Array.from({ length: nDof }, () => []));
    const assemblySteps = [];
    for (const e of elements) {
      const touched = [];
      for (let a = 0; a < 2 * dim; a++)
        for (let b = 0; b < 2 * dim; b++) {
          const p = e.dofMap[a] - 1, q = e.dofMap[b] - 1, v = e.kGlobal[a][b];
          K[p][q] += v;
          contributions[p][q].push({ element: e.id, a: a + 1, b: b + 1, value: v });
          touched.push([p + 1, q + 1]);
        }
      assemblySteps.push({ element: e.id, dofMap: e.dofMap.slice(), touched, K: copyM(K) });
    }

    // boundary conditions
    const constrained = new Array(nDof).fill(false);
    const constraintList = [];
    const axis = ["x", "y", "z"];
    for (const s of model.supports)
      for (let d = 0; d < dim; d++)
        if (s.fix[d]) {
          const dof = dim * nodeIdx.get(s.node) + d;
          if (!constrained[dof]) {
            constrained[dof] = true;
            constraintList.push({ dof: dof + 1, node: s.node, axis: axis[d] });
          }
        }
    const F = new Array(nDof).fill(0);
    for (const l of model.loads) for (let d = 0; d < dim; d++) F[dim * nodeIdx.get(l.node) + d] += l.F[d] || 0;
    const freeDofs = [], fixedDofs = [];
    for (let i = 0; i < nDof; i++) (constrained[i] ? fixedDofs : freeDofs).push(i + 1);

    const Kff = freeDofs.map((r) => freeDofs.map((c) => K[r - 1][c - 1]));
    const Ff = freeDofs.map((r) => F[r - 1]);
    const maxDiag = K.reduce((m, row, i) => Math.max(m, Math.abs(row[i])), 0);
    const pivotTol = 1e-12 * maxDiag;

    const result = {
      model, dim, nNodes: nN, nDof, elements, K, contributions, assemblySteps,
      constrained, constraintList, freeDofs, fixedDofs, F, Kff, Ff, pivotTol,
      counts: { total: nDof, constrained: fixedDofs.length, free: freeDofs.length },
      elimination: null, u: null, R: null, reactionRows: null,
      equilibrium: null, members: null, summary: null,
      state: "ok", message: "",
    };

    if (freeDofs.length === 0) {
      result.u = new Array(nDof).fill(0);
    } else {
      const g = gaussSolve(Kff, Ff, pivotTol);
      result.elimination = g;
      if (!g.ok) {
        result.state = "singular";
        result.message =
          "The reduced stiffness matrix is singular: the supports do not prevent rigid-body motion or part of the structure is a mechanism, so the displacements cannot be determined. Add or move supports/bars.";
        return result;
      }
      result.u = new Array(nDof).fill(0);
      freeDofs.forEach((d, i) => (result.u[d - 1] = g.x[i]));
    }
    const u = result.u;

    // reactions R = K u - F, row by row
    const Ku = K.map((row) => row.reduce((s, v, j) => s + v * u[j], 0));
    result.R = Ku.map((v, i) => v - F[i]);
    result.reactionRows = fixedDofs.map((d) => ({
      dof: d, Ku: Ku[d - 1], F: F[d - 1], R: result.R[d - 1],
      terms: K[d - 1].map((v, j) => ({ j: j + 1, k: v, u: u[j] })).filter((t) => t.u !== 0 && t.k !== 0),
    }));
    for (let i = 0; i < nDof; i++) if (!constrained[i]) result.R[i] = 0; // free rows are ~0 by construction

    // equilibrium
    const eq = { sumF: [0, 0, 0], sumR: [0, 0, 0], total: [0, 0, 0] };
    for (let i = 0; i < nDof; i++) { eq.sumF[i % dim] += F[i]; eq.sumR[i % dim] += result.R[i]; }
    for (let d = 0; d < dim; d++) eq.total[d] = eq.sumF[d] + eq.sumR[d];
    const fScale = Math.max(1, ...F.map(Math.abs));
    eq.ok = eq.total.every((t) => Math.abs(t) < 1e-9 * fScale);
    result.equilibrium = eq;

    // strain / stress
    const members = elements.map((e) => {
      const d = e.dofMap.map((g) => u[g - 1]);
      const dirv = dim === 3 ? [e.cx, e.cy, e.cz] : [e.cx, e.cy];
      const delta = -dirv.reduce((s, c, i) => s + c * d[i], 0) + dirv.reduce((s, c, i) => s + c * d[dim + i], 0);
      const strain = delta / e.L, stress = e.E * strain, N = stress * e.A;
      return { id: e.id, d, delta, strain, stress, N };
    });
    const maxSigma = members.reduce((m, x) => Math.max(m, Math.abs(x.stress)), 0);
    const tol = 1e-9 * maxSigma;
    members.forEach((m) => (m.state = m.stress > tol ? "tension" : m.stress < -tol ? "compression" : "zero"));
    result.members = members;

    let maxDisp = { node: null, value: 0 };
    model.nodes.forEach((n, i) => {
      const mag = Math.hypot(...u.slice(i * dim, i * dim + dim));
      if (mag > maxDisp.value) maxDisp = { node: n.id, value: mag };
    });
    const pick = (cmp) => members.reduce((b, m) => (b === null || cmp(m, b) ? m : b), null);
    const maxT = pick((a, b) => a.stress > b.stress), maxC = pick((a, b) => a.stress < b.stress);
    result.summary = {
      maxDisp,
      maxTension: maxT && maxT.stress > tol ? { element: maxT.id, stress: maxT.stress } : null,
      maxCompression: maxC && maxC.stress < -tol ? { element: maxC.id, stress: maxC.stress } : null,
    };
    return result;
  }

  return { PRESETS, DEFAULT_PRESET_ID, getPreset, solve, gaussSolve, elementData };
});
