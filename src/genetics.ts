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
 * genes follow Dawkins' in The Blind Watchmaker:
 *
 * - 0: depth of the tree, 1 to 9
 * - 1, 2, 3: how far a segment steps right when it heads northeast, east and southeast. Heading
 *   northwest, west and southwest it steps as far left, which makes every biomorph symmetric
 *   left to right. Heading north or south it doesn't step sideways.
 * - 4, 5, 6, 7, 8: how far a segment steps up when it heads north, northeast or northwest, east
 *   or west, southeast or southwest, and south.
 * - 9, 10, 11: red, green, blue
 * - 12: line width
 *
 * The steps run from -9 to 9, a negative step going the other way: left instead of right, down
 * instead of up. That is what lets branches fold back on themselves.
 */
export type Genes = readonly number[];

export interface GeneRange {
  min: number;
  max: number;
}

const DEPTH: GeneRange = { min: 1, max: 9 };
const STEP: GeneRange = { min: -9, max: 9 };
const STYLE: GeneRange = { min: 0, max: 20 };

export const GENE_RANGES: readonly GeneRange[] = [
  DEPTH,
  ...Array<GeneRange>(8).fill(STEP),
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
// At 2, about the biggest 15% are shrunk to fit. 1 keeps them their natural size.
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
 * Returns a copy of the genes with one of them, chosen at random, moved up or down by one. A
 * gene at the end of its range moves back from it, so every mutation changes the genes.
 */
export function mutate(genes: Genes, random: Random = Math.random): Genes {
  const gene = Math.floor(random() * genes.length);
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

// A line from (x, y) to (i, j), at the given level of the tree. Level 1 is the tips.
export interface Segment {
  x: number;
  y: number;
  i: number;
  j: number;
  level: number;
}

// The number of levels in the tree, from 1 to 9.
export function treeDepth(genes: Genes): number {
  return genes[0];
}

// The step a segment takes in each of the eight directions, as [right, up], which the shape
// genes set as Dawkins' did. A direction and its mirror image, e.g. northeast and northwest,
// step up the same and sideways opposite.
function steps(genes: Genes): [number, number][] {
  const [, right1, right2, right3, up0, up1, up2, up3, up4] = genes;
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
 * The segments the genes grow into, in drawing order. The tree starts at the middle of the
 * drawing square and grows north, each segment splitting into two that turn one step left and
 * one step right, down to level 1. As in Dawkins' biomorphs a segment's length is its step
 * times its level, so the trunk is the longest and each level of branches shorter than the
 * one before.
 */
export function growTree(genes: Genes): Segment[] {
  const step = steps(genes);
  const segments: Segment[] = [];
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
  grow(DRAWING_SIZE / 2, DRAWING_SIZE / 2, treeDepth(genes), NORTH);
  return segments;
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
    color: `rgba(${shade(9, 577)},${shade(10, 1297)},${shade(11, 2089)},.7)`,
    lineWidth: (Math.abs(genes[12] * level) % 5) + 1,
  };
}
