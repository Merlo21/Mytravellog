import { describe, it, expect, beforeEach } from "vitest";
import { authStorage } from "./client";

const REMEMBER_KEY = "navta.remember_me";

describe("authStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("usa localStorage di default (nessuna preferenza salvata)", () => {
    authStorage.setItem("sb-session", "valore-a");
    expect(localStorage.getItem("sb-session")).toBe("valore-a");
    expect(sessionStorage.getItem("sb-session")).toBeNull();
  });

  it("usa localStorage quando remember=true", () => {
    localStorage.setItem(REMEMBER_KEY, "true");
    authStorage.setItem("sb-session", "valore-b");
    expect(localStorage.getItem("sb-session")).toBe("valore-b");
    expect(sessionStorage.getItem("sb-session")).toBeNull();
  });

  it("usa sessionStorage quando remember=false", () => {
    localStorage.setItem(REMEMBER_KEY, "false");
    authStorage.setItem("sb-session", "valore-c");
    expect(sessionStorage.getItem("sb-session")).toBe("valore-c");
    expect(localStorage.getItem("sb-session")).toBeNull();
  });

  it("getItem legge dallo stesso storage indicato dalla preferenza", () => {
    localStorage.setItem(REMEMBER_KEY, "false");
    sessionStorage.setItem("sb-session", "valore-d");
    expect(authStorage.getItem("sb-session")).toBe("valore-d");
  });

  it("removeItem rimuove dallo storage indicato dalla preferenza corrente", () => {
    localStorage.setItem(REMEMBER_KEY, "false");
    sessionStorage.setItem("sb-session", "valore-e");
    authStorage.removeItem("sb-session");
    expect(sessionStorage.getItem("sb-session")).toBeNull();
  });
});
