import { Icon, addCollection } from "@iconify/react";
import { icons as catppuccinIcons } from "@iconify-json/catppuccin";

addCollection(catppuccinIcons);

const fileNameIcons: Record<string, string> = {
  "package.json": "package-json",
  "package-lock.json": "npm-lock",
  "pnpm-lock.yaml": "pnpm-lock",
  "yarn.lock": "yarn-lock",
  "cargo.toml": "cargo",
  "cargo.lock": "cargo-lock",
  "tsconfig.json": "typescript-config",
  "vite.config.ts": "vite",
  "vite.config.js": "vite",
  dockerfile: "docker",
  "docker-compose.yml": "docker-compose",
  "docker-compose.yaml": "docker-compose",
  makefile: "makefile",
  "readme.md": "markdown",
  license: "license",
  ".gitignore": "git",
  ".env": "env",
};

const extensionIcons: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript-react",
  js: "javascript",
  jsx: "javascript-react",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  css: "css",
  scss: "sass",
  sass: "sass",
  html: "html",
  md: "markdown",
  mdx: "markdown-mdx",
  rs: "rust",
  go: "go",
  py: "python",
  rb: "ruby",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c-header",
  cpp: "cpp",
  cc: "cpp",
  cs: "csharp",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  xml: "xml",
  sql: "database",
  svg: "svg",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  pdf: "pdf",
  zip: "zip",
  rar: "zip",
  csv: "csv",
  lock: "lock",
};

export function fileIconForPath(path: string) {
  return <Icon className="project-file-icon" icon={`catppuccin:${iconNameForPath(path)}`} />;
}

function iconNameForPath(path: string): string {
  const fileName = path.split(/[\\/]/).pop()?.toLowerCase() ?? path.toLowerCase();
  const fileNameIcon = fileNameIcons[fileName];
  if (fileNameIcon && iconExists(fileNameIcon)) return fileNameIcon;

  const extension = extensionForFileName(fileName);
  if (!extension) return "file";

  const extensionIcon = extensionIcons[extension];
  return extensionIcon && iconExists(extensionIcon) ? extensionIcon : "file";
}

function extensionForFileName(fileName: string): string | null {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return null;
  return fileName.slice(dotIndex + 1);
}

function iconExists(iconName: string): boolean {
  return iconName in catppuccinIcons.icons;
}
