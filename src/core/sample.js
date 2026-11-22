import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

// Produces a solid-colour RGBA PNG so a freshly initialised project already
// contains a valid pack icon and a placeholder texture.
export function createSolidPng(size, [red, green, blue, alpha = 255]) {
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x += 1) {
      const pixel = rowStart + 1 + x * 4;
      raw[pixel] = red;
      raw[pixel + 1] = green;
      raw[pixel + 2] = blue;
      raw[pixel + 3] = alpha;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  header[10] = 0; // compression method
  header[11] = 0; // filter method
  header[12] = 0; // interlace method

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

const GITKEEP_CONTENT = "This folder is part of the resource-pack layout and is ignored during builds.\n";

async function writeFileIfMissing(filePath, data, encoding) {
  try {
    await fs.writeFile(filePath, data, encoding ? { flag: "wx", encoding } : { flag: "wx" });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
}

async function ensurePlaceholderDir(directory) {
  await fs.mkdir(directory, { recursive: true });
  await writeFileIfMissing(path.join(directory, ".gitkeep"), GITKEEP_CONTENT, "utf8");
}

function sampleLanguageFile(config) {
  return JSON.stringify(
    {
      ["pack." + config.namespace + ".example"]: config.name + " example resource pack",
      ["block." + config.namespace + ".example"]: "Example Block"
    },
    null,
    2
  ) + "\n";
}

// Seeds the resource-pack directory with a buildable example: a pack icon, a
// sample language override, a placeholder texture and the conventional
// namespace folders. Existing files are never overwritten.
export async function createSampleResourcePack(sourceDir, config) {
  const namespaceAssets = path.join(sourceDir, "assets", config.namespace);
  const created = [];

  const files = [
    { file: path.join(sourceDir, "pack.png"), data: createSolidPng(128, [58, 140, 200]) },
    { file: path.join(namespaceAssets, "lang", "en_us.json"), data: sampleLanguageFile(config), encoding: "utf8" },
    { file: path.join(namespaceAssets, "textures", "example.png"), data: createSolidPng(16, [210, 120, 60]) }
  ];

  for (const entry of files) {
    await fs.mkdir(path.dirname(entry.file), { recursive: true });
    if (await writeFileIfMissing(entry.file, entry.data, entry.encoding)) {
      created.push(entry.file);
    }
  }

  await ensurePlaceholderDir(path.join(namespaceAssets, "models"));
  await ensurePlaceholderDir(path.join(namespaceAssets, "sounds"));
  await ensurePlaceholderDir(path.join(sourceDir, "assets", "minecraft"));

  return created;
}
