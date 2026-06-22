import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import { Trip } from "@/lib/storage";
import { RotateCw, Play, Square } from "lucide-react";

interface Props {
  trips: Trip[];
  selectedId?: string | null;
  onSelectTrip?: (t: Trip) => void;
}

const R = 1;
const GEO = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const TEX_ARTISTIC = "https://unpkg.com/three-globe/example/img/earth-day.jpg";
const TEX_SATELLITE = "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const TEX_BUMP = "https://unpkg.com/three-globe/example/img/earth-topology.png";
const TEX_NIGHT = "https://unpkg.com/three-globe/example/img/earth-night.jpg";
const TEX_SPEC = "https://unpkg.com/three-globe/example/img/earth-water.png";

function ll2v(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function arc(a: THREE.Vector3, b: THREE.Vector3, segs = 64): THREE.Vector3[] {
  const angle = a.angleTo(b);
  const lift = 0.05 + Math.min(0.35, angle * 0.18);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const sinA = Math.sin(angle) || 1;
    const p = a.clone().multiplyScalar(Math.sin((1 - t) * angle) / sinA)
      .add(b.clone().multiplyScalar(Math.sin(t * angle) / sinA)).normalize();
    pts.push(p.multiplyScalar(1 + Math.sin(t * Math.PI) * lift));
  }
  return pts;
}

type State = {
  renderer?: THREE.WebGLRenderer;
  scene?: THREE.Scene;
  camera?: THREE.PerspectiveCamera;
  earth?: THREE.Mesh;
  markersGroup?: THREE.Group;
  routesGroup?: THREE.Group;
  labelsRoot?: HTMLDivElement;
  autoRotate: boolean;
  isDragging: boolean;
  lastPtr?: { x: number; y: number };
  rot: { x: number; y: number };
  vel: { x: number; y: number };
  zoom: number;
  raf?: number;
};

