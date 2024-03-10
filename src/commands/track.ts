import chalk from "chalk";
import ArgsParser from "../argsParser";
import nodePath from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { readTracked, writeTracked } from "./parsers";
import { appendFile, readFile, writeFile } from "../files";

const mapDir = async (path: string, outputSet: Set<string>) => {
    const files = await fs.readdir(path);

    for (const file of files)
        try {
            const scanPath = nodePath.resolve(path, file)
            const status = await fs.stat(scanPath);

            if (status.isDirectory()) await mapDir(scanPath, outputSet);
            else if (status.isFile()) outputSet.add(nodePath.relative(process.cwd(), scanPath));
        } catch { }
}

const track = async (argsParser: ArgsParser) => {
    const target = argsParser.next();

    if (!target) {
        console.error(chalk.red(`\nTrack command requires <directory_path> | <file_path> | . argument.\n`));
        return;
    }

    const trackedPath = ".brifka/mem/tracked";
    const targetPath = nodePath.resolve(process.cwd(), target);
    let status;
    try {
        status = await fs.stat(targetPath);
    } catch {
        console.error(chalk.red(`\nFile or directory '${target}' doesn't exist.\n`));
        return;
    }

    const data = await readFile(trackedPath);

    if (typeof data !== "string") {
        console.error(chalk.red(`\nRepository memory corrupted :/\n`));
        return;
    }

    const trackedFiles = new Set(readTracked(data));

    if (status.isDirectory()) {
        const paths = new Set<string>();
        await mapDir(targetPath, paths);

        const newFiles = new Set(Array.from(paths).filter(p => !trackedFiles.has(p)));

        await appendFile(trackedPath, writeTracked(Array.from(newFiles)) + os.EOL)

        console.log(`\n${chalk.green(newFiles.size)} new files added to tracked stage from directory '${target}'.\n`);
    }
    else if (status.isFile()) {
        const newFile = nodePath.relative(process.cwd(), targetPath)

        if (!trackedFiles.has(newFile)) {
            await appendFile(trackedPath, writeTracked([newFile]) + os.EOL);

            console.log(`\nAdded '${target}' to tracked stage.\n`);
        }
        else {
            console.error(chalk.red(`\nFile '${newFile}' is already tracked.\n`));
            return;
        }
    }
}

export default track;