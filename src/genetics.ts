/*
Copyright © 2009 Hernan Silberman <hernan@defy.org>
This work is free. You can redistribute it and/or modify it under the
terms of the Do What The Fuck You Want To Public License, Version 2,
as published by Sam Hocevar. See http://www.wtfpl.net/ for more details.
*/

// How a genome becomes a biomorph: its genes, how they mutate, and the tree of line segments
// they grow into. Nothing here touches the page, so it can be tested on its own.

/**
 * A biomorph's genome, GENE_COUNT whole numbers, each in its range in GENE_RANGES. The shape
 * genes follow Dawkins' in The Blind Watchmaker and the program he wrote for it:
 *
 * - DEPTH: depth of the tree, 1 to 9
 * - STEPS, 8 genes: the first three are how far a segment steps right when it heads northeast,
 *   east and southeast. Heading northwest, west and southwest it steps as far left, which makes
 *   every biomorph symmetric left to right. Heading north or south it doesn't step sideways.
 *   The other five are how far a segment steps up when it heads north, northeast or northwest,
 *   east or west, southeast or southwest, and south. Steps run from -9 to 9, a negative step
 *   going the other way, left instead of right or down instead of up, which lets branches fold
 *   back on themselves.
 * - SEGMENTS: how many trees the body is made of, 1 to 8, one below the other on a spine
 * - SPACING: how far apart the segments are, negative putting each above the one before
 * - STEP_GRADIENTS, 8 genes: -1, 0 or 1 added to each step gene at each segment after the
 *   first, so segments can shrink or grow from front to back
 * - SPACING_GRADIENT: -1, 0 or 1 added to the spacing at each segment after the second
 * - SPOKES: NORTH_ONLY draws the body as it grows, NORTH_SOUTH adds its mirror image upside
 *   down, RADIAL adds those two turned on their sides as well
 * - RED, GREEN, BLUE, LINE_WIDTH: how the segments are drawn
 */
export type Genes = readonly number[];

export const DEPTH = 0;
export const STEPS = 1;
export const SEGMENTS = 9;
export const SPACING = 10;
export const STEP_GRADIENTS = 11;
export const SPACING_GRADIENT = 19;
export const SPOKES = 20;
export const RED = 21;
export const GREEN = 22;
export const BLUE = 23;
export const LINE_WIDTH = 24;

export const NORTH_ONLY = 0;
export const NORTH_SOUTH = 1;
export const RADIAL = 2;

export interface GeneRange {
  min: number;
  max: number;
}

const STEP: GeneRange = { min: -9, max: 9 };
const GRADIENT: GeneRange = { min: -1, max: 1 };
const STYLE: GeneRange = { min: 0, max: 20 };

export const GENE_RANGES: readonly GeneRange[] = [
  { min: 1, max: 9 },
  ...Array<GeneRange>(8).fill(STEP),
  { min: 1, max: 8 },
  { min: -20, max: 20 },
  ...Array<GeneRange>(8).fill(GRADIENT),
  GRADIENT,
  { min: NORTH_ONLY, max: RADIAL },
  ...Array<GeneRange>(4).fill(STYLE),
];
export const GENE_COUNT = GENE_RANGES.length;

// A source of random numbers in [0, 1), Math.random unless a test supplies its own.
export type Random = () => number;

// Biomorphs are grown in a square of this size, which is then scaled to fit the canvas, so a
// given genome grows the same shape at any canvas size.
export const DRAWING_SIZE = 300;
// The length of one unit of step in the drawing square.
const STEP_LENGTH = 0.5;

// Each biomorph is centered in its canvas and drawn this many times larger, unless that would
// not fit, so most of them fill a good part of the canvas while sizes still compare fairly.
// At 2, about the biggest 30% are shrunk to fit. 1 keeps them their natural size.
export const ZOOM = 2;
// the share of the canvas a biomorph can fill
export const FILL = 0.9;

// The eight directions a segment can grow in, clockwise from north.
const NORTH = 0;

function randomGene(range: GeneRange, random: Random): number {
  return range.min + Math.floor(random() * (range.max - range.min + 1));
}

export function randomGenes(random: Random = Math.random): Genes {
  return GENE_RANGES.map((range) => randomGene(range, random));
}

/**
 * The genes that have an effect on this biomorph, the only ones a mutation changes, so that
 * every mutation can show. Those that only shape the segments after the first, or the spacing
 * after the second, have none while there are no such segments, and as in Dawkins' program
 * they are left alone until there are.
 */
export function activeGenes(genes: Genes): number[] {
  return Array.from({ length: GENE_COUNT }, (_, gene) => gene).filter(
    (gene) =>
      (genes[SEGMENTS] > 1 ||
        (gene !== SPACING &&
          (gene < STEP_GRADIENTS || gene >= STEP_GRADIENTS + 8))) &&
      (genes[SEGMENTS] > 2 || gene !== SPACING_GRADIENT),
  );
}

/**
 * Returns a copy of the genes with one of them, chosen at random, moved up or down by one. A
 * gene at the end of its range moves back from it, so every mutation changes the genes.
 */
export function mutate(genes: Genes, random: Random = Math.random): Genes {
  const candidates = activeGenes(genes);
  const gene = candidates[Math.floor(random() * candidates.length)];
  const { min, max } = GENE_RANGES[gene];
  const result = [...genes];
  const down = random() < 0.5;
  if (result[gene] === min) {
    result[gene]++;
  } else if (result[gene] === max) {
    result[gene]--;
  } else {
    result[gene] += down ? -1 : 1;
  }
  return result;
}

