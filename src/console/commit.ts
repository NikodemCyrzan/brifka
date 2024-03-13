import chalk from "chalk";

export const COMMIT_SUCCESS = "Successfully commited.";

export const COMMIT_NO_ARGUMENT = "Commit command requires <commit_name> argument.";

export const COMMIT_DOES_NOT_EXIST = (hash: string) => `Commit with hash '${hash}' doesn't exist.`;

export const COMMITS_EMPTY = "There aren't commits yet.";

export const COMMIT_NOT_EXISTING = "Couldn't load commits file.";

export const COMMIT_REMOVE_SUCCESS = "Successfully removed last commit.";

export const COMMIT_INFO = (hash: string, timestamp: number, title: string) => `${chalk.yellow(`commit: ${hash}`)}\nDate: ${new Date(timestamp).toLocaleString()}\n\n\t${title}`;