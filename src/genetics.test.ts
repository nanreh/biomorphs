import { describe, expect, it } from "vitest";
import {
  DRAWING_SIZE,
  FILL,
  GENE_COUNT,
  GENE_RANGES,
  NORTH_ONLY,
  NORTH_SOUTH,
  RADIAL,
  SEGMENTS,
  SPACING,
  SPACING_GRADIENT,
  SPOKES,
  STEP_GRADIENTS,
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
  type Segment,
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

interface Body {
  segments?: number;
  spacing?: number;
  stepGradients?: number[];
  spacingGradient?: number;
  spokes?: number;
}

// A genome from its depth and eight steps, plus the body genes, which default to one segment
// and no spokes.
function genome(
  [depth, ...steps]: number[],
  {
    segments = 1,
    spacing = 0,
    stepGradients = Array(8).fill(0),
    spacingGradient = 0,
    spokes = NORTH_ONLY,
  }: Body = {},
): Genes {
  return [
    depth,
    ...steps,
    segments,
    spacing,
    ...stepGradients,
    spacingGradient,
    spokes,
    2,
    16,
    9,
    14,
  ];
}

const SAMPLE = genome([4, 3, -2, 5, 6, -4, 1, 7, -3]);
// Found by searching random genomes: it reaches well above and below its root, with a narrow
// waist where the trunk starts.
const HOURGLASS = genome([8, 4, -5, -4, 0, -6, 7, 4, 0]);
// Dawkins' Insect, from his program, with its up and down steps turned the other way since in
// his a positive step goes down the screen.
const INSECT = [6, -1, -1, 4, -1, 1, 2, -8, 4];

// A plain tree whose trunk grows up, so in a segmented body the trunks go up from the spine
// and the spine goes down.
const TREE = [6, 1, 2, 2, 4, 3, 1, -2, -4];

const MINS = GENE_RANGES.map(({ min }) => min);
const MAXES = GENE_RANGES.map(({ max }) => max);

const key = ({ x, y, i, j }: Pick<Segment, "x" | "y" | "i" | "j">) =>
  [x, y, i, j].join();

// Whether every line has its mirror image under the given flip.
function symmetric(
  segments: Segment[],
  flip: (segment: Segment) => Pick<Segment, "x" | "y" | "i" | "j">,
): boolean {
  const all = new Set(segments.map(key));
  return segments.every((segment) => all.has(key(flip(segment))));
}

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
    expect(mutate(SAMPLE, sequence(0, 0.1))[0]).toBe(3);
    expect(mutate(SAMPLE, sequence(0, 0.9))[0]).toBe(5);
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
  // At three segments or more every gene can mutate, so the first random number picks any.
  it("moves back from the ends of the range", () => {
    const low = MINS.map((gene, i) => (i === SEGMENTS ? 3 : gene));
    for (let gene = 0; gene < GENE_COUNT; gene++) {
      const pick = (gene + 0.5) / GENE_COUNT;
      for (const direction of [0.1, 0.9]) {
        if (gene !== SEGMENTS) {
          expect(mutate(low, sequence(pick, direction))[gene]).toBe(
            MINS[gene] + 1,
          );
        }
        expect(mutate(MAXES, sequence(pick, direction))[gene]).toBe(
          MAXES[gene] - 1,
        );
      }
    }
  });

  it("only changes the segment genes when there are segments for them to shape", () => {
    const random = seeded(9);
    const ever = (genes: Genes) => {
      const changed = new Set<number>();
      for (let n = 0; n < 5000; n++) {
        mutate(genes, random).forEach((gene, i) => {
          if (gene !== genes[i]) {
            changed.add(i);
          }
        });
      }
      return changed;
    };
    const one = ever(SAMPLE);
    expect(one.has(SPACING)).toBe(false);
    expect(one.has(SPACING_GRADIENT)).toBe(false);
    for (let k = 0; k < 8; k++) {
      expect(one.has(STEP_GRADIENTS + k)).toBe(false);
    }
    expect(one.has(SEGMENTS)).toBe(true);

    const two = ever(genome([4, 3, -2, 5, 6, -4, 1, 7, -3], { segments: 2 }));
    expect(two.has(SPACING)).toBe(true);
    expect(two.has(STEP_GRADIENTS)).toBe(true);
    expect(two.has(SPACING_GRADIENT)).toBe(false);

    const three = ever(genome([4, 3, -2, 5, 6, -4, 1, 7, -3], { segments: 3 }));
    expect(three.size).toBe(GENE_COUNT);
  });

  // It used to call Math.random(2), which ignores its argument, so genes only ever went down.
  it("goes down and up about equally often", () => {
    const random = seeded(3);
    let up = 0;
    const middle: Genes = GENE_RANGES.map(({ min, max }) =>
      Math.floor((min + max) / 2),
    );
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
  it("has two branches for every line above the tips, in every segment and spoke", () => {
    const random = seeded(4);
    for (let n = 0; n < 50; n++) {
      const genes = randomGenes(random);
      const segments = genes[SEGMENTS];
      const trees = segments * (2 ** treeDepth(genes) - 1);
      const spine = segments - 1;
      const spokes = [1, 2, 4][genes[SPOKES]];
      expect(growTree(genes)).toHaveLength((trees + spine) * spokes);
    }
  });

  it("starts in the middle of the drawing square and grows north", () => {
    const [trunk] = growTree(SAMPLE);
    expect(trunk).toEqual({ x: 150, y: 150, i: 150, j: 138, level: 4 });
  });

  // Each step is the gene times the level, so the trunk is the longest line.
  it("shortens the branches level by level", () => {
    const segments = growTree(genome(Array(9).fill(5)));
    for (const { x, y, i, j, level } of segments) {
      expect(Math.max(Math.abs(i - x), Math.abs(j - y))).toBe(level * 2.5);
    }
  });

  it("is symmetric left to right", () => {
    const random = seeded(8);
    for (let n = 0; n < 200; n++) {
      const segments = growTree(randomGenes(random));
      expect(
        symmetric(segments, ({ x, y, i, j }) => ({
          x: DRAWING_SIZE - x,
          y,
          i: DRAWING_SIZE - i,
          j,
        })),
      ).toBe(true);
    }
  });

  it("can grow an hourglass, as much below its root as above", () => {
    const { top, bottom } = bounds(growTree(HOURGLASS));
    expect(150 - top).toBeGreaterThan(30);
    expect(bottom - 150).toBeGreaterThan(30);
  });

  it("starts every line at the root or at the end of another", () => {
    const random = seeded(10);
    for (let n = 0; n < 50; n++) {
      const segments = growTree(randomGenes(random));
      const ends = new Set(segments.map(({ i, j }) => `${i},${j}`));
      ends.add("150,150");
      for (const { x, y } of segments) {
        expect(ends.has(`${x},${y}`)).toBe(true);
      }
    }
  });

  describe("segments", () => {
    const body = (spacingGradient: number) =>
      growTree(
        genome(TREE, {
          segments: 3,
          spacing: 10,
          stepGradients: [0, 0, 0, 1, 0, 0, 0, 0],
          spacingGradient,
        }),
      );
    // The spine runs straight down from the root, at the level of the trunks.
    const spine = (segments: Segment[]) =>
      segments.filter(
        ({ x, i, j, y, level }) =>
          x === 150 && i === 150 && j > y && level === 6,
      );
    // A trunk goes straight up from the spine.
    const trunks = (segments: Segment[]) =>
      segments.filter(
        ({ x, i, j, y, level }) =>
          x === 150 && i === 150 && j < y && level === 6,
      );

    it("grow one below the other down a spine", () => {
      expect(spine(body(0))).toEqual([
        { x: 150, y: 150, i: 150, j: 155, level: 6 },
        { x: 150, y: 155, i: 150, j: 160, level: 6 },
      ]);
    });

    it("space out by the spacing gradient", () => {
      expect(spine(body(1)).map(({ j }) => j)).toEqual([155, 160.5]);
      expect(spine(body(-1)).map(({ j }) => j)).toEqual([155, 159.5]);
    });

    // TREE's north step is 4, with a gradient of 1: 4, 5, 6 times level 6 times 0.5.
    it("add the gradients to their genes, segment by segment", () => {
      expect(trunks(body(0)).map(({ y, j }) => y - j)).toEqual([12, 15, 18]);
    });

    it("draw a single tree when there is one segment", () => {
      const one = growTree(genome(TREE));
      expect(spine(one)).toEqual([]);
      expect(one).toHaveLength(2 ** 6 - 1);
    });
  });

  describe("spokes", () => {
    const upsideDown = ({ x, y, i, j }: Segment) => ({
      x,
      y: DRAWING_SIZE - y,
      i,
      j: DRAWING_SIZE - j,
    });
    const onItsSide = ({ x, y, i, j }: Segment) => ({ x: y, y: x, i: j, j: i });

    it("add the body's mirror image upside down for NORTH_SOUTH", () => {
      const plain = growTree(genome(INSECT));
      const mirrored = growTree(genome(INSECT, { spokes: NORTH_SOUTH }));
      expect(symmetric(plain, upsideDown)).toBe(false);
      expect(symmetric(mirrored, upsideDown)).toBe(true);
      expect(mirrored.slice(0, plain.length)).toEqual(plain);
      const { top, bottom } = bounds(mirrored);
      expect(150 - top).toBe(bottom - 150);
    });

    it("turn those on their sides as well for RADIAL", () => {
      const radial = growTree(
        genome(INSECT, { spokes: RADIAL, segments: 2, spacing: 8 }),
      );
      expect(symmetric(radial, upsideDown)).toBe(true);
      expect(symmetric(radial, onItsSide)).toBe(true);
    });
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
    expect(
      bounds(
        growTree(
          genome(INSECT, {
            segments: 4,
            spacing: 14,
            stepGradients: [0, 0, 1, 0, 0, 0, -1, 0],
            spokes: NORTH_SOUTH,
          }),
        ),
      ),
    ).toEqual({ left: 140.5, top: 112.5, right: 159.5, bottom: 187.5 });
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
    expect(shrunk).toBeLessThan(5000 * 0.4);
  });

  it("does not divide by zero for a tree with no length", () => {
    const flat = growTree(genome([1, 0, 0, 0, 0, 0, 0, 0, 0]));
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
