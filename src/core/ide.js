import fs from "node:fs/promises";
import path from "node:path";

// Actions surfaced in the IDE run bar. Every entry maps to an npm script so the
// generated shortcuts never drift from package.json, and carries the matching
// CLI arguments so VS Code can launch the action directly under the Node
// debugger (breakpoints inside src/ work out of the box).
export const IDE_ACTIONS = [
  { id: "build", label: "Build resource pack", script: "build", cliArgs: ["build"] },
  { id: "setup", label: "Set up test client", script: "setup", cliArgs: ["setup"] },
  { id: "install", label: "Install into test client", script: "install-pack", cliArgs: ["install"] },
  { id: "launch", label: "Run test client", script: "launch", cliArgs: ["launch"] },
  { id: "test", label: "Run unit tests", script: "test", cliArgs: null }
];

const LABEL_PREFIX = "MTR: ";
const INIT_LABEL = LABEL_PREFIX + "Initialize project";

// Syntax support shipped under syntax/: JSON Schemas drive key completion and
// validation errors for the NTE resource-pack JSON files, and the TypeScript
// declarations drive completion for the train/eyecandy scripts. The IDE files
// below point each editor at those artefacts so authoring works out of the box.
const SYNTAX_SCHEMA_MAPPINGS = [
  {
    id: "mtr-eyecandy",
    name: "MTR Steam Loco eyecandy",
    schema: "syntax/schemas/eyecandy.schema.json",
    fileMatch: "resource-pack/assets/mtrsteamloco/eyecandies/*.json"
  },
  {
    id: "mtr-rail-model",
    name: "MTR Steam Loco rail model",
    schema: "syntax/schemas/rail-model.schema.json",
    fileMatch: "resource-pack/assets/mtrsteamloco/rails/*.json"
  },
  {
    id: "mtr-custom-resources",
    name: "MTR custom resources",
    schema: "syntax/schemas/mtr-custom-resources.schema.json",
    fileMatch: "**/mtr_custom_resources.json"
  }
];

const SYNTAX_TYPES_GLOB = "syntax/types/**/*.d.ts";
const SCRIPT_SOURCES_GLOB = "resource-pack/**/*.js";

function actionName(action) {
  return LABEL_PREFIX + action.label;
}

// Runs once whenever the folder is opened. The "init" npm script is idempotent,
// so re-opening the project is a no-op instead of a failure.
function vscodeInitTask() {
  return {
    label: INIT_LABEL,
    type: "shell",
    command: "npm run init",
    runOptions: { runOn: "folderOpen" },
    problemMatcher: []
  };
}

function vscodeTasks() {
  return {
    version: "2.0.0",
    tasks: [
      vscodeInitTask(),
      ...IDE_ACTIONS.map((action) => {
        const task = {
          label: actionName(action),
          type: "shell",
          command: "npm run " + action.script,
          problemMatcher: []
        };
        if (action.id === "build") task.group = { kind: "build", isDefault: true };
        if (action.id === "test") task.group = { kind: "test", isDefault: true };
        return task;
      })
    ]
  };
}

function vscodeSettings() {
  return {
    "task.allowAutomaticTasks": "on",
    "json.schemas": SYNTAX_SCHEMA_MAPPINGS.map((mapping) => ({
      fileMatch: [mapping.fileMatch],
      url: "./" + mapping.schema
    }))
  };
}

// Let VS Code (and WebStorm, which honours jsconfig.json for JavaScript
// projects) resolve the script API globals and report type errors in scripts.
function vscodeJsConfig() {
  return {
    compilerOptions: {
      target: "es2015",
      lib: ["es2015"],
      allowJs: true,
      checkJs: true,
      noEmit: true
    },
    include: [SYNTAX_TYPES_GLOB, SCRIPT_SOURCES_GLOB]
  };
}

