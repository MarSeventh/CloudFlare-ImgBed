import "./chunk-GAR7ORU2.mjs";

// src/utils/sub-paths.ts
import { readdir, stat } from "fs/promises";
import { fileURLToPath, pathToFileURL } from "url";
async function subPaths(path, maxDepth = 10) {
  const state = await stat(path);
  if (!state.isDirectory()) {
    return [{ path, relativePath: "." }];
  }
  const files = await readdir(path, { withFileTypes: true });
  const ret = [];
  for (const file of files) {
    const filePath = pathToFileURL(fileURLToPath(path) + "/" + file.name);
    if (file.isDirectory()) {
      ret.push(
        ...(await subPaths(filePath, maxDepth - 1)).map((subPath) => ({
          ...subPath,
          relativePath: `${file.name}/${subPath.relativePath}`
        }))
      );
    } else {
      ret.push({ path: filePath, relativePath: file.name });
    }
  }
  return ret;
}
export {
  subPaths
};
