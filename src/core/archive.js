import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import archiver from "archiver";

export async function writeZip(sourceDir, archivePath) {
  const destination = path.resolve(archivePath);
  const temporaryPath = destination + ".tmp-" + randomUUID();

  await fs.mkdir(path.dirname(destination), { recursive: true });

  const output = createWriteStream(temporaryPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  const completed = new Promise((resolve, reject) => {
    output.once("close", resolve);
    output.once("error", reject);
    archive.once("error", reject);
    archive.on("warning", (error) => {
      if (error.code === "ENOENT") {
        console.warn("Archive warning: " + error.message);
      } else {
        reject(error);
      }
    });
  });

  archive.pipe(output);
  archive.directory(sourceDir, false);

  try {
    await archive.finalize();
    await completed;
    await fs.rm(destination, { force: true });
    await fs.rename(temporaryPath, destination);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }

  return destination;
}
