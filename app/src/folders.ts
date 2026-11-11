import { useEffect, useState } from "react";
import { describeFailure, loadFolders, pickFolder, saveFolders, type AppError } from "./data";

/** The project folders the audit may scan, shared by the welcome and Settings. */
export function useFolders(onError: (error: AppError | null) => void) {
  const [folders, setFolders] = useState<string[] | null>(null);
  const [changed, setChanged] = useState(false);
  const report = (reason: unknown) => onError(describeFailure(reason));

  useEffect(() => {
    void loadFolders().then(setFolders, report);
  }, []);

  const save = async (next: string[]) => {
    onError(null);
    await saveFolders(next);
    setFolders(next);
    setChanged(true);
  };

  const add = () =>
    pickFolder()
      .then((folder) => (folder && !folders?.includes(folder) ? save([...(folders ?? []), folder]) : undefined))
      .catch(report);
  const remove = (folder: string) => save((folders ?? []).filter((f) => f !== folder)).catch(report);

  return { folders, changed, add, remove };
}
