export type ProjectId = string;

export type Project = {
  projectId: ProjectId;
  name: string;
  root: string;
  schemaVersion: number;
};

export type DiscoveredProject = {
  projectId: ProjectId;
  name: string;
  root: string;
  modifiedAt: number;
};

export type PairState =
  | "paired"
  | "missing-original"
  | "missing-translation"
  | "unavailable"
  | "manually-linked"
  | "conflict";

export type DocumentFileRef = {
  relativePath: string;
  sha256: string;
  size: number;
  modifiedAt: number;
  mediaType: string;
};

export type DocumentSummary = {
  documentId: string;
  title: string;
  pairState: PairState;
  original: DocumentFileRef | null;
  translation: DocumentFileRef | null;
};

export type ProjectSnapshot = {
  project: Project;
  documents: DocumentSummary[];
  hiddenDocuments: DocumentSummary[];
  folders: ProjectFolder[];
};

export type ProjectFolder = {
  relativePath: string;
  name: string;
};
