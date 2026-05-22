import { readFile } from "node:fs/promises";

type PackageJson = {
  version?: string;
};

export async function printVersion(fromUrl: string): Promise<void> {
  const packageJson = await readWorkspacePackageJson(fromUrl);
  const version = packageJson.version;

  if (!version) {
    throw new Error("root package.json does not define a version");
  }

  process.stdout.write(`${version}\n`);
}

async function readWorkspacePackageJson(fromUrl: string): Promise<PackageJson> {
  const candidateUrls = [
    new URL("../../package.json", fromUrl),
    new URL("../../../package.json", fromUrl),
  ];

  for (const candidateUrl of candidateUrls) {
    try {
      const raw = await readFile(candidateUrl, "utf8");
      return JSON.parse(raw) as PackageJson;
    } catch {
      // Try next location.
    }
  }

  throw new Error("unable to locate workspace package.json");
}
