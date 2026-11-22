import fs from "node:fs/promises";
import path from "node:path";

export async function validateProject(config, paths) {
  let sourceStat;

  try {
    sourceStat = await fs.stat(paths.sourceDir);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("Resource source directory does not exist: " + paths.sourceDir);
    }
    throw error;
  }

  if (!sourceStat.isDirectory()) {
    throw new Error("Resource source path is not a directory: " + paths.sourceDir);
  }

  const warnings = [];
  const metadataPath = path.join(paths.sourceDir, "pack.mcmeta");

  try {
    const metadataText = await fs.readFile(metadataPath, "utf8");
    let metadata;

    try {
      metadata = JSON.parse(metadataText);
    } catch (error) {
      throw new Error("Invalid pack.mcmeta JSON: " + error.message);
    }

    if (!metadata.pack || typeof metadata.pack !== "object") {
      throw new Error('pack.mcmeta must contain a "pack" object.');
    }

    if (!Number.isInteger(metadata.pack.pack_format) || metadata.pack.pack_format < 1) {
      throw new Error('"pack.pack_format" in pack.mcmeta must be a positive integer.');
    }

    if (metadata.pack.description === undefined) {
      throw new Error('pack.mcmeta must contain "pack.description".');
    }

    if (metadata.pack.pack_format !== config.pack.packFormat) {
      warnings.push(
        "pack.mcmeta uses pack_format " + metadata.pack.pack_format +
        " while the configuration specifies " + config.pack.packFormat +
        ". The existing pack.mcmeta will be preserved."
      );
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      warnings.push("pack.mcmeta is missing and will be generated from the project configuration.");
    } else {
      throw error;
    }
  }

  const namespaceDir = path.join(paths.sourceDir, "assets", config.namespace);
  try {
    const namespaceStat = await fs.stat(namespaceDir);
    if (!namespaceStat.isDirectory()) {
      warnings.push("Expected namespace path is not a directory: assets/" + config.namespace);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      warnings.push("No assets/" + config.namespace + " directory was found. Add your MTR assets there when needed.");
    } else {
      throw error;
    }
  }

  return warnings;
}
