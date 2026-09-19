import { describe, expect, it } from "vitest";
import type { DocumentSummary, ProjectFolder } from "../../domain/project";
import {
  buildLibraryTree,
  documentFolder,
  flattenVisibleNodes,
  folderAncestors,
} from "./libraryTree";

function document(
  documentId: string,
  title: string,
  relativePath: string,
  modifiedAt = 1,
): DocumentSummary {
  return {
    documentId,
    title,
    pairState: "missing-translation",
    original: {
      relativePath,
      sha256: documentId,
      size: 1,
      modifiedAt,
      mediaType: "application/pdf",
    },
    translation: null,
  };
}

const folders: ProjectFolder[] = [
  { relativePath: "Teoría", name: "Teoría" },
  { relativePath: "Teoría/Instituciones", name: "Instituciones" },
  { relativePath: "Vacía", name: "Vacía" },
];

describe("buildLibraryTree", () => {
  it("builds nested folders, root documents and empty folders", () => {
    const tree = buildLibraryTree(
      {
        folders,
        documents: [
          document("root", "Raíz", "Demo_orig/Raíz.pdf"),
          document(
            "nested",
            "Artículo",
            "Demo_orig/Teoría/Instituciones/Artículo.pdf",
          ),
        ],
      },
      "name-asc",
    );

    expect(tree.map((node) => node.key)).toEqual([
      "folder:Teoría",
      "folder:Vacía",
      "document:root",
    ]);
    const theory = tree[0];
    expect(theory.kind).toBe("folder");
    if (theory.kind === "folder") {
      expect(theory.children[0]?.key).toBe("folder:Teoría/Instituciones");
    }
  });

  it("sorts documents by modification time", () => {
    const tree = buildLibraryTree(
      {
        folders: [],
        documents: [
          document("old", "Antiguo", "Demo_orig/Antiguo.pdf", 1),
          document("new", "Nuevo", "Demo_orig/Nuevo.pdf", 10),
        ],
      },
      "modified-desc",
    );
    expect(tree.map((node) => node.key)).toEqual([
      "document:new",
      "document:old",
    ]);
  });

  it("normalizes document folders and exposes ancestor paths", () => {
    expect(
      documentFolder(
        document("a", "A", "Demo_orig\\Teoría\\Instituciones\\A.pdf"),
      ),
    ).toBe("Teoría/Instituciones");
    expect(folderAncestors("Teoría/Instituciones")).toEqual([
      "Teoría",
      "Teoría/Instituciones",
    ]);
  });

  it("flattens only expanded branches", () => {
    const tree = buildLibraryTree(
      {
        folders,
        documents: [
          document(
            "nested",
            "Artículo",
            "Demo_orig/Teoría/Instituciones/Artículo.pdf",
          ),
        ],
      },
      "name-asc",
    );
    expect(
      flattenVisibleNodes(tree, new Set(["Teoría"])).map((node) => node.key),
    ).toEqual(["folder:Teoría", "folder:Teoría/Instituciones", "folder:Vacía"]);
  });
});
