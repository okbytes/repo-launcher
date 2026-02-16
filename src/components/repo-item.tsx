import { useEffect, useState } from "react";
import { ActionPanel, Action, Color, List, Icon, openExtensionPreferences } from "@raycast/api";
import { getGitBranch, getGitDirty } from "../lib/git";

interface Repo {
  name: string;
  path: string;
  workspaceFile?: string;
}

interface Preferences {
  editorApp: { path: string; name: string };
  terminalApp: { path: string; name: string };
}

interface RepoItemProps {
  repo: Repo;
  isPinned: boolean;
  preferences: Preferences;
  onTogglePin: (path: string) => void;
}

function useGitStatus(path: string) {
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      const [dirty, branchName] = await Promise.all([getGitDirty(path), getGitBranch(path)]);
      setIsDirty(dirty);
      setBranch(branchName);
    }
    fetchStatus();
  }, [path]);

  return { isDirty, branch };
}

export function RepoItem({ repo, isPinned, preferences, onTogglePin }: RepoItemProps) {
  const { isDirty, branch } = useGitStatus(repo.path);
  const icon = isDirty ? { source: Icon.Dot, tintColor: Color.Red } : Icon.Folder;
  const accessories: List.Item.Accessory[] = [];

  return (
    <List.Item
      key={repo.path}
      title={repo.name}
      subtitle={branch || undefined}
      icon={icon}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action.Open
            title={`Open in ${preferences.editorApp.name}`}
            icon={Icon.Code}
            target={
              repo.workspaceFile && preferences.editorApp.name === "Visual Studio Code" ? repo.workspaceFile : repo.path
            }
            application={preferences.editorApp.path}
          />
          <Action.Open
            icon={Icon.Terminal}
            title={`Open in ${preferences.terminalApp.name}`}
            target={repo.path}
            application={preferences.terminalApp.path}
          />
          <Action
            title={isPinned ? "Unpin" : "Pin"}
            icon={isPinned ? Icon.PinDisabled : Icon.Pin}
            onAction={() => onTogglePin(repo.path)}
          />
          <Action.ShowInFinder path={repo.path} />
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    />
  );
}
