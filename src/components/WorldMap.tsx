import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import { Trip } from "@/lib/storage";
import { GlobeLabels } from "@/lib/settings";
import { RotateCw, Play, Square } from "lucide-react";

interface CityInfo {
  name: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  tier: 1 | 2 | 3;
}

const CITIES: CityInfo[] = [
  // Tier 1 — world capitals
  {name:"Roma",country:"Italia",country_code:"IT",latitude:41.9,longitude:12.5,tier:1},
  {name:"Tokyo",country:"Giappone",country_code:"JP",latitude:35.68,longitude:139.69,tier:1},
  {name:"New York",country:"USA",country_code:"US",latitude:40.71,longitude:-74.01,tier:1},
  {name:"Londra",country:"Regno Unito",country_code:"GB",latitude:51.51,longitude:-0.13,tier:1},
  {name:"Pechino",country:"Cina",country_code:"CN",latitude:39.91,longitude:116.39,tier:1},
  {name:"Mosca",country:"Russia",country_code:"RU",latitude:55.75,longitude:37.62,tier:1},
  {name:"Cairo",country:"Egitto",country_code:"EG",latitude:30.05,longitude:31.25,tier:1},
  {name:"São Paulo",country:"Brasile",country_code:"BR",latitude:-23.55,longitude:-46.63,tier:1},
  {name:"Mumbai",country:"India",country_code:"IN",latitude:19.08,longitude:72.88,tier:1},
  {name:"Sydney",country:"Australia",country_code:"AU",latitude:-33.87,longitude:151.21,tier:1},
  // Tier 2 — major cities
  {name:"Parigi",country:"Francia",country_code:"FR",latitude:48.85,longitude:2.35,tier:2},
  {name:"Berlino",country:"Germania",country_code:"DE",latitude:52.52,longitude:13.4,tier:2},
  {name:"Madrid",country:"Spagna",country_code:"ES",latitude:40.42,longitude:-3.7,tier:2},
  {name:"Istanbul",country:"Turchia",country_code:"TR",latitude:41.01,longitude:28.95,tier:2},
  {name:"Seoul",country:"Corea del Sud",country_code:"KR",latitude:37.57,longitude:126.98,tier:2},
  {name:"Delhi",country:"India",country_code:"IN",latitude:28.61,longitude:77.21,tier:2},
  {name:"Shanghai",country:"Cina",country_code:"CN",latitude:31.23,longitude:121.47,tier:2},
  {name:"Lagos",country:"Nigeria",country_code:"NG",latitude:6.45,longitude:3.4,tier:2},
  {name:"Buenos Aires",country:"Argentina",country_code:"AR",latitude:-34.6,longitude:-58.38,tier:2},
  {name:"Los Angeles",country:"USA",country_code:"US",latitude:34.05,longitude:-118.24,tier:2},
  {name:"Chicago",country:"USA",country_code:"US",latitude:41.85,longitude:-87.65,tier:2},
  {name:"Toronto",country:"Canada",country_code:"CA",latitude:43.65,longitude:-79.38,tier:2},
  {name:"Dubai",country:"Emirati Arabi",country_code:"AE",latitude:25.2,longitude:55.27,tier:2},
  {name:"Bangkok",country:"Thailandia",country_code:"TH",latitude:13.75,longitude:100.52,tier:2},
  {name:"Singapore",country:"Singapore",country_code:"SG",latitude:1.35,longitude:103.82,tier:2},
  {name:"Amsterdam",country:"Paesi Bassi",country_code:"NL",latitude:52.37,longitude:4.9,tier:2},
  {name:"Vienna",country:"Austria",country_code:"AT",latitude:48.21,longitude:16.37,tier:2},
  {name:"Kyiv",country:"Ucraina",country_code:"UA",latitude:50.45,longitude:30.52,tier:2},
  {name:"Città del Messico",country:"Messico",country_code:"MX",latitude:19.43,longitude:-99.13,tier:2},
  {name:"Johannesburg",country:"Sudafrica",country_code:"ZA",latitude:-26.2,longitude:28.04,tier:2},
  // Tier 3 — regional
  {name:"Milano",country:"Italia",country_code:"IT",latitude:45.47,longitude:9.19,tier:3},
  {name:"Napoli",country:"Italia",country_code:"IT",latitude:40.85,longitude:14.27,tier:3},
  {name:"Firenze",country:"Italia",country_code:"IT",latitude:43.77,longitude:11.26,tier:3},
  {name:"Venezia",country:"Italia",country_code:"IT",latitude:45.44,longitude:12.33,tier:3},
  {name:"Barcellona",country:"Spagna",country_code:"ES",latitude:41.39,longitude:2.15,tier:3},
  {name:"Siviglia",country:"Spagna",country_code:"ES",latitude:37.39,longitude:-5.99,tier:3},
  {name:"Lione",country:"Francia",country_code:"FR",latitude:45.75,longitude:4.85,tier:3},
  {name:"Marsiglia",country:"Francia",country_code:"FR",latitude:43.3,longitude:5.37,tier:3},
  {name:"Monaco",country:"Germania",country_code:"DE",latitude:48.14,longitude:11.58,tier:3},
  {name:"Francoforte",country:"Germania",country_code:"DE",latitude:50.11,longitude:8.68,tier:3},
  {name:"Amburgo",country:"Germania",country_code:"DE",latitude:53.55,longitude:10.0,tier:3},
  {name:"Zurigo",country:"Svizzera",country_code:"CH",latitude:47.38,longitude:8.54,tier:3},
  {name:"Bruxelles",country:"Belgio",country_code:"BE",latitude:50.85,longitude:4.35,tier:3},
  {name:"Budapest",country:"Ungheria",country_code:"HU",latitude:47.5,longitude:19.04,tier:3},
  {name:"Praga",country:"Rep. Ceca",country_code:"CZ",latitude:50.08,longitude:14.44,tier:3},
  {name:"Oslo",country:"Norvegia",country_code:"NO",latitude:59.91,longitude:10.75,tier:3},
  {name:"Copenhagen",country:"Danimarca",country_code:"DK",latitude:55.68,longitude:12.57,tier:3},
  {name:"Helsinki",country:"Finlandia",country_code:"FI",latitude:60.17,longitude:24.94,tier:3},
  {name:"Varsavia",country:"Polonia",country_code:"PL",latitude:52.23,longitude:21.01,tier:3},
  {name:"Ankara",country:"Turchia",country_code:"TR",latitude:39.92,longitude:32.85,tier:3},
  {name:"San Francisco",country:"USA",country_code:"US",latitude:37.77,longitude:-122.42,tier:3},
  {name:"Miami",country:"USA",country_code:"US",latitude:25.77,longitude:-80.19,tier:3},
  {name:"Montréal",country:"Canada",country_code:"CA",latitude:45.5,longitude:-73.57,tier:3},
  {name:"Ho Chi Minh",country:"Vietnam",country_code:"VN",latitude:10.82,longitude:106.63,tier:3},
  {name:"Kuala Lumpur",country:"Malaysia",country_code:"MY",latitude:3.14,longitude:101.69,tier:3},
  {name:"Tel Aviv",country:"Israele",country_code:"IL",latitude:32.08,longitude:34.78,tier:3},
  {name:"Casablanca",country:"Marocco",country_code:"MA",latitude:33.59,longitude:-7.62,tier:3},
  {name:"Nairobi",country:"Kenya",country_code:"KE",latitude:-1.29,longitude:36.82,tier:3},
  {name:"Accra",country:"Ghana",country_code:"GH",latitude:5.56,longitude:-0.21,tier:3},
  {name:"Osaka",country:"Giappone",country_code:"JP",latitude:34.69,longitude:135.5,tier:3},
  {name:"Taipei",country:"Taiwan",country_code:"TW",latitude:25.05,longitude:121.53,tier:3},
  {name:"Lima",country:"Perù",country_code:"PE",latitude:-12.05,longitude:-77.04,tier:3},
  {name:"Santiago",country:"Cile",country_code:"CL",latitude:-33.45,longitude:-70.67,tier:3},
];

