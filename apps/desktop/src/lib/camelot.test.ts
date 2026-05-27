import { describe, it, expect } from "vitest";
import { toCamelot, colorForKey, CAMELOT_COLORS } from "./camelot";

describe("toCamelot", () => {
  it("handles all 12 major roots in long form", () => {
    expect(toCamelot("C major")).toBe("8B");
    expect(toCamelot("G major")).toBe("9B");
    expect(toCamelot("D major")).toBe("10B");
    expect(toCamelot("A major")).toBe("11B");
    expect(toCamelot("E major")).toBe("12B");
    expect(toCamelot("B major")).toBe("1B");
    expect(toCamelot("F# major")).toBe("2B");
    expect(toCamelot("C# major")).toBe("3B");
    expect(toCamelot("G# major")).toBe("4B");
    expect(toCamelot("D# major")).toBe("5B");
    expect(toCamelot("A# major")).toBe("6B");
    expect(toCamelot("F major")).toBe("7B");
  });

  it("handles all 12 minor roots in long form", () => {
    expect(toCamelot("A minor")).toBe("8A");
    expect(toCamelot("E minor")).toBe("9A");
    expect(toCamelot("B minor")).toBe("10A");
    expect(toCamelot("F# minor")).toBe("11A");
    expect(toCamelot("C# minor")).toBe("12A");
    expect(toCamelot("G# minor")).toBe("1A");
    expect(toCamelot("D# minor")).toBe("2A");
    expect(toCamelot("A# minor")).toBe("3A");
    expect(toCamelot("F minor")).toBe("4A");
    expect(toCamelot("C minor")).toBe("5A");
    expect(toCamelot("G minor")).toBe("6A");
    expect(toCamelot("D minor")).toBe("7A");
  });

  it("recognises enharmonic equivalents (sharps ↔ flats)", () => {
    expect(toCamelot("Gb major")).toBe(toCamelot("F# major"));
    expect(toCamelot("Db major")).toBe(toCamelot("C# major"));
    expect(toCamelot("Eb major")).toBe(toCamelot("D# major"));
    expect(toCamelot("Bb major")).toBe(toCamelot("A# major"));
    expect(toCamelot("Ab major")).toBe(toCamelot("G# major"));
    expect(toCamelot("Bb minor")).toBe(toCamelot("A# minor"));
  });

  it("handles short forms (Cm, F#, etc.)", () => {
    expect(toCamelot("Cm")).toBe("5A");
    expect(toCamelot("Am")).toBe("8A");
    expect(toCamelot("F#m")).toBe("11A");
    expect(toCamelot("C")).toBe("8B");
    expect(toCamelot("F#")).toBe("2B");
    expect(toCamelot("C min")).toBe("5A");
    expect(toCamelot("Cmaj")).toBe("8B");
  });

  it("is case-insensitive on the mode word", () => {
    expect(toCamelot("c MINOR")).toBe("5A");
    expect(toCamelot("F# MAJOR")).toBe("2B");
  });

  it("passes through canonical Camelot codes", () => {
    expect(toCamelot("8A")).toBe("8A");
    expect(toCamelot("11b")).toBe("11B");
    expect(toCamelot(" 5B ")).toBe("5B");
  });

  it("returns null for nonsense", () => {
    expect(toCamelot("Banana")).toBeNull();
    expect(toCamelot("H major")).toBeNull();
    expect(toCamelot("13A")).toBeNull();
    expect(toCamelot("")).toBeNull();
    expect(toCamelot(null)).toBeNull();
    expect(toCamelot(undefined)).toBeNull();
  });
});

describe("colorForKey", () => {
  it("maps known keys to their MIK palette colour", () => {
    expect(colorForKey("A minor")).toBe(CAMELOT_COLORS["8A"]);
    expect(colorForKey("C major")).toBe(CAMELOT_COLORS["8B"]);
    expect(colorForKey("8A")).toBe(CAMELOT_COLORS["8A"]);
  });

  it("returns null for unparseable keys", () => {
    expect(colorForKey("nonsense")).toBeNull();
    expect(colorForKey(null)).toBeNull();
  });
});
