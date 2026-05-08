import { describe, it, expect, beforeEach, vi } from "vitest";

// ---- Mock topojson-client (used by WorldMap to draw borders) ----
vi.mock("topojson-client", () => ({
  feature: () => ({ features: [] }),
}));

// ---- Mock three.js so the WebGL pipeline doesn't crash inside jsdom.
// The mock is intentionally permissive: every property access returns a
// chainable stub. We keep a few typed surfaces (TextureLoader, WebGLRenderer,
// Group) so we can observe behaviour from the outside.
const loadedTextures: string[] = [];
const createdRenderers: any[] = [];

vi.mock("three", () => {
  const makeVec = (): any => {
    const v: any = {
      x: 0, y: 0, z: 0,
      set() { return v; },
      copy() { return v; },
      clone: () => makeVec(),
      add() { return v; },
      sub() { return v; },
      multiplyScalar() { return v; },
      normalize() { return v; },
      project() { return makeVec(); },
      angleTo: () => 1,
      dot: () => 1,
      lengthSq: () => 1,
      length: () => 1,
    };
    return v;
  };
  const stub = (extra: Record<string, any> = {}) => {
    const base: any = {
      position: makeVec(),
      rotation: { x: 0, y: 0, z: 0, copy() {}, set() {} },
      scale: makeVec(),
      children: [] as any[],
      userData: {},
      material: { dispose() {}, opacity: 1, color: { set() {} } },
      geometry: { dispose() {}, setFromPoints() { return base.geometry; }, setAttribute() {} },
      setAttribute() {},
      setFromPoints() { return base; },
      dispose() {},
      uniforms: {},
      visible: true,
      add(c: any) { base.children.push(c); return base; },
      remove(c: any) { base.children = base.children.filter((x: any) => x !== c); return base; },
      lookAt() {}, updateMatrixWorld() {},
      getWorldPosition: (target?: any) => target ?? makeVec(),
      ...extra,
    };
    return base;
  };
  class Group { constructor() { return stub(); } }
  class Mesh { constructor() { return stub(); } }
  class Line { constructor() { return stub(); } }
  class Points { constructor() { return stub(); } }
  class Scene { constructor() { return stub({ background: null }); } }
  class PerspectiveCamera {
    constructor() {
      return stub({
        aspect: 1, updateProjectionMatrix() {},
      });
    }
  }
  class WebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor() {
      this.domElement = document.createElement("canvas");
      (this.domElement as any).captureStream = () => ({});
      createdRenderers.push(this);
    }
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
    outputColorSpace = 0;
  }
  class TextureLoader {
    crossOrigin = "";
    load(url: string) {
      loadedTextures.push(url);
      return { colorSpace: 0 };
    }
  }
  // Generic constructor proxy for everything else (geometries, materials, lights…)
  const Generic: any = new Proxy(function () {}, {
    construct: () => stub(),
  });
  return {
    Scene, PerspectiveCamera, WebGLRenderer, TextureLoader,
    Group, Mesh, Line, Points,
    SphereGeometry: Generic, BufferGeometry: Generic, BufferAttribute: Generic,
    MeshPhongMaterial: Generic, MeshBasicMaterial: Generic, ShaderMaterial: Generic,
    LineBasicMaterial: Generic, PointsMaterial: Generic,
    AmbientLight: Generic, DirectionalLight: Generic, PointLight: Generic,
    Vector2: function () { return makeVec(); },
    Vector3: function () { return makeVec(); },
    Color: function () { return { set() {}, copy() {} }; },
    CatmullRomCurve3: Generic, TubeGeometry: Generic,
    Raycaster: function () {
      return { setFromCamera() {}, intersectObjects: () => [] };
    },
    SRGBColorSpace: 0, BackSide: 0, FrontSide: 0, DoubleSide: 0,
    AdditiveBlending: 0, NormalBlending: 0,
  };
});

