import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG, DEFAULT_CONFIG_FILE } from "./config.js";
import { createSampleResourcePack } from "./sample.js";
import { generateIdeConfigs } from "./ide.js";
import { pathExists } from "./download.js";

// `ifMissing` makes the initialisation idempotent so IDEs can run it on every
// project open: it returns null when the project already has a configuration.
export async function initializeProject(targetDir = ".", options = {}) {
  const { ifMissing = false } = options;
  const projectDir = path.resolve(targetDir);
  const configPath = path.join(projectDir, DEFAULT_CONFIG_FILE);
  const sourceDir = path.join(projectDir, DEFAULT_CONFIG.paths.source);

  if (await pathExists(configPath)) {
    if (ifMissing) return null;
    throw new Error("Configuration already exists: " + configPath);
  }

  await fs.mkdir(projectDir, { recursive: true });
  await fs.mkdir(sourceDir, { recursive: true });

  const sampleFiles = await createSampleResourcePack(sourceDir, DEFAULT_CONFIG);

  await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", { flag: "wx" });

  const ide = await generateIdeConfigs(projectDir);

  return { projectDir, configPath, sourceDir, sampleFiles, ideFiles: ide.files };
}