// A line from (x, y) to (i, j), at the given level of the tree. Level 1 is the tips. The spine
// joining the segments is at the level of the trunks.
export interface Segment {
  x: number;
  y: number;
  i: number;
  j: number;
  level: number;
}

// The number of levels in the tree, from 1 to 9.
export function treeDepth(genes: Genes): number {
  return genes[DEPTH];
}

// The step a segment takes in each of the eight directions, as [right, up], from the eight
// step genes, as Dawkins' did. A direction and its mirror image, e.g. northeast and northwest,
// step up the same and sideways opposite.
function steps(stepGenes: readonly number[]): [number, number][] {
  const [right1, right2, right3, up0, up1, up2, up3, up4] = stepGenes;
  return [
    [0, up0],
    [right1, up1],
    [right2, up2],
    [right3, up3],
    [0, up4],
    [-right3, up3],
    [-right2, up2],
    [-right1, up1],
  ];
}

/**
 * The lines the genes grow into. The body starts at the middle of the drawing square with a
 * tree that grows north, each segment splitting into two that turn one step left and one step
 * right, down to level 1. As in Dawkins' biomorphs a segment's length is its step times its
 * level, so the trunk is the longest and each level of branches shorter than the one before.
 * Each further body segment grows another tree, SPACING further down the spine, with the
 * gradients added to its genes. Then SPOKES adds mirror images.
 */
export function growTree(genes: Genes): Segment[] {
  const depth = treeDepth(genes);
  const segments: Segment[] = [];
  let stepGenes = genes.slice(STEPS, STEPS + 8);
  let spacing = genes[SPACING];
  let y = DRAWING_SIZE / 2;
  for (let segment = 0; segment < genes[SEGMENTS]; segment++) {
    if (segment > 0) {
      const next = y + spacing * STEP_LENGTH;
      segments.push({
        x: DRAWING_SIZE / 2,
        y,
        i: DRAWING_SIZE / 2,
        j: next,
        level: depth,
      });
      y = next;
      spacing += genes[SPACING_GRADIENT];
      stepGenes = stepGenes.map((gene, k) => gene + genes[STEP_GRADIENTS + k]);
    }
    growSegment(steps(stepGenes), y, depth, segments);
  }
  return withSpokes(segments, genes[SPOKES]);
}

// Grows one body segment's tree from the spine at height y, adding its lines to segments.
function growSegment(
  step: [number, number][],
  y: number,
  depth: number,
  segments: Segment[],
) {
  const grow = (x: number, y: number, level: number, direction: number) => {
    direction = (direction + 8) % 8;
    const [right, up] = step[direction];
    const i = x + right * level * STEP_LENGTH;
    // up is toward the top of the canvas, where y is smaller
    const j = y - up * level * STEP_LENGTH;
    segments.push({ x, y, i, j, level });
    if (level > 1) {
      grow(i, j, level - 1, direction + 1);
      grow(i, j, level - 1, direction - 1);
    }
  };
  grow(DRAWING_SIZE / 2, y, depth, NORTH);
}

// The lines with the mirror images SPOKES calls for: flipped upside down about the root, and
// for RADIAL also turned on their sides, which about the root is swapping x and y.
function withSpokes(segments: Segment[], spokes: number): Segment[] {
  if (spokes === NORTH_ONLY) {
    return segments;
  }
  const flipped = segments.concat(
    segments.map(({ x, y, i, j, level }) => ({
      x,
      y: DRAWING_SIZE - y,
      i,
      j: DRAWING_SIZE - j,
      level,
    })),
  );
  if (spokes === NORTH_SOUTH) {
    return flipped;
  }
  return flipped.concat(
    flipped.map(({ x, y, i, j, level }) => ({ x: y, y: x, i: j, j: i, level })),
  );
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// The box around the tree's root and all of its segments' ends.
export function bounds(segments: Segment[]): Bounds {
  const result = {
    left: DRAWING_SIZE / 2,
    top: DRAWING_SIZE / 2,
    right: DRAWING_SIZE / 2,
    bottom: DRAWING_SIZE / 2,
  };
  for (const { i, j } of segments) {
    result.left = Math.min(result.left, i);
    result.top = Math.min(result.top, j);
    result.right = Math.max(result.right, i);
    result.bottom = Math.max(result.bottom, j);
  }
  return result;
}

// How to place a tree in the drawing square: zoomed by `zoom` around the point (centerX,
// centerY), which goes to the middle of the square.
export interface Framing {
  zoom: number;
  centerX: number;
  centerY: number;
}

export function framing(segments: Segment[]): Framing {
  const { left, top, right, bottom } = bounds(segments);
  return {
    zoom: Math.min(
      ZOOM,
      (DRAWING_SIZE * FILL) / Math.max(right - left, bottom - top, 1),
    ),
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

export interface SegmentStyle {
  color: string;
  lineWidth: number;
}

// The color and width of the segments at a level of the tree.
export function segmentStyle(genes: Genes, level: number): SegmentStyle {
  const shade = (gene: number, multiplier: number) =>
    ((Math.floor(genes[gene] * multiplier) % 255) + level * 97) % 255;
  return {
    color: `rgba(${shade(RED, 577)},${shade(GREEN, 1297)},${shade(BLUE, 2089)},.7)`,
    lineWidth: (Math.abs(genes[LINE_WIDTH] * level) % 5) + 1,
  };
}
