// FireSync — dotted/halftone wireframe globe (d3-geo + 2D canvas)
// Renders a monochrome dotted Earth with graticule + land outlines, then
// overlays fire pins (severity-ramp glows) and a warm atmospheric halo.

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { getBurnPolygon, getProgression, severityColor } from "./data.js";

const LAND_URL =
  "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/physical/ne_110m_land.json";

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export default function Globe({ fires, selectedId, onSelect, onHover, simulation }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef({});
  const propsRef = useRef({ selectedId, simulation, fires });
  propsRef.current = { selectedId, simulation, fires };
  const [, force] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");

    function resize() {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const radius = Math.min(w, h) * 0.42;
      stateRef.current.w = w;
      stateRef.current.h = h;
      stateRef.current.cx = w / 2;
      stateRef.current.cy = h / 2;
      stateRef.current.baseRadius = radius;
      if (stateRef.current.projection) {
        stateRef.current.projection.scale(radius * stateRef.current.zoom).translate([w / 2, h / 2]);
      }
    }

    const projection = d3.geoOrthographic().clipAngle(90).precision(0.6);
    const path = d3.geoPath().projection(projection).context(ctx);

    stateRef.current.projection = projection;
    stateRef.current.zoom = 1.0;
    stateRef.current.rotation = [121, -38];
    stateRef.current.autoRotate = true;
    stateRef.current.lastInteract = 0;
    stateRef.current.land = null;
    stateRef.current.dots = [];
    stateRef.current.dragging = false;
    stateRef.current.lastPointer = null;

    resize();
    projection.rotate(stateRef.current.rotation);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(LAND_URL);
        if (!res.ok) throw new Error("land fetch failed: " + res.status);
        const land = await res.json();
        if (cancelled) return;
        stateRef.current.land = land;
        const dots = [];
        const latStep = 2.4;
        function inLand(p) {
          for (const f of land.features) {
            const g = f.geometry;
            if (g.type === "Polygon") {
              if (!pointInRing(p, g.coordinates[0])) continue;
              let inHole = false;
              for (let i = 1; i < g.coordinates.length; i++)
                if (pointInRing(p, g.coordinates[i])) { inHole = true; break; }
              if (!inHole) return true;
            } else if (g.type === "MultiPolygon") {
              for (const poly of g.coordinates) {
                if (pointInRing(p, poly[0])) {
                  let inHole = false;
                  for (let i = 1; i < poly.length; i++)
                    if (pointInRing(p, poly[i])) { inHole = true; break; }
                  if (!inHole) return true;
                }
              }
            }
          }
          return false;
        }
        for (let lat = -88; lat <= 84; lat += latStep) {
          const cosL = Math.cos((lat * Math.PI) / 180);
          const lngStep = Math.max(2.4, 2.4 / Math.max(0.12, cosL));
          for (let lng = -180; lng <= 180; lng += lngStep) {
            if (inLand([lng, lat])) dots.push([lng, lat]);
          }
        }
        stateRef.current.dots = dots;
        force((x) => x + 1);
      } catch (e) {
        console.warn("[FireSync] Land geojson failed:", e);
      }
    })();

    function render() {
      const s = stateRef.current;
      const { w, h, cx, cy } = s;
      const r = projection.scale();

      ctx.clearRect(0, 0, w, h);

      const halo = ctx.createRadialGradient(cx, cy, r * 0.94, cx, cy, r * 1.35);
      halo.addColorStop(0, "rgba(255, 140, 90, 0)");
      halo.addColorStop(0.35, "rgba(255, 140, 90, 0.18)");
      halo.addColorStop(1, "rgba(255, 140, 90, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(10, 9, 8, 1)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(244, 241, 235, 0.32)";
      ctx.lineWidth = 1.25;
      ctx.stroke();

      if (s.land) {
        const graticule = d3.geoGraticule().step([15, 15]);
        ctx.beginPath();
        path(graticule());
        ctx.strokeStyle = "rgba(244, 241, 235, 0.07)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        const eq = d3.geoGraticule().stepMajor([0, 90]).extentMajor([[-180, -90], [180, 90]]).stepMinor([360, 360])();
        ctx.beginPath();
        path(eq);
        ctx.strokeStyle = "rgba(244, 241, 235, 0.12)";
        ctx.lineWidth = 0.9;
        ctx.stroke();

        ctx.beginPath();
        s.land.features.forEach((f) => path(f));
        ctx.strokeStyle = "rgba(244, 241, 235, 0.42)";
        ctx.lineWidth = 0.9;
        ctx.stroke();

        ctx.fillStyle = "rgba(244, 241, 235, 0.62)";
        const dotR = Math.max(0.7, r * 0.0032);
        for (const [lng, lat] of s.dots) {
          const p = projection([lng, lat]);
          if (!p) continue;
          ctx.beginPath();
          ctx.arc(p[0], p[1], dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "rgba(244, 241, 235, 0.35)";
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.fillText("LOADING TERRAIN…", cx, cy);
      }

      const propsNow = propsRef.current;
      const allFires = propsNow.fires;
      const sim = propsNow.simulation;
      const selId = propsNow.selectedId;

      // Burn footprint overlay for selected fire
      if (sim && sim.fireId) {
        const fire = allFires.find((f) => f.id === sim.fireId);
        if (fire) {
          const frames = getProgression(fire);
          const curIdx = Math.max(0, Math.min(frames.length - 1, Math.floor(sim.day) - 1));
          for (let i = 0; i <= curIdx; i++) {
            const frame = frames[i];
            const poly = getBurnPolygon(fire, frame, 64);
            const pts = [];
            let anyVisible = false;
            for (const [lng, lat] of poly) {
              const pp = projection([lng, lat]);
              if (pp) { pts.push(pp); anyVisible = true; }
            }
            if (!anyVisible || pts.length < 8) continue;
            const isCurrent = i === curIdx;
            const fireColors = ["#FFD66B", "#FFA744", "#FF6F2C", "#FF3D14", "#C82400"];
            const col = fireColors[Math.min(4, i)];

            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
            ctx.closePath();
            ctx.fillStyle = col + (isCurrent ? "44" : "22");
            ctx.fill();
            ctx.strokeStyle = col + (isCurrent ? "ee" : "55");
            ctx.lineWidth = isCurrent ? 1.6 : 0.7;
            if (!isCurrent) ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          const center = projection([fire.lng, fire.lat]);
          if (center) {
            const f = frames[curIdx];
            ctx.font = '600 10px "JetBrains Mono", monospace';
            ctx.textAlign = "left";
            const lx = center[0] + 18, ly = center[1] - 28;
            ctx.strokeStyle = "rgba(244,241,235,0.45)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(center[0], center[1]);
            ctx.lineTo(lx - 2, ly + 8);
            ctx.stroke();
            const tag = `DAY ${f.day}  ·  ${f.acres.toLocaleString()} ac`;
            const tw = ctx.measureText(tag).width + 16;
            ctx.fillStyle = "rgba(28,26,23,0.92)";
            ctx.strokeStyle = "rgba(58,53,48,1)";
            ctx.fillRect(lx, ly - 6, tw, 18);
            ctx.strokeRect(lx + 0.5, ly - 6 + 0.5, tw - 1, 17);
            ctx.fillStyle = "#F4F1EB";
            ctx.fillText(tag, lx + 8, ly + 6);
          }
        }
      }

      // Fire pins
      const visiblePins = [];
      for (const f of allFires) {
        const p = projection([f.lng, f.lat]);
        if (!p) continue;
        visiblePins.push({ f, x: p[0], y: p[1] });
      }
      s.visiblePins = visiblePins;

      for (const { f, x, y } of visiblePins) {
        const sev = f.severity || 2;
        const col = severityColor(sev);
        const haloR = 6 + sev * 2.2;
        const g = ctx.createRadialGradient(x, y, 0, x, y, haloR);
        g.addColorStop(0, col + "cc");
        g.addColorStop(0.5, col + "55");
        g.addColorStop(1, col + "00");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, haloR, 0, Math.PI * 2);
        ctx.fill();
      }

      const t = performance.now() / 1000;
      for (const { f, x, y } of visiblePins) {
        if (!f.evacOrderActive) continue;
        const phase = (t + (f.id ? f.id.length * 0.31 : 0)) % 2.4;
        const k = phase / 2.4;
        const ringR = 6 + k * 24;
        ctx.strokeStyle = `rgba(255, 77, 28, ${0.55 * (1 - k)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const { f, x, y } of visiblePins) {
        const sev = f.severity || 2;
        const col = severityColor(sev);
        const pr = 2.2 + sev * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, pr + 1.6, 0, Math.PI * 2);
        ctx.fillStyle = col + "33";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, pr, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - pr * 0.3, y - pr * 0.3, pr * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fill();
      }

      if (selId) {
        const sel = visiblePins.find((p) => p.f.id === selId);
        if (sel) {
          ctx.beginPath();
          ctx.arc(sel.x, sel.y, 11, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(244, 241, 235, 0.95)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(sel.x, sel.y, 14, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(244, 241, 235, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    stateRef.current.render = render;

    let raf;
    function loop() {
      const s = stateRef.current;
      if (!s.autoRotate && performance.now() - s.lastInteract > 3000) s.autoRotate = true;
      if (s.autoRotate) {
        s.rotation[0] = (s.rotation[0] + 0.012) % 360;
        projection.rotate(s.rotation);
      }
      render();
      raf = requestAnimationFrame(loop);
    }
    loop();

    function pickPin(mx, my) {
      const pins = stateRef.current.visiblePins || [];
      let best = null, bestD = 20 * 20;
      for (const p of pins) {
        const dx = p.x - mx, dy = p.y - my;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    }

    function onPointerDown(e) {
      stateRef.current.dragging = true;
      stateRef.current.autoRotate = false;
      stateRef.current.lastPointer = { x: e.clientX, y: e.clientY };
      stateRef.current.lastInteract = performance.now();
      stateRef.current.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    }
    function onPointerMove(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (stateRef.current.dragging) {
        const dx = e.clientX - stateRef.current.lastPointer.x;
        const dy = e.clientY - stateRef.current.lastPointer.y;
        const sens = 0.32;
        stateRef.current.rotation[0] = (stateRef.current.rotation[0] + dx * sens) % 360;
        stateRef.current.rotation[1] = Math.max(-85, Math.min(85, stateRef.current.rotation[1] - dy * sens));
        projection.rotate(stateRef.current.rotation);
        stateRef.current.lastPointer = { x: e.clientX, y: e.clientY };
        stateRef.current.lastInteract = performance.now();
      } else {
        const hit = pickPin(mx, my);
        canvas.style.cursor = hit ? "pointer" : "grab";
        if (onHover) onHover(hit ? hit.f.id : null, hit ? { x: e.clientX, y: e.clientY } : null);
        if (hit) {
          stateRef.current.autoRotate = false;
          stateRef.current.lastInteract = performance.now();
        }
      }
    }
    function onPointerUp(e) {
      const s = stateRef.current;
      const wasDrag = s.dragging;
      s.dragging = false;
      s.lastInteract = performance.now();
      if (wasDrag && s.downAt) {
        const dx = e.clientX - s.downAt.x, dy = e.clientY - s.downAt.y;
        const moved = Math.hypot(dx, dy);
        const dt = performance.now() - s.downAt.t;
        if (moved < 5 && dt < 350) {
          const rect = canvas.getBoundingClientRect();
          const hit = pickPin(e.clientX - rect.left, e.clientY - rect.top);
          if (hit && onSelect) onSelect(hit.f.id);
        }
      }
    }
    function onWheel(e) {
      e.preventDefault();
      const s = stateRef.current;
      const dir = e.deltaY > 0 ? 0.92 : 1.08;
      s.zoom = Math.max(0.7, Math.min(2.4, s.zoom * dir));
      projection.scale(s.baseRadius * s.zoom);
      s.lastInteract = performance.now();
      s.autoRotate = false;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter on selected fire
  useEffect(() => {
    const s = stateRef.current;
    if (!s.projection || !selectedId) return;
    const fire = fires.find((f) => f.id === selectedId);
    if (!fire) return;
    s.autoRotate = false;
    s.lastInteract = performance.now() + 5000;
    const target = [-fire.lng, -fire.lat];
    const start = [...s.rotation];
    const t0 = performance.now();
    const dur = 700;
    function step(now) {
      const k = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - k, 3);
      let dλ = target[0] - start[0];
      while (dλ > 180) dλ -= 360;
      while (dλ < -180) dλ += 360;
      s.rotation[0] = start[0] + dλ * ease;
      s.rotation[1] = start[1] + (target[1] - start[1]) * ease;
      s.projection.rotate(s.rotation);
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [selectedId, fires]);

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
