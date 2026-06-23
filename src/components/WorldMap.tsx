import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import { Trip } from "@/lib/storage";
import { GlobeLabels, AutoRotate } from "@/lib/settings";
import { RotateCw, Play, Square } from "lucide-react";

export interface CityInfo {
  name: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  tier: 1 | 2 | 3;
}

// ── Label data ────────────────────────────────────────────────────────────────
// Countries — always visible, large text
// tier 1 = very large countries (show from z<2.8), tier 2 = medium (z<2.2), tier 3 = small (z<1.8)
const COUNTRIES: { name: string; lat: number; lon: number; tier: 1|2|3 }[] = [
  // Tier 1 — largest countries, always visible when zoomed in a bit
  {name:"Russia",lat:61,lon:105,tier:1},{name:"Canada",lat:60,lon:-96,tier:1},
  {name:"USA",lat:38,lon:-97,tier:1},{name:"Cina",lat:35,lon:103,tier:1},
  {name:"Brasile",lat:-10,lon:-53,tier:1},{name:"Australia",lat:-25,lon:134,tier:1},
  {name:"India",lat:21,lon:78,tier:1},{name:"Argentina",lat:-35,lon:-65,tier:1},
  {name:"Kazakistan",lat:48,lon:68,tier:1},{name:"Algeria",lat:28,lon:2,tier:1},
  {name:"Sudan",lat:15,lon:30,tier:1},{name:"Congo",lat:-2,lon:23,tier:1},
  {name:"Arabia Saudita",lat:24,lon:45,tier:1},{name:"Messico",lat:23,lon:-102,tier:1},
  {name:"Indonesia",lat:-2,lon:116,tier:1},{name:"Libia",lat:26,lon:17,tier:1},
  {name:"Iran",lat:32,lon:54,tier:1},{name:"Mongolia",lat:46,lon:105,tier:1},
  {name:"Mali",lat:17,lon:-2,tier:1},{name:"Angola",lat:-12,lon:18,tier:1},
  {name:"Sud Africa",lat:-29,lon:25,tier:1},{name:"Colombia",lat:4,lon:-73,tier:1},
  {name:"Etiopia",lat:9,lon:40,tier:1},{name:"Bolivia",lat:-17,lon:-65,tier:1},
  {name:"Mauritania",lat:20,lon:-11,tier:1},{name:"Egitto",lat:26,lon:30,tier:1},
  {name:"Nigeria",lat:9,lon:8,tier:1},{name:"Tanzania",lat:-6,lon:35,tier:1},
  {name:"Perù",lat:-10,lon:-75,tier:1},{name:"Venezuela",lat:8,lon:-66,tier:1},
  // Tier 2 — medium countries, show z<2.2
  {name:"Namibia",lat:-22,lon:18,tier:2},{name:"Mozambico",lat:-18,lon:35,tier:2},
  {name:"Pakistan",lat:30,lon:70,tier:2},{name:"Turchia",lat:39,lon:35,tier:2},
  {name:"Ciad",lat:15,lon:18,tier:2},{name:"Niger",lat:17,lon:8,tier:2},
  {name:"Zambia",lat:-14,lon:28,tier:2},{name:"Somalia",lat:6,lon:46,tier:2},
  {name:"Francia",lat:46,lon:2,tier:2},{name:"Spagna",lat:40,lon:-3,tier:2},
  {name:"Svezia",lat:63,lon:16,tier:2},{name:"Norvegia",lat:65,lon:13,tier:2},
  {name:"Germania",lat:51,lon:10,tier:2},{name:"Finlandia",lat:64,lon:26,tier:2},
  {name:"Marocco",lat:32,lon:-6,tier:2},{name:"Giappone",lat:37,lon:138,tier:2},
  {name:"Corea",lat:37,lon:127,tier:2},{name:"Vietnam",lat:16,lon:108,tier:2},
  {name:"Ucraina",lat:49,lon:32,tier:2},{name:"Iraq",lat:33,lon:44,tier:2},
  {name:"Afghanistan",lat:34,lon:66,tier:2},{name:"Malesia",lat:3,lon:113,tier:2},
  {name:"Yemen",lat:16,lon:48,tier:2},{name:"Uzbekistan",lat:41,lon:63,tier:2},
  {name:"Regno Unito",lat:54,lon:-2,tier:2},{name:"Italia",lat:43,lon:12,tier:2},
  {name:"Camerun",lat:6,lon:12,tier:2},{name:"Madagascar",lat:-20,lon:47,tier:2},
  {name:"Ghana",lat:8,lon:-1,tier:2},{name:"Senegal",lat:14,lon:-14,tier:2},
  // Tier 3 — smaller, show z<1.8
  {name:"Polonia",lat:52,lon:19,tier:3},{name:"Romania",lat:46,lon:25,tier:3},
  {name:"Siria",lat:35,lon:38,tier:3},{name:"Myanmar",lat:19,lon:96,tier:3},
  {name:"Tailandia",lat:15,lon:101,tier:3},{name:"Tunisia",lat:34,lon:9,tier:3},
  {name:"Bulgaria",lat:43,lon:25,tier:3},{name:"Ungheria",lat:47,lon:19,tier:3},
  {name:"Grecia",lat:39,lon:22,tier:3},{name:"Belarus",lat:53,lon:28,tier:3},
  {name:"Kirghizistan",lat:41,lon:75,tier:3},{name:"Tagikistan",lat:39,lon:71,tier:3},
  {name:"Turkmenistan",lat:40,lon:59,tier:3},{name:"Bangladesh",lat:23,lon:90,tier:3},
  {name:"Oman",lat:22,lon:57,tier:3},{name:"Sri Lanka",lat:8,lon:81,tier:3},
];

