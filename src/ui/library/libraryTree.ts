import type { DocumentSummary, ProjectSnapshot } from "../../domain/project";
import type { LibrarySort } from "../../domain/settings";

export type LibraryDocumentNode = {
  kind: "document";
  key: string;
  document: DocumentSummary;
  parentPath: string;
};

export type LibraryFolderNode = {
  kind: "folder";
  key: string;
  name: string;
  path: string;
  parentPath: string;
  children: LibraryNode[];
};

export type LibraryNode = LibraryFolderNode | LibraryDocumentNode;

type MutableFolder = Omit<LibraryFolderNode, "children"> & {
  folders: Map<string, MutableFolder>;
  documents: LibraryDocumentNode[];
};

const collator = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

export function documentFolder(document: DocumentSummary): string {
  const path =
    document.original?.relativePath ?? document.translation?.relativePath ?? "";
  const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
  return parts.length > 2 ? parts.slice(1, -1).join("/") : "";
}

export function folderAncestors(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

export function documentModifiedAt(document: DocumentSummary): number {
  return Math.max(
    document.original?.modifiedAt ?? 0,
    document.translation?.modifiedAt ?? 0,
  );
}

export function buildLibraryTree(
  snapshot: Pick<ProjectSnapshot, "folders" | "documents">,
  sort: LibrarySort,
): LibraryNode[] {
  const root = createMutableFolder("", "", "");

  for (const folder of snapshot.folders) {
    ensureFolder(root, folder.relativePath);
  }

  for (const document of snapshot.documents) {
    const parentPath = documentFolder(document);
    const parent = ensureFolder(root, parentPath);
    parent.documents.push({
      kind: "document",
      key: `document:${document.documentId}`,
      document,
      parentPath,
    });
  }

  return finalizeFolder(root, sort);
}

function createMutableFolder(
  name: string,
  path: string,
  parentPath: string,
): MutableFolder {
  return {
    kind: "folder",
    key: `folder:${path}`,
    name,
    path,
    parentPath,
    folders: new Map(),
    documents: [],
  };
}

function ensureFolder(
  root: MutableFolder,
  relativePath: string,
): MutableFolder {
  let current = root;
  const segments = relativePath
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean);
  for (const segment of segments) {
    const path = current.path ? `${current.path}/${segment}` : segment;
    let child = current.folders.get(segment);
    if (!child) {
      child = createMutableFolder(segment, path, current.path);
      current.folders.set(segment, child);
    }
    current = child;
  }
  return current;
}

function finalizeFolder(
  folder: MutableFolder,
  sort: LibrarySort,
): LibraryNode[] {
  const direction = sort === "name-desc" ? -1 : 1;
  const folders = [...folder.folders.values()]
    .sort((left, right) => direction * collator.compare(left.name, right.name))
    .map<LibraryFolderNode>((child) => ({
      kind: "folder",
      key: child.key,
      name: child.name,
      path: child.path,
      parentPath: child.parentPath,
      children: finalizeFolder(child, sort),
    }));

  const documents = [...folder.documents].sort((left, right) => {
    if (sort === "modified-desc" || sort === "modified-asc") {
      const delta =
        documentModifiedAt(left.document) - documentModifiedAt(right.document);
      if (delta !== 0) return sort === "modified-desc" ? -delta : delta;
    }
    const result = collator.compare(left.document.title, right.document.title);
    return sort === "name-desc" ? -result : result;
  });

  return [...folders, ...documents];
}

export function flattenVisibleNodes(
  nodes: LibraryNode[],
  expandedPaths: ReadonlySet<string>,
): LibraryNode[] {
  const visible: LibraryNode[] = [];
  for (const node of nodes) {
    visible.push(node);
    if (node.kind === "folder" && expandedPaths.has(node.path)) {
      visible.push(...flattenVisibleNodes(node.children, expandedPaths));
    }
  }
  return visible;
}
