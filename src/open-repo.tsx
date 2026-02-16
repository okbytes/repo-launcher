import { List, getPreferenceValues, LocalStorage } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { readdirSync, statSync } from "fs";
import { join } from "path";
import { RepoItem } from "./components/repo-item";

interface Repo {
  name: string;
  path: string;
  workspaceFile?: string;
}

interface Preferences {
  reposFolder: string;
  editorApp: { path: string; name: string };
  terminalApp: { path: string; name: string };
}

async function fetchRepos(folderPath: string): Promise<Repo[]> {
  return readdirSync(folderPath)
    .filter((item) => {
      const fullPath = join(folderPath, item);
      return !item.startsWith(".") && statSync(fullPath).isDirectory();
    })
    .map((item) => {
      const fullPath = join(folderPath, item);

      // Find workspace file (hidden first, then regular)
      const files = readdirSync(fullPath);
      const hiddenWs = files.find((f) => f.startsWith(".") && f.endsWith(".code-workspace"));
      const regularWs = files.find((f) => !f.startsWith(".") && f.endsWith(".code-workspace"));
      const wsFile = hiddenWs || regularWs;

      return {
        name: item,
        path: fullPath,
        workspaceFile: wsFile ? join(fullPath, wsFile) : undefined,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getPinned() {
  const stored = await LocalStorage.getItem<string>("pinned-repos");
  return stored ? JSON.parse(stored) : [];
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const { data: pinnedPaths = [], mutate: mutatePinned } = useCachedPromise(getPinned, []);
  const { data: repos = [], isLoading } = useCachedPromise(fetchRepos, [preferences.reposFolder]);

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