// Cities tier 1 — show at zoom < 3.0
const CITIES_T1: CityInfo[] = [
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
];
// Cities tier 2 — show at zoom < 2.1
const CITIES_T2: CityInfo[] = [
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
  {name:"Bangkok",country:"Tailandia",country_code:"TH",latitude:13.75,longitude:100.52,tier:2},
  {name:"Singapore",country:"Singapore",country_code:"SG",latitude:1.35,longitude:103.82,tier:2},
  {name:"Amsterdam",country:"Paesi Bassi",country_code:"NL",latitude:52.37,longitude:4.9,tier:2},
  {name:"Vienna",country:"Austria",country_code:"AT",latitude:48.21,longitude:16.37,tier:2},
  {name:"Kyiv",country:"Ucraina",country_code:"UA",latitude:50.45,longitude:30.52,tier:2},
  {name:"Città del Messico",country:"Messico",country_code:"MX",latitude:19.43,longitude:-99.13,tier:2},
  {name:"Johannesburg",country:"Sudafrica",country_code:"ZA",latitude:-26.2,longitude:28.04,tier:2},
];
// Cities tier 3 — show at zoom < 1.6
const CITIES_T3: CityInfo[] = [
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
  {name:"Tel Aviv",country:"Israele",country_code:"IL",latitude:32.08,longitude:34.78,tier:3},
  {name:"Casablanca",country:"Marocco",country_code:"MA",latitude:33.59,longitude:-7.62,tier:3},
  {name:"Nairobi",country:"Kenya",country_code:"KE",latitude:-1.29,longitude:36.82,tier:3},
  {name:"Osaka",country:"Giappone",country_code:"JP",latitude:34.69,longitude:135.5,tier:3},
  {name:"Lima",country:"Perù",country_code:"PE",latitude:-12.05,longitude:-77.04,tier:3},
  {name:"Santiago",country:"Cile",country_code:"CL",latitude:-33.45,longitude:-70.67,tier:3},
];

export const ALL_CITIES: CityInfo[] = [...CITIES_T1, ...CITIES_T2, ...CITIES_T3];

interface Props {
  trips: Trip[];
  selectedId?: string | null;
  onSelectTrip?: (t: Trip) => void;
  onSelectCity?: (city: CityInfo) => void;
  globeLabels?: GlobeLabels;
  autoRotateSetting?: AutoRotate;
}

const TEX_DAY   = "https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-day.jpg";
const TEX_SAT   = "https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-blue-marble.jpg";
const TEX_BUMP  = "https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-topology.png";
const TEX_NIGHT = "https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-night.jpg";
const TEX_SPEC  = "https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-water.png";
const GEO_LOW   = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const GEO_HIGH  = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

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

// Text shadow style used for all labels
const SHADOW = "0 0 6px rgba(0,0,0,1),0 0 3px rgba(0,0,0,1),1px 1px 2px rgba(0,0,0,0.9),-1px -1px 2px rgba(0,0,0,0.9)";

