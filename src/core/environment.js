import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import {
  ensureDir,
  pathExists,
  readJson,
  writeJson,
  fetchJson,
  downloadFile,
  mapLimit,
  setProxy
} from "./download.js";

export const MINECRAFT_VERSION = "1.20.1";
export const FABRIC_LOADER_VERSION = "0.16.10";

export const MOJANG_MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
export const FABRIC_META_URL = "https://meta.fabricmc.net/v2";
export const FABRIC_MAVEN_URL = "https://maven.fabricmc.net/";
export const MODRINTH_API_URL = "https://api.modrinth.com/v2";
export const MOJANG_RESOURCES_URL = "https://resources.download.minecraft.net";

export const DEFAULT_GAME_DIR_NAME = "minecraft-test";

// Fabric API is resolved to the newest release for the target Minecraft version,
// the two MTR add-ons are pinned to the exact Modrinth version ids requested.
// Architectury API is a hard runtime dependency of MTR even though the mod does
// not declare it, so it is pulled in automatically to keep the client bootable.
export const DEFAULT_TEST_MODS = [
  { project: "fabric-api", label: "Fabric API" },
  { project: "architectury-api", label: "Architectury API" },
  { project: "ybOYitTg", version: "7Hi3cN4I", label: "MTR-ANTE" },
  { project: "U75MCH6y", version: "20XUo8Wv", label: "YMTR" }
];

export function detectPlatform() {
  const name =
    process.platform === "win32" ? "windows" :
    process.platform === "darwin" ? "osx" :
    "linux";

  const arch =
    process.arch === "x64" ? "x86_64" :
    process.arch === "arm64" ? "arm64" :
    process.arch === "ia32" ? "x86" :
    process.arch;

  return { name, arch };
}

function ruleMatches(rule, platform, features) {
  if (rule.features) {
    for (const key of Object.keys(rule.features)) {
      if (!features[key]) return false;
    }
  }

  const target = rule.os;
  if (!target) return true;
  if (target.name && target.name !== platform.name) return false;
  if (target.arch && target.arch !== platform.arch) return false;

  return true;
}

export function isAllowed(rules, platform, features = {}) {
  if (!Array.isArray(rules) || rules.length === 0) return true;

  let allowed = false;
  for (const rule of rules) {
    if (!ruleMatches(rule, platform, features)) continue;
    allowed = rule.action === "allow";
  }

  return allowed;
}

export function mavenToPath(coordinates) {
  const [group, artifact, version, classifier] = coordinates.split(":");
  const fileName = artifact + "-" + version + (classifier ? "-" + classifier : "") + ".jar";
  return group.replace(/\./g, "/") + "/" + artifact + "/" + version + "/" + fileName;
}

function splitRelative(relativePath) {
  return relativePath.split("/").filter(Boolean);
}

const NATIVE_OS_ALIAS = { windows: "windows", osx: "macos", linux: "linux" };

function nativeClassifier(library) {
  const parts = library.name.split(":");
  const classifier = parts.length > 3 ? parts[3] : null;
  return classifier && classifier.startsWith("natives-") ? classifier : null;
}

function expectedNativeClassifier(platform) {
  const osName = NATIVE_OS_ALIAS[platform.name] || platform.name;
  const archSuffix = platform.arch === "x86" ? "-x86" : platform.arch === "arm64" ? "-arm64" : "";
  return "natives-" + osName + archSuffix;
}

// Mojang's version manifest lists every native classifier of a library while only
// restricting the rules by operating system, so the architecture suffix has to be
// matched explicitly to avoid mixing 32-bit, 64-bit and ARM natives.
export function libraryApplies(library, platform) {
  if (!isAllowed(library.rules, platform)) return false;

  const classifier = nativeClassifier(library);
  if (classifier) return classifier === expectedNativeClassifier(platform);

  return true;
}

export async function resolveMinecraftVersion(versionId = MINECRAFT_VERSION) {
  const manifest = await fetchJson(MOJANG_MANIFEST_URL);
  const entry = manifest.versions.find((item) => item.id === versionId);
  if (!entry) throw new Error("Unknown Minecraft version: " + versionId);
  return fetchJson(entry.url);
}

export async function resolveFabricProfile(gameVersion, loaderVersion) {
  return fetchJson(FABRIC_META_URL + "/versions/loader/" + gameVersion + "/" + loaderVersion + "/profile/json");
}

export async function resolveModrinthVersion(project, versionId, gameVersion) {
  if (versionId) {
    return fetchJson(MODRINTH_API_URL + "/version/" + versionId);
  }

  const query =
    "?game_versions=" + encodeURIComponent(JSON.stringify([gameVersion])) +
    "&loaders=" + encodeURIComponent(JSON.stringify(["fabric"]));
  const versions = await fetchJson(MODRINTH_API_URL + "/project/" + project + "/version" + query);

  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error("No Fabric " + gameVersion + " release found for Modrinth project " + project);
  }

  return versions[0];
}

export async function extractZip(jarPath, destDir, { skipPrefix = "META-INF/" } = {}) {
  const zip = new AdmZip(jarPath);
  const prefix = skipPrefix.toLowerCase();

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    if (entry.entryName.toLowerCase().startsWith(prefix)) continue;
    await fs.writeFile(path.join(destDir, path.basename(entry.entryName)), entry.getData());
  }
}

