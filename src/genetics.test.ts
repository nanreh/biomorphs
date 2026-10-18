import { describe, expect, it } from "vitest";
import {
  DRAWING_SIZE,
  FILL,
  GENE_COUNT,
  GENE_MAX,
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

const SAMPLE: Genes = [3, 7, 12, 0, 19, 5, 11, 2, 16, 9, 14];

describe("randomGenes", () => {
  it("gives GENE_COUNT genes from 0 to GENE_MAX", () => {
    const random = seeded(1);
    for (let n = 0; n < 1000; n++) {
      const genes = randomGenes(random);
      expect(genes).toHaveLength(GENE_COUNT);
      for (const gene of genes) {
        expect(Number.isInteger(gene)).toBe(true);
        expect(gene).toBeGreaterThanOrEqual(0);
        expect(gene).toBeLessThanOrEqual(GENE_MAX);
      }
    }
  });

  it("reaches both ends of the range", () => {
    expect(randomGenes(sequence(0))).toEqual(Array(GENE_COUNT).fill(0));
    expect(randomGenes(sequence(0.9999))).toEqual(
      Array(GENE_COUNT).fill(GENE_MAX),
    );
  });
});

describe("mutate", () => {
  // The first random number picks the gene, the second whether it goes down (< 0.5) or up.
  it("moves one gene down or up by one", () => {
    expect(mutate(SAMPLE, sequence(0.5, 0.1))[5]).toBe(4);
    expect(mutate(SAMPLE, sequence(0.5, 0.9))[5]).toBe(6);
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

  it("wraps around at the ends of the range", () => {
    const low: Genes = Array(GENE_COUNT).fill(0);
    const high: Genes = Array(GENE_COUNT).fill(GENE_MAX);
    expect(mutate(low, sequence(0, 0.1))[0]).toBe(GENE_MAX);
    expect(mutate(low, sequence(0, 0.9))[0]).toBe(1);
    expect(mutate(high, sequence(0, 0.9))[0]).toBe(0);
    expect(mutate(high, sequence(0, 0.1))[0]).toBe(GENE_MAX - 1);
  });

  // It used to call Math.random(2), which ignores its argument, so genes only ever went down.
  it("goes down and up about equally often", () => {
    const random = seeded(3);
    let up = 0;
    const middle: Genes = Array(GENE_COUNT).fill(10);
    for (let n = 0; n < 10000; n++) {
      if (mutate(middle, random).some((gene) => gene > 10)) {
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
      const levels = treeDepth(genes) + 1;
      expect(growTree(genes)).toHaveLength(2 ** levels - 1);
    }
  });

  it("starts in the middle of the drawing square and grows north", () => {
    const [trunk] = growTree(SAMPLE);
    expect(trunk).toEqual({ x: 150, y: 150, i: 150, j: 149, level: 4 });
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
      x: 127,
      y: 139,
      i: 127,
      j: 150,
      level: 0,
    });
    expect(bounds(segments)).toEqual({
      left: 110,
      top: 113,
      right: 190,
      bottom: 150,
    });
    expect(bounds(growTree(Array(GENE_COUNT).fill(GENE_MAX)))).toEqual({
      left: 120,
      top: 134,
      right: 180,
      bottom: 150,
    });
  });
});

describe("framing", () => {
  it("centers the tree and zooms in on it", () => {
    expect(framing(growTree(SAMPLE))).toEqual({
      zoom: ZOOM,
      centerX: 150,
      centerY: 131.5,
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
    const flat = growTree(Array(GENE_COUNT).fill(0));
    expect(framing(flat)).toEqual({ zoom: ZOOM, centerX: 150, centerY: 150 });
  });
});

describe("segmentStyle", () => {
  it("colors and sizes each level from the genes", () => {
    expect(segmentStyle(SAMPLE, 0)).toEqual({
      color: "rgba(134,97,186,.7)",
      lineWidth: 1,
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
      for (let level = 0; level <= treeDepth(genes); level++) {
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
