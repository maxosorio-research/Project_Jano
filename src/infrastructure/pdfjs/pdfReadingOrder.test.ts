import { describe, expect, it } from "vitest";
import {
  reconstructPdfReadingOrder,
  type PositionedPdfText,
} from "./pdfReadingOrder";

function item(
  text: string,
  x: number,
  y: number,
  width: number,
  height = 10,
  sourceIndex = 0,
): PositionedPdfText {
  return { text, x, y, width, height, sourceIndex };
}

describe("PDF reading order", () => {
  it("orders mixed column and full-width regions geometrically", () => {
    const items = [
      item("Body second line.", 60, 230, 320, 10, 5),
      item("Biography.", 60, 180, 320, 8, 6),
      item("Article title", 60, 560, 125, 15, 0),
      item("Author Name", 60, 525, 75, 10, 2),
      item("Deck first line", 210, 560, 170, 10, 3),
      item("Deck second line.", 210, 544, 170, 10, 4),
      item("Deck final line.", 210, 525, 170, 10, 7),
      item("Body first line", 60, 243, 320, 10, 1),
    ];

    expect(reconstructPdfReadingOrder(items, { width: 450, height: 650 })).toBe(
      [
        "Article title",
        "",
        "Author Name",
        "",
        "Deck first line\nDeck second line.\nDeck final line.",
        "",
        "Body first line\nBody second line.",
        "",
        "Biography.",
      ].join("\n"),
    );
  });

  it("reads complete columns from left to right", () => {
    const items = [
      item("Right one", 250, 500, 140, 10, 2),
      item("Left two", 60, 480, 140, 10, 1),
      item("Right two", 250, 480, 140, 10, 3),
      item("Left one", 60, 500, 140, 10, 0),
    ];

    expect(reconstructPdfReadingOrder(items, { width: 450, height: 650 })).toBe(
      "Left one\nLeft two\n\nRight one\nRight two",
    );
  });

  it("joins adjacent typographic fragments without inventing spaces", () => {
    const items = [
      item("E", 60, 250, 18, 28, 0),
      item("n muchos sentidos", 78, 263, 90, 10, 1),
      item("Second line", 60, 250, 90, 10, 2),
      item("Noam Ti", 60, 200, 38, 10, 3),
      item("T", 98, 200, 5, 7, 4),
      item("elman", 103, 200, 25, 7, 5),
    ];

    expect(reconstructPdfReadingOrder(items, { width: 450, height: 650 })).toBe(
      "En muchos sentidos\nSecond line\n\nNoam TiTelman",
    );
  });

  it("keeps an overlapping sidebar out of the main prose flow", () => {
    const items = [
      item("Full-width introduction", 60, 420, 330, 10, 0),
      item("Main narrow line one", 60, 400, 170, 10, 1),
      item("Main narrow line two", 60, 380, 170, 10, 2),
      item("Full-width continuation", 60, 360, 330, 10, 3),
      item("Sidebar line one", 255, 400, 125, 11, 4),
      item("Sidebar line two", 255, 380, 125, 11, 5),
    ];

    expect(reconstructPdfReadingOrder(items, { width: 450, height: 650 })).toBe(
      [
        "Full-width introduction",
        "Main narrow line one",
        "Main narrow line two",
        "Full-width continuation",
        "",
        "Sidebar line one",
        "Sidebar line two",
      ].join("\n"),
    );
  });
});