export async function extractNatives(libraries, platform, librariesDir, nativesDir) {
  await fs.rm(nativesDir, { recursive: true, force: true });
  await ensureDir(nativesDir);

  let extracted = 0;
  for (const library of libraries) {
    if (!libraryApplies(library, platform) || !nativeClassifier(library)) continue;
    if (!library.downloads?.artifact) continue;

    const relative = library.downloads.artifact.path;
    const jarPath = path.join(librariesDir, ...splitRelative(relative));
    if (!(await pathExists(jarPath))) continue;

    await extractZip(jarPath, nativesDir);
    extracted += 1;
  }

  return extracted;
}

export async function setupEnvironment(options = {}) {
  const {
    projectDir = process.cwd(),
    gameDirName = DEFAULT_GAME_DIR_NAME,
    minecraftVersion = MINECRAFT_VERSION,
    loaderVersion = FABRIC_LOADER_VERSION,
    mods = DEFAULT_TEST_MODS,
    includeAssets = true,
    concurrency = 8,
    proxy,
    log = console.log
  } = options;

  const activeProxy = setProxy(proxy);
  const root = path.resolve(projectDir, gameDirName);
  const platform = detectPlatform();
  const versionDir = path.join(root, "versions", minecraftVersion);
  const librariesDir = path.join(root, "libraries");
  const metaDir = path.join(root, ".mtr-test");

  log("Game directory: " + root);
  log("Platform: " + platform.name + "/" + platform.arch);
  if (activeProxy) log("Proxy: " + activeProxy);

  log("Resolving Minecraft " + minecraftVersion + "...");
  const versionJson = await resolveMinecraftVersion(minecraftVersion);
  await writeJson(path.join(versionDir, minecraftVersion + ".json"), versionJson);

  const client = versionJson.downloads.client;
  await downloadFile(client.url, path.join(versionDir, minecraftVersion + ".jar"), {
    sha1: client.sha1,
    size: client.size,
    label: "minecraft-" + minecraftVersion + ".jar",
    log
  });

  const activeLibraries = versionJson.libraries.filter(
    (library) => libraryApplies(library, platform) && library.downloads?.artifact
  );

  log("Downloading " + activeLibraries.length + " Minecraft libraries...");
  await mapLimit(activeLibraries, concurrency, async (library) => {
    const artifact = library.downloads.artifact;
    await downloadFile(artifact.url, path.join(librariesDir, ...splitRelative(artifact.path)), {
      sha1: artifact.sha1,
      size: artifact.size,
      quiet: true,
      log
    });
  });

  log("Resolving Fabric loader " + loaderVersion + "...");
  const fabricProfile = await resolveFabricProfile(minecraftVersion, loaderVersion);
  await writeJson(path.join(metaDir, "fabric-profile.json"), fabricProfile);

  log("Downloading " + fabricProfile.libraries.length + " Fabric libraries...");
  await mapLimit(fabricProfile.libraries, concurrency, async (library) => {
    const relative = mavenToPath(library.name);
    const url = (library.url || FABRIC_MAVEN_URL).replace(/\/+$/, "/") + relative;
    await downloadFile(url, path.join(librariesDir, ...splitRelative(relative)), {
      sha1: library.sha1,
      size: library.size,
      quiet: true,
      log
    });
  });

  if (includeAssets) {
    const assetsDir = path.join(root, "assets");
    const index = versionJson.assetIndex;
    const indexPath = path.join(assetsDir, "indexes", index.id + ".json");

    await downloadFile(index.url, indexPath, {
      sha1: index.sha1,
      size: index.size,
      label: "assets-index-" + index.id + ".json",
      log
    });

    const assetIndex = await readJson(indexPath);
    const objects = Object.values(assetIndex.objects);
    log("Downloading " + objects.length + " assets...");

    let done = 0;
    await mapLimit(objects, 16, async (object) => {
      const prefix = object.hash.slice(0, 2);
      await downloadFile(MOJANG_RESOURCES_URL + "/" + prefix + "/" + object.hash, path.join(assetsDir, "objects", prefix, object.hash), {
        sha1: object.hash,
        size: object.size,
        quiet: true,
        log
      });
      done += 1;
      if (done % 500 === 0) log("  assets " + done + "/" + objects.length);
    });
  }

  const modsDir = path.join(root, "mods");
  await ensureDir(modsDir);
  const installedMods = [];

  for (const mod of mods) {
    const version = await resolveModrinthVersion(mod.project, mod.version, minecraftVersion);
    const file = version.files.find((candidate) => candidate.primary) || version.files[0];
    if (!file) throw new Error("No downloadable file for Modrinth project " + mod.project);

    await downloadFile(file.url, path.join(modsDir, file.filename), {
      sha1: file.hashes?.sha1,
      size: file.size,
      label: file.filename,
      log
    });

    installedMods.push({ project: mod.project, version: version.version_number, file: file.filename });
  }

  log("Extracting native libraries...");
  const nativesDir = path.join(versionDir, "natives");
  const nativesCount = await extractNatives(activeLibraries, platform, librariesDir, nativesDir);
  log("Extracted " + nativesCount + " native libraries into " + nativesDir);

  const summary = {
    gameDir: root,
    minecraftVersion,
    loaderVersion,
    platform,
    assets: includeAssets,
    natives: nativesCount,
    mods: installedMods
  };

  await writeJson(path.join(metaDir, "environment.json"), summary);
  return summary;
}
