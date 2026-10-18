/*
Copyright © 2009 Hernan Silberman <hernan@defy.org>
This work is free. You can redistribute it and/or modify it under the
terms of the Do What The Fuck You Want To Public License, Version 2,
as published by Sam Hocevar. See http://www.wtfpl.net/ for more details.
*/

// The page: a parent biomorph with eight children around it, each drawn on its own canvas.

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

/**
 * A biomorph shown on a canvas. It is drawn again when its genes change and when the canvas
 * changes size, e.g. when the window is resized or a phone is turned.
 */
class Biomorph {
  private genes: Genes = [];
  readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener("mouseover", () =>
      canvas.classList.add("selected"),
    );
    canvas.addEventListener("mouseout", () =>
      canvas.classList.remove("selected"),
    );
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  getGenes(): Genes {
    return this.genes;
  }

  setGenes(genes: Genes) {
    this.genes = genes;
    this.draw();
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
    for (const { x, y, i, j, level } of segments) {
      const { color, lineWidth } = segmentStyle(this.genes, level);
      ctx.beginPath();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.moveTo(x, y);
      ctx.lineTo(i, j);
      ctx.closePath();
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
      child.setGenes(mutate(parent.getGenes()));
    }
  };
  const setParent = (genes: Genes) => {
    parent.setGenes(genes);
    breed();
  };

  // Clicking a child makes it the parent, clicking the parent breeds a new litter.
  for (const child of children) {
    child.canvas.addEventListener("click", () => setParent(child.getGenes()));
  }
  parent.canvas.addEventListener("click", breed);
  document
    .getElementById("randomBtn")!
    .addEventListener("click", () => setParent(randomGenes()));

  setParent(randomGenes());
}

init();
