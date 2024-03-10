import chalk from "chalk";
import ArgsParser from "../argsParser";
import nodePath from "node:path";
import fs from "node:fs/promises";
import { readTracked, writeTracked } from "./parsers";
import { readFile, writeFile } from "../files";

const mapDir = async (path: string): Promise<string[]> => {
    const files = await fs.readdir(path);

    const output: string[] = []

    for (const file of files) {
        try {
            const scanPath = nodePath.resolve(path, file)
            const status = await fs.stat(scanPath);

            if (status.isDirectory()) output.push(...await mapDir(scanPath));
            else if (status.isFile()) output.push(nodePath.relative(process.cwd(), scanPath));
        } catch { }
    }

    return output;
}

const track = async (argsParser: ArgsParser) => {
    const target = argsParser.next();

    if (!target) {
        console.error(chalk.red(`\nTrack command requires <directory_path> | <file_path> | . argument.\n`));
        return;
    }

    const trackedPath = nodePath.resolve(process.cwd(), ".brifka/mem/tracked");
    const path = nodePath.resolve(process.cwd(), target);
    let status;
    try {
        status = await fs.stat(path);
    } catch {
        console.error(chalk.red(`\nFile or directory '${target}' doesn't exist.\n`));
        return;
    }

    if (status.isDirectory()) {
        const paths: string[] = await mapDir(path);

        const data = await readFile(trackedPath);
        if (typeof data !== "string") throw new Error();

        const trackedFiles = readTracked(data);
        for (const newFile of paths) {
            let isRepeated = false;
            for (const trackedFile of trackedFiles)
                if (trackedFile == newFile) {
                    isRepeated = true;
                    break;
                }

            if (!isRepeated) trackedFiles.push(newFile);
        }

        await writeFile(trackedPath, writeTracked(trackedFiles));
    }
    else if (status.isFile()) {
        const data = await readFile(trackedPath);
        if (typeof data !== "string") {
            console.error(chalk.red(`\nRepository memory corrupted :/\n`));
            return;
        }

        const trackedFiles = readTracked(data);
        const newFile = nodePath.relative(process.cwd(), path)

        let isRepeated = false;
        for (const trackedFile of trackedFiles)
            if (trackedFile == newFile) {
                isRepeated = true;
                break;
            }

        if (!isRepeated) trackedFiles.push(newFile);
        else {
            console.error(chalk.red(`\nFile '${newFile}' is already tracked.\n`));
            return;
        }

        await writeFile(trackedPath, writeTracked(trackedFiles));
    }

}

export default track;