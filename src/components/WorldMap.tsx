import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import { LocalTrip } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Play, Square, Video, RotateCw } from "lucide-react";
import { useSettings } from "@/lib/settings";

interface Props {
  trips: LocalTrip[];
  onSelectTrip?: (t: LocalTrip) => void;
  selectedId?: string | null;
}

// ---- helpers ----
const EARTH_RADIUS = 1;
const MIN_MARKER_SCALE = 0.5;
const MAX_MARKER_SCALE = 1.0;

function latLonToVec3(lat: number, lon: number, radius = EARTH_RADIUS): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function chronological(trips: LocalTrip[]) {
  return [...trips].sort((a, b) => a.trip_date.localeCompare(b.trip_date));
}

/** Great-circle arc between two points on the sphere, raised above the surface. */
function arcPoints(a: THREE.Vector3, b: THREE.Vector3, segments = 64): THREE.Vector3[] {
  const angle = a.angleTo(b);
  const archHeight = 0.05 + Math.min(0.35, angle * 0.18);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // SLERP on the sphere
    const sinAngle = Math.sin(angle) || 1;
    const w1 = Math.sin((1 - t) * angle) / sinAngle;
    const w2 = Math.sin(t * angle) / sinAngle;
    const p = a.clone().multiplyScalar(w1).add(b.clone().multiplyScalar(w2)).normalize();
    // Raise above surface in a parabola so it visibly arcs out
    const lift = 1 + Math.sin(t * Math.PI) * archHeight;
    pts.push(p.multiplyScalar(lift));
  }
  return pts;
}

