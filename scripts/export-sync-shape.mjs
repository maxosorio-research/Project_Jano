import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import prettier from "prettier";

function parseArguments(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? "end of command"}.`);
    }
    options[key.slice(2)] = value;
  }
  return options;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function countBy(values, selector) {
  return values.reduce((counts, value) => {
    const key = selector(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

const options = parseArguments(process.argv.slice(2));
const projectRoot = options["project-root"];
const documentId = options["document-id"];
const output = options.output;
const fixtureName = options.name;

if (!projectRoot || !documentId || !output || !fixtureName) {
  throw new Error(
    "Required arguments: --project-root, --document-id, --name, --output.",
  );
}

const metadataRoot = path.join(projectRoot, ".jano");
const artifactRoot = path.join(metadataRoot, "documents", documentId);
const catalog = await readJson(path.join(metadataRoot, "documents.json"));
const document = requireArray(catalog.documents, "documents").find(
  (candidate) => candidate.documentId === documentId,
);

if (!document?.original) {
  throw new Error(`Document ${documentId} has no original file record.`);
}

const [segments, translations, alignments, processing] = await Promise.all([
  readJson(path.join(artifactRoot, "segments.json")),
  readJson(path.join(artifactRoot, "translation.json")),
  readJson(path.join(artifactRoot, "alignment.json")),
  readJson(path.join(artifactRoot, "processing.json")),
]);

requireArray(segments, "segments");
requireArray(translations, "translations");
requireArray(alignments, "alignments");

const sourceIds = new Set(segments.map((segment) => segment.segmentId));
const targetIds = new Set(
  translations.map((translation) => translation.segmentId),
);
if (sourceIds.size !== segments.length) {
  throw new Error("Source segment IDs must be unique.");
}
if (targetIds.size !== translations.length) {
  throw new Error("Target segment IDs must be unique.");
}
const sourceAlignmentCounts = new Map();
const targetAlignmentCounts = new Map();

for (const alignment of alignments) {
  for (const segmentId of alignment.sourceSegmentIds) {
    if (!sourceIds.has(segmentId)) {
      throw new Error(`Unknown source segment in alignment: ${segmentId}.`);
    }
    sourceAlignmentCounts.set(
      segmentId,
      (sourceAlignmentCounts.get(segmentId) ?? 0) + 1,
    );
  }
  for (const segmentId of alignment.targetSegmentIds) {
    if (!targetIds.has(segmentId)) {
      throw new Error(`Unknown target segment in alignment: ${segmentId}.`);
    }
    targetAlignmentCounts.set(
      segmentId,
      (targetAlignmentCounts.get(segmentId) ?? 0) + 1,
    );
  }
}

for (const segmentId of sourceIds) {
  if (sourceAlignmentCounts.get(segmentId) !== 1) {
    throw new Error(`Source segment ${segmentId} is not aligned exactly once.`);
  }
}
for (const segmentId of targetIds) {
  if (targetAlignmentCounts.get(segmentId) !== 1) {
    throw new Error(`Target segment ${segmentId} is not aligned exactly once.`);
  }
}

const translationById = new Map(
  translations.map((translation) => [translation.segmentId, translation]),
);
const pageCount = Math.max(...segments.map((segment) => segment.page), 0);
const reviewStatusCounts = countBy(
  translations,
  (translation) => translation.reviewStatus ?? "not-reviewed",
);

const fixture = {
  schemaVersion: 1,
  name: fixtureName,
  contentIncluded: false,
  source: {
    documentId,
    originalFileName: path.basename(document.original.relativePath),
    originalSha256: document.original.sha256,
    pageCount,
    nativePageCount: processing.nativePageCount,
    ocrPageCount: processing.ocrPageCount,
    segmentCount: segments.length,
    translationCount: translations.length,
    alignmentCount: alignments.length,
    reviewStatusCounts,
  },
  segments: segments.map((segment) => {
    const translation = translationById.get(segment.segmentId);
    if (!translation) {
      throw new Error(`Missing translation for ${segment.segmentId}.`);
    }
    return {
      segmentId: segment.segmentId,
      page: segment.page,
      blockType: segment.blockType,
      sourceLength: segment.text.length,
      targetLength: translation.text.length,
      reviewStatus: translation.reviewStatus ?? "not-reviewed",
      reviewWarningCount: translation.reviewWarnings?.length ?? 0,
    };
  }),
  alignments: alignments.map((alignment) => ({
    alignmentId: alignment.alignmentId,
    sourceSegmentIds: alignment.sourceSegmentIds,
    targetSegmentIds: alignment.targetSegmentIds,
    type: alignment.type,
    method: alignment.method,
  })),
};

const outputPath = path.resolve(output);
const serializedFixture = await prettier.format(JSON.stringify(fixture), {
  parser: "json",
});
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, serializedFixture, "utf8");
process.stdout.write(
  `Wrote ${segments.length} de-identified segment shapes to ${outputPath}\n`,
);