export function WorldMap({ trips, selectedId, onSelectTrip, onSelectCity, globeLabels = "major", autoRotateSetting = "on" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
  const earthRef     = useRef<THREE.Mesh | null>(null);
  const MG           = useRef<THREE.Group | null>(null);
  const RG           = useRef<THREE.Group | null>(null);

  const countryLabelEls = useRef<{ el: HTMLDivElement; vec: THREE.Vector3; tier: 1|2|3 }[]>([]);
  const cityLabelEls    = useRef<{ el: HTMLDivElement; vec: THREE.Vector3; city: CityInfo }[]>([]);
  const bordersLow  = useRef<THREE.Line[]>([]);
  const bordersHigh = useRef<THREE.Line[]>([]);
  const highLoaded  = useRef(false);

  const rotRef  = useRef({ x: 0, y: 0 });
  const velRef  = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(3.2);
  const dragRef = useRef(false);
  const lpRef   = useRef({ x: 0, y: 0 });
  const rafRef  = useRef(0);
  const autoRotRef     = useRef(true);
  const liveLineRef    = useRef<THREE.Line | null>(null);
  const replayRafRef   = useRef<number | null>(null);
  const tripsRef       = useRef(trips);
  const onSelectTripRef = useRef(onSelectTrip);
  const onSelectCityRef = useRef(onSelectCity);
  const globeLabelsRef  = useRef(globeLabels);

  const [autoRotate, setAutoRotate] = useState(autoRotateSetting === "on");
  const [playing, setPlaying]       = useState(false);

  useEffect(() => { tripsRef.current = trips; }, [trips]);
  useEffect(() => { onSelectTripRef.current = onSelectTrip; }, [onSelectTrip]);
  useEffect(() => { onSelectCityRef.current = onSelectCity; }, [onSelectCity]);
  useEffect(() => { autoRotRef.current = autoRotate; }, [autoRotate]);
  useEffect(() => { globeLabelsRef.current = globeLabels; }, [globeLabels]);

  const ordered = useMemo(() => [...trips].sort((a, b) => a.trip_date.localeCompare(b.trip_date)), [trips]);

  // ── Init Three.js ────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;

    // Sharp canvas
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = container.clientWidth, h = container.clientHeight;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width  = w + "px";
    canvas.style.height = h + "px";

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(40, w / h, 0.01, 1000);
    camera.position.set(0, 0, 3.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // Earth
    const TL = new THREE.TextureLoader(); TL.setCrossOrigin("anonymous");
    const earthMat = new THREE.MeshPhongMaterial({ color: 0x1a3a5c, shininess: 8, emissive: new THREE.Color(0x99b0c8), emissiveIntensity: 0.3 });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), earthMat);
    earthRef.current = earth;
    scene.add(earth);

    TL.load(TEX_BUMP,  t => { earthMat.bumpMap = t; earthMat.bumpScale = 0.035; earthMat.needsUpdate = true; }, undefined, () => {});
    TL.load(TEX_SPEC,  t => { earthMat.specularMap = t; earthMat.specular = new THREE.Color(0x223344); earthMat.needsUpdate = true; }, undefined, () => {});
    TL.load(TEX_NIGHT, t => { t.colorSpace = THREE.SRGBColorSpace; earthMat.emissiveMap = t; earthMat.needsUpdate = true; }, undefined, () => {});
    TL.load(TEX_DAY, t => {
      t.colorSpace = THREE.SRGBColorSpace;
      earthMat.map = t;
      earthMat.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
        {vec3 c=diffuseColor.rgb;
        float om=smoothstep(0.0,0.18,c.b-max(c.r,c.g-0.04));c=mix(c,vec3(0.04,0.10,0.22),om*0.92);
        float gm=smoothstep(0.0,0.12,c.g-max(c.r*0.95,c.b));c=mix(c,vec3(0.42,0.58,0.18),gm*0.65);
        float sm=smoothstep(0.0,0.05,min(c.r,c.g)-c.b)*smoothstep(0.26,0.42,c.r);
        float ww=smoothstep(0.0,0.18,c.r-c.g);
        vec3 st=mix(vec3(0.96,0.90,0.72),vec3(0.90,0.78,0.46),smoothstep(0.0,0.5,ww));
        st=mix(st,vec3(0.80,0.58,0.28),smoothstep(0.4,0.85,ww));
        c=mix(c,st,sm*0.85);c=mix(c,c*1.12,(1.0-om)*0.5);diffuseColor.rgb=clamp(c,0.0,1.0);}`);
      };
      earthMat.color = new THREE.Color(0xffffff);
      earthMat.needsUpdate = true;
    }, undefined, () => {});

    // Atmosphere
    const atm = new THREE.ShaderMaterial({
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true,
      uniforms: { g: { value: new THREE.Color(0x7ec4ff) } },
      vertexShader:   "varying vec3 N;void main(){N=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "varying vec3 N;uniform vec3 g;void main(){float i=pow(0.65-dot(N,vec3(0,0,1)),2.3);gl_FragColor=vec4(g,1.)*i;}"
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.18, 64, 64), atm));

    // Lights + stars
    const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(5, 3, 5); scene.add(sun);
    scene.add(new THREE.AmbientLight(0x88aacc, 1.0));
    const fill = new THREE.DirectionalLight(0xaaccee, 0.6); fill.position.set(-5, -2, -3); scene.add(fill);
    const sp = new Float32Array(3000 * 3);
    for (let i = 0; i < 3000; i++) {
      const r = 80 + Math.random() * 40, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      sp[i*3] = r*Math.sin(p)*Math.cos(t); sp[i*3+1] = r*Math.sin(p)*Math.sin(t); sp[i*3+2] = r*Math.cos(p);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.75 })));

    // Borders 110m
    fetch(GEO_LOW).then(r => r.json()).then((topo: any) => {
      const geo: any = feature(topo, topo.objects.countries);
      const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.45, 0.45, 0.45), depthWrite: false });
      for (const f of geo.features) {
        const g = f.geometry; if (!g) continue;
        const addRing = (ring: number[][]) => {
          const pts = ring.map(([lo, la]) => ll(la, lo, 1.002));
          if (pts.length < 2) return;
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
          line.visible = false; earth.add(line); bordersLow.current.push(line);
        };
        if (g.type === "Polygon") g.coordinates.forEach(addRing);
        else if (g.type === "MultiPolygon") g.coordinates.forEach((p: number[][][]) => p.forEach(addRing));
      }
    }).catch(() => {});

    // Markers + routes groups
    const mg = new THREE.Group(); earth.add(mg); MG.current = mg;
    const rg = new THREE.Group(); earth.add(rg); RG.current = rg;

    // ── Labels overlay ────────────────────────────────────────────────────
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;";
    container.appendChild(overlay);

    // Country labels — mixed case, no pointer events
    COUNTRIES.forEach(({ name, lat, lon, tier }) => {
      const el = document.createElement("div");
      el.textContent = name;
      el.style.cssText = `position:absolute;transform:translate(-50%,-50%);pointer-events:none;white-space:nowrap;font-family:ui-sans-serif,system-ui,sans-serif;font-size:10px;font-weight:500;letter-spacing:0.5px;color:rgba(255,255,255,0.8);text-shadow:${SHADOW};opacity:0;transition:opacity 0.25s`;
      overlay.appendChild(el);
      countryLabelEls.current.push({ el, vec: ll(lat, lon, 1.005), tier });
    });

    // City labels + click targets
    const cityOverlay = document.createElement("div");
    cityOverlay.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;";
    container.appendChild(cityOverlay);

    ALL_CITIES.forEach(city => {
      const wrap = document.createElement("div");
      wrap.style.cssText = `position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:3px;white-space:nowrap;opacity:0;cursor:pointer;pointer-events:auto;transition:opacity 0.2s`;
      const dot = document.createElement("div");
      const ds = city.tier === 1 ? 5 : city.tier === 2 ? 4 : 3;
      dot.style.cssText = `width:${ds}px;height:${ds}px;border-radius:50%;background:rgba(255,255,255,0.9);flex-shrink:0;box-shadow:0 0 4px rgba(0,0,0,0.9);transition:transform 0.15s,background 0.15s`;
      const lbl = document.createElement("span");
      lbl.textContent = city.name;
      lbl.style.cssText = `font-family:ui-sans-serif,system-ui,sans-serif;font-size:${city.tier===1?12:city.tier===2?11:10}px;font-weight:${city.tier===1?700:600};color:rgba(255,255,255,${city.tier===1?1:city.tier===2?0.9:0.8});text-shadow:${SHADOW};pointer-events:none`;
      wrap.appendChild(dot); wrap.appendChild(lbl);
      cityOverlay.appendChild(wrap);
      wrap.addEventListener("mouseenter", () => { dot.style.transform = "scale(1.6)"; dot.style.background = "#22d3ee"; lbl.style.color = "#22d3ee"; });
      wrap.addEventListener("mouseleave", () => { dot.style.transform = ""; dot.style.background = "rgba(255,255,255,0.9)"; lbl.style.color = `rgba(255,255,255,${city.tier===1?1:city.tier===2?0.9:0.8})`; });
      wrap.addEventListener("click", e => { e.stopPropagation(); onSelectCityRef.current?.(city); });
      cityLabelEls.current.push({ el: wrap, vec: ll(city.latitude, city.longitude, 1.007), city });
    });

    // ── Interaction ───────────────────────────────────────────────────────
    const ray = new THREE.Raycaster();
    const onPD = (e: PointerEvent) => { dragRef.current = true; lpRef.current = { x: e.clientX, y: e.clientY }; velRef.current = { x: 0, y: 0 }; (e.target as Element).setPointerCapture?.(e.pointerId); };
    const onPM = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - lpRef.current.x, dy = e.clientY - lpRef.current.y;
      rotRef.current.y += dx * 0.005; rotRef.current.x += dy * 0.005;
      rotRef.current.x = Math.max(-Math.PI/2+0.05, Math.min(Math.PI/2-0.05, rotRef.current.x));
      velRef.current = { x: dy * 0.005, y: dx * 0.005 }; lpRef.current = { x: e.clientX, y: e.clientY };
    };
    const onPU = () => { dragRef.current = false; };
    const onW  = (e: WheelEvent) => { e.preventDefault(); zoomRef.current = Math.max(1.1, Math.min(8, zoomRef.current * (e.deltaY > 0 ? 1.1 : 0.9))); };
    const onC  = (e: MouseEvent) => {
      if (Math.abs(velRef.current.x) > 0.005 || Math.abs(velRef.current.y) > 0.005) return;
      const rc = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX-rc.left)/rc.width)*2-1,-((e.clientY-rc.top)/rc.height)*2+1), camera);
      const h = ray.intersectObjects(mg.children, false);
      const id = (h[0]?.object as any)?.userData?.tripId;
      if (id) { const t = tripsRef.current.find(x => x.id === id); if (t) onSelectTripRef.current?.(t); }
    };
    canvas.addEventListener("pointerdown", onPD);
    window.addEventListener("pointermove", onPM);
    window.addEventListener("pointerup", onPU);
    canvas.addEventListener("wheel", onW, { passive: false });
    canvas.addEventListener("click", onC);

    const ro = new ResizeObserver(() => {
      if (!rendererRef.current || !cameraRef.current) return;
      const dpr2 = Math.min(window.devicePixelRatio, 2);
      const w2 = container.clientWidth, h2 = container.clientHeight;
      canvas.width = Math.round(w2*dpr2); canvas.height = Math.round(h2*dpr2);
      canvas.style.width = w2+"px"; canvas.style.height = h2+"px";
      rendererRef.current.setSize(w2, h2, false);
      cameraRef.current.aspect = w2/h2; cameraRef.current.updateProjectionMatrix();
    });
    ro.observe(container);

    // ── Animate ───────────────────────────────────────────────────────────
    const animate = () => {
      const rot = rotRef.current, vel = velRef.current;
      if (!dragRef.current) {
        if (autoRotRef.current && Math.abs(vel.x) < 0.0005 && Math.abs(vel.y) < 0.0005) rot.y += 0.0008;
        else { rot.y += vel.y; rot.x += vel.x; vel.x *= 0.94; vel.y *= 0.94; }
        rot.x = Math.max(-Math.PI/2+0.05, Math.min(Math.PI/2-0.05, rot.x));
      }
      earth.rotation.y = rot.y; earth.rotation.x = rot.x;
      camera.position.z += (zoomRef.current - camera.position.z) * 0.12;
      const z = camera.position.z;

      // Borders
      const showLow = z < 3.8, showHigh = z < 2.2;
      bordersLow.current.forEach(l => { if (l.visible !== showLow) l.visible = showLow; });
      if (showHigh && !highLoaded.current) {
        highLoaded.current = true;
        fetch(GEO_HIGH).then(r => r.json()).then((topo: any) => {
          const geo: any = feature(topo, topo.objects.countries);
          const mat2 = new THREE.LineBasicMaterial({ color: new THREE.Color(0.3, 0.3, 0.3), depthWrite: false });
          for (const f of geo.features) {
            const g = f.geometry; if (!g) continue;
            const addR = (ring: number[][]) => {
              const pts = ring.map(([lo, la]) => ll(la, lo, 1.0018));
              if (pts.length < 2) return;
              const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat2);
              line.visible = false; earth.add(line); bordersHigh.current.push(line);
            };
            if (g.type === "Polygon") g.coordinates.forEach(addR);
            else if (g.type === "MultiPolygon") g.coordinates.forEach((p: number[][][]) => p.forEach(addR));
          }
        }).catch(() => {});
      }
      bordersHigh.current.forEach(l => { if (l.visible !== showHigh) l.visible = showHigh; });

      // Project labels
      const euler = new THREE.Euler(rot.x, rot.y, 0, "XYZ");
      const cw = container.clientWidth, ch = container.clientHeight;

      // Country labels — LOD by tier and zoom
      countryLabelEls.current.forEach(({ el, vec, tier }) => {
        const wv = vec.clone().applyEuler(euler);
        const onFront = wv.z > 0.15;
        const maxZ = tier === 1 ? 2.8 : tier === 2 ? 2.2 : 1.8;
        const show = onFront && z < maxZ;
        const targetOp = show ? Math.min(1, (maxZ - z) / 0.4 + 0.4) : 0;
        const cur = parseFloat(el.style.opacity) || 0;
        const next = cur + (Math.min(1, targetOp) - cur) * 0.1;
        el.style.opacity = next < 0.02 ? "0" : String(next);
        if (show && next > 0.01) {
          const proj = wv.clone().project(camera);
          el.style.left = `${(proj.x * 0.5 + 0.5) * cw}px`;
          el.style.top  = `${(-proj.y * 0.5 + 0.5) * ch}px`;
        }
      });

      // City labels — LOD by tier
      const gl = globeLabelsRef.current;
      const maxTier = gl === "none" ? 0 : gl === "capitals" ? 1 : gl === "major" ? 2 : 3;
      cityLabelEls.current.forEach(({ el, vec, city }) => {
        const wv = vec.clone().applyEuler(euler);
        const show = wv.z > 0.08 && city.tier <= maxTier && (city.tier === 1 ? z < 3.0 : city.tier === 2 ? z < 2.1 : z < 1.6);
        const cur = parseFloat(el.style.opacity) || 0;
        const next = cur + ((show ? 1 : 0) - cur) * 0.12;
        el.style.opacity = next < 0.02 ? "0" : next > 0.98 ? "1" : String(next);
        el.style.pointerEvents = show && next > 0.1 ? "auto" : "none";
        if (show) {
          const proj = wv.clone().project(camera);
          el.style.left = `${(proj.x * 0.5 + 0.5) * cw}px`;
          el.style.top  = `${(-proj.y * 0.5 + 0.5) * ch}px`;
        }
      });

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPD);
      window.removeEventListener("pointermove", onPM);
      window.removeEventListener("pointerup", onPU);
      canvas.removeEventListener("wheel", onW);
      canvas.removeEventListener("click", onC);
      overlay.remove(); cityOverlay.remove();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild markers ────────────────────────────────────────────────────────
  useEffect(() => {
    const mg = MG.current, rg = RG.current;
    if (!mg || !rg) return;
    while (mg.children.length) { const c = mg.children.pop()!; (c as any).geometry?.dispose(); (c as any).material?.dispose(); }
    while (rg.children.length) { const c = rg.children.pop()!; (c as any).geometry?.dispose(); (c as any).material?.dispose(); }
    if (!ordered.length) return;
    const home = ordered[0];
    const hp = ll(home.home_latitude, home.home_longitude, 1.005);
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
    hm.position.copy(hp); mg.add(hm);
    const pos = [hp];
    ordered.forEach(t => {
      const p = ll(t.latitude, t.longitude, 1.005); pos.push(p);
      const sel = t.id === selectedId;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(sel ? 0.022 : 0.015, 16, 16), new THREE.MeshBasicMaterial({ color: sel ? 0x5eead4 : 0x22d3ee }));
      dot.position.copy(p); dot.userData = { tripId: t.id }; mg.add(dot);
    });
    for (let i = 0; i < pos.length - 1; i++)
      rg.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPoints(pos[i], pos[i+1])), new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 })));
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

  // ── Replay ────────────────────────────────────────────────────────────────
  const stopReplay = () => {
    if (replayRafRef.current) cancelAnimationFrame(replayRafRef.current);
    setPlaying(false);
    const rg = RG.current; if (!rg) return;
    rg.children.forEach(c => { if (c !== liveLineRef.current) ((c as THREE.Line).material as any).opacity = 0.85; });
    if (liveLineRef.current) { rg.remove(liveLineRef.current); (liveLineRef.current.geometry as any).dispose?.(); (liveLineRef.current.material as any).dispose?.(); liveLineRef.current = null; }
  };

  const startReplay = () => {
    const rg = RG.current; if (!rg || !ordered.length || playing) return;
    setPlaying(true); setAutoRotate(false);
    const hp = ll(ordered[0].home_latitude, ordered[0].home_longitude, 1.005);
    const allA: { pts: THREE.Vector3[]; tgt: { lat: number; lon: number } }[] = [];
    let prev = hp;
    ordered.forEach(t => { const p = ll(t.latitude, t.longitude, 1.005); allA.push({ pts: arcPoints(prev, p, 80), tgt: { lat: t.latitude, lon: t.longitude } }); prev = p; });
    rg.children.forEach(c => ((c as THREE.Line).material as any).opacity = 0.15);
    const lg = new THREE.BufferGeometry(), lm = new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 1 });
    const ll2 = new THREE.Line(lg, lm); rg.add(ll2); liveLineRef.current = ll2;
    let ai = 0, t0 = performance.now(); const PA = 1800, acc: THREE.Vector3[] = [];
    const step = (now: number) => {
      const arc = allA[ai], t = Math.min(1, (now - t0) / PA);
      lg.setFromPoints([...acc, ...arc.pts.slice(0, Math.max(2, Math.floor(arc.pts.length * t)))]);
      rotRef.current.y += (-arc.tgt.lon*(Math.PI/180)-Math.PI/2 - rotRef.current.y) * 0.06;
      rotRef.current.x += (arc.tgt.lat*(Math.PI/180) - rotRef.current.x) * 0.06;
      zoomRef.current += (2.0 - zoomRef.current) * 0.04;
      if (t >= 1) { acc.push(...arc.pts); ai++; t0 = now; if (ai >= allA.length) { stopReplay(); zoomRef.current = 3.0; return; } }
      replayRafRef.current = requestAnimationFrame(step);
    };
    replayRafRef.current = requestAnimationFrame(step);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full rounded-2xl overflow-hidden border border-border"
      style={{ background: "radial-gradient(ellipse at center, #061226 0%, #02060f 70%, #000 100%)" }}>
      <canvas ref={canvasRef} className="w-full h-full" />

      <div className="absolute top-3 right-3 bg-black/50 backdrop-blur border border-white/10 rounded-lg flex p-1 gap-1 z-40">
        <button onClick={() => setAutoRotate(v => !v)}
          className={`px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1 ${autoRotate ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <RotateCw className="w-3 h-3" />
          {autoRotate ? "Auto" : "Manuale"}
        </button>
      </div>

      {trips.length >= 1 && (
        <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur border border-white/10 rounded-lg px-2 py-1.5 flex items-center gap-1 z-40">
          {!playing
            ? <button onClick={startReplay} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-white/10 transition-colors text-white"><Play className="w-3.5 h-3.5" /> Replay</button>
            : <button onClick={stopReplay}  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-white/10 transition-colors text-white"><Square className="w-3.5 h-3.5" /> Stop</button>
          }
        </div>
      )}

      <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur border border-white/10 rounded-lg px-3 py-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-white/60 z-40">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /> Casa</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-400" /> Tappa</div>
      </div>
    </div>
  );
}
