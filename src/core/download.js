import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ProxyAgent, fetch as httpFetch } from "undici";

let proxyAgent = null;

function proxyFromEnvironment() {
  const candidates = [
    process.env.HTTPS_PROXY,
    process.env.https_proxy,
    process.env.HTTP_PROXY,
    process.env.http_proxy,
    process.env.ALL_PROXY,
    process.env.all_proxy
  ];
  return candidates.find((value) => value && /^https?:\/\//i.test(value)) || null;
}

export function setProxy(proxyUrl) {
  if (proxyUrl === undefined) {
    proxyUrl = proxyFromEnvironment();
  }
  proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : null;
  return proxyUrl || null;
}

function requestInit(options) {
  return proxyAgent ? { ...options, dispatcher: proxyAgent } : options;
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function sha1File(filePath) {
  const hash = crypto.createHash("sha1");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

const MAX_ATTEMPTS = 3;
const STALL_TIMEOUT_MS = 30000;

async function withRetry(operation, url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  throw new Error("Failed to fetch " + url + ": " + lastError.message);
}

async function fetchToFile(url, dest) {
  const controller = new AbortController();
  let stallTimer;

  const resetStall = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(new Error("timed out")), STALL_TIMEOUT_MS);
  };

  const guard = new Transform({
    transform(chunk, encoding, callback) {
      resetStall();
      callback(null, chunk);
    }
  });

  try {
    resetStall();
    const response = await httpFetch(url, requestInit({ signal: controller.signal }));
    if (!response.ok || !response.body) {
      throw new Error("HTTP " + response.status);
    }
    await pipeline(Readable.fromWeb(response.body), guard, createWriteStream(dest));
  } finally {
    clearTimeout(stallTimer);
  }
}

export async function fetchJson(url) {
  return withRetry(async () => {
    const response = await httpFetch(url, requestInit({}));
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
    return response.json();
  }, url);
}

async function fileIsValid(dest, { sha1, size }) {
  try {
    const stat = await fs.stat(dest);
    if (size && stat.size !== size) return false;
    if (sha1) return (await sha1File(dest)) === sha1;
    return stat.size > 0;
  } catch {
    return false;
  }
}

export async function downloadFile(url, dest, options = {}) {
  const { sha1, size, label, quiet = false, force = false, log = console.log } = options;

  if (!force && (await fileIsValid(dest, { sha1, size }))) {
    if (!quiet) log("  cached  " + (label || path.basename(dest)));
    return { downloaded: false, path: dest };
  }

  await ensureDir(path.dirname(dest));
  const temp = dest + ".part-" + process.pid + "-" + Math.random().toString(16).slice(2);

  try {
    await withRetry(() => fetchToFile(url, temp), url);

    if (sha1) {
      const actual = await sha1File(temp);
      if (actual !== sha1) {
        throw new Error("Checksum mismatch, expected " + sha1 + " but got " + actual);
      }
    }

    await fs.rm(dest, { force: true });
    await fs.rename(temp, dest);
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }

  if (!quiet) log("  get     " + (label || path.basename(dest)));
  return { downloaded: true, path: dest };
}

export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}
