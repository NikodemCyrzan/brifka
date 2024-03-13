import chalk from "chalk";

export const TRACKED_FILE_NOT_EXISTING = "Repository memory corrupted :/";

export const TRACK_NO_ARGUMENT = "Track command requires <directory_path> | <file_path> argument.";

export const TRACKED_EMPTY = "There aren't any files in tracked stage.";

export const TRACKED_DOES_NOT_EXIST = (path: string) => `File or directory '${path}' doesn't exist.`;

export const TRACKED_FILE_WAS_NOT_TRACKED = (path: string) => `File '${path}' wasn't tracked.`;

export const TRACKED_REMOVED_FILE = (path: string) => `Removed '${path}' from tracked stage.`;

export const TRACKED_PATHS_REMOVED = (count: number, path: string) => `${chalk.red(count)} files removed from tracked stage from directory '${path}'.`;
export const TRACKED_PATHS_ADDED = (count: number, path: string) => `${chalk.green(count)} new files added to tracked stage from directory '${path}'.`;
export const TRACKED_PATH_ADDED = (path: string) => `Added '${path}' to tracked stage.`;

export const TRACKED_PATH_ALREADY_TRACKED = (path: string) => `File '${path}' is already tracked.`;

export const UNTRACK_NO_ARGUMENT = "Untrack command requires <directory_path> | <file_path> argument.";