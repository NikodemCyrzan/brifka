import { join } from "node:path";

const MEMORY = join(".brifka", "mem"),
    COMMITS = join(MEMORY, "commits"),
    HEAD = join(MEMORY, "head"),
    TRACKED = join(MEMORY, "tracked"),
    REPOSITORY = join(".brifka", "rep"),
    REPOSITORY_FILE = (hash: string) => join(REPOSITORY, hash.slice(0, 8)),
    CONFIG = "brifka.config.json",
    BRIGNORE = ".brignore";

export {
    MEMORY,
    COMMITS,
    HEAD,
    TRACKED,
    REPOSITORY,
    REPOSITORY_FILE,
    CONFIG,
    BRIGNORE,
}