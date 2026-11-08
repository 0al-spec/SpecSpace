/* Paste this expression into the browser console on the SpecGraph canvas.
   First select Tree or Spine, Curve, and All edges. It only reads the DOM. */
(() => {
  const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  function intersects(p, q, r, s) {
    const u = orient(p, q, r),
      v = orient(p, q, s),
      w = orient(r, s, p),
      z = orient(r, s, q);
    if (u === 0 && v === 0 && w === 0 && z === 0) return false;
    return u * v <= 0 && w * z <= 0;
  }
  function pathsIntersect(a, b) {
    for (const [i, p] of a.entries()) {
      const q = a.at(i + 1);
      if (!q) continue;
      for (const [j, r] of b.entries()) {
        const s = b.at(j + 1);
        if (s && intersects(p, q, r, s)) return true;
      }
    }
    return false;
  }
  const edges = [...document.querySelectorAll(".react-flow__edge")].map((element) => {
    const path = element.querySelector("path.react-flow__edge-path");
    const parts = element.getAttribute("data-id").split("__");
    const length = path.getTotalLength();
    return {
      ends: [parts[0], parts[2]],
      points: Array.from({ length: 33 }, (_, index) =>
        path.getPointAtLength((length * index) / 32),
      ),
    };
  });
  let pairs = 0;
  for (const [index, a] of edges.entries()) {
    for (const b of edges.slice(index + 1)) {
      if (new Set([...a.ends, ...b.ends]).size < 4) continue;
      if (pathsIntersect(a.points, b.points)) pairs++;
    }
  }
  return {
    nodes: document.querySelectorAll(".react-flow__node").length,
    edges: edges.length,
    intersecting_pairs: pairs,
  };
})();