// ---- After mocks are wired, import the SUT ----
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SettingsProvider } from "@/lib/settings";
import { WorldMap } from "@/components/WorldMap";
import SettingsPage from "@/pages/Settings";
import type { LocalTrip } from "@/lib/storage";

const trips: LocalTrip[] = [
  {
    id: "t1", title: "Roma", city: "Roma", country: "Italia", country_code: "IT",
    latitude: 41.9, longitude: 12.5,
    home_latitude: 45.5, home_longitude: 9.2, home_label: "Casa",
    trip_date: "2024-01-01",
    temperature_c: 20, altitude_m: 100, distance_from_home_km: 100, notes: null,
  } as unknown as LocalTrip,
  {
    id: "t2", title: "Parigi", city: "Parigi", country: "Francia", country_code: "FR",
    latitude: 48.8, longitude: 2.3,
    home_latitude: 45.5, home_longitude: 9.2, home_label: "Casa",
    trip_date: "2024-02-01",
    temperature_c: 12, altitude_m: 35, distance_from_home_km: 850, notes: null,
  } as unknown as LocalTrip,
];

// jsdom defaults to clientWidth/Height = 0; give containers real measurements
beforeEach(() => {
  loadedTextures.length = 0;
  createdRenderers.length = 0;
  localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });
  // ResizeObserver shim
  (globalThis as any).ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  // Queue rAF callbacks; tests flush manually so we don't loop forever
  rafQueue.length = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length as any;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

const rafQueue: FrameRequestCallback[] = [];
function flushRaf() {
  const cbs = rafQueue.splice(0);
  cbs.forEach((c) => c(performance.now()));
}

function renderApp(initialTrips: LocalTrip[]) {
  return render(
    <SettingsProvider>
      <MemoryRouter>
        <div style={{ width: 800, height: 600 }}>
          <WorldMap trips={initialTrips} />
        </div>
        <SettingsPage />
      </MemoryRouter>
    </SettingsProvider>
  );
}

describe("WorldMap ↔ Settings integration", () => {
  it("re-initialises the globe (new renderer + texture) when globe style toggles", () => {
    renderApp(trips);

    const initialRenderers = createdRenderers.length;
    expect(initialRenderers).toBeGreaterThan(0);
    // Default = artistic → loads earth-day (plain), not blue-marble
    expect(loadedTextures.some((u) => u.includes("earth-day.jpg"))).toBe(true);
    expect(loadedTextures.some((u) => u.includes("earth-blue-marble.jpg"))).toBe(false);

    act(() => {
      screen.getByRole("button", { name: /Satellitare/i }).click();
    });

    // A new renderer instance is created and blue-marble is now requested
    expect(createdRenderers.length).toBeGreaterThan(initialRenderers);
    expect(loadedTextures.some((u) => u.includes("earth-blue-marble.jpg"))).toBe(true);

    act(() => {
      screen.getByRole("button", { name: /Artistico/i }).click();
    });

    // Switching back triggers yet another init
    expect(createdRenderers.length).toBeGreaterThan(initialRenderers + 1);
  });

  it("rebuilds markers (home + one per trip) after toggling globe style", () => {
    renderApp(trips);

    const lastRenderer = () => createdRenderers[createdRenderers.length - 1];
    // The container the renderer is appended to is also where labelsRoot lives.
    const labelsRootOf = (r: any) =>
      r.domElement.parentElement?.querySelector("div");

    // After a frame, labels for home + each trip should be appended
    const beforeLabels = labelsRootOf(lastRenderer())?.children.length ?? 0;
    expect(beforeLabels).toBe(trips.length + 1); // home + 2 trips

    act(() => {
      screen.getByRole("button", { name: /Satellitare/i }).click();
    });

    const afterLabels = labelsRootOf(lastRenderer())?.children.length ?? 0;
    expect(afterLabels).toBe(trips.length + 1);
  });
});
