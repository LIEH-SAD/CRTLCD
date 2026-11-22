import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { readJson, pathExists, ensureDir } from "./download.js";
import {
  MINECRAFT_VERSION,
  DEFAULT_GAME_DIR_NAME,
  detectPlatform,
  isAllowed,
  libraryApplies,
  mavenToPath,
  extractNatives
} from "./environment.js";
import { installResourcePack } from "./installer.js";

const LAUNCHER_BRAND = "mtr-resource-packs-creator";

function offlineUuid(username) {
  const hash = crypto.createHash("md5").update("OfflinePlayer:" + username, "utf8").digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
}

function substitute(template, values) {
  return template.replace(/\$\{([^}]+)\}/g, (match, key) => (key in values ? values[key] : match));
}

function expandArguments(argumentList, values, platform) {
  const result = [];

  for (const argument of argumentList) {
    if (typeof argument === "string") {
      result.push(substitute(argument, values));
      continue;
    }

    if (!argument || !isAllowed(argument.rules, platform)) continue;

    const valuesToAdd = Array.isArray(argument.value) ? argument.value : [argument.value];
    for (const value of valuesToAdd) {
      result.push(substitute(value, values));
    }
  }

  return result;
}

export function resolveJavaCommand(explicit) {
  if (explicit) return explicit;
  if (process.env.JAVA_HOME) {
    return path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java");
  }
  return "java";
}

export async function buildLaunchPlan(options = {}) {
  const {
    projectDir = process.cwd(),
    gameDirName = DEFAULT_GAME_DIR_NAME,
    minecraftVersion = MINECRAFT_VERSION,
    username = "Player",
    memory = "2G"
  } = options;

  const root = path.resolve(projectDir, gameDirName);
  const versionDir = path.join(root, "versions", minecraftVersion);
  const versionJsonPath = path.join(versionDir, minecraftVersion + ".json");
  const fabricProfilePath = path.join(root, ".mtr-test", "fabric-profile.json");

  if (!(await pathExists(versionJsonPath)) || !(await pathExists(fabricProfilePath))) {
    throw new Error("Test environment not found in " + root + ". Run the setup command first.");
  }

  const versionJson = await readJson(versionJsonPath);
  const fabricProfile = await readJson(fabricProfilePath);
  const platform = detectPlatform();

  const librariesDir = path.join(root, "libraries");
  const clientJar = path.join(versionDir, minecraftVersion + ".jar");
  const nativesDir = path.join(versionDir, "natives");

  await ensureDir(nativesDir);
  await extractNatives(versionJson.libraries, platform, librariesDir, nativesDir);

  const classpath = [];
  for (const library of fabricProfile.libraries) {
    classpath.push(path.join(librariesDir, ...mavenToPath(library.name).split("/")));
  }
  for (const library of versionJson.libraries) {
    if (!libraryApplies(library, platform) || !library.downloads?.artifact) continue;
    classpath.push(path.join(librariesDir, ...library.downloads.artifact.path.split("/")));
  }
  classpath.push(clientJar);

  const values = {
    auth_player_name: username,
    version_name: fabricProfile.id || minecraftVersion,
    game_directory: root,
    assets_root: path.join(root, "assets"),
    assets_index_name: versionJson.assetIndex.id,
    auth_uuid: offlineUuid(username),
    auth_access_token: "0",
    clientid: "",
    auth_xuid: "",
    user_type: "legacy",
    version_type: versionJson.type || "release",
    natives_directory: nativesDir,
    launcher_name: LAUNCHER_BRAND,
    launcher_version: "0.1.0",
    classpath: classpath.join(path.delimiter),
    library_directory: librariesDir,
    classpath_separator: path.delimiter
  };

  const jvmArguments = [
    "-Xmx" + memory,
    ...expandArguments(versionJson.arguments.jvm, values, platform),
    ...expandArguments(fabricProfile.arguments?.jvm || [], values, platform)
  ];

  const gameArguments = [
    ...expandArguments(versionJson.arguments.game, values, platform),
    ...expandArguments(fabricProfile.arguments?.game || [], values, platform)
  ];

  return {
    root,
    mainClass: fabricProfile.mainClass || versionJson.mainClass,
    jvmArguments,
    gameArguments,
    classpath,
    nativesDir,
    platform
  };
}

export async function launchClient(options = {}) {
  const { log = console.log, dryRun = false, install = true } = options;

  if (install) {
    const installed = await installResourcePack({ ...options, log });
    log("The client will load the pack from " + installed.resourcePacksDir);
  }

  const plan = await buildLaunchPlan(options);
  const java = resolveJavaCommand(options.java);
  const args = [...plan.jvmArguments, plan.mainClass, ...plan.gameArguments];

  log("Launching " + plan.mainClass + " with " + java);
  log("Game directory: " + plan.root);

  if (dryRun) {
    log(args.join(" "));
    return { spawned: false, command: java, args };
  }

  return new Promise((resolve, reject) => {
    const child = spawn(java, args, { cwd: plan.root, stdio: "inherit" });

    child.on("error", (error) => {
      reject(new Error("Failed to start Java (" + java + "): " + error.message));
    });

    child.on("exit", (code) => {
      resolve({ spawned: true, exitCode: code });
    });
  });
}
