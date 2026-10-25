import { describe, expect, it } from "vitest";
import {
  DRAWING_SIZE,
  FILL,
  GENE_COUNT,
  GENE_RANGES,
  ZOOM,
  bounds,
  framing,
  growTree,
  mutate,
  randomGenes,
  segmentStyle,
  treeDepth,
  type Genes,
  type Random,
} from "./genetics";

// A random source that returns the given values in turn.
function sequence(...values: number[]): Random {
  let next = 0;
  return () => values[next++ % values.length];
}

// A repeatable random source, for checks that run over many genomes.
function seeded(seed: number): Random {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const SAMPLE: Genes = [4, 3, -2, 5, 6, -4, 1, 7, -3, 2, 16, 9, 14];
// Found by searching random genomes: it reaches well above and below its root, with a narrow
// waist where the trunk starts.
const HOURGLASS: Genes = [8, 4, -5, -4, 0, -6, 7, 4, 0, 16, 2, 1, 2];

const MINS = GENE_RANGES.map(({ min }) => min);
const MAXES = GENE_RANGES.map(({ max }) => max);

describe("randomGenes", () => {
  it("gives GENE_COUNT genes, each in its range", () => {
    const random = seeded(1);
    for (let n = 0; n < 1000; n++) {
      const genes = randomGenes(random);
      expect(genes).toHaveLength(GENE_COUNT);
      genes.forEach((gene, i) => {
        expect(Number.isInteger(gene)).toBe(true);
        expect(gene).toBeGreaterThanOrEqual(GENE_RANGES[i].min);
        expect(gene).toBeLessThanOrEqual(GENE_RANGES[i].max);
      });
    }
  });

  it("reaches both ends of each range", () => {
    expect(randomGenes(sequence(0))).toEqual(MINS);
    expect(randomGenes(sequence(0.9999))).toEqual(MAXES);
  });
});

describe("mutate", () => {
  // The first random number picks the gene, the second whether it goes down (< 0.5) or up.
  it("moves one gene down or up by one", () => {
    expect(mutate(SAMPLE, sequence(0.4, 0.1))[5]).toBe(-5);
    expect(mutate(SAMPLE, sequence(0.4, 0.9))[5]).toBe(-3);
  });

  it("changes exactly one gene and leaves the original alone", () => {
    const random = seeded(2);
    for (let n = 0; n < 1000; n++) {
      const before = [...SAMPLE];
      const after = mutate(SAMPLE, random);
      expect(SAMPLE).toEqual(before);
      const changed = after.filter((gene, i) => gene !== SAMPLE[i]);
      expect(changed).toHaveLength(1);
    }
  });

  // Wrapping around would turn a small change into the biggest one, e.g. a step of 9 into -9.
  it("moves back from the ends of the range", () => {
    for (let gene = 0; gene < GENE_COUNT; gene++) {
      const pick = (gene + 0.5) / GENE_COUNT;
      for (const direction of [0.1, 0.9]) {
        expect(mutate(MINS, sequence(pick, direction))[gene]).toBe(
          MINS[gene] + 1,
        );
        expect(mutate(MAXES, sequence(pick, direction))[gene]).toBe(
          MAXES[gene] - 1,
        );
      }
    }
  });

  // It used to call Math.random(2), which ignores its argument, so genes only ever went down.
  it("goes down and up about equally often", () => {
    const random = seeded(3);
    let up = 0;
    const middle: Genes = GENE_RANGES.map(({ min, max }) => (min + max) / 2);
    for (let n = 0; n < 10000; n++) {
      if (mutate(middle, random).some((gene, i) => gene > middle[i])) {
        up++;
      }
    }
    expect(up).toBeGreaterThan(4500);
    expect(up).toBeLessThan(5500);
  });
});

describe("growTree", () => {
  it("has two branches for every segment above the tips", () => {
    for (const genes of [
      SAMPLE,
      randomGenes(seeded(4)),
      randomGenes(seeded(5)),
    ]) {
      expect(growTree(genes)).toHaveLength(2 ** treeDepth(genes) - 1);
    }
  });

  it("starts in the middle of the drawing square and grows north", () => {
    const [trunk] = growTree(SAMPLE);
    expect(trunk).toEqual({ x: 150, y: 150, i: 150, j: 138, level: 4 });
  });

  // Each step is the gene times the level, so the trunk is the longest segment.
  it("shortens the branches level by level", () => {
    const segments = growTree(Array(GENE_COUNT).fill(5));
    for (const { x, y, i, j, level } of segments) {
      expect(Math.max(Math.abs(i - x), Math.abs(j - y))).toBe(level * 2.5);
    }
  });

  it("is symmetric left to right", () => {
    const random = seeded(8);
    for (let n = 0; n < 200; n++) {
      const segments = growTree(randomGenes(random));
      const key = (x: number, y: number, i: number, j: number) =>
        [x, y, i, j].join();
      const all = new Set(segments.map(({ x, y, i, j }) => key(x, y, i, j)));
      for (const { x, y, i, j } of segments) {
        expect(all.has(key(300 - x, y, 300 - i, j))).toBe(true);
      }
    }
  });

  it("can grow an hourglass, as much below its root as above", () => {
    const { top, bottom } = bounds(growTree(HOURGLASS));
    expect(150 - top).toBeGreaterThan(30);
    expect(bottom - 150).toBeGreaterThan(30);
  });

  it("joins each segment to the one it grows from", () => {
    const segments = growTree(SAMPLE);
    const ends = new Set(segments.map(({ i, j }) => `${i},${j}`));
    for (const { x, y } of segments.slice(1)) {
      expect(ends.has(`${x},${y}`)).toBe(true);
    }
  });

  // The shapes the app has always drawn for these genes. A change here changes every biomorph.
  it("grows the same shape for the same genes", () => {
    const segments = growTree(SAMPLE);
    expect(segments.at(-1)).toEqual({
      x: 147.5,
      y: 143,
      i: 145,
      j: 139.5,
      level: 1,
    });
    expect(bounds(segments)).toEqual({
      left: 144,
      top: 138,
      right: 156,
      bottom: 150,
    });
    expect(bounds(growTree(MAXES))).toEqual({
      left: -12,
      top: -52.5,
      right: 312,
      bottom: 150,
    });
  });
});

describe("framing", () => {
  it("centers the tree and zooms in on it", () => {
    expect(framing(growTree(SAMPLE))).toEqual({
      zoom: ZOOM,
      centerX: 150,
      centerY: 144,
    });
  });

  it("keeps every biomorph inside the drawing square", () => {
    const random = seeded(6);
    let shrunk = 0;
    for (let n = 0; n < 5000; n++) {
      const segments = growTree(randomGenes(random));
      const { zoom, centerX, centerY } = framing(segments);
      const { left, top, right, bottom } = bounds(segments);
      expect(zoom).toBeLessThanOrEqual(ZOOM);
      expect(zoom * (right - left)).toBeLessThanOrEqual(
        DRAWING_SIZE * FILL + 1e-9,
      );
      expect(zoom * (bottom - top)).toBeLessThanOrEqual(
        DRAWING_SIZE * FILL + 1e-9,
      );
      expect(centerX).toBe((left + right) / 2);
      expect(centerY).toBe((top + bottom) / 2);
      if (zoom < ZOOM) {
        shrunk++;
      }
    }
    // most are only zoomed, a minority are shrunk to fit
    expect(shrunk).toBeGreaterThan(0);
    expect(shrunk).toBeLessThan(5000 * 0.25);
  });

  it("does not divide by zero for a tree with no length", () => {
    const flat = growTree([1, ...Array(GENE_COUNT - 1).fill(0)]);
    expect(framing(flat)).toEqual({ zoom: ZOOM, centerX: 150, centerY: 150 });
  });
});

describe("segmentStyle", () => {
  it("colors and sizes each level from the genes", () => {
    expect(segmentStyle(SAMPLE, 1)).toEqual({
      color: "rgba(231,194,28,.7)",
      lineWidth: 5,
    });
    expect(segmentStyle(SAMPLE, 4)).toEqual({
      color: "rgba(12,230,64,.7)",
      lineWidth: 2,
    });
  });

  it("keeps colors in range and lines 1 to 5 wide", () => {
    const random = seeded(7);
    for (let n = 0; n < 1000; n++) {
      const genes = randomGenes(random);
      for (let level = 1; level <= treeDepth(genes); level++) {
        const { color, lineWidth } = segmentStyle(genes, level);
        const [r, g, b] = color.slice(5, -4).split(",").map(Number);
        for (const value of [r, g, b]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(255);
        }
        expect(lineWidth).toBeGreaterThanOrEqual(1);
        expect(lineWidth).toBeLessThanOrEqual(5);
      }
    }
  });
});
