import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execFileAsync = promisify(execFile);

export async function getGitBranch(directoryPath: string): Promise<string | null> {
  try {
    const gitDir = path.join(directoryPath, ".git");
    const isGitRepo = await fs.promises
      .access(gitDir)
      .then(() => true)
      .catch(() => false);

    if (!isGitRepo) {
      return null;
    }

    const { stdout } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: directoryPath,
      encoding: "utf-8",
    });

    const branch = stdout.trim();
    return branch || null;
  } catch {
    return null;
  }
}

export async function getGitDirty(directoryPath: string): Promise<boolean> {
  try {
    const gitDir = path.join(directoryPath, ".git");
    const isGitRepo = await fs.promises
      .access(gitDir)
      .then(() => true)
      .catch(() => false);

    if (!isGitRepo) {
      return false;
    }

    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
      cwd: directoryPath,
      encoding: "utf-8",
    });

    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}
