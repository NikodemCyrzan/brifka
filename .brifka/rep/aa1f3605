import chalk from "chalk";
import ArgsParser from "../argsParser";
import nodePath from "node:path";
import fs from "node:fs/promises";
import { mapDirectory, readFile, writeFile } from "../files";
import { readTracked, writeTracked } from "./parsers";

const untrack = async (argsParser: ArgsParser) => {
    const target = argsParser.next();

    if (!target || target.length <= 0) {
        console.error(chalk.red(`\nUntrack command requires <directory_path> | <file_path> | . argument.\n`));
        return;
    }

    const trackedPath = ".brifka/mem/tracked";
    const data = await readFile(trackedPath);

    if (typeof data !== "string") {
        console.error(chalk.red(`\nRepository memory corrupted :/\n`));
        return;
    }

    const normalisedTarget = nodePath.normalize(target);
    const targetPath = nodePath.resolve(process.cwd(), normalisedTarget);
    const trackedFiles = new Set(readTracked(data));

    let status;
    try {
        status = await fs.stat(targetPath);
    } catch {
        console.log(chalk.red(`\nFile or directory '${target}' doesn't exist.\n`));
        return;
    }

    if (status.isFile()) {
        if (trackedFiles.delete(normalisedTarget))
            console.log(`\nRemoved '${target}' from tracked stage.\n`);
        else
            console.log(chalk.red(`\nFile '${target}' wasn't tracked.\n`));
    }
    else if (status.isDirectory()) {
        const paths = new Set<string>();
        await mapDirectory(targetPath, paths);

        let counter = 0;
        for (const path of paths)
            if (trackedFiles.delete(path)) counter++;

        console.log(`\n${chalk.red(counter)} files removed from tracked stage from directory '${target}'.\n`);
    }

    await writeFile(trackedPath, writeTracked(Array.from(trackedFiles)));
}

export default untrack;