export function WorldMap({ trips, selectedId, onSelectTrip }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<State>({
    autoRotate: true, isDragging: false,
    rot: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, zoom: 3.2,
  });
  const tripsRef = useRef(trips);
  useEffect(() => { tripsRef.current = trips; }, [trips]);
  const onSelectRef = useRef(onSelectTrip);
  useEffect(() => { onSelectRef.current = onSelectTrip; }, [onSelectTrip]);

  const [autoRotate, setAutoRotate] = useState(true);
  useEffect(() => { stateRef.current.autoRotate = autoRotate; }, [autoRotate]);
  const [playing, setPlaying] = useState(false);
  const liveLineRef = useRef<THREE.Line | null>(null);
  const replayRafRef = useRef<number | null>(null);

  const ordered = useMemo(() => [...trips].sort((a, b) => a.trip_date.localeCompare(b.trip_date)), [trips]);

  // ---- Init Three.js scene ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth, h = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 1000);
    camera.position.set(0, 0, stateRef.current.zoom);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const loader = new THREE.TextureLoader();
    const dayTex = loader.load(TEX_ARTISTIC);
    dayTex.colorSpace = THREE.SRGBColorSpace;
    const nightTex = loader.load(TEX_NIGHT);
    nightTex.colorSpace = THREE.SRGBColorSpace;

    const earthMat = new THREE.MeshPhongMaterial({
      map: dayTex,
      bumpMap: loader.load(TEX_BUMP),
      bumpScale: 0.035,
      specularMap: loader.load(TEX_SPEC),
      specular: new THREE.Color(0x223344),
      shininess: 8,
      emissiveMap: nightTex,
      emissive: new THREE.Color(0x99b0c8),
      emissiveIntensity: 0.3,
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 128), earthMat);
    scene.add(earth);

    // Country borders
    const bordersGroup = new THREE.Group();
    earth.add(bordersGroup);
    fetch(GEO).then((r) => r.json()).then((topo: any) => {
      const geo: any = feature(topo, topo.objects.countries);
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
      const addRing = (ring: number[][]) => {
        const pts = ring.map(([lon, lat]) => ll2v(lat, lon, R * 1.001));
        bordersGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
      };
      for (const f of geo.features) {
        const g = f.geometry;
        if (!g) continue;
        if (g.type === "Polygon") g.coordinates.forEach(addRing);
        else if (g.type === "MultiPolygon") g.coordinates.forEach((p: number[][][]) => p.forEach(addRing));
      }
    }).catch(() => {});

    // Atmosphere
    const atmMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true,
      uniforms: { glowColor: { value: new THREE.Color(0x7ec4ff) } },
      vertexShader: `varying vec3 vN; void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 vN; uniform vec3 glowColor; void main(){float i=pow(0.65-dot(vN,vec3(0,0,1)),2.3);gl_FragColor=vec4(glowColor,1.)*i;}`,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.18, 64, 64), atmMat));

    // Lights
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x88aacc, 1.0));
    const fill = new THREE.DirectionalLight(0xaaccee, 0.6);
    fill.position.set(-5, -2, -3);
    scene.add(fill);

    // Stars
    const starPos = new Float32Array(4000 * 3);
    for (let i = 0; i < 4000; i++) {
      const r2 = 80 + Math.random() * 40, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r2 * Math.sin(p) * Math.cos(t);
      starPos[i * 3 + 1] = r2 * Math.sin(p) * Math.sin(t);
      starPos[i * 3 + 2] = r2 * Math.cos(p);
    }
    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, transparent: true, opacity: 0.8 })));

    const markersGroup = new THREE.Group();
    earth.add(markersGroup);
    const routesGroup = new THREE.Group();
    earth.add(routesGroup);

    // Labels overlay
    const labelsRoot = document.createElement("div");
    labelsRoot.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
    container.appendChild(labelsRoot);

    // ── City labels data ────────────────────────────────────────────
    const CITY_DATA: { n: string; la: number; lo: number; tier: 1 | 2 | 3 }[] = [
      // T1 — world capitals, show at zoom < 3.0
      {n:'Roma',la:41.9,lo:12.5,tier:1},{n:'Tokyo',la:35.68,lo:139.69,tier:1},
      {n:'New York',la:40.71,lo:-74.01,tier:1},{n:'Londra',la:51.51,lo:-0.13,tier:1},
      {n:'Pechino',la:39.91,lo:116.39,tier:1},{n:'Mosca',la:55.75,lo:37.62,tier:1},
      {n:'Cairo',la:30.05,lo:31.25,tier:1},{n:'São Paulo',la:-23.55,lo:-46.63,tier:1},
      {n:'Mumbai',la:19.08,lo:72.88,tier:1},{n:'Sydney',la:-33.87,lo:151.21,tier:1},
      // T2 — major cities, show at zoom < 2.1
      {n:'Parigi',la:48.85,lo:2.35,tier:2},{n:'Berlino',la:52.52,lo:13.4,tier:2},
      {n:'Madrid',la:40.42,lo:-3.7,tier:2},{n:'Istanbul',la:41.01,lo:28.95,tier:2},
      {n:'Seoul',la:37.57,lo:126.98,tier:2},{n:'Delhi',la:28.61,lo:77.21,tier:2},
      {n:'Shanghai',la:31.23,lo:121.47,tier:2},{n:'Lagos',la:6.45,lo:3.4,tier:2},
      {n:'Buenos Aires',la:-34.6,lo:-58.38,tier:2},{n:'Los Angeles',la:34.05,lo:-118.24,tier:2},
      {n:'Chicago',la:41.85,lo:-87.65,tier:2},{n:'Toronto',la:43.65,lo:-79.38,tier:2},
      {n:'Dubai',la:25.2,lo:55.27,tier:2},{n:'Bangkok',la:13.75,lo:100.52,tier:2},
      {n:'Singapore',la:1.35,lo:103.82,tier:2},{n:'Amsterdam',la:52.37,lo:4.9,tier:2},
      {n:'Vienna',la:48.21,lo:16.37,tier:2},{n:'Kyiv',la:50.45,lo:30.52,tier:2},
      // T3 — regional cities, show at zoom < 1.6
      {n:'Milano',la:45.47,lo:9.19,tier:3},{n:'Napoli',la:40.85,lo:14.27,tier:3},
      {n:'Firenze',la:43.77,lo:11.26,tier:3},{n:'Venezia',la:45.44,lo:12.33,tier:3},
      {n:'Barcellona',la:41.39,lo:2.15,tier:3},{n:'Lione',la:45.75,lo:4.85,tier:3},
      {n:'Monaco',la:48.14,lo:11.58,tier:3},{n:'Francoforte',la:50.11,lo:8.68,tier:3},
      {n:'Zurigo',la:47.38,lo:8.54,tier:3},{n:'Bruxelles',la:50.85,lo:4.35,tier:3},
      {n:'Budapest',la:47.5,lo:19.04,tier:3},{n:'Praga',la:50.08,lo:14.44,tier:3},
      {n:'Oslo',la:59.91,lo:10.75,tier:3},{n:'Copenhagen',la:55.68,lo:12.57,tier:3},
      {n:'Helsinki',la:60.17,lo:24.94,tier:3},{n:'Ankara',la:39.92,lo:32.85,tier:3},
      {n:'San Francisco',la:37.77,lo:-122.42,tier:3},{n:'Miami',la:25.77,lo:-80.19,tier:3},
      {n:'Montréal',la:45.5,lo:-73.57,tier:3},{n:'Ho Chi Minh',la:10.82,lo:106.63,tier:3},
      {n:'Tel Aviv',la:32.08,lo:34.78,tier:3},{n:'Casablanca',la:33.59,lo:-7.62,tier:3},
    ];

    function cityToVec(la: number, lo: number, r = 1.006): THREE.Vector3 {
      const phi = (90 - la) * (Math.PI / 180);
      const theta = (lo + 180) * (Math.PI / 180);
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    }

    const cityLabelEls: { el: HTMLDivElement; vec: THREE.Vector3; tier: 1 | 2 | 3 }[] = [];
    CITY_DATA.forEach(({ n, la, lo, tier }) => {
      const el = document.createElement("div");
      const dotSize = tier === 1 ? 5 : tier === 2 ? 3.5 : 2.5;
      el.style.cssText = "position:absolute;transform:translate(-50%,-50%);pointer-events:none;opacity:0;display:flex;align-items:center;gap:3px;white-space:nowrap;";
      const dot = document.createElement("div");
      dot.style.cssText = `width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:rgba(255,255,255,${tier===1?0.95:0.7});flex-shrink:0;box-shadow:0 0 3px rgba(0,0,0,0.8)`;
      const lbl = document.createElement("span");
      lbl.textContent = n;
      lbl.style.cssText = `font-size:${tier===1?11:tier===2?10:9}px;font-family:ui-sans-serif,system-ui,sans-serif;color:rgba(255,255,255,${tier===1?0.95:tier===2?0.82:0.65});font-weight:${tier===1?700:600};text-shadow:0 0 4px #000,1px 0 2px #000,-1px 0 2px #000,0 1px 2px #000,0 -1px 2px #000`;
      el.appendChild(dot);
      el.appendChild(lbl);
      labelsRoot.appendChild(el);
      cityLabelEls.push({ el, vec: cityToVec(la, lo), tier });
    });


    // Tooltip
    const tooltip = document.createElement("div");
    tooltip.style.cssText = "position:absolute;pointer-events:none;padding:8px 10px;border-radius:10px;font-size:11px;font-family:ui-monospace,monospace;color:#e6f8ff;background:rgba(4,17,31,0.92);border:1px solid rgba(34,211,238,0.45);transform:translate(12px,-50%);opacity:0;transition:opacity 0.15s;white-space:nowrap;z-index:500;";
    container.appendChild(tooltip);

    const raycaster = new THREE.Raycaster();

    const onPointerDown = (e: PointerEvent) => {
      stateRef.current.isDragging = true;
      stateRef.current.lastPtr = { x: e.clientX, y: e.clientY };
      stateRef.current.vel = { x: 0, y: 0 };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      const s = stateRef.current;
      if (s.isDragging && s.lastPtr) {
        const dx = e.clientX - s.lastPtr.x, dy = e.clientY - s.lastPtr.y;
        s.rot.y += dx * 0.005; s.rot.x += dy * 0.005;
        s.rot.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, s.rot.x));
        s.vel = { x: dy * 0.005, y: dx * 0.005 };
        s.lastPtr = { x: e.clientX, y: e.clientY };
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        tooltip.style.opacity = "0"; return;
      }
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(markersGroup.children, false);
      const first = hits[0];
      const id = (first?.object as any)?.userData?.tripId;
      if (id) {
        const t = tripsRef.current.find((x) => x.id === id);
        if (t) {
          tooltip.innerHTML = `<div style="font-weight:700;color:#5eead4;margin-bottom:3px;">${t.city}</div><div style="color:#94a3b8;font-size:10px;">${t.country}</div>`;
          tooltip.style.left = `${e.clientX - rect.left}px`;
          tooltip.style.top = `${e.clientY - rect.top}px`;
          tooltip.style.opacity = "1";
          renderer.domElement.style.cursor = "pointer";
          return;
        }
      }
      tooltip.style.opacity = "0";
      renderer.domElement.style.cursor = "grab";
    };
    const onPointerUp = () => { stateRef.current.isDragging = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stateRef.current.zoom = Math.max(1.25, Math.min(8, stateRef.current.zoom * (e.deltaY > 0 ? 1.1 : 0.9)));
    };
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(markersGroup.children, false);
      const id = (hits[0]?.object as any)?.userData?.tripId;
      if (id) {
        const t = tripsRef.current.find((x) => x.id === id);
        if (t) onSelectRef.current?.(t);
      }
    };

    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("click", onClick);

    const ro = new ResizeObserver(() => {
      const w2 = container.clientWidth, h2 = container.clientHeight;
      renderer.setSize(w2, h2);
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    const labelEls = new Map<string, HTMLDivElement>();
    const updateLabels = () => {
      markersGroup.children.forEach((child) => {
        const id = (child as any).userData?.labelId as string | undefined;
        if (!id) return;
        const text = (child as any).userData?.text as string;
        const wp = new THREE.Vector3();
        child.getWorldPosition(wp);
        const proj = wp.clone().project(camera);
        const dot = wp.clone().normalize().dot(camera.position.clone().normalize());
        const visible = dot > 0.1 && proj.z < 1;
        let el = labelEls.get(id);
        if (!el) {
          el = document.createElement("div");
          el.style.cssText = "position:absolute;transform:translate(-50%,-130%);padding:2px 8px;border-radius:8px;font-size:11px;font-family:ui-monospace,monospace;font-weight:600;color:#e6f8ff;background:rgba(4,17,31,0.72);border:1px solid rgba(34,211,238,0.35);white-space:nowrap;pointer-events:none;transition:opacity 0.2s;";
          el.textContent = text;
          labelsRoot.appendChild(el);
          labelEls.set(id, el);
        }
        const isHome = id === "home";
        const fade = isHome ? 1 : Math.max(0, Math.min(1, (2.4 - stateRef.current.zoom) / 0.6));
        if (visible && fade > 0.01) {
          el.style.left = `${(proj.x * 0.5 + 0.5) * container.clientWidth}px`;
          el.style.top = `${(-proj.y * 0.5 + 0.5) * container.clientHeight}px`;
          el.style.opacity = String(fade);
        } else {
          el.style.opacity = "0";
        }
      });
      const validIds = new Set(markersGroup.children.map((c: any) => c.userData?.labelId).filter(Boolean));
      labelEls.forEach((el, id) => { if (!validIds.has(id)) { el.remove(); labelEls.delete(id); } });
    };

    const animate = () => {
      const s = stateRef.current;
      if (!s.isDragging) {
        if (s.autoRotate && Math.abs(s.vel.x) < 0.0005 && Math.abs(s.vel.y) < 0.0005) {
          s.rot.y += 0.0008;
        } else {
          s.rot.y += s.vel.y; s.rot.x += s.vel.x;
          s.vel.x *= 0.94; s.vel.y *= 0.94;
        }
        s.rot.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, s.rot.x));
      }
      earth.rotation.y = s.rot.y;
      earth.rotation.x = s.rot.x;
      camera.position.z += (s.zoom - camera.position.z) * 0.12;
      renderer.render(scene, camera);
      updateLabels();

      // ── City labels LOD ─────────────────────────────────────────────
      const z = s.zoom;
      const euler = new THREE.Euler(earth.rotation.x, earth.rotation.y, 0, 'XYZ');
      const cw = container.clientWidth, ch = container.clientHeight;
      cityLabelEls.forEach(({ el, vec, tier }) => {
        const wv = vec.clone().applyEuler(euler);
        const show = wv.z > 0.1 && (tier === 1 ? z < 3.0 : tier === 2 ? z < 2.1 : z < 1.6);
        const cur = parseFloat(el.style.opacity) || 0;
        const next = cur + ((show ? 1 : 0) - cur) * 0.12;
        el.style.opacity = next < 0.02 ? '0' : next > 0.98 ? '1' : String(next);
        if (show) {
          const proj = wv.clone().project(camera);
          el.style.left = `${(proj.x * 0.5 + 0.5) * cw}px`;
          el.style.top = `${(-proj.y * 0.5 + 0.5) * ch}px`;
        }
      });

      s.raf = requestAnimationFrame(animate);
    };
    animate();

    Object.assign(stateRef.current, { renderer, scene, camera, earth, markersGroup, routesGroup, labelsRoot });

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
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Rebuild markers when trips/selection change ----
  useEffect(() => {
    const { markersGroup, routesGroup } = stateRef.current;
    if (!markersGroup || !routesGroup) return;
    while (markersGroup.children.length) {
      const c = markersGroup.children.pop()!;
      (c as any).geometry?.dispose?.(); (c as any).material?.dispose?.();
    }
    while (routesGroup.children.length) {
      const c = routesGroup.children.pop()!;
      (c as any).geometry?.dispose?.(); (c as any).material?.dispose?.();
    }
    if (ordered.length === 0) return;

    const home = ordered[0];
    const homePos = ll2v(home.home_latitude, home.home_longitude, R * 1.005);
    const homeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    );
    homeMesh.position.copy(homePos);
    (homeMesh as any).userData = { labelId: "home", text: home.home_label };
    markersGroup.add(homeMesh);

    const tripPos: THREE.Vector3[] = [];
    ordered.forEach((t, i) => {
      const pos = ll2v(t.latitude, t.longitude, R * 1.005);
      tripPos.push(pos);
      const sel = t.id === selectedId;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(sel ? 0.022 : 0.014, 16, 16),
        new THREE.MeshBasicMaterial({ color: sel ? 0x5eead4 : 0x22d3ee }),
      );
      dot.position.copy(pos);
      (dot as any).userData = { tripId: t.id, labelId: `t-${t.id}`, text: `${i + 1}. ${t.city}` };
      markersGroup.add(dot);
    });

    const nodes = [homePos, ...tripPos];
    for (let i = 0; i < nodes.length - 1; i++) {
      const pts = arc(nodes[i], nodes[i + 1]);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 }),
      );
      routesGroup.add(line);
    }
  }, [ordered, selectedId]);

  // ---- Focus on selected trip ----
  useEffect(() => {
    if (!selectedId) return;
    const t = ordered.find((x) => x.id === selectedId);
    if (!t) return;
    stateRef.current.rot.y = -t.longitude * (Math.PI / 180) - Math.PI / 2;
    stateRef.current.rot.x = t.latitude * (Math.PI / 180);
    stateRef.current.vel = { x: 0, y: 0 };
    stateRef.current.zoom = Math.min(stateRef.current.zoom, 2.2);
  }, [selectedId, ordered]);

  // ---- Replay ----
  const stopReplay = () => {
    if (replayRafRef.current) cancelAnimationFrame(replayRafRef.current);
    setPlaying(false);
    const { routesGroup } = stateRef.current;
    if (routesGroup) {
      routesGroup.children.forEach((c) => {
        if (c !== liveLineRef.current) ((c as THREE.Line).material as any).opacity = 0.85;
      });
      if (liveLineRef.current) {
        routesGroup.remove(liveLineRef.current);
        (liveLineRef.current.geometry as any).dispose?.();
        (liveLineRef.current.material as any).dispose?.();
        liveLineRef.current = null;
      }
    }
  };

  const playReplay = () => {
    const { routesGroup } = stateRef.current;
    if (!routesGroup || ordered.length === 0 || playing) return;
    setPlaying(true);
    setAutoRotate(false);

    const home = ordered[0];
    const homePos = ll2v(home.home_latitude, home.home_longitude, R * 1.005);
    const allArcs: { pts: THREE.Vector3[]; target: { lat: number; lon: number } }[] = [];
    let prev = homePos;
    ordered.forEach((t) => {
      const pos = ll2v(t.latitude, t.longitude, R * 1.005);
      allArcs.push({ pts: arc(prev, pos, 80), target: { lat: t.latitude, lon: t.longitude } });
      prev = pos;
    });

    routesGroup.children.forEach((c) => ((c as THREE.Line).material as any).opacity = 0.15);

    const liveGeo = new THREE.BufferGeometry();
    const liveMat = new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 1 });
    const liveLine = new THREE.Line(liveGeo, liveMat);
    routesGroup.add(liveLine);
    liveLineRef.current = liveLine;

    let arcIdx = 0, t0 = performance.now();
    const perArc = 1800;
    const accumulated: THREE.Vector3[] = [];

    const step = (now: number) => {
      const arcData = allArcs[arcIdx];
      const t = Math.min(1, (now - t0) / perArc);
      const count = Math.max(2, Math.floor(arcData.pts.length * t));
      liveGeo.setFromPoints([...accumulated, ...arcData.pts.slice(0, count)]);
      const { lat, lon } = arcData.target;
      stateRef.current.rot.y += (-lon * (Math.PI / 180) - Math.PI / 2 - stateRef.current.rot.y) * 0.06;
      stateRef.current.rot.x += (lat * (Math.PI / 180) - stateRef.current.rot.x) * 0.06;
      stateRef.current.zoom += (2.0 - stateRef.current.zoom) * 0.04;
      if (t >= 1) {
        accumulated.push(...arcData.pts);
        arcIdx++;
        t0 = now;
        if (arcIdx >= allArcs.length) {
          setPlaying(false);
          routesGroup.children.forEach((c) => { if (c !== liveLine) ((c as THREE.Line).material as any).opacity = 0.85; });
          setTimeout(() => {
            routesGroup.remove(liveLine);
            liveGeo.dispose(); liveMat.dispose();
            liveLineRef.current = null;
          }, 800);
          stateRef.current.zoom = 3.0;
          return;
        }
      }
      replayRafRef.current = requestAnimationFrame(step);
    };
    replayRafRef.current = requestAnimationFrame(step);
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-border"
      style={{ background: "radial-gradient(ellipse at center, #061226 0%, #02060f 70%, #000 100%)" }}>
      <div ref={containerRef} className="w-full h-full" />

      <div className="absolute top-3 right-3 glass-card flex p-1 gap-1 z-40">
        <button onClick={() => setAutoRotate((v) => !v)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1 ${autoRotate ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <RotateCw className="w-3 h-3" />
          {autoRotate ? "Auto" : "Manuale"}
        </button>
      </div>

      {trips.length >= 1 && (
        <div className="absolute bottom-3 left-3 glass-card px-2 py-1.5 flex items-center gap-1 z-40">
          {!playing
            ? <button onClick={playReplay} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-secondary transition-colors"><Play className="w-3.5 h-3.5" /> Replay</button>
            : <button onClick={stopReplay} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-secondary transition-colors"><Square className="w-3.5 h-3.5" /> Stop</button>
          }
        </div>
      )}

      <div className="absolute bottom-3 right-3 glass-card px-3 py-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground z-40">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-accent" /> Casa</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary" /> Tappa</div>
      </div>

      <div className="absolute top-3 left-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 pointer-events-none">
        Trascina · Scroll per zoom
      </div>
    </div>
  );
}
