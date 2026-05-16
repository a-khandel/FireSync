// FireSync — dotted/halftone wireframe globe (d3-geo + 2D canvas)
// Renders a monochrome dotted Earth with graticule + land outlines, then
// overlays fire pins (severity-ramp glows) and a warm atmospheric halo.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as d3 from "d3";
import { getBurnPolygon, getProgression, pinSeverityRank, severityColor } from "./data.js";

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

const IDLE_RESUME_MS = 4500;
const AUTO_ROTATE_DEG_PER_SEC = 1.8;

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.4;
/** Larger steps than scroll-wheel zoom; only used by +/- UI */
const ZOOM_BTN_IN_FACTOR = 1.26;
const ZOOM_BTN_OUT_FACTOR = 1 / ZOOM_BTN_IN_FACTOR;
const ZOOM_BTN_ANIM_MS = 420;

/** Rotate + zoom when focusing a clicked pin */
const PIN_FOCUS_ANIM_MS = 780;
/** Always try to reach at least this zoom unless already closer */
const PIN_FOCUS_ZOOM = 1.5;
/** Also scale current zoom up by this factor when picking a pin */
const PIN_FOCUS_ZOOM_MUL = 1.2;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function clampZoom(z) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

/** Value of +/- zoom tween at time `now` */
function zoomTweenAt(tw, now) {
  const t = Math.min(1, (now - tw.t0) / tw.dur);
  const z = tw.z0 + (tw.z1 - tw.z0) * easeOutCubic(t);
  return { z, done: t >= 1 };
}

function Globe({ fires, selectedId, onSelect, onHover, simulation }, ref) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef({});
  const propsRef = useRef({ selectedId, simulation, fires });
  propsRef.current = { selectedId, simulation, fires };
  const [, force] = useState(0);

  useImperativeHandle(ref, () => ({
    zoomIn: () => stateRef.current.startButtonZoom?.(ZOOM_BTN_IN_FACTOR),
    zoomOut: () => stateRef.current.startButtonZoom?.(ZOOM_BTN_OUT_FACTOR),
  }));

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
    // Center orthographic roughly on continental US / southern Canada (VIIRS bbox is NA-only).
    stateRef.current.rotation = [94, -46];
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
        const sev = pinSeverityRank(f);
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
        const sev = pinSeverityRank(f);
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

    function bumpInteract() {
      const s = stateRef.current;
      s.lastInteract = performance.now();
      s.autoRotate = false;
    }

    stateRef.current.startButtonZoom = (factor) => {
      const s = stateRef.current;
      if (!s.projection) return;
      bumpInteract();
      const now = performance.now();
      let z0 = s.zoom;
      if (s.zoomTween) {
        z0 = zoomTweenAt(s.zoomTween, now).z;
      }
      const z1 = clampZoom(z0 * factor);
      if (Math.abs(z1 - z0) < 1e-5) return;
      s.zoomTween = { z0, z1, t0: now, dur: ZOOM_BTN_ANIM_MS };
    };

    let raf;
    let lastFrame = performance.now();
    function loop(now) {
      const s = stateRef.current;
      const dt = Math.min(1 / 30, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;

      if (s.zoomTween) {
        const { z, done } = zoomTweenAt(s.zoomTween, now);
        s.zoom = done ? s.zoomTween.z1 : z;
        projection.scale(s.baseRadius * s.zoom);
        if (done) s.zoomTween = null;
      }

      if (!s.autoRotate && now - s.lastInteract > IDLE_RESUME_MS) s.autoRotate = true;
      if (s.autoRotate) {
        s.rotation[0] = (s.rotation[0] + dt * AUTO_ROTATE_DEG_PER_SEC) % 360;
        projection.rotate(s.rotation);
      }
      render();
      raf = requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

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
      const now = performance.now();
      if (s.zoomTween) {
        s.zoom = zoomTweenAt(s.zoomTween, now).z;
        s.zoomTween = null;
      }
      const dir = e.deltaY > 0 ? 0.92 : 1.08;
      s.zoom = clampZoom(s.zoom * dir);
      projection.scale(s.baseRadius * s.zoom);
      bumpInteract();
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

  // Recenter + zoom smoothly on selected incident (clicked pin / focus from elsewhere)
  useEffect(() => {
    const s = stateRef.current;
    if (!selectedId) {
      s.selectionSeq = (s.selectionSeq ?? 0) + 1;
      return;
    }
    if (!s.projection) return;
    const fire = fires.find((f) => f.id === selectedId);
    if (!fire) return;

    s.selectionSeq = (s.selectionSeq ?? 0) + 1;
    const seq = s.selectionSeq;

    if (s.zoomTween) {
      const nowZ = zoomTweenAt(s.zoomTween, performance.now()).z;
      s.zoomTween = null;
      s.zoom = nowZ;
    }
    if (s.baseRadius != null && s.projection) {
      s.projection.scale(s.baseRadius * s.zoom);
    }

    s.autoRotate = false;
    s.lastInteract = performance.now() + 5000;

    const now0 = performance.now();
    const zStart = s.zoom;
    const zTarget = clampZoom(Math.max(zStart * PIN_FOCUS_ZOOM_MUL, PIN_FOCUS_ZOOM));

    const target = [-fire.lng, -fire.lat];
    const start = [...s.rotation];
    const t0 = now0;
    const dur = PIN_FOCUS_ANIM_MS;

    function step(now) {
      if (seq !== stateRef.current.selectionSeq) return;
      const s2 = stateRef.current;
      if (!s2.projection) return;
      const k = Math.min(1, (now - t0) / dur);
      const ease = easeOutCubic(k);
      let dλ = target[0] - start[0];
      while (dλ > 180) dλ -= 360;
      while (dλ < -180) dλ += 360;
      s2.rotation[0] = start[0] + dλ * ease;
      s2.rotation[1] = start[1] + (target[1] - start[1]) * ease;
      s2.zoom = zStart + (zTarget - zStart) * ease;
      s2.projection.rotate(s2.rotation);
      s2.projection.scale(s2.baseRadius * s2.zoom);
      if (k < 1) requestAnimationFrame(step);
      else {
        s2.zoom = zTarget;
        s2.projection.scale(s2.baseRadius * s2.zoom);
      }
    }
    requestAnimationFrame(step);
  }, [selectedId, fires]);

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

export default forwardRef(Globe);
