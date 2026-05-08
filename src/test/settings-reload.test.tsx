import { describe, it, expect, beforeEach, vi } from "vitest";

// Same three/topojson mocks used by worldmap-integration tests
vi.mock("topojson-client", () => ({ feature: () => ({ features: [] }) }));

const loadedTextures: string[] = [];
const createdRenderers: any[] = [];

vi.mock("three", () => {
  const makeVec = (): any => {
    const v: any = {
      x: 0, y: 0, z: 0,
      set: () => v, copy: () => v, clone: () => makeVec(),
      add: () => v, sub: () => v, multiplyScalar: () => v, normalize: () => v,
      project: () => makeVec(), angleTo: () => 1, dot: () => 1,
      lengthSq: () => 1, length: () => 1,
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
      uniforms: {},
      visible: true,
      setAttribute() {}, setFromPoints() { return base; }, dispose() {},
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
    constructor() { return stub({ aspect: 1, updateProjectionMatrix() {} }); }
  }
  class WebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor() {
      this.domElement = document.createElement("canvas");
      (this.domElement as any).captureStream = () => ({});
      createdRenderers.push(this);
    }
    setPixelRatio() {} setSize() {} render() {} dispose() {};
    outputColorSpace = 0;
  }
  class TextureLoader {
    crossOrigin = "";
    load(url: string) { loadedTextures.push(url); return { colorSpace: 0 }; }
  }
  const Generic: any = new Proxy(function () {}, { construct: () => stub() });
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
    Raycaster: function () { return { setFromCamera() {}, intersectObjects: () => [] }; },
    SRGBColorSpace: 0, BackSide: 0, FrontSide: 0, DoubleSide: 0,
    AdditiveBlending: 0, NormalBlending: 0,
  };
});

import { render, screen, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SettingsProvider } from "@/lib/settings";
import { WorldMap } from "@/components/WorldMap";
import { TripCard } from "@/components/TripCard";
import SettingsPage from "@/pages/Settings";
import type { LocalTrip } from "@/lib/storage";

const trip: LocalTrip = {
  id: "t1", title: "Roma", city: "Roma", country: "Italia", country_code: "IT",
  latitude: 41.9, longitude: 12.5,
  home_latitude: 45.5, home_longitude: 9.2, home_label: "Casa",
  trip_date: "2024-01-01",
  temperature_c: 20, altitude_m: 100, distance_from_home_km: 100, notes: null,
} as unknown as LocalTrip;

beforeEach(() => {
  loadedTextures.length = 0;
  createdRenderers.length = 0;
  localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });
  (globalThis as any).ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  vi.stubGlobal("requestAnimationFrame", () => 1 as any);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

function mountApp() {
  return render(
    <SettingsProvider>
      <MemoryRouter>
        <div data-testid="card"><TripCard trip={trip} /></div>
        <div style={{ width: 800, height: 600 }}>
          <WorldMap trips={[trip]} />
        </div>
        <SettingsPage />
      </MemoryRouter>
    </SettingsProvider>
  );
}

describe("Reload simulation: settings hydrate from localStorage", () => {
  it("restores defaults when localStorage is empty", () => {
    mountApp();
    // Default = artistic → plain earth-day texture
    expect(loadedTextures.some((u) => u.includes("earth-day.jpg"))).toBe(true);
    expect(loadedTextures.some((u) => u.includes("earth-blue-marble.jpg"))).toBe(false);

    const card = screen.getByTestId("card");
    expect(within(card).getByText(/100 km/)).toBeInTheDocument();
    expect(within(card).getByText("20°C")).toBeInTheDocument();

    // SettingsPage reflects defaults via the active button styling
    const artistic = screen.getByRole("button", { name: /Artistico/i });
    expect(artistic.className).toMatch(/border-primary/);
    const metric = screen.getByRole("button", { name: /Metrico/i });
    expect(metric.className).toMatch(/border-primary/);
  });

  it("hydrates persisted settings (satellite + imperial + fahrenheit) on a fresh mount", () => {
    // Simulate a previous session that left these settings persisted
    localStorage.setItem(
      "atlas.settings.v1",
      JSON.stringify({
        distanceUnit: "imperial",
        temperatureUnit: "fahrenheit",
        globeStyle: "satellite",
      })
    );

    mountApp();

    // Map initialises with the satellite (blue-marble) texture, not the artistic one
    expect(loadedTextures.some((u) => u.includes("earth-blue-marble.jpg"))).toBe(true);
    expect(loadedTextures.some((u) => u.includes("earth-day.jpg"))).toBe(false);
    expect(createdRenderers.length).toBeGreaterThan(0);

    // TripCard renders in imperial / fahrenheit immediately
    const card = screen.getByTestId("card");
    expect(within(card).queryByText(/100 km/)).not.toBeInTheDocument();
    expect(within(card).getByText(/mi$/)).toBeInTheDocument();
    expect(within(card).getByText(/ft$/)).toBeInTheDocument();
    expect(within(card).getByText("68°F")).toBeInTheDocument();

    // SettingsPage shows the persisted choices as active
    expect(screen.getByRole("button", { name: /Satellitare/i }).className).toMatch(/border-primary/);
    expect(screen.getByRole("button", { name: /Imperiale/i }).className).toMatch(/border-primary/);
    expect(screen.getByRole("button", { name: /Fahrenheit/i }).className).toMatch(/border-primary/);
  });

  it("survives a full unmount/remount cycle (simulated reload)", () => {
    const { unmount } = mountApp();
    act(() => { screen.getByRole("button", { name: /Satellitare/i }).click(); });
    act(() => { screen.getByRole("button", { name: /Fahrenheit/i }).click(); });
    unmount();

    loadedTextures.length = 0;
    createdRenderers.length = 0;

    // Fresh mount = simulated page reload, only localStorage carries state
    mountApp();

    expect(loadedTextures.some((u) => u.includes("earth-blue-marble.jpg"))).toBe(true);
    const card = screen.getByTestId("card");
    expect(within(card).getByText("68°F")).toBeInTheDocument();
  });
});
