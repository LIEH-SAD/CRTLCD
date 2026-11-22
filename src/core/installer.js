import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG_FILE, loadConfig, resolveProjectPaths } from "./config.js";
import { buildResourcePack } from "./generator.js";
import { DEFAULT_GAME_DIR_NAME } from "./environment.js";
import { pathExists } from "./download.js";

const OPTIONS_FILE = "options.txt";
const RESOURCE_PACKS_KEY = "resourcePacks:";
const VANILLA_PACK = "vanilla";

function parsePackList(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((entry) => typeof entry === "string");
  } catch {
    // Minecraft writes valid JSON; fall back to a lenient scan when it does not.
  }

  return [...raw.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
}

// Records the pack in options.txt so the game enables it on start-up. The entry
// is appended last, which gives the pack priority over the other enabled packs.
export async function enableResourcePack(optionsPath, entry) {
  let lines = [];

  try {
    const text = await fs.readFile(optionsPath, "utf8");
    lines = text.split(/\r?\n/);
    if (lines[lines.length - 1] === "") lines.pop();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const index = lines.findIndex((line) => line.startsWith(RESOURCE_PACKS_KEY));
  const existing = index === -1 ? [] : parsePackList(lines[index].slice(RESOURCE_PACKS_KEY.length));

  const entries = existing.filter((value) => value !== entry);
  entries.push(entry);
  if (!entries.includes(VANILLA_PACK)) entries.unshift(VANILLA_PACK);

  const line = RESOURCE_PACKS_KEY + JSON.stringify(entries);
  if (index === -1) lines.push(line);
  else lines[index] = line;

  await fs.writeFile(optionsPath, lines.join("\n") + "\n", "utf8");
  return entries;
}

// Builds the resource pack and copies it into the test client's resourcepacks
// folder, then enables it in options.txt. Called before every launch so the
// client always loads the current build.
export async function installResourcePack(options = {}) {
  const {
    projectDir = process.cwd(),
    gameDirName = DEFAULT_GAME_DIR_NAME,
    build = true,
    log = () => {}
  } = options;

  const root = path.resolve(projectDir);
  const configPath = options.configPath || path.join(root, DEFAULT_CONFIG_FILE);
  const config = await loadConfig(configPath);
  const paths = resolveProjectPaths(config, configPath);

  let buildResult = null;
  if (build) {
    buildResult = await buildResourcePack({ config, configPath, archiveEnabled: true });
    log("Built resource pack: " + buildResult.outputDir);
  } else if (!(await pathExists(paths.archivePath))) {
    throw new Error("Resource pack archive not found: " + paths.archivePath + ". Run the build command first.");
  }

  const gameDir = path.resolve(root, gameDirName);
  const resourcePacksDir = path.join(gameDir, "resourcepacks");
  const fileName = path.basename(paths.archivePath);
  const installedPath = path.join(resourcePacksDir, fileName);

  await fs.mkdir(resourcePacksDir, { recursive: true });
  await fs.rm(installedPath, { force: true });
  await fs.copyFile(paths.archivePath, installedPath);

  const entry = "file/" + fileName;
  const optionsPath = path.join(gameDir, OPTIONS_FILE);
  const enabledPacks = await enableResourcePack(optionsPath, entry);

  log("Installed resource pack: " + installedPath);
  log("Enabled in: " + optionsPath);

  return {
    gameDir,
    resourcePacksDir,
    installedPath,
    entry,
    optionsPath,
    enabledPacks,
    build: buildResult
  };
}
