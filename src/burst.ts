/*
Copyright © 2009 Hernan Silberman <hernan@defy.org>
This work is free. You can redistribute it and/or modify it under the
terms of the Do What The Fuck You Want To Public License, Version 2,
as published by Sam Hocevar. See http://www.wtfpl.net/ for more details.
*/

// The starburst link between the app and its About page.

const SVG = "http://www.w3.org/2000/svg";

/**
 * The outline of a starburst with the given number of points, in a 100 by 100 box: points * 2
 * corners alternating between an outer and an inner circle, starting at the top.
 */
export function burstPath(points = 30): string {
  const center = 50;
  const outerRadius = 48;
  const innerRadius = 40;
  const corners: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    corners.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return corners.join(" ") + " Z";
}

/**
 * Turns each `a.about-burst` link on the page into a starburst with the link's text on it. In
 * the HTML they are plain links, so they still work if this never runs.
 */
export function initBursts(size = 92) {
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    "a.about-burst",
  )) {
    const text = link.textContent?.trim() ?? "";
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", "0 0 100 100");
    const shape = document.createElementNS(SVG, "path");
    shape.setAttribute("d", burstPath());
    shape.setAttribute("class", "burst-shape");
    const label = document.createElementNS(SVG, "text");
    for (const [name, value] of Object.entries({
      x: "50",
      y: "50",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      class: "burst-text",
    })) {
      label.setAttribute(name, value);
    }
    label.textContent = text;
    svg.append(shape, label);
    link.replaceChildren(svg);
  }
}
