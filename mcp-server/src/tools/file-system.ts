import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { WORKSPACE_ROOT } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Consolidate all pipeline files within workspace/ folder
const PROJECT_ROOT = path.resolve(WORKSPACE_ROOT, 'workspace');

// Ensure the workspace directory exists
if (!fs.existsSync(PROJECT_ROOT)) {
  fs.mkdirSync(PROJECT_ROOT, { recursive: true });
}

export interface ReadFileOptions {
  filePath: string;   // relative to project root, e.g. "MEMORY.md" or "sql/001_Orders.sql"
}

export interface ReadFileResult {
  filePath: string;
  content: string;
  exists: boolean;
  sizeBytes: number;
}

export interface WriteFileOptions {
  filePath: string;   // relative to project root
  content: string;
  append?: boolean;   // default false — overwrite
}

export interface WriteFileResult {
  filePath: string;
  sizeBytes: number;
  action: 'created' | 'updated' | 'appended';
}

export interface ListFilesOptions {
  directory?: string;   // relative to project root, default "."
  pattern?: string;     // glob-style extension filter, e.g. ".sql", ".md"
  recursive?: boolean;  // default false
}

export interface ListFilesResult {
  directory: string;
  files: FileEntry[];
  totalCount: number;
}

export interface FileEntry {
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
}

/**
 * Resolves a path relative to the project root and validates it stays within
 * the project directory (prevents path-traversal attacks).
 */
function resolveProjectPath(relativePath: string): string {
  const resolved = path.resolve(PROJECT_ROOT, relativePath);
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error(`Path "${relativePath}" is outside the project directory.`);
  }
  return resolved;
}

/**
 * MCP Tool: read_file
 *
 * Reads a file from the project workspace. Use this to read MEMORY.md,
 * SQL scripts, requirements docs, or any other text file in the project.
 */
export function readFile(options: ReadFileOptions): ReadFileResult {
  const { filePath } = options;
  const absPath = resolveProjectPath(filePath);

  if (!fs.existsSync(absPath)) {
    return {
      filePath,
      content: '',
      exists: false,
      sizeBytes: 0,
    };
  }

  const stat = fs.statSync(absPath);
  if (!stat.isFile()) {
    throw new Error(`"${filePath}" is a directory, not a file.`);
  }

  const content = fs.readFileSync(absPath, 'utf-8');
  return {
    filePath,
    content,
    exists: true,
    sizeBytes: stat.size,
  };
}

/**
 * MCP Tool: write_file
 *
 * Writes or appends content to a file in the project workspace.
 * Creates any missing parent directories automatically.
 * Use this to create/update MEMORY.md, save SQL scripts, etc.
 */
export function writeFile(options: WriteFileOptions): WriteFileResult {
  const { filePath, content, append = false } = options;
  const absPath = resolveProjectPath(filePath);

  // Create parent directories if they don't exist
  const dir = path.dirname(absPath);
  fs.mkdirSync(dir, { recursive: true });

  const existed = fs.existsSync(absPath);

  if (append) {
    fs.appendFileSync(absPath, content, 'utf-8');
  } else {
    fs.writeFileSync(absPath, content, 'utf-8');
  }

  const stat = fs.statSync(absPath);
  return {
    filePath,
    sizeBytes: stat.size,
    action: append ? 'appended' : existed ? 'updated' : 'created',
  };
}

/**
 * MCP Tool: list_files
 *
 * Lists files in a project directory, optionally filtered by extension.
 * Use this to discover SQL scripts, output documents, or other assets.
 */
export function listFiles(options: ListFilesOptions): ListFilesResult {
  const { directory = '.', pattern, recursive = false } = options;
  const absDir = resolveProjectPath(directory);

  if (!fs.existsSync(absDir)) {
    return {
      directory,
      files: [],
      totalCount: 0,
    };
  }

  const files: FileEntry[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);

      // Skip hidden directories and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }

      if (entry.isDirectory()) {
        if (recursive) walk(entryPath);
      } else if (entry.isFile()) {
        // Apply extension/pattern filter
        if (pattern && !entry.name.endsWith(pattern) && !entry.name.includes(pattern)) {
          continue;
        }
        const stat = fs.statSync(entryPath);
        files.push({
          relativePath: path.relative(PROJECT_ROOT, entryPath).replace(/\\/g, '/'),
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }
  }

  walk(absDir);

  return {
    directory,
    files: files.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
    totalCount: files.length,
  };
}
