import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadConfig, resolveProjectPaths, validateConfig } from "./config.js";
import { assertSafeBuildPaths } from "./paths.js";
import { validateProject } from "./validator.js";
import { createPackMetadata } from "./metadata.js";
import { writeZip } from "./archive.js";

const IGNORED_FILES = new Set([".DS_Store", "Thumbs.db", ".gitkeep"]);

async function copyDirectory(sourceDir, destinationDir) {
  let fileCount = 0;

  async function walk(currentSource, currentDestination) {
    await fs.mkdir(currentDestination, { recursive: true });
    const entries = await fs.readdir(currentSource, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (IGNORED_FILES.has(entry.name)) continue;

      const sourcePath = path.join(currentSource, entry.name);
      const destinationPath = path.join(currentDestination, entry.name);

      if (entry.isSymbolicLink()) {
        throw new Error("Symbolic links are not supported in resource sources: " + sourcePath);
      }

      if (entry.isDirectory()) {
        await walk(sourcePath, destinationPath);
      } else if (entry.isFile()) {
        await fs.copyFile(sourcePath, destinationPath);
        fileCount += 1;
      } else {
        throw new Error("Unsupported filesystem entry: " + sourcePath);
      }
    }
  }

  await walk(sourceDir, destinationDir);
  return fileCount;
}

async function replaceDirectory(stagingDir, outputDir) {
  const backupDir = outputDir + ".bak-" + randomUUID();
  let hasBackup = false;

  try {
    await fs.rename(outputDir, backupDir);
    hasBackup = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  try {
    await fs.rename(stagingDir, outputDir);
    if (hasBackup) await fs.rm(backupDir, { recursive: true, force: true });
  } catch (error) {
    if (hasBackup) {
      await fs.rename(backupDir, outputDir).catch(() => {});
    }
    throw error;
  }
}

export async function buildResourcePack({ config, configPath, archiveEnabled = config.archive.enabled }) {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new Error("Invalid project configuration:\n- " + errors.join("\n- "));
  }

  const paths = resolveProjectPaths(config, configPath);
  const archivePath = archiveEnabled ? paths.archivePath : null;

  assertSafeBuildPaths({
    sourceDir: paths.sourceDir,
    outputDir: paths.outputDir,
    archivePath
  });

  const warnings = await validateProject(config, paths);
  await fs.mkdir(path.dirname(paths.outputDir), { recursive: true });

  const stagingDir = paths.outputDir + ".tmp-" + randomUUID();
  await fs.rm(stagingDir, { recursive: true, force: true });

  let fileCount;
  try {
    fileCount = await copyDirectory(paths.sourceDir, stagingDir);

    const metadataPath = path.join(stagingDir, "pack.mcmeta");
    try {
      await fs.access(metadataPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await fs.writeFile(metadataPath, createPackMetadata(config), "utf8");
      fileCount += 1;
    }

    await replaceDirectory(stagingDir, paths.outputDir);
  } catch (error) {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  let writtenArchive = null;
  if (archiveEnabled) {
    writtenArchive = await writeZip(paths.outputDir, paths.archivePath);
  }

  return {
    outputDir: paths.outputDir,
    archivePath: writtenArchive,
    fileCount,
    warnings
  };
}

export async function buildFromConfig(configPath, options = {}) {
  const config = await loadConfig(configPath);
  return buildResourcePack({
    config,
    configPath,
    archiveEnabled: options.archiveEnabled ?? config.archive.enabled
  });
}
