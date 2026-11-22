#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG_FILE, loadConfig, resolveProjectPaths } from "./core/config.js";
import { validateProject } from "./core/validator.js";
import { assertSafeBuildPaths } from "./core/paths.js";
import { buildResourcePack } from "./core/generator.js";
import { initializeProject } from "./core/initializer.js";
import { generateIdeConfigs } from "./core/ide.js";
import {
  DEFAULT_GAME_DIR_NAME,
  FABRIC_LOADER_VERSION,
  MINECRAFT_VERSION,
  setupEnvironment
} from "./core/environment.js";
import { launchClient } from "./core/launcher.js";
import { installResourcePack } from "./core/installer.js";

const currentFile = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === currentFile;

function readOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error("Missing value for " + name);
  }
  return args[index + 1];
}

function printInitSummary(result) {
  console.log("Project initialized: " + result.projectDir);
  console.log("Configuration: " + result.configPath);
  console.log("Add your files under: " + result.sourceDir);
  console.log("Sample resource pack generated:");
  for (const file of result.sampleFiles) {
    console.log("  " + path.relative(result.projectDir, file));
  }
  console.log("IDE run configurations generated:");
  for (const file of result.ideFiles) {
    console.log("  " + path.relative(result.projectDir, file));
  }
}

// Scaffolds the project the first time any command runs, so a fresh clone is
// usable straight after the IDE imports it.
async function ensureProject(projectDir) {
  const result = await initializeProject(projectDir, { ifMissing: true });
  if (!result) return null;

  console.log("First run detected, scaffolding the project...");
  printInitSummary(result);
  console.log("");
  return result;
}

function printHelp() {
  console.log([
    "MTR Resource Packs Creator",
    "",
    "Usage:",
    "  node src/cli.js init [directory] [--if-missing]",
    "  node src/cli.js ide [directory]",
    "  node src/cli.js validate [--config file]",
    "  node src/cli.js build [--config file] [--no-archive]",
    "  node src/cli.js setup [--dir name] [--mc version] [--loader version] [--no-assets] [--proxy url]",
    "  node src/cli.js install [--config file] [--dir name] [--no-build]",
    "  node src/cli.js launch [--dir name] [--username name] [--memory 2G] [--java path] [--no-install] [--dry-run]",
    "",
    "Commands:",
    "  init       Create a starter resource-pack project (--if-missing: skip when initialised)",
    "  ide        Generate VS Code and WebStorm run configurations for build/test",
    "  validate   Check the project configuration and source directory",
    "  build      Generate the resource-pack directory and optional ZIP",
    "  setup      Download a Minecraft 1.20.1 + Fabric test client with the MTR mods",
    "  install    Copy the built pack into the test client and enable it",
    "  launch     Build, install the pack and start the test client",
    "",
    "Options:",
    "  --config   Path to the JSON project configuration",
    "  --no-archive  Skip ZIP generation for this build",
    "  --dir      Test-client directory name (default: " + DEFAULT_GAME_DIR_NAME + ")",
    "  --mc       Minecraft version to install (default: " + MINECRAFT_VERSION + ")",
    "  --loader   Fabric loader version (default: " + FABRIC_LOADER_VERSION + ")",
    "  --no-assets   Skip downloading Minecraft asset files",
    "  --proxy    HTTP(S) proxy URL, e.g. http://127.0.0.1:7897 (default: HTTPS_PROXY env)",
    "  --no-build    Install the existing build instead of rebuilding",
    "  --no-install  Launch without rebuilding or installing the resource pack",
    "  --username In-game player name for the test client",
    "  --memory   Maximum Java heap size, e.g. 2G",
    "  --java     Explicit path to the java executable",
    "  --dry-run  Print the launch command without starting the game"
  ].join("\n"));
}

