import { describe, it, expect } from "vitest";
import { formatDecimal, formatMADCompact, formatPercent } from "@/lib/utils";

const nb = (s: string) => s.replace(/[  ]/g, " ");

describe("Formats français", () => {
  it("virgule décimale", () => {
    expect(formatPercent(0.9)).toBe("0,9 %");
    expect(nb(formatDecimal(1234.5, 2))).toBe("1 234,50");
    expect(formatDecimal(null)).toBe("—");
  });
  it("montants abrégés pour les indicateurs", () => {
    expect(formatMADCompact(866_000_000)).toBe("866 M MAD");
    expect(formatMADCompact(7_600_000)).toBe("7,6 M MAD");
    expect(formatMADCompact(1_250_000_000)).toBe("1,3 Md MAD");
    expect(formatMADCompact(-12_000_000)).toBe("-12 M MAD");
    expect(nb(formatMADCompact(950_000))).toContain("950");
  });
});
