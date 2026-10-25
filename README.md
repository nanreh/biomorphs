# Biomorphs

Biomorphs breeds Richard Dawkins' biomorphs from *The Blind Watchmaker*: little tree-shaped creatures grown from a genome of twenty-five genes, including the segmentation and symmetry genes Dawkins added to his own Blind Watchmaker program. The one in the middle is the parent, and around it are its children, each with one gene mutated. Click a child to breed from it, click the parent for a new litter, and see what selection can do in a few generations.

The project is hosted at [defy.org/hacks/biomorphs](https://defy.org/hacks/biomorphs/).

## Running Locally

Biomorphs is plain TypeScript built with Vite, with no runtime dependencies. You need Node.js 24 or later, which includes npm.

```
npm install
npm run dev
```

The other standard scripts exist also: `npm test`, `npm run lint`, `npm run build`, `npm run pretty`.

## Code

- `src/genetics.ts` is how a genome becomes a biomorph: random genomes, mutation, the tree of line segments the genes grow into, and how it is framed and colored. It doesn't touch the page, and `src/genetics.test.ts` tests it.
- `src/readout.ts` turns a genome into the labeled text shown over each biomorph, marking the gene that changed from its parent and the genes that have no effect. `src/readout.test.ts` tests it.
- `src/biomorphs.ts` is the page: one canvas per biomorph, sized to how big it is shown and the screen's pixel density, and the clicks that breed them.

## License

[WTFPL](http://www.wtfpl.net/), as noted at the top of the source files.
