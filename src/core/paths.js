import path from "node:path";

export function isSameOrInside(parentPath, candidatePath) {
  const parent = path.resolve(parentPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(parent, candidate);

  return relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(".." + path.sep) &&
      !path.isAbsolute(relative));
}

export function assertSafeBuildPaths({ sourceDir, outputDir, archivePath }) {
  const source = path.resolve(sourceDir);
  const output = path.resolve(outputDir);

  if (isSameOrInside(source, output) || isSameOrInside(output, source)) {
    throw new Error("Source and output directories must not overlap. Check paths.source and paths.output.");
  }

  if (!archivePath) return;

  const archive = path.resolve(archivePath);
  if (!archive.toLowerCase().endsWith(".zip")) {
    throw new Error('The archive output path must end with ".zip".');
  }

  if (isSameOrInside(source, archive) || isSameOrInside(output, archive)) {
    throw new Error("The ZIP archive must be outside both the source and output directories.");
  }
}
