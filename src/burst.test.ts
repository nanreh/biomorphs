import { describe, expect, it } from "vitest";
import { burstPath } from "./burst";

describe("burstPath", () => {
  // the corners as [x, y], from "M x y L x y ... Z"
  const corners = (path: string) =>
    [...path.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)].map(([, x, y]) => [
      Number(x),
      Number(y),
    ]);
  const radius = ([x, y]: number[]) => Math.hypot(x - 50, y - 50);

  it("has two corners per point and is closed", () => {
    const path = burstPath(30);
    expect(corners(path)).toHaveLength(60);
    expect(path.startsWith("M ")).toBe(true);
    expect(path.endsWith(" Z")).toBe(true);
  });

  it("starts at the top and alternates between the outer and inner circles", () => {
    const points = corners(burstPath(12));
    expect(points[0]).toEqual([50, 2]);
    points.forEach((corner, i) => {
      expect(radius(corner)).toBeCloseTo(i % 2 === 0 ? 48 : 40, 1);
    });
  });
});
