/*
Copyright © 2009 Hernan Silberman <hernan@defy.org>
This work is free. You can redistribute it and/or modify it under the
terms of the Do What The Fuck You Want To Public License, Version 2,
as published by Sam Hocevar. See http://www.wtfpl.net/ for more details.
*/

// How a genome becomes a biomorph: its genes, how they mutate, and the tree of line segments
// they grow into. Nothing here touches the page, so it can be tested on its own.

/**
 * A biomorph's genome, GENE_COUNT values from 0 to GENE_MAX:
 *
 * - 0: depth of the tree
 * - 1, 2, 3: x-scale of levels 3, 6, 9 / 1, 4, 7 / 2, 5, 8
 * - 4, 5, 6: y-scale of the same levels
 * - 7, 8, 9: red, green, blue
 * - 10: line width
 */
export type Genes = readonly number[];

export const GENE_COUNT = 11;
export const GENE_MAX = 20;

// A source of random numbers in [0, 1), Math.random unless a test supplies its own.
export type Random = () => number;

// Biomorphs are grown in a square of this size, which is then scaled to fit the canvas. The
// longest segment is a fixed fraction of it, and the genes are reduced modulo that length, so a
// given genome grows the same shape at any canvas size. 300 keeps the shapes the app has always
// drawn, from when every canvas was the default 300 pixels wide.
export const DRAWING_SIZE = 300;
const MAX_SEGMENT_LENGTH = Math.floor(DRAWING_SIZE / 2 / 8);

// Each biomorph is centered in its canvas and drawn this many times larger, unless that would
// not fit, so most of them fill a good part of the canvas while sizes still compare fairly.
// At 2, about the biggest 15% are shrunk to fit. 1 keeps them their natural size.
export const ZOOM = 2;
// the share of the canvas a biomorph can fill
export const FILL = 0.9;

// The eight directions a segment can grow in, clockwise from north, and the step each takes.
const N = 0;
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

function randomGene(random: Random): number {
  return Math.floor(random() * (GENE_MAX + 1));
}

export function randomGenes(random: Random = Math.random): Genes {
  return Array.from({ length: GENE_COUNT }, () => randomGene(random));
}

/**
 * Returns a copy of the genes with one of them, chosen at random, moved up or down by one,
 * wrapping around from GENE_MAX to 0 and back.
 */
export function mutate(genes: Genes, random: Random = Math.random): Genes {
  const gene = Math.floor(random() * genes.length);
  const result = [...genes];
  if (random() < 0.5) {
    result[gene] = result[gene] === 0 ? GENE_MAX : result[gene] - 1;
  } else {
    result[gene] = result[gene] === GENE_MAX ? 0 : result[gene] + 1;
  }
  return result;
}

// A line from (x, y) to (i, j), at the given level of the tree. Level 0 is the tips.
export interface Segment {
  x: number;
  y: number;
  i: number;
  j: number;
  level: number;
}

// The number of levels in the tree, from 1 to 9.
export function treeDepth(genes: Genes): number {
  return (genes[0] % 9) + 1;
}

/**
 * The segments the genes grow into, in drawing order. The tree starts at the middle of the
 * drawing square and grows north, each segment splitting into two that turn one step left and
 * one step right, down to level 0.
 */
export function growTree(genes: Genes): Segment[] {
  const segments: Segment[] = [];
  const grow = (x: number, y: number, level: number, direction: number) => {
    direction = (direction + 8) % 8;
    const xGene = (level % 3) + 1;
    const yGene = xGene + 3;
    // the multipliers scramble the genes into segment lengths, so neighboring gene values grow
    // quite different shapes
    const i =
      x +
      Math.floor((DX[direction] * (genes[xGene] * 2579)) % MAX_SEGMENT_LENGTH);
    const j =
      y +
      Math.floor((DY[direction] * (genes[yGene] * 5051)) % MAX_SEGMENT_LENGTH);
    segments.push({ x, y, i, j, level });
    if (level > 0) {
      grow(i, j, level - 1, direction + 1);
      grow(i, j, level - 1, direction - 1);
    }
  };
  grow(DRAWING_SIZE / 2, DRAWING_SIZE / 2, treeDepth(genes), N);
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
    color: `rgba(${shade(7, 577)},${shade(8, 1297)},${shade(9, 2089)},.7)`,
    lineWidth: (Math.abs(genes[10] * level) % 5) + 1,
  };
}
