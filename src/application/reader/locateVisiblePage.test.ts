import { describe, expect, it } from "vitest";
import { locateVisiblePage } from "./locateVisiblePage";

const pages = [
  { pageNumber: 1, top: 0, height: 800 },
  { pageNumber: 2, top: 824, height: 800 },
  { pageNumber: 3, top: 1648, height: 800 },
];

describe("locateVisiblePage", () => {
  it("chooses the page occupying the largest visible area", () => {
    expect(locateVisiblePage(pages, 650, 600)).toEqual({
      pageNumber: 2,
      pageOffset: 0,
    });
  });

  it("reports a stable offset inside the current page", () => {
    expect(locateVisiblePage(pages, 1024, 500)).toEqual({
      pageNumber: 2,
      pageOffset: 0.25,
    });
  });

  it("does not invent a locator outside rendered page bounds", () => {
    expect(locateVisiblePage(pages, 3000, 500)).toBeNull();
  });
});
