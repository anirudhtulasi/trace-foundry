"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const postcss = require("postcss");
const { compile } = require("tailwindcss");

const CLASS_SAFESET = new Set(["flex", "grid", "block", "inline", "contents", "table", "hidden"]);
const CANDIDATE_CHARS = /^[!#&()a-zA-Z0-9,:._%/\-\[\]]+$/;
const SPECIAL_CHARS = /[-:[\]!/_0-9]/;
const SEARCH_DIRECTORIES = ["app", "components", "lib"];
const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function sanitizeToken(token) {
  return token
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.,;:]+/, "")
    .replace(/[.,;:]+$/, "");
}

function isCandidate(token) {
  if (!token) return false;
  if (!CANDIDATE_CHARS.test(token)) return false;
  if (token.includes("://")) return false;
  if (token.length > 120) return false;
  return SPECIAL_CHARS.test(token) || CLASS_SAFESET.has(token);
}

function addTokensFromString(input, bucket) {
  if (!input) return;
  const normalized = input.replace(/\$\{[^}]+\}/g, " ");
  for (const rawToken of normalized.split(/\s+/)) {
    const token = sanitizeToken(rawToken);
    if (isCandidate(token)) {
      bucket.add(token);
    }
  }
}

function collectStringLiterals(text, bucket) {
  const stringLiteral = /(['"`])((?:\\.|(?!\1).)*)\1/gs;
  for (const match of text.matchAll(stringLiteral)) {
    const literal = match[2];
    addTokensFromString(literal, bucket);
  }
}

function collectApplyUtilities(cssText, bucket) {
  const applyRegex = /@apply\s+([^;]+);/g;
  let result;
  while ((result = applyRegex.exec(cssText)) !== null) {
    addTokensFromString(result[1], bucket);
  }
}

async function walkDirectory(dir, visitor) {
  if (!(await fileExists(dir))) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkDirectory(fullPath, visitor);
        return;
      }
      if (!FILE_EXTENSIONS.has(path.extname(entry.name))) return;
      await visitor(fullPath);
    })
  );
}

function createModuleLoader(projectRoot) {
  return async (id, fromPath) => {
    let contextBase = fromPath;
    try {
      const stats = await fs.stat(fromPath);
      if (!stats.isDirectory()) {
        contextBase = path.dirname(fromPath);
      }
    } catch {
      contextBase = path.dirname(fromPath);
    }

    const candidatePaths = [];
    if (path.isAbsolute(id)) {
      candidatePaths.push(id);
    } else {
      candidatePaths.push(path.resolve(contextBase, id));
      candidatePaths.push(path.resolve(projectRoot, id));
      candidatePaths.push(path.resolve(projectRoot, id.replace(/^\.\//, "")));
      candidatePaths.push(path.join(projectRoot, "tailwind.config.js"));
    }

    let resolvedPath;
    for (const candidate of candidatePaths) {
      try {
        resolvedPath = require.resolve(candidate, { paths: [contextBase, projectRoot] });
        break;
      } catch {
        continue;
      }
    }

    if (!resolvedPath) {
      throw new Error(`Unable to resolve Tailwind resource "${id}" from "${fromPath}"`);
    }

    const loaded = require(resolvedPath);
    return {
      path: resolvedPath,
      base: path.dirname(resolvedPath),
      module: loaded?.default ?? loaded
    };
  };
}

async function loadStylesheet(id, fromPath) {
  const resolvedPath = path.isAbsolute(id) ? id : path.resolve(fromPath, id);
  const content = await fs.readFile(resolvedPath, "utf8");
  return {
    path: resolvedPath,
    base: path.dirname(resolvedPath),
    content
  };
}

async function collectCandidates(projectRoot) {
  const candidateSet = new Set();

  await Promise.all(
    SEARCH_DIRECTORIES.map(async (dirName) => {
      const dir = path.join(projectRoot, dirName);
      await walkDirectory(dir, async (filePath) => {
        const contents = await fs.readFile(filePath, "utf8");
        collectStringLiterals(contents, candidateSet);
      });
    })
  );

  const globalsPath = path.join(projectRoot, "app", "globals.css");
  if (await fileExists(globalsPath)) {
    const globalsCss = await fs.readFile(globalsPath, "utf8");
    collectApplyUtilities(globalsCss, candidateSet);
  }

  return Array.from(candidateSet);
}

module.exports = () => ({
  postcssPlugin: "tailwind-offline",
  async Once(root) {
    const projectRoot = path.resolve(__dirname);
    const inputPath = path.join(projectRoot, "app", "globals.css");
    const cssSource = await fs.readFile(inputPath, "utf8");
    const moduleLoader = createModuleLoader(projectRoot);
    const tw = await compile(cssSource, {
      base: projectRoot,
      from: inputPath,
      loadModule: (id, basePath) => moduleLoader(id, basePath),
      loadStylesheet
    });
    const candidates = await collectCandidates(projectRoot);
    const generatedCss = tw.build(candidates);
    const parsed = postcss.parse(generatedCss, { from: inputPath });

    root.removeAll();
    root.append(...parsed.nodes);
  }
});
module.exports.postcss = true;
