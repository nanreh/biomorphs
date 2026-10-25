import { describe, expect, it } from "vitest";
import {
  GENE_COUNT,
  NORTH_SOUTH,
  RADIAL,
  SEGMENTS,
  SPACING,
  SPACING_GRADIENT,
  SPOKES,
  STEP_GRADIENTS,
  STEPS,
  type Genes,
} from "./genetics";
import { readout, type GeneText } from "./readout";

// depth 6, steps, 3 segments 14 apart, two gradients, up/down spokes, color and width
// prettier-ignore
const GENES: Genes = [
  6,
  -1, -1, 4, -1, 1, 2, -8, 4,
  3, 14,
  0, 0, 1, 0, 0, 0, -1, 0, -1,
  NORTH_SOUTH,
  2, 16, 9, 14,
];

const all = (genes: Genes, bredFrom?: Genes): GeneText[] =>
  readout(genes, bredFrom).flatMap((row) => row.flatMap(({ genes }) => genes));

describe("readout", () => {
  it("shows every gene once", () => {
    expect(
      all(GENES)
        .map(({ gene }) => gene)
        .sort((a, b) => a - b),
    ).toEqual(Array.from({ length: GENE_COUNT }, (_, gene) => gene));
  });

  it("labels the genes in groups", () => {
    expect(
      readout(GENES).map((row) =>
        row.map(({ label, genes }) =>
          [label, ...genes.map(({ text }) => text)].join(" "),
        ),
      ),
    ).toEqual([
      ["depth 6", "steps −1 −1 4 −1 1 2 −8 4"],
      ["segments 3", "spacing 14 −", "spokes up/down"],
      ["gradients · · + · · · − ·"],
      ["color 2 16 9", "width 14"],
    ]);
  });

  it("names each kind of spokes", () => {
    const spokes = (value: number) =>
      all(GENES.map((gene, i) => (i === SPOKES ? value : gene))).find(
        ({ gene }) => gene === SPOKES,
      )!.text;
    expect([0, NORTH_SOUTH, RADIAL].map(spokes)).toEqual([
      "up",
      "up/down",
      "radial",
    ]);
  });

  it("marks the gene that differs from the genes it was bred from", () => {
    const parent = GENES.map((gene, i) => (i === STEPS + 2 ? gene - 1 : gene));
    expect(
      all(GENES, parent)
        .filter(({ changed }) => changed)
        .map(({ gene }) => gene),
    ).toEqual([STEPS + 2]);
    expect(all(GENES).some(({ changed }) => changed)).toBe(false);
  });

  it("marks the genes that have no effect as inactive", () => {
    const inactive = (segments: number) =>
      all(GENES.map((gene, i) => (i === SEGMENTS ? segments : gene)))
        .filter(({ active }) => !active)
        .map(({ gene }) => gene)
        .sort((a, b) => a - b);
    const gradients = Array.from({ length: 8 }, (_, k) => STEP_GRADIENTS + k);
    expect(inactive(1)).toEqual(
      [SPACING, ...gradients, SPACING_GRADIENT].sort((a, b) => a - b),
    );
    expect(inactive(2)).toEqual([SPACING_GRADIENT]);
    expect(inactive(3)).toEqual([]);
  });
});
