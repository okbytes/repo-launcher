import { List, getPreferenceValues, LocalStorage } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { readdirSync, statSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
import { RepoItem } from "./components/repo-item";

interface Repo {
  name: string;
  path: string;
  sourcePath: string;
  workspaceFile?: string;
}

interface Preferences {
  reposFolders: string;
  editorApp: { path: string; name: string };
  terminalApp: { path: string; name: string };
}

interface RepoData {
  repos: Repo[];
  duplicateNames: string[];
}

function normalizePath(inputPath: string): string {
  const trimmedPath = inputPath.trim();
  if (!trimmedPath) {
    return "";
  }

  const expandedPath = trimmedPath.startsWith("~") ? join(homedir(), trimmedPath.slice(1)) : trimmedPath;
  return resolve(expandedPath);
}

function parseSourceFolders(foldersInput: string): string[] {
  const allFolders = foldersInput
    .split(/[\n,;]/)
    .map((folder) => folder.trim())
    .filter(Boolean)
    .map(normalizePath)
    .filter((folder) => Boolean(folder))
    .filter((folder, index, folders) => folders.indexOf(folder) === index);

  return allFolders.filter((folder) => {
    try {
      return statSync(folder).isDirectory();
    } catch {
      return false;
    }
  });
}

function getWorkspaceFile(repoPath: string): string | undefined {
  try {
    const files = readdirSync(repoPath);
    const hiddenWorkspaceFile = files.find((file) => file.startsWith(".") && file.endsWith(".code-workspace"));
    const regularWorkspaceFile = files.find((file) => !file.startsWith(".") && file.endsWith(".code-workspace"));
    const workspaceFile = hiddenWorkspaceFile || regularWorkspaceFile;

    return workspaceFile ? join(repoPath, workspaceFile) : undefined;
  } catch {
    return undefined;
  }
}

async function fetchRepos(sourceFolders: string[]): Promise<Repo[]> {
  const reposByPath = new Map<string, Repo>();

  for (const sourceFolder of sourceFolders) {
    let items: string[];

    try {
      items = readdirSync(sourceFolder);
    } catch {
      continue;
    }

    for (const item of items) {
      if (item.startsWith(".")) {
        continue;
      }

      const repoPath = join(sourceFolder, item);

      try {
        if (!statSync(repoPath).isDirectory()) {
          continue;
        }
      } catch {
        continue;
      }

      if (!reposByPath.has(repoPath)) {
        reposByPath.set(repoPath, {
          name: item,
          path: repoPath,
          sourcePath: sourceFolder,
          workspaceFile: getWorkspaceFile(repoPath),
        });
      }
    }
  }

  return Array.from(reposByPath.values()).sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path));
}

async function fetchRepoData(foldersInput: string): Promise<RepoData> {
  const sourceFolders = parseSourceFolders(foldersInput);
  const repos = await fetchRepos(sourceFolders);
  const nameCounts = new Map<string, number>();

  for (const repo of repos) {
    nameCounts.set(repo.name, (nameCounts.get(repo.name) ?? 0) + 1);
  }

  const duplicateNames = Array.from(nameCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name);

  return { repos, duplicateNames };
}

async function getPinned() {
  const stored = await LocalStorage.getItem<string>("pinned-repos");
  return stored ? JSON.parse(stored) : [];
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();

  const { data: pinnedPaths = [], mutate: mutatePinned } = useCachedPromise(getPinned, []);
  const { data, isLoading } = useCachedPromise(fetchRepoData, [preferences.reposFolders]);
  const repos = data?.repos ?? [];
  const duplicateNames = data?.duplicateNames ?? [];

  const togglePin = async (path: string) => {
    const newPinned = pinnedPaths.includes(path)
      ? pinnedPaths.filter((p: string) => p !== path)
      : [...pinnedPaths, path];
    await LocalStorage.setItem("pinned-repos", JSON.stringify(newPinned));
    mutatePinned();
  };

  const pinned = repos.filter((r) => pinnedPaths.includes(r.path));
  const unpinned = repos.filter((r) => !pinnedPaths.includes(r.path));

  const renderItem = (repo: Repo) => (
    <RepoItem
      key={repo.path}
      repo={repo}
      isPinned={pinnedPaths.includes(repo.path)}
      preferences={preferences}
      showSourcePath={duplicateNames.includes(repo.name)}
      onTogglePin={togglePin}
    />
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search your repos...">
      {pinned.length > 0 && <List.Section title="Pinned">{pinned.map(renderItem)}</List.Section>}
      <List.Section title={pinned.length > 0 ? "Repos" : undefined}>{unpinned.map(renderItem)}</List.Section>
    </List>
  );
}