// ---- texture URLs (three-globe CDN, stable) ----
const TEX_DAY = "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const TEX_DAY_PLAIN = "https://unpkg.com/three-globe/example/img/earth-day.jpg";
const TEX_BUMP = "https://unpkg.com/three-globe/example/img/earth-topology.png";
const TEX_NIGHT = "https://unpkg.com/three-globe/example/img/earth-night.jpg";
const TEX_SPEC = "https://unpkg.com/three-globe/example/img/earth-water.png";
const TEX_CLOUDS = "https://unpkg.com/three-globe/example/img/earth-water.png";
// Country borders (lightweight TopoJSON-style geojson, ~110m)
const GEO_BORDERS = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export function WorldMap({ trips, onSelectTrip, selectedId }: Props) {
  const { globeStyle } = useSettings();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    earth?: THREE.Mesh;
    clouds?: THREE.Mesh;
    atmosphere?: THREE.Mesh;
    stars?: THREE.Points;
    markersGroup?: THREE.Group;
    routesGroup?: THREE.Group;
    labelsRoot?: HTMLDivElement;
    raycaster?: THREE.Raycaster;
    targetCamPos?: THREE.Vector3;
    autoRotate: boolean;
    isDragging: boolean;
    lastPointer?: { x: number; y: number };
    rotation: { x: number; y: number };
    rotVelocity: { x: number; y: number };
    zoom: number;
    raf?: number;
  }>({
    autoRotate: true,
    isDragging: false,
    rotation: { x: 0, y: 0 },
    rotVelocity: { x: 0, y: 0 },
    zoom: 3.2,
  });

  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  useEffect(() => { stateRef.current.autoRotate = autoRotate; }, [autoRotate]);

  const orderedTrips = useMemo(() => chronological(trips), [trips]);
  const onSelectRef = useRef(onSelectTrip);
  useEffect(() => { onSelectRef.current = onSelectTrip; }, [onSelectTrip]);
  const tripsRef = useRef(trips);
  useEffect(() => { tripsRef.current = trips; }, [trips]);

  // ---- init scene once ----
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene & camera
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 1000);
    camera.position.set(0, 0, stateRef.current.zoom);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // ---- Earth ----
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    // Use plain day texture for artistic (so shader recolor reads neutral land/ocean),
    // and blue-marble for satellite (realistic NASA imagery).
    const dayTex = loader.load(globeStyle === "satellite" ? TEX_DAY : TEX_DAY_PLAIN);
    dayTex.colorSpace = THREE.SRGBColorSpace;
    const bumpTex = loader.load(TEX_BUMP);
    const nightTex = loader.load(TEX_NIGHT);
    nightTex.colorSpace = THREE.SRGBColorSpace;

    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 192, 192);
    const specTex = loader.load(TEX_SPEC);
    const earthMat = new THREE.MeshPhongMaterial({
      map: dayTex,
      bumpMap: bumpTex,
      bumpScale: 0.035,
      specularMap: specTex,
      specular: new THREE.Color(0x223344),
      shininess: 8,
      emissiveMap: nightTex,
      emissive: new THREE.Color(0x99b0c8),
      emissiveIntensity: 0.3,
    });
    // Painterly palette: deep blue ocean, olive/yellow land, warm deserts
    if (globeStyle === "artistic") {
      earthMat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `
          #include <map_fragment>
          {
            vec3 c = diffuseColor.rgb;
            // Ocean: deep navy blue (like reference)
            float oceanMask = smoothstep(0.0, 0.18, c.b - max(c.r, c.g - 0.04));
            vec3 oceanTint = vec3(0.04, 0.10, 0.22);
            c = mix(c, oceanTint, oceanMask * 0.92);
            // Land green areas -> warmer olive/yellow-green
            float greenMask = smoothstep(0.0, 0.12, c.g - max(c.r * 0.95, c.b));
            vec3 greenTint = vec3(0.42, 0.58, 0.18);
            c = mix(c, greenTint, greenMask * 0.65);
            // Desert/dry land -> realistic sand with multi-tone variation
            float sandMask = smoothstep(0.0, 0.05, min(c.r, c.g) - c.b) * smoothstep(0.26, 0.42, c.r);
            float warmth = smoothstep(0.0, 0.18, c.r - c.g);
            float lum = (c.r + c.g + c.b) / 3.0;
            vec2 nseed = vMapUv * vec2(420.0, 220.0);
            float n1 = fract(sin(dot(floor(nseed), vec2(12.9898, 78.233))) * 43758.5453);
            float n2 = fract(sin(dot(floor(nseed * 0.35), vec2(39.346, 11.135))) * 24634.6345);
            float dunes = mix(n1, n2, 0.5) - 0.5;
            vec3 sandPale  = vec3(0.96, 0.90, 0.72);
            vec3 sandGold  = vec3(0.90, 0.78, 0.46);
            vec3 sandOcra  = vec3(0.80, 0.58, 0.28);
            vec3 sandDry   = vec3(0.62, 0.42, 0.20);
            vec3 sandTint = mix(sandPale, sandGold, smoothstep(0.0, 0.5, warmth));
            sandTint = mix(sandTint, sandOcra, smoothstep(0.4, 0.85, warmth));
            sandTint = mix(sandTint, sandDry, smoothstep(0.75, 1.0, warmth) * 0.7);
            sandTint *= 1.0 + dunes * 0.18;
            sandTint = mix(sandTint, sandPale, smoothstep(0.55, 0.85, lum) * 0.45);
            c = mix(c, sandTint, sandMask * 0.85);
            float landMask = 1.0 - oceanMask;
            c = mix(c, c * 1.12, landMask * 0.5);
            diffuseColor.rgb = clamp(c, 0.0, 1.0);
          }
          `
        );
      };
    } else {
      // Satellite: keep original NASA Blue Marble colors (no shader override)
      earthMat.emissiveIntensity = 0.18;
      earthMat.specular = new THREE.Color(0x111a26);
    }
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // ---- Country borders (loaded async) ----
    const bordersGroup = new THREE.Group();
    earth.add(bordersGroup);
    fetch(GEO_BORDERS)
      .then((r) => r.json())
      .then((topo: any) => {
        const geo: any = feature(topo, topo.objects.countries);
        const mat = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        });
        const R = EARTH_RADIUS * 1.001;
        const addRing = (ring: number[][]) => {
          const pts: THREE.Vector3[] = [];
          for (const [lon, lat] of ring) pts.push(latLonToVec3(lat, lon, R));
          const g = new THREE.BufferGeometry().setFromPoints(pts);
          bordersGroup.add(new THREE.Line(g, mat));
        };
        for (const f of geo.features) {
          const g = f.geometry;
          if (!g) continue;
          if (g.type === "Polygon") g.coordinates.forEach(addRing);
          else if (g.type === "MultiPolygon")
            g.coordinates.forEach((poly: number[][][]) => poly.forEach(addRing));
        }
      })
      .catch(() => {});

    // ---- Clouds (disabled: no cloud texture available on the current CDN) ----
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.005, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));

    // ---- Atmosphere glow (custom shader) ----
    const atmMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      uniforms: {
        glowColor: { value: new THREE.Color(0x7ec4ff) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 glowColor;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.3);
          gl_FragColor = vec4(glowColor, 1.0) * intensity * 1.0;
        }
      `,
    });
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.18, 64, 64), atmMat);
    scene.add(atmosphere);

    // ---- Lights ----
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    const ambient = new THREE.AmbientLight(0x88aacc, 1.0);
    scene.add(ambient);
    const fill = new THREE.DirectionalLight(0xaaccee, 0.6);
    fill.position.set(-5, -2, -3);
    scene.add(fill);

    // ---- Stars ----
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 4000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 80 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, sizeAttenuation: true, transparent: true, opacity: 0.85 });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // ---- Markers / routes group (children of earth so they rotate with it) ----
    const markersGroup = new THREE.Group();
    earth.add(markersGroup);
    const routesGroup = new THREE.Group();
    earth.add(routesGroup);

    // ---- Labels overlay ----
    const labelsRoot = document.createElement("div");
    labelsRoot.style.position = "absolute";
    labelsRoot.style.inset = "0";
    labelsRoot.style.pointerEvents = "none";
    labelsRoot.style.overflow = "hidden";
    container.appendChild(labelsRoot);

    // ---- Hover tooltip ----
    const tooltip = document.createElement("div");
    tooltip.style.position = "absolute";
    tooltip.style.pointerEvents = "none";
    tooltip.style.padding = "8px 10px";
    tooltip.style.borderRadius = "10px";
    tooltip.style.fontSize = "11px";
    tooltip.style.fontFamily = "ui-monospace, monospace";
    tooltip.style.color = "#e6f8ff";
    tooltip.style.background = "rgba(4,17,31,0.92)";
    tooltip.style.backdropFilter = "blur(8px)";
    tooltip.style.border = "1px solid rgba(34,211,238,0.45)";
    tooltip.style.boxShadow = "0 8px 28px rgba(0,0,0,0.45)";
    tooltip.style.transform = "translate(12px, -50%)";
    tooltip.style.opacity = "0";
    tooltip.style.transition = "opacity 0.15s";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.style.zIndex = "500";
    container.appendChild(tooltip);

    // ---- Pointer interaction ----
    const raycaster = new THREE.Raycaster();
    const onPointerDown = (e: PointerEvent) => {
      stateRef.current.isDragging = true;
      stateRef.current.lastPointer = { x: e.clientX, y: e.clientY };
      stateRef.current.rotVelocity = { x: 0, y: 0 };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (stateRef.current.isDragging && stateRef.current.lastPointer) {
        const dx = e.clientX - stateRef.current.lastPointer.x;
        const dy = e.clientY - stateRef.current.lastPointer.y;
        stateRef.current.rotation.y += dx * 0.005;
        stateRef.current.rotation.x += dy * 0.005;
        stateRef.current.rotation.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, stateRef.current.rotation.x));
        stateRef.current.rotVelocity = { x: dy * 0.005, y: dx * 0.005 };
        stateRef.current.lastPointer = { x: e.clientX, y: e.clientY };
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
      ) {
        tooltip.style.opacity = "0";
        renderer.domElement.style.cursor = "grab";
        return;
      }
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(markersGroup.children, false);
      const first = hits[0];
      const id = (first?.object as any)?.userData?.tripId;
      const homeHit = (first?.object as any)?.userData?.labelId === "home";
      if (id) {
        const t = tripsRef.current.find((x) => x.id === id);
        if (t) {
          const tempStr = t.temperature_c != null ? `${Math.round(t.temperature_c)}°C` : "—";
          const altStr = t.altitude_m != null ? `${Math.round(t.altitude_m)} m` : "—";
          tooltip.innerHTML = `
            <div style="font-weight:700;color:#5eead4;margin-bottom:4px;font-size:12px;">${t.city}</div>
            <div style="color:#94a3b8;font-size:10px;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">${t.country}</div>
            <div style="display:flex;gap:10px;">
              <div><span style="color:#94a3b8;">🌡 </span><strong>${tempStr}</strong></div>
              <div><span style="color:#94a3b8;">⛰ </span><strong>${altStr}</strong></div>
            </div>`;
          tooltip.style.left = `${e.clientX - rect.left}px`;
          tooltip.style.top = `${e.clientY - rect.top}px`;
          tooltip.style.opacity = "1";
          renderer.domElement.style.cursor = "pointer";
          return;
        }
      } else if (homeHit) {
        const home = tripsRef.current[0];
        tooltip.innerHTML = `<div style="font-weight:700;color:#fbbf24;">🏠 ${home?.home_label || "Casa"}</div>`;
        tooltip.style.left = `${e.clientX - rect.left}px`;
        tooltip.style.top = `${e.clientY - rect.top}px`;
        tooltip.style.opacity = "1";
        renderer.domElement.style.cursor = "pointer";
        return;
      }
      tooltip.style.opacity = "0";
      renderer.domElement.style.cursor = "grab";
    };
    const onPointerUp = () => { stateRef.current.isDragging = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      stateRef.current.zoom = Math.max(1.25, Math.min(8, stateRef.current.zoom * factor));
    };
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(markersGroup.children, false);
      const first = hits[0];
      const id = (first?.object as any)?.userData?.tripId;
      if (id) {
        const t = tripsRef.current.find((x) => x.id === id);
        if (t && onSelectRef.current) onSelectRef.current(t);
      }
    };
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("click", onClick);

    // ---- Resize ----
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    // ---- Animation loop ----
    const labelEls = new Map<string, HTMLDivElement>();
    const updateLabels = () => {
      // Project each marker child world position to screen
      markersGroup.children.forEach((child) => {
        const id = (child as any).userData?.labelId as string | undefined;
        if (!id) return;
        const text = (child as any).userData?.text as string;
        const worldPos = new THREE.Vector3();
        child.getWorldPosition(worldPos);
        const projected = worldPos.clone().project(camera);
        const dot = worldPos.clone().normalize().dot(camera.position.clone().normalize());
        const visible = dot > 0.1 && projected.z < 1;
        let el = labelEls.get(id);
        if (!el) {
          el = document.createElement("div");
          el.style.position = "absolute";
          el.style.transform = "translate(-50%, -130%)";
          el.style.padding = "2px 8px";
          el.style.borderRadius = "8px";
          el.style.fontSize = "11px";
          el.style.fontFamily = "ui-monospace, monospace";
          el.style.fontWeight = "600";
          el.style.color = "#e6f8ff";
          el.style.background = "rgba(4,17,31,0.72)";
          el.style.backdropFilter = "blur(6px)";
          el.style.border = "1px solid rgba(34,211,238,0.35)";
          el.style.whiteSpace = "nowrap";
          el.style.pointerEvents = "none";
          el.style.transition = "opacity 0.2s";
          el.textContent = text;
          labelsRoot.appendChild(el);
          labelEls.set(id, el);
        }
        // Hide trip labels when zoomed out; fade in as user zooms in. Home label always shown when visible.
        const isHome = id === "home";
        const zoomVal = stateRef.current.zoom;
        const fade = isHome ? 1 : Math.max(0, Math.min(1, (2.4 - zoomVal) / 0.6));
        if (visible && fade > 0.01) {
          const x = (projected.x * 0.5 + 0.5) * container.clientWidth;
          const y = (-projected.y * 0.5 + 0.5) * container.clientHeight;
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.style.opacity = String(fade);
        } else {
          el.style.opacity = "0";
        }
      });
      // Cleanup orphans
      const validIds = new Set(markersGroup.children.map((c: any) => c.userData?.labelId).filter(Boolean));
      labelEls.forEach((el, id) => {
        if (!validIds.has(id)) {
          el.remove();
          labelEls.delete(id);
        }
      });
    };

    const animate = () => {
      const s = stateRef.current;
      // Inertia + auto-rotate
      if (!s.isDragging) {
        if (s.autoRotate && Math.abs(s.rotVelocity.x) < 0.0005 && Math.abs(s.rotVelocity.y) < 0.0005) {
          s.rotation.y += 0.0008;
        } else {
          s.rotation.y += s.rotVelocity.y;
          s.rotation.x += s.rotVelocity.x;
          s.rotVelocity.x *= 0.94;
          s.rotVelocity.y *= 0.94;
        }
        s.rotation.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, s.rotation.x));
      }
      earth.rotation.y = s.rotation.y;
      earth.rotation.x = s.rotation.x;
      clouds.rotation.y = s.rotation.y + 0.0003 * performance.now() * 0.001;
      clouds.rotation.x = s.rotation.x;
      atmosphere.rotation.copy(earth.rotation);

      // Smooth zoom
      const targetZ = s.zoom;
      camera.position.z += (targetZ - camera.position.z) * 0.12;

      // Scale markers based on zoom with explicit min/max bounds
      const rawScale = camera.position.z / 3.2;
      const markerScale = Math.max(MIN_MARKER_SCALE, Math.min(MAX_MARKER_SCALE, rawScale));
      markersGroup.children.forEach((child) => {
        child.scale.setScalar(markerScale);
      });

      renderer.render(scene, camera);
      updateLabels();
      s.raf = requestAnimationFrame(animate);
    };
    animate();

    stateRef.current.renderer = renderer;
    stateRef.current.scene = scene;
    stateRef.current.camera = camera;
    stateRef.current.earth = earth;
    stateRef.current.clouds = clouds;
    stateRef.current.atmosphere = atmosphere;
    stateRef.current.stars = stars;
    stateRef.current.markersGroup = markersGroup;
    stateRef.current.routesGroup = routesGroup;
    stateRef.current.labelsRoot = labelsRoot;
    stateRef.current.raycaster = raycaster;

    return () => {
      if (stateRef.current.raf) cancelAnimationFrame(stateRef.current.raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("click", onClick);
      labelEls.forEach((el) => el.remove());
      labelsRoot.remove();
      tooltip.remove();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globeStyle]);

  // ---- rebuild markers + routes when trips change ----
  useEffect(() => {
    const { markersGroup, routesGroup } = stateRef.current;
    if (!markersGroup || !routesGroup) return;

    // Clear
    while (markersGroup.children.length) {
      const c = markersGroup.children.pop()!;
      (c as any).geometry?.dispose?.();
      (c as any).material?.dispose?.();
    }
    while (routesGroup.children.length) {
      const c = routesGroup.children.pop()!;
      (c as any).geometry?.dispose?.();
      (c as any).material?.dispose?.();
    }

    if (orderedTrips.length === 0) return;

    // Home marker
    const home = orderedTrips[0];
    const homePos = latLonToVec3(home.home_latitude, home.home_longitude, EARTH_RADIUS * 1.005);
    const homeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
    );
    homeMesh.position.copy(homePos);
    (homeMesh as any).userData = { tripId: null, labelId: "home", text: home.home_label || "Casa" };
    markersGroup.add(homeMesh);

    // Trip markers + labels
    const tripPositions: THREE.Vector3[] = [];
    orderedTrips.forEach((t, i) => {
      const pos = latLonToVec3(t.latitude, t.longitude, EARTH_RADIUS * 1.005);
      tripPositions.push(pos);
      const isSel = t.id === selectedId;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(isSel ? 0.022 : 0.014, 16, 16),
        new THREE.MeshBasicMaterial({ color: isSel ? 0x5eead4 : 0x22d3ee })
      );
      dot.position.copy(pos);
      (dot as any).userData = { tripId: t.id, labelId: `t-${t.id}`, text: `${i + 1}. ${t.city}` };
      markersGroup.add(dot);
    });

    // Routes: home -> first -> second -> ... (chronological)
    const routeNodes = [homePos, ...tripPositions];
    for (let i = 0; i < routeNodes.length - 1; i++) {
      const pts = arcPoints(routeNodes[i], routeNodes[i + 1], 64);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 });
      const line = new THREE.Line(geo, mat);
      routesGroup.add(line);
    }
  }, [orderedTrips, selectedId, globeStyle]);

  // ---- focus on selected trip ----
  useEffect(() => {
    if (!selectedId) return;
    const t = orderedTrips.find((x) => x.id === selectedId);
    if (!t) return;
    // Rotate the earth so this point faces the camera
    const lat = t.latitude * (Math.PI / 180);
    const lon = t.longitude * (Math.PI / 180);
    stateRef.current.rotation.y = -lon - Math.PI / 2;
    stateRef.current.rotation.x = lat;
    stateRef.current.rotVelocity = { x: 0, y: 0 };
    stateRef.current.zoom = Math.min(stateRef.current.zoom, 2.2);
  }, [selectedId, orderedTrips]);

  // ---- Replay (animate route + spin to follow) ----
  const replayRafRef = useRef<number | null>(null);
  const playReplay = () => {
    const { routesGroup } = stateRef.current;
    if (!routesGroup || orderedTrips.length === 0 || playing) return;
    setPlaying(true);
    setAutoRotate(false);

    const home = orderedTrips[0];
    const homePos = latLonToVec3(home.home_latitude, home.home_longitude, EARTH_RADIUS * 1.005);
    const allArcs: { points: THREE.Vector3[]; target: { lat: number; lon: number } }[] = [];
    let prev = homePos;
    orderedTrips.forEach((t) => {
      const pos = latLonToVec3(t.latitude, t.longitude, EARTH_RADIUS * 1.005);
      allArcs.push({ points: arcPoints(prev, pos, 80), target: { lat: t.latitude, lon: t.longitude } });
      prev = pos;
    });

    // Hide static routes during replay
    routesGroup.children.forEach((c) => ((c as THREE.Line).material as any).opacity = 0.15);

    const liveGeo = new THREE.BufferGeometry();
    const liveMat = new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 1 });
    const liveLine = new THREE.Line(liveGeo, liveMat);
    routesGroup.add(liveLine);

    let arcIdx = 0;
    let t0 = performance.now();
    const perArc = 1800;
    const accumulated: THREE.Vector3[] = [];

    const step = (now: number) => {
      const arc = allArcs[arcIdx];
      const t = Math.min(1, (now - t0) / perArc);
      const count = Math.max(2, Math.floor(arc.points.length * t));
      const partial = arc.points.slice(0, count);
      const merged = [...accumulated, ...partial];
      liveGeo.setFromPoints(merged);

      // Rotate globe so the leading point faces camera
      const target = arc.target;
      const lat = target.lat * (Math.PI / 180);
      const lon = target.lon * (Math.PI / 180);
      const desiredY = -lon - Math.PI / 2;
      const desiredX = lat;
      stateRef.current.rotation.y += (desiredY - stateRef.current.rotation.y) * 0.06;
      stateRef.current.rotation.x += (desiredX - stateRef.current.rotation.x) * 0.06;
      stateRef.current.zoom += (2.0 - stateRef.current.zoom) * 0.04;

      if (t >= 1) {
        accumulated.push(...arc.points);
        arcIdx++;
        t0 = now;
        if (arcIdx >= allArcs.length) {
          // Finished
          setPlaying(false);
          // Restore static routes
          routesGroup.children.forEach((c) => {
            if (c === liveLine) return;
            ((c as THREE.Line).material as any).opacity = 0.85;
          });
          // Remove live line after a brief beat
          setTimeout(() => {
            routesGroup.remove(liveLine);
            liveGeo.dispose();
            liveMat.dispose();
          }, 800);
          stateRef.current.zoom = 3.0;
          return;
        }
      }
      replayRafRef.current = requestAnimationFrame(step);
    };
    replayRafRef.current = requestAnimationFrame(step);
  };

  const stopReplay = () => {
    if (replayRafRef.current) cancelAnimationFrame(replayRafRef.current);
    setPlaying(false);
    const { routesGroup } = stateRef.current;
    routesGroup?.children.forEach((c) => ((c as THREE.Line).material as any).opacity = 0.85);
  };

  // ---- Record video ----
  const recordReplay = async () => {
    const renderer = stateRef.current.renderer;
    if (!renderer || recording) return;
    const canvas = renderer.domElement;
    const stream = canvas.captureStream(30);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `atlas-globo-${new Date().toISOString().slice(0, 10)}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setRecording(false);
    };
    setRecording(true);
    recorder.start();
    playReplay();
    // Stop ~1s after the replay ends
    const totalMs = 1800 * Math.max(1, orderedTrips.length) + 1500;
    setTimeout(() => recorder.state !== "inactive" && recorder.stop(), totalMs);
  };

  return (
    <div
      className="relative w-full h-full rounded-2xl overflow-hidden border border-border"
      style={{ background: "radial-gradient(ellipse at center, #061226 0%, #02060f 70%, #000 100%)" }}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Top-right: auto-rotate toggle */}
      <div className="absolute top-3 right-3 glass-card flex p-1 gap-1 z-[400]">
        <button
          onClick={() => setAutoRotate((v) => !v)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1 ${
            autoRotate ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <RotateCw className="w-3 h-3" />
          {autoRotate ? "Auto-rotate" : "Manuale"}
        </button>
      </div>

      {/* Bottom-left: replay controls */}
      {trips.length >= 1 && (
        <div className="absolute bottom-3 left-3 glass-card px-2 py-1.5 flex items-center gap-1 z-[400]">
          {!playing ? (
            <Button size="sm" variant="ghost" onClick={playReplay} disabled={recording} className="h-8 gap-1.5">
              <Play className="w-3.5 h-3.5" /> Replay
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={stopReplay} className="h-8 gap-1.5">
              <Square className="w-3.5 h-3.5" /> Stop
            </Button>
          )}
          <div className="w-px h-5 bg-border mx-0.5" />
          <Button size="sm" variant="ghost" onClick={recordReplay} disabled={recording || playing} className="h-8 gap-1.5">
            <Video className={`w-3.5 h-3.5 ${recording ? "text-destructive animate-pulse" : ""}`} />
            {recording ? "Registrazione…" : "Esporta video"}
          </Button>
        </div>
      )}

      {/* Bottom-right: legend */}
      <div className="absolute bottom-3 right-3 glass-card px-3 py-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground z-[400]">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-accent" /> Casa</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-primary" /> Tappa</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-primary" /> Percorso</div>
      </div>

      {/* Hint */}
      <div className="absolute top-3 left-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 pointer-events-none">
        Trascina per ruotare · Scroll per zoom
      </div>
    </div>
  );
}
