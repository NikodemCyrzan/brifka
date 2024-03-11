import ArgsParser from "../argsParser";
import chalk from "chalk";
import { readFile } from "../files";
import { readCommits, readTree } from "./parsers";
import fs from "node:fs/promises"

const clearAll = async (directoryPath: string) => {
    const files = await fs.readdir(directoryPath);

    for (const p of files) {
        const path = `${directoryPath}/${p}`;
        const status = await fs.stat(path);

        if (status.isFile()) await fs.unlink(path);
        else if (p != ".brifka") {
            await clearAll(path);
            await fs.rmdir(path);
        }
    }
}

const change = async (argsParser: ArgsParser) => {
    const commitHash = argsParser.next();

    if (!commitHash || commitHash.length <= 0) {
        console.error(chalk.red(`\Change command requires <commit_hash> argument.\n`));
        return;
    }

    // find commit
    const commitsPath = ".brifka/mem/commits",
        data = await readFile(commitsPath);

    if (typeof data === "boolean" && !data) return;
    const commits = readCommits(data);

    const commit = commits.filter(({ hash }) => commitHash == hash)[0];

    if (!commit) {
        console.error(`\nCommit with hash '${commitHash}' doesn't exist.\n`)
        return;
    }

    // clean working area
    clearAll(process.cwd());

    // load commit state
    const treePath = `.brifka/rep/${commit.hash.slice(0, 8)}`,
        treeRaw = await readFile(treePath);

    if (typeof treeRaw === "boolean" && !treeRaw) {
        return;
    }

    const tree = readTree(treeRaw);

    for (const branch of tree) {

    }
}

export default change;