interface Props {
  trips: Trip[];
  selectedId?: string | null;
  onSelectTrip?: (t: Trip) => void;
  onSelectCity?: (city: CityInfo) => void;
  globeLabels?: GlobeLabels;
}

const GEO = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const GEO50 = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
const TEX_DAY = "https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-day.jpg";
const TEX_SAT = "https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-blue-marble.jpg";
const TEX_BUMP = "https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-topology.png";
const TEX_NIGHT = "https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-night.jpg";
const TEX_SPEC = "https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-water.png";

function ll(lat: number, lon: number, r = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function arcPoints(a: THREE.Vector3, b: THREE.Vector3, segs = 64): THREE.Vector3[] {
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

export function WorldMap({ trips, selectedId, onSelectTrip, onSelectCity, globeLabels = "major" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const earthMatRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const routesGroupRef = useRef<THREE.Group | null>(null);
  const labelsRootRef = useRef<HTMLDivElement | null>(null);
  const cityLabelsRef = useRef<{ el: HTMLDivElement; vec: THREE.Vector3; city: CityInfo }[]>([]);
  const bordersLowRef = useRef<THREE.Line[]>([]);
  const bordersHighRef = useRef<THREE.Line[]>([]);
  const bordersHighLoadedRef = useRef(false);

  const rotRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(3.2);
  const dragRef = useRef(false);
  const lpRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const autoRotRef = useRef(true);
  const liveLineRef = useRef<THREE.Line | null>(null);
  const replayRafRef = useRef<number | null>(null);
  const tripsRef = useRef(trips);
  const onSelectTripRef = useRef(onSelectTrip);
  const onSelectCityRef = useRef(onSelectCity);

  const [autoRotate, setAutoRotate] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => { tripsRef.current = trips; }, [trips]);
  useEffect(() => { onSelectTripRef.current = onSelectTrip; }, [onSelectTrip]);
  useEffect(() => { onSelectCityRef.current = onSelectCity; }, [onSelectCity]);
  useEffect(() => { autoRotRef.current = autoRotate; }, [autoRotate]);

  const ordered = useMemo(() => [...trips].sort((a, b) => a.trip_date.localeCompare(b.trip_date)), [trips]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Sharp canvas: set physical pixel size explicitly
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = container.clientWidth, h = container.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 1000);
    camera.position.set(0, 0, 3.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    const TL = new THREE.TextureLoader(); TL.setCrossOrigin("anonymous");

    // Earth
    const earthMat = new THREE.MeshPhongMaterial({ color: 0x1a3a5c, shininess: 8, emissive: new THREE.Color(0x99b0c8), emissiveIntensity: 0.3 });
    earthMatRef.current = earthMat;
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), earthMat);
    earthRef.current = earth;
    scene.add(earth);

    TL.load(TEX_BUMP,  t => { earthMat.bumpMap = t; earthMat.bumpScale = 0.035; earthMat.needsUpdate = true; }, undefined, () => {});
    TL.load(TEX_SPEC,  t => { earthMat.specularMap = t; earthMat.specular = new THREE.Color(0x223344); earthMat.needsUpdate = true; }, undefined, () => {});
    TL.load(TEX_NIGHT, t => { t.colorSpace = THREE.SRGBColorSpace; earthMat.emissiveMap = t; earthMat.needsUpdate = true; }, undefined, () => {});
    TL.load(TEX_DAY,   t => {
      t.colorSpace = THREE.SRGBColorSpace;
      earthMat.map = t;
      earthMat.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
        {vec3 c=diffuseColor.rgb;
        float om=smoothstep(0.0,0.18,c.b-max(c.r,c.g-0.04));c=mix(c,vec3(0.04,0.10,0.22),om*0.92);
        float gm=smoothstep(0.0,0.12,c.g-max(c.r*0.95,c.b));c=mix(c,vec3(0.42,0.58,0.18),gm*0.65);
        float sm=smoothstep(0.0,0.05,min(c.r,c.g)-c.b)*smoothstep(0.26,0.42,c.r);
        float w2=smoothstep(0.0,0.18,c.r-c.g);
        vec3 st=mix(vec3(0.96,0.90,0.72),vec3(0.90,0.78,0.46),smoothstep(0.0,0.5,w2));
        st=mix(st,vec3(0.80,0.58,0.28),smoothstep(0.4,0.85,w2));
        c=mix(c,st,sm*0.85);c=mix(c,c*1.12,(1.0-om)*0.5);diffuseColor.rgb=clamp(c,0.0,1.0);}`);
      };
      earthMat.color = new THREE.Color(0xffffff);
      earthMat.needsUpdate = true;
    }, undefined, () => {});

    // Atmosphere
    const atm = new THREE.ShaderMaterial({
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true,
      uniforms: { g: { value: new THREE.Color(0x7ec4ff) } },
      vertexShader: "varying vec3 N;void main(){N=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "varying vec3 N;uniform vec3 g;void main(){float i=pow(0.65-dot(N,vec3(0,0,1)),2.3);gl_FragColor=vec4(g,1.)*i;}"
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.18, 64, 64), atm));

    // Lights
    const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(5, 3, 5); scene.add(sun);
    scene.add(new THREE.AmbientLight(0x88aacc, 1.0));
    const fill = new THREE.DirectionalLight(0xaaccee, 0.6); fill.position.set(-5, -2, -3); scene.add(fill);

    // Stars
    const sp = new Float32Array(3000 * 3);
    for (let i = 0; i < 3000; i++) {
      const r = 80 + Math.random() * 40, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      sp[i*3] = r*Math.sin(p)*Math.cos(t); sp[i*3+1] = r*Math.sin(p)*Math.sin(t); sp[i*3+2] = r*Math.cos(p);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.75 })));

    // Borders (110m — always loaded)
    fetch(GEO).then(r => r.json()).then((topo: any) => {
      const geoData: any = feature(topo, topo.objects.countries);
      const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.38, 0.38, 0.38), depthWrite: false });
      const addRing = (ring: number[][]) => {
        const pts = ring.map(([lon, lat]) => ll(lat, lon, 1.002));
        if (pts.length < 2) return;
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
        line.visible = false;
        earth.add(line);
        bordersLowRef.current.push(line);
      };
      for (const f of geoData.features) {
        const g = f.geometry; if (!g) continue;
        if (g.type === "Polygon") g.coordinates.forEach(addRing);
        else if (g.type === "MultiPolygon") g.coordinates.forEach((p: number[][][]) => p.forEach(addRing));
      }
    }).catch(() => {});

    // Markers & routes
    const MG = new THREE.Group(); earth.add(MG); markersGroupRef.current = MG;
    const RG = new THREE.Group(); earth.add(RG); routesGroupRef.current = RG;

    // City labels overlay
    const labelsRoot = document.createElement("div");
    labelsRoot.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
    container.appendChild(labelsRoot);
    labelsRootRef.current = labelsRoot;

    // City click overlay (separate div with pointer-events)
    const cityClickRoot = document.createElement("div");
    cityClickRoot.style.cssText = "position:absolute;inset:0;overflow:hidden;";
    container.appendChild(cityClickRoot);

    CITIES.forEach(city => {
      const el = document.createElement("div");
      const dotSize = city.tier === 1 ? 6 : city.tier === 2 ? 4.5 : 3;
      el.style.cssText = `position:absolute;transform:translate(-50%,-50%);opacity:0;display:flex;align-items:center;gap:3px;white-space:nowrap;cursor:pointer;transition:opacity 0.2s`;
      const dot = document.createElement("div");
      dot.style.cssText = `width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:rgba(255,255,255,${city.tier===1?0.95:0.75});flex-shrink:0;box-shadow:0 0 4px rgba(0,0,0,0.9);transition:transform 0.15s`;
      const lbl = document.createElement("span");
      lbl.textContent = city.name;
      lbl.style.cssText = `font-size:${city.tier===1?11:city.tier===2?10:9}px;font-family:ui-sans-serif,system-ui,sans-serif;color:rgba(255,255,255,${city.tier===1?0.95:city.tier===2?0.85:0.7});font-weight:${city.tier===1?700:600};text-shadow:0 0 4px #000,1px 0 2px #000,-1px 0 2px #000,0 1px 2px #000,0 -1px 2px #000;pointer-events:none`;
      el.appendChild(dot); el.appendChild(lbl);
      cityClickRoot.appendChild(el);

      el.addEventListener("mouseenter", () => { dot.style.transform = "scale(1.5)"; dot.style.background = "#22d3ee"; });
      el.addEventListener("mouseleave", () => { dot.style.transform = "scale(1)"; dot.style.background = `rgba(255,255,255,${city.tier===1?0.95:0.75})`; });
      el.addEventListener("click", (e) => { e.stopPropagation(); onSelectCityRef.current?.(city); });

      cityLabelsRef.current.push({ el, vec: ll(city.latitude, city.longitude, 1.006), city });
    });

    // Interaction
    const ray = new THREE.Raycaster();
    const onPointerDown = (e: PointerEvent) => {
      dragRef.current = true;
      lpRef.current = { x: e.clientX, y: e.clientY };
      velRef.current = { x: 0, y: 0 };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - lpRef.current.x, dy = e.clientY - lpRef.current.y;
      rotRef.current.y += dx * 0.005; rotRef.current.x += dy * 0.005;
      rotRef.current.x = Math.max(-Math.PI/2+0.05, Math.min(Math.PI/2-0.05, rotRef.current.x));
      velRef.current = { x: dy * 0.005, y: dx * 0.005 };
      lpRef.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => { dragRef.current = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current = Math.max(1.1, Math.min(8, zoomRef.current * (e.deltaY > 0 ? 1.1 : 0.9)));
    };
    const onClick = (e: MouseEvent) => {
      if (Math.abs(velRef.current.x) > 0.005 || Math.abs(velRef.current.y) > 0.005) return;
      const rc = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX-rc.left)/rc.width)*2-1, -((e.clientY-rc.top)/rc.height)*2+1), camera);
      const hits = ray.intersectObjects(MG.children, false);
      const id = (hits[0]?.object as any)?.userData?.tripId;
      if (id) { const t = tripsRef.current.find(x => x.id === id); if (t) onSelectTripRef.current?.(t); }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("click", onClick);

    // Resize
    const ro = new ResizeObserver(() => {
      if (!rendererRef.current || !cameraRef.current) return;
      const dpr2 = Math.min(window.devicePixelRatio, 2);
      const w2 = container.clientWidth, h2 = container.clientHeight;
      canvas.width = Math.round(w2 * dpr2); canvas.height = Math.round(h2 * dpr2);
      canvas.style.width = w2 + "px"; canvas.style.height = h2 + "px";
      rendererRef.current.setSize(w2, h2, false);
      cameraRef.current.aspect = w2 / h2; cameraRef.current.updateProjectionMatrix();
    });
    ro.observe(container);

    // Animate
    const animate = () => {
      const rot = rotRef.current, vel = velRef.current;
      if (!dragRef.current) {
        if (autoRotRef.current && Math.abs(vel.x) < 0.0005 && Math.abs(vel.y) < 0.0005) {
          rot.y += 0.0008;
        } else {
          rot.y += vel.y; rot.x += vel.x; vel.x *= 0.94; vel.y *= 0.94;
        }
        rot.x = Math.max(-Math.PI/2+0.05, Math.min(Math.PI/2-0.05, rot.x));
      }
      earth.rotation.y = rot.y; earth.rotation.x = rot.x;
      camera.position.z += (zoomRef.current - camera.position.z) * 0.12;
      const z = camera.position.z;

      // Borders LOD
      const showLow = z < 3.5, showHigh = z < 2.0;
      bordersLowRef.current.forEach(l => { if (l.visible !== showLow) l.visible = showLow; });
      if (showHigh && !bordersHighLoadedRef.current) {
        bordersHighLoadedRef.current = true;
        fetch(GEO50).then(r => r.json()).then((topo: any) => {
          const geoData: any = feature(topo, topo.objects.countries);
          const mat2 = new THREE.LineBasicMaterial({ color: new THREE.Color(0.25, 0.25, 0.25), depthWrite: false });
          const addRing2 = (ring: number[][]) => {
            const pts = ring.map(([lon, lat]) => ll(lat, lon, 1.0018));
            if (pts.length < 2) return;
            const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat2);
            line.visible = false; earth.add(line); bordersHighRef.current.push(line);
          };
          for (const f of geoData.features) {
            const g = f.geometry; if (!g) continue;
            if (g.type === "Polygon") g.coordinates.forEach(addRing2);
            else if (g.type === "MultiPolygon") g.coordinates.forEach((p: number[][][]) => p.forEach(addRing2));
          }
        }).catch(() => {});
      }
      bordersHighRef.current.forEach(l => { if (l.visible !== showHigh) l.visible = showHigh; });

      // City labels LOD
      const cw = container.clientWidth, ch = container.clientHeight;
      const euler = new THREE.Euler(rot.x, rot.y, 0, "XYZ");
      cityLabelsRef.current.forEach(({ el, vec, city }) => {
        const wv = vec.clone().applyEuler(euler);
        const maxTier = globeLabels === "none" ? 0 : globeLabels === "capitals" ? 1 : globeLabels === "major" ? 2 : 3;
        const show = wv.z > 0.1 && city.tier <= maxTier && (city.tier === 1 ? z < 3.0 : city.tier === 2 ? z < 2.1 : z < 1.6);
        const cur = parseFloat(el.style.opacity) || 0;
        const next = cur + ((show ? 1 : 0) - cur) * 0.12;
        el.style.opacity = next < 0.02 ? "0" : next > 0.98 ? "1" : String(next);
        el.style.pointerEvents = show ? "auto" : "none";
        if (show) {
          const proj = wv.clone().project(camera);
          el.style.left = `${(proj.x * 0.5 + 0.5) * cw}px`;
          el.style.top = `${(-proj.y * 0.5 + 0.5) * ch}px`;
        }
      });

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("click", onClick);
      labelsRoot.remove();
      cityClickRoot.remove();
      renderer.dispose();
    };
  }, []);

  // ── Rebuild markers when trips/selection change ────────────────────────────
  useEffect(() => {
    const MG = markersGroupRef.current, RG = routesGroupRef.current;
    if (!MG || !RG) return;
    while (MG.children.length) { const c = MG.children.pop()!; (c as any).geometry?.dispose(); (c as any).material?.dispose(); }
    while (RG.children.length) { const c = RG.children.pop()!; (c as any).geometry?.dispose(); (c as any).material?.dispose(); }
    if (!ordered.length) return;
    const home = ordered[0];
    const homePos = ll(home.home_latitude, home.home_longitude, 1.005);
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
    hm.position.copy(homePos); hm.userData = { labelId: "home", text: home.home_label }; MG.add(hm);
    const positions = [homePos];
    ordered.forEach((t, i) => {
      const p = ll(t.latitude, t.longitude, 1.005); positions.push(p);
      const sel = t.id === selectedId;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(sel ? 0.022 : 0.014, 16, 16), new THREE.MeshBasicMaterial({ color: sel ? 0x5eead4 : 0x22d3ee }));
      dot.position.copy(p); dot.userData = { tripId: t.id, labelId: `t-${t.id}`, text: `${i+1}. ${t.city}` }; MG.add(dot);
    });
    for (let i = 0; i < positions.length - 1; i++) {
      RG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPoints(positions[i], positions[i+1])), new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 })));
    }
  }, [ordered, selectedId]);

  // ── Focus on selected trip ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    const t = ordered.find(x => x.id === selectedId); if (!t) return;
    rotRef.current.y = -t.longitude * (Math.PI / 180) - Math.PI / 2;
    rotRef.current.x = t.latitude * (Math.PI / 180);
    velRef.current = { x: 0, y: 0 };
    zoomRef.current = Math.min(zoomRef.current, 2.2);
  }, [selectedId, ordered]);

  // ── Globe style change ─────────────────────────────────────────────────────
  // (handled by parent re-rendering with new globeStyle prop — not implemented here for simplicity)

  // ── Replay ────────────────────────────────────────────────────────────────
  const stopReplay = () => {
    if (replayRafRef.current) cancelAnimationFrame(replayRafRef.current);
    setPlaying(false);
    const RG = routesGroupRef.current; if (!RG) return;
    RG.children.forEach(c => { if (c !== liveLineRef.current) ((c as THREE.Line).material as any).opacity = 0.85; });
    if (liveLineRef.current) {
      RG.remove(liveLineRef.current);
      (liveLineRef.current.geometry as any).dispose?.();
      (liveLineRef.current.material as any).dispose?.();
      liveLineRef.current = null;
    }
  };

  const startReplay = () => {
    const RG = routesGroupRef.current; if (!RG || !ordered.length || playing) return;
    setPlaying(true); setAutoRotate(false);
    const homePos = ll(ordered[0].home_latitude, ordered[0].home_longitude, 1.005);
    const allArcs: { pts: THREE.Vector3[]; tgt: { lat: number; lon: number } }[] = [];
    let prev = homePos;
    ordered.forEach(t => { const p = ll(t.latitude, t.longitude, 1.005); allArcs.push({ pts: arcPoints(prev, p, 80), tgt: { lat: t.latitude, lon: t.longitude } }); prev = p; });
    RG.children.forEach(c => ((c as THREE.Line).material as any).opacity = 0.15);
    const lg = new THREE.BufferGeometry(), lm = new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 1 });
    const ll2 = new THREE.Line(lg, lm); RG.add(ll2); liveLineRef.current = ll2;
    let ai = 0, t0 = performance.now(); const PA = 1800, acc: THREE.Vector3[] = [];
    const step = (now: number) => {
      const arc = allArcs[ai], t = Math.min(1, (now - t0) / PA);
      lg.setFromPoints([...acc, ...arc.pts.slice(0, Math.max(2, Math.floor(arc.pts.length * t)))]);
      rotRef.current.y += (-arc.tgt.lon*(Math.PI/180)-Math.PI/2 - rotRef.current.y) * 0.06;
      rotRef.current.x += (arc.tgt.lat*(Math.PI/180) - rotRef.current.x) * 0.06;
      zoomRef.current += (2.0 - zoomRef.current) * 0.04;
      if (t >= 1) {
        acc.push(...arc.pts); ai++; t0 = now;
        if (ai >= allArcs.length) { stopReplay(); zoomRef.current = 3.0; return; }
      }
      replayRafRef.current = requestAnimationFrame(step);
    };
    replayRafRef.current = requestAnimationFrame(step);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full rounded-2xl overflow-hidden border border-border"
      style={{ background: "radial-gradient(ellipse at center, #061226 0%, #02060f 70%, #000 100%)" }}>
      <canvas ref={canvasRef} className="w-full h-full" />

      <div className="absolute top-3 right-3 bg-card/80 backdrop-blur border border-border rounded-lg flex p-1 gap-1 z-40">
        <button onClick={() => setAutoRotate(v => !v)}
          className={`px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1 ${autoRotate ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <RotateCw className="w-3 h-3" />
          {autoRotate ? "Auto" : "Manuale"}
        </button>
      </div>

      {trips.length >= 1 && (
        <div className="absolute bottom-3 left-3 bg-card/80 backdrop-blur border border-border rounded-lg px-2 py-1.5 flex items-center gap-1 z-40">
          {!playing
            ? <button onClick={startReplay} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-secondary transition-colors"><Play className="w-3.5 h-3.5" /> Replay</button>
            : <button onClick={stopReplay} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-secondary transition-colors"><Square className="w-3.5 h-3.5" /> Stop</button>
          }
        </div>
      )}

      <div className="absolute bottom-3 right-3 bg-card/80 backdrop-blur border border-border rounded-lg px-3 py-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground z-40">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /> Casa</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary" /> Tappa</div>
      </div>

      <div className="absolute top-3 left-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 pointer-events-none z-40">
        Trascina · Scroll zoom · Click città
      </div>
    </div>
  );
}
