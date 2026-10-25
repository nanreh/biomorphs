/*
Copyright © 2009 Hernan Silberman <hernan@defy.org>
This work is free. You can redistribute it and/or modify it under the
terms of the Do What The Fuck You Want To Public License, Version 2,
as published by Sam Hocevar. See http://www.wtfpl.net/ for more details.
*/

// The page: a parent biomorph with eight children around it, each drawn on its own canvas with
// its genes over it.

import "./index.css";
import {
  DRAWING_SIZE,
  framing,
  growTree,
  mutate,
  randomGenes,
  segmentStyle,
  type Genes,
} from "./genetics";
import { readout } from "./readout";

/**
 * A biomorph shown on a canvas, with its genes in an element over the canvas. It is drawn again
 * when its genes change and when the canvas changes size, e.g. when the window is resized or a
 * phone is turned.
 */
class Biomorph {
  private genes: Genes = [];
  readonly canvas: HTMLCanvasElement;
  private readonly genesView: HTMLElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.genesView = document.createElement("div");
    this.genesView.className = "genes";
    canvas.after(this.genesView);
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  getGenes(): Genes {
    return this.genes;
  }

  // bredFrom is the genes of the biomorph these were bred from, whose differences are shown
  setGenes(genes: Genes, bredFrom?: Genes) {
    this.genes = genes;
    this.draw();
    this.showGenes(bredFrom);
  }

  private showGenes(bredFrom?: Genes) {
    this.genesView.replaceChildren(
      ...readout(this.genes, bredFrom).map((row) => {
        const line = document.createElement("div");
        for (const { label, genes } of row) {
          const group = document.createElement("span");
          group.className = "group";
          const name = document.createElement("span");
          name.className = "label";
          name.textContent = label;
          group.append(name);
          for (const { text, changed, active } of genes) {
            const value = document.createElement("span");
            value.className = "gene";
            value.classList.toggle("changed", changed);
            value.classList.toggle("inactive", !active);
            value.textContent = text;
            group.append(" ", value);
          }
          line.append(group);
        }
        return line;
      }),
    );
  }

  draw() {
    if (this.genes.length === 0) {
      return;
    }
    const ctx = this.fitToDisplay();
    const segments = growTree(this.genes);
    const { zoom, centerX, centerY } = framing(segments);
    ctx.translate(DRAWING_SIZE / 2, DRAWING_SIZE / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-centerX, -centerY);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // One path per level, since a level's lines share a style. Segmented and mirrored
    // biomorphs can have thousands of lines, too many to stroke one at a time.
    const levels = new Map<number, typeof segments>();
    for (const segment of segments) {
      const lines = levels.get(segment.level);
      if (lines) {
        lines.push(segment);
      } else {
        levels.set(segment.level, [segment]);
      }
    }
    for (const [level, lines] of levels) {
      const { color, lineWidth } = segmentStyle(this.genes, level);
      ctx.beginPath();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      for (const { x, y, i, j } of lines) {
        ctx.moveTo(x, y);
        ctx.lineTo(i, j);
      }
      ctx.stroke();
    }
  }

  /**
   * Sizes the canvas's drawing surface to the size it is shown at, times the screen's pixel
   * density, so drawings are neither stretched by CSS nor blurry on high density screens. Then
   * scales the DRAWING_SIZE square to fit the canvas, centered, so drawing is done in that
   * square's coordinates. Resizing the surface also clears it.
   */
  private fitToDisplay(): CanvasRenderingContext2D {
    const { canvas } = this;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
    const scale = Math.min(canvas.width, canvas.height) / DRAWING_SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(
      scale,
      0,
      0,
      scale,
      (canvas.width - DRAWING_SIZE * scale) / 2,
      (canvas.height - DRAWING_SIZE * scale) / 2,
    );
    return ctx;
  }
}

function init() {
  const parent = new Biomorph(
    document.querySelector<HTMLCanvasElement>("canvas.parent")!,
  );
  const children = [
    ...document.querySelectorAll<HTMLCanvasElement>("canvas.child"),
  ].map((canvas) => new Biomorph(canvas));

  // A new litter: each child is the parent with one gene mutated.
  const breed = () => {
    for (const child of children) {
      child.setGenes(mutate(parent.getGenes()), parent.getGenes());
    }
  };
  const setParent = (genes: Genes, bredFrom?: Genes) => {
    parent.setGenes(genes, bredFrom);
    breed();
  };

  // Clicking a child makes it the parent, clicking the parent breeds a new litter.
  for (const child of children) {
    child.canvas.addEventListener("click", () =>
      setParent(child.getGenes(), parent.getGenes()),
    );
  }
  parent.canvas.addEventListener("click", breed);
  document
    .getElementById("randomBtn")!
    .addEventListener("click", () => setParent(randomGenes()));

  initGenesButton();
  setParent(randomGenes());
}

// The button that shows every biomorph's genes at once, which is also how to see them where
// there is no hovering, e.g. on a phone. The choice is remembered in this browser.
function initGenesButton() {
  const button = document.getElementById("genesBtn")!;
  const grid = document.getElementById("grid")!;
  const key = "biomorphs.showGenes";
  const show = (on: boolean) => {
    grid.classList.toggle("show-genes", on);
    button.setAttribute("aria-pressed", String(on));
    button.textContent = on ? "Hide Genes" : "Show Genes";
    try {
      localStorage.setItem(key, String(on));
    } catch {
      // storage can be unavailable, e.g. in a private window; the choice just isn't kept
    }
  };
  let remembered = false;
  try {
    remembered = localStorage.getItem(key) === "true";
  } catch {
    // as above
  }
  show(remembered);
  button.addEventListener("click", () =>
    show(!grid.classList.contains("show-genes")),
  );
}

init();
