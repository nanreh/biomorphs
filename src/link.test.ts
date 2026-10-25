import { describe, expect, it } from "vitest";
import { GENE_COUNT, GENE_RANGES, randomGenes, type Genes } from "./genetics";
import { LINK_VERSION, genesFromQuery, genesQuery } from "./link";

// prettier-ignore
const GENES: Genes = [
  6,
  -1, -1, 4, -1, 1, 2, -8, 4,
  3, 14,
  0, 0, 1, 0, 0, 0, -1, 0, -1,
  1,
  2, 16, 9, 14,
];

const query = (g: string, v = String(LINK_VERSION)) => `?v=${v}&g=${g}`;

describe("genesQuery", () => {
  it("writes the version and the genes, with plain commas", () => {
    expect(genesQuery(GENES)).toBe(
      "?v=1&g=6,-1,-1,4,-1,1,2,-8,4,3,14,0,0,1,0,0,0,-1,0,-1,1,2,16,9,14",
    );
  });
});

describe("genesFromQuery", () => {
  it("reads back the genes it wrote", () => {
    let state = 1;
    const random = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    for (let n = 0; n < 500; n++) {
      const genes = randomGenes(random);
      expect(genesFromQuery(genesQuery(genes))).toEqual(genes);
    }
  });

  it("reads genes whose commas were escaped, e.g. by a chat app", () => {
    expect(genesFromQuery(genesQuery(GENES).replaceAll(",", "%2C"))).toEqual(
      GENES,
    );
  });

  it("reads the parameters in any order, among others", () => {
    expect(
      genesFromQuery(`?utm_source=x&g=${GENES.join(",")}&v=${LINK_VERSION}`),
    ).toEqual(GENES);
  });

  it("turns down a query with no genes", () => {
    expect(genesFromQuery("")).toBeUndefined();
    expect(genesFromQuery("?v=1")).toBeUndefined();
    expect(genesFromQuery("?g=1,2,3")).toBeUndefined();
  });

  it("turns down genes for another version", () => {
    expect(genesFromQuery(query(GENES.join(","), "2"))).toBeUndefined();
    expect(genesFromQuery(query(GENES.join(","), ""))).toBeUndefined();
  });

  it("turns down the wrong number of genes", () => {
    expect(genesFromQuery(query(GENES.slice(1).join(",")))).toBeUndefined();
    expect(genesFromQuery(query([...GENES, 0].join(",")))).toBeUndefined();
  });

  it("turns down anything but whole numbers", () => {
    const withFirst = (text: string) =>
      query([text, ...GENES.slice(1)].join(","));
    for (const bad of ["", "1.5", "1e1", " 6", "6 ", "+6", "x", "0x6"]) {
      expect(genesFromQuery(withFirst(bad))).toBeUndefined();
    }
  });

  it("turns down genes outside their ranges", () => {
    for (let gene = 0; gene < GENE_COUNT; gene++) {
      for (const value of [
        GENE_RANGES[gene].min - 1,
        GENE_RANGES[gene].max + 1,
      ]) {
        const genes = GENES.map((g, i) => (i === gene ? value : g));
        expect(genesFromQuery(genesQuery(genes))).toBeUndefined();
      }
    }
  });
});
