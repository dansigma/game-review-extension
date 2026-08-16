import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isExtensionContextValid,
  isInvalidatedContextError,
} from "../src/content/extensionContext.ts";

describe("isExtensionContextValid", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when chrome.runtime.id is set", () => {
    vi.stubGlobal("chrome", { runtime: { id: "test-extension-id" } });
    expect(isExtensionContextValid()).toBe(true);
  });

  it("returns false when chrome.runtime.id is missing", () => {
    vi.stubGlobal("chrome", { runtime: {} });
    expect(isExtensionContextValid()).toBe(false);
  });

  it("returns false when chrome.runtime access throws", () => {
    vi.stubGlobal("chrome", {
      get runtime() {
        throw new Error("Extension context invalidated");
      },
    });
    expect(isExtensionContextValid()).toBe(false);
  });
});

describe("isInvalidatedContextError", () => {
  it("matches extension context invalidated message", () => {
    expect(
      isInvalidatedContextError(new Error("Extension context invalidated")),
    ).toBe(true);
    expect(isInvalidatedContextError("Extension context invalidated")).toBe(
      true,
    );
    expect(
      isInvalidatedContextError(new Error("EXTENSION CONTEXT INVALIDATED")),
    ).toBe(true);
  });

  it("does not match other errors", () => {
    expect(isInvalidatedContextError(new Error("Failed to fetch"))).toBe(
      false,
    );
    expect(isInvalidatedContextError(new Error("Falha na comunicação"))).toBe(
      false,
    );
    expect(isInvalidatedContextError(null)).toBe(false);
    expect(isInvalidatedContextError(42)).toBe(false);
  });
});
