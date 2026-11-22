import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONFIG_FILE = "mtr-resource-pack.config.json";

export const DEFAULT_CONFIG = {
  name: "mtr-resource-pack",
  version: "1.0.0",
  author: "",
  namespace: "mtr",
  pack: {
    packFormat: 15,
    description: "MTR Resource Pack"
  },
  paths: {
    source: "resource-pack",
    output: "dist/resource-pack",
    archive: "dist/mtr-resource-pack.zip"
  },
  archive: {
    enabled: true
  }
};

export function validateConfig(config) {
  const errors = [];

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return ["Configuration root must be a JSON object."];
  }

  if (typeof config.name !== "string" || !config.name.trim()) {
    errors.push('"name" must be a non-empty string.');
  }

  if (typeof config.namespace !== "string" || !/^[a-z0-9_.-]+$/.test(config.namespace)) {
    errors.push('"namespace" must contain only lowercase letters, numbers, dots, underscores or hyphens.');
  }

  if (!config.pack || typeof config.pack !== "object") {
    errors.push('"pack" must be an object.');
  } else {
    if (!Number.isInteger(config.pack.packFormat) || config.pack.packFormat < 1) {
      errors.push('"pack.packFormat" must be a positive integer.');
    }
    if (typeof config.pack.description !== "string" || !config.pack.description.trim()) {
      errors.push('"pack.description" must be a non-empty string.');
    }
  }

  if (!config.paths || typeof config.paths !== "object") {
    errors.push('"paths" must be an object.');
  } else {
    for (const key of ["source", "output", "archive"]) {
      if (typeof config.paths[key] !== "string" || !config.paths[key].trim()) {
        errors.push('"paths.' + key + '" must be a non-empty path string.');
      }
    }
  }

  if (!config.archive || typeof config.archive.enabled !== "boolean") {
    errors.push('"archive.enabled" must be a boolean.');
  }

  return errors;
}

export async function loadConfig(configPath = DEFAULT_CONFIG_FILE) {
  const absoluteConfigPath = path.resolve(configPath);
  let text;

  try {
    text = await fs.readFile(absoluteConfigPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("Configuration file not found: " + absoluteConfigPath + ". Run the init command first.");
    }
    throw error;
  }

  let config;
  try {
    config = JSON.parse(text);
  } catch (error) {
    throw new Error("Invalid JSON in " + absoluteConfigPath + ": " + error.message);
  }

  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new Error("Invalid project configuration:\n- " + errors.join("\n- "));
  }

  return config;
}

export function resolveProjectPaths(config, configPath = DEFAULT_CONFIG_FILE) {
  const projectDir = path.dirname(path.resolve(configPath));

  return {
    projectDir,
    sourceDir: path.resolve(projectDir, config.paths.source),
    outputDir: path.resolve(projectDir, config.paths.output),
    archivePath: path.resolve(projectDir, config.paths.archive)
  };
}