async function run() {
  const args = process.argv.slice(2);
  const command = args.shift();

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "init") {
    const target = args.find((value) => !value.startsWith("--")) || ".";
    const result = await initializeProject(target, { ifMissing: args.includes("--if-missing") });

    if (!result) {
      console.log("Project already initialized: " + path.resolve(target));
      return;
    }

    printInitSummary(result);
    return;
  }

  if (command === "ide") {
    const target = args.find((value) => !value.startsWith("--")) || ".";
    const result = await generateIdeConfigs(target, { log: (message) => console.log(message) });
    console.log("Open the IDE run bar to use the generated build/test shortcuts in " + result.projectDir);
    return;
  }

  if (command === "setup") {
    await ensureProject(process.cwd());

    const summary = await setupEnvironment({
      projectDir: process.cwd(),
      gameDirName: readOption(args, "--dir") || DEFAULT_GAME_DIR_NAME,
      minecraftVersion: readOption(args, "--mc") || MINECRAFT_VERSION,
      loaderVersion: readOption(args, "--loader") || FABRIC_LOADER_VERSION,
      includeAssets: !args.includes("--no-assets"),
      proxy: readOption(args, "--proxy")
    });

    console.log("");
    console.log("Test environment ready: " + summary.gameDir);
    console.log("  Minecraft: " + summary.minecraftVersion);
    console.log("  Fabric loader: " + summary.loaderVersion);
    for (const mod of summary.mods) {
      console.log("  mod: " + mod.file + "  (" + mod.version + ")");
    }
    console.log("Run \"node src/cli.js launch\" to start the test client.");
    return;
  }

  if (command === "install") {
    await ensureProject(process.cwd());

    const configArgument = readOption(args, "--config");
    const result = await installResourcePack({
      projectDir: process.cwd(),
      gameDirName: readOption(args, "--dir") || DEFAULT_GAME_DIR_NAME,
      configPath: configArgument ? path.resolve(process.cwd(), configArgument) : undefined,
      build: !args.includes("--no-build"),
      log: (message) => console.log(message)
    });

    console.log("The test client will load it on the next launch.");
    return result;
  }

  if (command === "launch") {
    await ensureProject(process.cwd());

    const result = await launchClient({
      projectDir: process.cwd(),
      gameDirName: readOption(args, "--dir") || DEFAULT_GAME_DIR_NAME,
      username: readOption(args, "--username") || "Player",
      memory: readOption(args, "--memory") || "2G",
      java: readOption(args, "--java"),
      install: !args.includes("--no-install"),
      dryRun: args.includes("--dry-run")
    });

    if (result.spawned) console.log("Client exited with code " + result.exitCode);
    return;
  }

  if (command !== "validate" && command !== "build") {
    throw new Error("Unknown command: " + command + ". Run with --help for usage.");
  }

  const configArgument = readOption(args, "--config");
  if (!configArgument) await ensureProject(process.cwd());

  const configPath = path.resolve(process.cwd(), configArgument || DEFAULT_CONFIG_FILE);
  const config = await loadConfig(configPath);
  const paths = resolveProjectPaths(config, configPath);

  assertSafeBuildPaths({
    sourceDir: paths.sourceDir,
    outputDir: paths.outputDir,
    archivePath: config.archive.enabled && !args.includes("--no-archive") ? paths.archivePath : null
  });

  if (command === "validate") {
    const warnings = await validateProject(config, paths);
    console.log("Project validation passed.");
    for (const warning of warnings) console.warn("Warning: " + warning);
    return;
  }

  const result = await buildResourcePack({
    config,
    configPath,
    archiveEnabled: config.archive.enabled && !args.includes("--no-archive")
  });

  console.log("Resource pack generated: " + result.outputDir);
  console.log("Files copied: " + result.fileCount);
  if (result.archivePath) console.log("ZIP archive: " + result.archivePath);
  for (const warning of result.warnings) console.warn("Warning: " + warning);
}

if (isDirectRun) {
  run().catch((error) => {
    console.error("Error: " + error.message);
    process.exitCode = 1;
  });
}
