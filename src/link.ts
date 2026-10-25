/*
Copyright © 2009 Hernan Silberman <hernan@defy.org>
This work is free. You can redistribute it and/or modify it under the
terms of the Do What The Fuck You Want To Public License, Version 2,
as published by Sam Hocevar. See http://www.wtfpl.net/ for more details.
*/

// A biomorph's genes in the page's address, so a link to the page brings back the same parent.
// Nothing here touches the page, so it can be tested on its own.

import { GENE_COUNT, GENE_RANGES, type Genes } from "./genetics";

// The version of the genome the genes in a link are for. It goes up whenever the genes change
// meaning, e.g. when one is added, so old links can be read the old way or turned down rather
// than grow something else.
export const LINK_VERSION = 1;

/**
 * The query part of a link to the genes, e.g. "?v=1&g=6,-1,4,...". It is written out by hand,
 * not with URLSearchParams, which would turn the commas into %2C.
 */
export function genesQuery(genes: Genes): string {
  return `?v=${LINK_VERSION}&g=${genes.join(",")}`;
}

/**
 * The genes in a link's query, or undefined if it has none, or genes for another version, or
 * anything but GENE_COUNT whole numbers each in its range.
 */
export function genesFromQuery(query: string): Genes | undefined {
  const params = new URLSearchParams(query);
  if (params.get("v") !== String(LINK_VERSION)) {
    return undefined;
  }
  const values = (params.get("g") ?? "").split(",");
  if (
    values.length !== GENE_COUNT ||
    !values.every((value) => /^-?\d+$/.test(value))
  ) {
    return undefined;
  }
  const genes = values.map(Number);
  const inRange = genes.every(
    (gene, i) => gene >= GENE_RANGES[i].min && gene <= GENE_RANGES[i].max,
  );
  return inRange ? genes : undefined;
}
