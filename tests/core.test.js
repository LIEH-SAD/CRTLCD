import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildResourcePack,
  createPackMetadata,
  generateIdeConfigs,
  initializeProject,
  installResourcePack,
  isSameOrInside,
  validateConfig
} from "../src/index.js";

test("configuration validation accepts the starter configuration", () => {
  const errors = validateConfig({
    name: "test-pack",
    namespace: "mtr",
    pack: { packFormat: 15, description: "Test pack" },
    paths: { source: "resource-pack", output: "dist/output", archive: "dist/output.zip" },
    archive: { enabled: true }
  });

  assert.deepEqual(errors, []);
});

test("configuration validation reports an invalid namespace", () => {
  const errors = validateConfig({
    name: "test-pack",
    namespace: "Invalid Namespace",
    pack: { packFormat: 15, description: "Test pack" },
    paths: { source: "resource-pack", output: "dist/output", archive: "dist/output.zip" },
    archive: { enabled: false }
  });

  assert.ok(errors.some((error) => error.includes("namespace")));
});

test("path containment detects equal and nested paths", () => {
  const root = path.resolve("/tmp/mtr-pack-test");
  assert.equal(isSameOrInside(root, root), true);
  assert.equal(isSameOrInside(root, path.join(root, "assets", "mtr")), true);
  assert.equal(isSameOrInside(root, path.resolve(root, "..", "other")), false);
});

test("pack.mcmeta is generated from the configuration", () => {
  const metadata = JSON.parse(createPackMetadata({
    pack: { packFormat: 15, description: "Test pack" }
  }));

  assert.deepEqual(metadata, {
    pack: { pack_format: 15, description: "Test pack" }
  });
});

