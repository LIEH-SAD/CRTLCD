export function createPackMetadata(config) {
  return JSON.stringify({
    pack: {
      pack_format: config.pack.packFormat,
      description: config.pack.description
    }
  }, null, 2) + "\n";
}