// Shareable IntelliJ / WebStorm JSON Schema mappings. Paths are relative to the
// project root; the `Pattern` mapping kind matches the file globs VS Code uses.
function intellijJsonSchemas() {
  const entries = SYNTAX_SCHEMA_MAPPINGS.map((mapping) => [
    '        <entry key="' + escapeXml(mapping.id) + '">',
    "          <value>",
    "            <SchemaInfo>",
    '              <option name="name" value="' + escapeXml(mapping.name) + '" />',
    '              <option name="relativePathToSchema" value="' + escapeXml(mapping.schema) + '" />',
    '              <option name="patterns">',
    "                <list>",
    "                  <Item>",
    '                    <option name="pattern" value="true" />',
    '                    <option name="path" value="' + escapeXml(mapping.fileMatch) + '" />',
    '                    <option name="mappingKind" value="Pattern" />',
    "                  </Item>",
    "                </list>",
    "              </option>",
    "            </SchemaInfo>",
    "          </value>",
    "        </entry>"
  ].join("\n"));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<project version="4">',
    '  <component name="JsonSchemaMappingsProjectConfiguration">',
    "    <state>",
    "      <map>",
    ...entries,
    "      </map>",
    "    </state>",
    "  </component>",
    "</project>",
    ""
  ].join("\n");
}

function vscodeLaunch() {
  return {
    version: "0.2.0",
    configurations: IDE_ACTIONS.map((action) => {
      const base = {
        name: actionName(action),
        type: "node",
        request: "launch",
        cwd: "${workspaceFolder}",
        console: "integratedTerminal",
        skipFiles: ["<node_internals>/**"]
      };

      if (action.cliArgs) {
        return {
          ...base,
          program: "${workspaceFolder}/src/cli.js",
          args: action.cliArgs
        };
      }

      return {
        ...base,
        runtimeExecutable: "node",
        runtimeArgs: ["--test"]
      };
    })
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Shareable WebStorm / IntelliJ run configurations. The `js.build_tools.npm`
// type makes each entry show up in the run bar next to the package.json scripts.
function webstormConfiguration(action) {
  return [
    '<component name="ProjectRunConfigurationManager">',
    '  <configuration default="false" name="' + escapeXml(actionName(action)) + '" type="js.build_tools.npm">',
    '    <package-json value="$PROJECT_DIR$/package.json" />',
    '    <command value="run" />',
    '    <scripts>',
    '      <script value="' + escapeXml(action.script) + '" />',
    '    </scripts>',
    '    <node-interpreter value="project" />',
    '    <envs />',
    '    <method v="2" />',
    '  </configuration>',
    '</component>',
    ""
  ].join("\n");
}

async function writeIfChanged(filePath, content) {
  try {
    const existing = await fs.readFile(filePath, "utf8");
    if (existing === content) return false;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  await fs.writeFile(filePath, content, "utf8");
  return true;
}

// Generates VS Code (`.vscode/`) and WebStorm (`.idea/runConfigurations/`) run
// configurations so the IDE run bar exposes build and test actions without any
// manual setup. Running it again refreshes the files in place.
export async function generateIdeConfigs(projectDir = ".", options = {}) {
  const { log = () => {} } = options;
  const root = path.resolve(projectDir);
  const vscodeDir = path.join(root, ".vscode");
  const ideaDir = path.join(root, ".idea");
  const runConfigDir = path.join(ideaDir, "runConfigurations");

  await fs.mkdir(vscodeDir, { recursive: true });
  await fs.mkdir(runConfigDir, { recursive: true });

  const written = [];

  const tasksPath = path.join(vscodeDir, "tasks.json");
  await writeIfChanged(tasksPath, JSON.stringify(vscodeTasks(), null, 2) + "\n");
  written.push(tasksPath);

  const settingsPath = path.join(vscodeDir, "settings.json");
  await writeIfChanged(settingsPath, JSON.stringify(vscodeSettings(), null, 2) + "\n");
  written.push(settingsPath);

  const launchPath = path.join(vscodeDir, "launch.json");
  await writeIfChanged(launchPath, JSON.stringify(vscodeLaunch(), null, 2) + "\n");
  written.push(launchPath);

  const jsconfigPath = path.join(root, "jsconfig.json");
  await writeIfChanged(jsconfigPath, JSON.stringify(vscodeJsConfig(), null, 2) + "\n");
  written.push(jsconfigPath);

  const jsonSchemasPath = path.join(ideaDir, "jsonSchemas.xml");
  await writeIfChanged(jsonSchemasPath, intellijJsonSchemas());
  written.push(jsonSchemasPath);

  for (const action of IDE_ACTIONS) {
    const filePath = path.join(runConfigDir, action.id + ".xml");
    await writeIfChanged(filePath, webstormConfiguration(action));
    written.push(filePath);
  }

  log("IDE run configurations generated in " + root);
  for (const file of written) {
    log("  " + path.relative(root, file));
  }

  return { projectDir: root, files: written };
}
