/*
Copyright © 2009 Hernan Silberman <hernan@defy.org>
This work is free. You can redistribute it and/or modify it under the
terms of the Do What The Fuck You Want To Public License, Version 2,
as published by Sam Hocevar. See http://www.wtfpl.net/ for more details.
*/

// A biomorph's genome as text to show with it: its genes in labeled groups, in rows. Nothing
// here touches the page, so it can be tested on its own.

import {
  DEPTH,
  LINE_WIDTH,
  NORTH_SOUTH,
  RADIAL,
  RED,
  SEGMENTS,
  SPACING,
  SPACING_GRADIENT,
  SPOKES,
  STEP_GRADIENTS,
  STEPS,
  activeGenes,
  type Genes,
} from "./genetics";

export interface GeneText {
  // the gene's index in the genome
  gene: number;
  text: string;
  // whether it differs from the genes it was bred from
  changed: boolean;
  // whether it has an effect on this biomorph, see activeGenes
  active: boolean;
}

export interface GeneGroup {
  label: string;
  genes: GeneText[];
}

// A true minus sign, which is as wide as the digits and easier to see than a hyphen.
function number(value: number): string {
  return value < 0 ? `−${-value}` : String(value);
}

function gradient(value: number): string {
  return value > 0 ? "+" : value < 0 ? "−" : "·";
}

function spokes(value: number): string {
  return value === RADIAL ? "radial" : value === NORTH_SOUTH ? "up/down" : "up";
}

/**
 * The rows of gene groups to show for a biomorph. Genes that differ from `bredFrom`, the genes
 * of the biomorph it was bred from, are marked changed. With no `bredFrom`, none are.
 */
export function readout(genes: Genes, bredFrom?: Genes): GeneGroup[][] {
  const active = new Set(activeGenes(genes));
  const text = (gene: number, format = number): GeneText => ({
    gene,
    text: format(genes[gene]),
    changed: bredFrom !== undefined && bredFrom[gene] !== genes[gene],
    active: active.has(gene),
  });
  const run = (start: number, count: number, format = number) =>
    Array.from({ length: count }, (_, k) => text(start + k, format));
  return [
    [
      { label: "depth", genes: [text(DEPTH)] },
      { label: "steps", genes: run(STEPS, 8) },
    ],
    [
      { label: "segments", genes: [text(SEGMENTS)] },
      {
        label: "spacing",
        genes: [text(SPACING), text(SPACING_GRADIENT, gradient)],
      },
      { label: "spokes", genes: [text(SPOKES, spokes)] },
    ],
    [{ label: "gradients", genes: run(STEP_GRADIENTS, 8, gradient) }],
    [
      { label: "color", genes: run(RED, 3) },
      { label: "width", genes: [text(LINE_WIDTH)] },
    ],
  ];
}