test("build copies source files and generates pack.mcmeta", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mtr-pack-test-"));
  const configPath = path.join(temporaryRoot, "mtr-resource-pack.config.json");
  const sourceDir = path.join(temporaryRoot, "resource-pack");
  const assetDir = path.join(sourceDir, "assets", "mtr");

  await fs.mkdir(assetDir, { recursive: true });
  await fs.writeFile(path.join(assetDir, "sample.txt"), "sample asset", "utf8");

  const config = {
    name: "test-pack",
    namespace: "mtr",
    pack: { packFormat: 15, description: "Test pack" },
    paths: {
      source: "resource-pack",
      output: "dist/resource-pack",
      archive: "dist/test-pack.zip"
    },
    archive: { enabled: false }
  };

  try {
    const result = await buildResourcePack({ config, configPath, archiveEnabled: false });
    const copiedAsset = await fs.readFile(path.join(result.outputDir, "assets", "mtr", "sample.txt"), "utf8");
    const metadata = JSON.parse(await fs.readFile(path.join(result.outputDir, "pack.mcmeta"), "utf8"));

    assert.equal(copiedAsset, "sample asset");
    assert.equal(metadata.pack.pack_format, 15);
    assert.equal(result.fileCount, 2);
    assert.equal(result.archivePath, null);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("IDE configurations expose build and test shortcuts", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mtr-ide-test-"));

  try {
    const result = await generateIdeConfigs(temporaryRoot);
    const tasks = JSON.parse(await fs.readFile(path.join(temporaryRoot, ".vscode", "tasks.json"), "utf8"));
    const launch = JSON.parse(await fs.readFile(path.join(temporaryRoot, ".vscode", "launch.json"), "utf8"));
    const webstorm = await fs.readFile(path.join(temporaryRoot, ".idea", "runConfigurations", "build.xml"), "utf8");

    assert.deepEqual(
      tasks.tasks.map((task) => task.label),
      [
        "MTR: Initialize project",
        "MTR: Build resource pack",
        "MTR: Set up test client",
        "MTR: Install into test client",
        "MTR: Run test client",
        "MTR: Run unit tests"
      ]
    );
    assert.equal(tasks.tasks[0].runOptions.runOn, "folderOpen");
    assert.equal(tasks.tasks[1].group.kind, "build");
    assert.equal(tasks.tasks[5].group.kind, "test");

    const settings = JSON.parse(await fs.readFile(path.join(temporaryRoot, ".vscode", "settings.json"), "utf8"));
    assert.equal(settings["task.allowAutomaticTasks"], "on");
    assert.deepEqual(
      settings["json.schemas"].map((entry) => entry.url),
      [
        "./syntax/schemas/eyecandy.schema.json",
        "./syntax/schemas/rail-model.schema.json",
        "./syntax/schemas/mtr-custom-resources.schema.json"
      ]
    );
    assert.deepEqual(settings["json.schemas"][0].fileMatch, ["resource-pack/assets/mtrsteamloco/eyecandies/*.json"]);

    const jsconfig = JSON.parse(await fs.readFile(path.join(temporaryRoot, "jsconfig.json"), "utf8"));
    assert.equal(jsconfig.compilerOptions.checkJs, true);
    assert.ok(jsconfig.include.includes("syntax/types/**/*.d.ts"));

    const jsonSchemas = await fs.readFile(path.join(temporaryRoot, ".idea", "jsonSchemas.xml"), "utf8");
    assert.match(jsonSchemas, /JsonSchemaMappingsProjectConfiguration/);
    assert.match(jsonSchemas, /relativePathToSchema" value="syntax\/schemas\/eyecandy\.schema\.json"/);
    assert.match(jsonSchemas, /mappingKind" value="Pattern"/);

    assert.equal(launch.configurations.length, 5);
    assert.ok(launch.configurations.some((config) => config.name === "MTR: Run test client"));
    assert.match(webstorm, /type="js\.build_tools\.npm"/);
    assert.match(webstorm, /<script value="build" \/>/);
    assert.equal(result.files.length, 10);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("installing copies the pack into the test client and enables it", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mtr-install-test-"));

  try {
    const init = await initializeProject(temporaryRoot);
    const gameDir = path.join(temporaryRoot, "minecraft-test");
    await fs.mkdir(gameDir, { recursive: true });
    await fs.writeFile(
      path.join(gameDir, "options.txt"),
      'fov:0.0\nresourcePacks:["vanilla","file/other.zip"]\nlang:en_us\n',
      "utf8"
    );

    const result = await installResourcePack({ projectDir: temporaryRoot, configPath: init.configPath });

    assert.deepEqual(result.enabledPacks, ["vanilla", "file/other.zip", "file/mtr-resource-pack.zip"]);
    await fs.access(path.join(result.resourcePacksDir, "mtr-resource-pack.zip"));

    const options = await fs.readFile(path.join(gameDir, "options.txt"), "utf8");
    assert.match(options, /resourcePacks:\["vanilla","file\/other\.zip","file\/mtr-resource-pack\.zip"\]/);
    assert.match(options, /lang:en_us/);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("installing is idempotent and creates options.txt when missing", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mtr-install-twice-test-"));

  try {
    const init = await initializeProject(temporaryRoot);
    const optionsPath = path.join(temporaryRoot, "minecraft-test", "options.txt");

    const first = await installResourcePack({ projectDir: temporaryRoot, configPath: init.configPath });
    assert.deepEqual(first.enabledPacks, ["vanilla", "file/mtr-resource-pack.zip"]);

    const second = await installResourcePack({ projectDir: temporaryRoot, configPath: init.configPath });
    assert.deepEqual(second.enabledPacks, ["vanilla", "file/mtr-resource-pack.zip"]);

    const options = await fs.readFile(optionsPath, "utf8");
    assert.equal(options.split("resourcePacks:").length - 1, 1);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("initialisation seeds a buildable sample resource pack", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mtr-init-test-"));

  try {
    const result = await initializeProject(temporaryRoot);
    const packDir = path.join(temporaryRoot, "resource-pack");
    const icon = await fs.readFile(path.join(packDir, "pack.png"));
    const language = JSON.parse(await fs.readFile(path.join(packDir, "assets", "mtr", "lang", "en_us.json"), "utf8"));

    assert.deepEqual([...icon.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(language["block.mtr.example"], "Example Block");
    assert.equal(result.sampleFiles.length, 3);

    await fs.access(path.join(packDir, "assets", "mtr", "models", ".gitkeep"));
    await fs.access(path.join(packDir, "assets", "mtr", "sounds", ".gitkeep"));

    assert.equal(await initializeProject(temporaryRoot, { ifMissing: true }), null);
    await assert.rejects(() => initializeProject(temporaryRoot), /already exists/);

    const config = JSON.parse(await fs.readFile(result.configPath, "utf8"));
    const build = await buildResourcePack({ config, configPath: result.configPath, archiveEnabled: false });
    const metadata = JSON.parse(await fs.readFile(path.join(build.outputDir, "pack.mcmeta"), "utf8"));

    assert.equal(build.fileCount, 4);
    assert.equal(metadata.pack.pack_format, config.pack.packFormat);
    await fs.access(path.join(build.outputDir, "assets", "mtr", "textures", "example.png"));
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});
