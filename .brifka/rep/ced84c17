import fs from "node:fs/promises";
import nodePath from "node:path";

type Flags = "r" | "r+" | "rs+" | "w" | "wx" | "w+" | "wx+" | "a" | "ax" | "a+" | "ax+";

const openFile = async (path: string, flags: Flags): Promise<fs.FileHandle | false> => {
    path = nodePath.resolve(process.cwd(), path);
    try {
        return await fs.open(path, flags);
    } catch {
        return false;
    }
}

const writeFile = async (path: string, data: string = "") => {
    const normalized = nodePath.normalize(path),
        parsed = nodePath.parse(normalized),
        split = parsed.dir.split(nodePath.sep).filter(d => d.length > 0);
    path = nodePath.resolve(process.cwd(), normalized);

    for (let i = 0; i < split.length; i++)
        try {
            await fs.mkdir(nodePath.resolve(process.cwd(), ...split.slice(0, i + 1)));
        } catch { }

    await fs.writeFile(path, data);
}

const appendFile = async (path: string, data: string) => {
    const normalized = nodePath.normalize(path),
        parsed = nodePath.parse(normalized),
        split = parsed.dir.split(nodePath.sep).filter(d => d.length > 0);
    path = nodePath.resolve(process.cwd(), normalized);

    for (let i = 0; i < split.length; i++)
        try {
            await fs.mkdir(nodePath.resolve(process.cwd(), ...split.slice(0, i + 1)));
        } catch { }

    await fs.appendFile(path, data);
}

const readFile = async (path: string): Promise<string | false> => {
    path = nodePath.resolve(process.cwd(), path);
    try {
        return await fs.readFile(path, { encoding: "utf8" })
    } catch {
        return false;
    }
}

const createDirectory = async (path: string) => {
    const normalized = nodePath.normalize(path),
        parsed = nodePath.parse(normalized),
        split = [...parsed.dir.split(nodePath.sep), parsed.name].filter(d => d.length > 0);

    for (let i = 0; i < split.length; i++)
        try {
            await fs.mkdir(nodePath.resolve(process.cwd(), ...split.slice(0, i + 1)));
        } catch { }
}

const mapDirectory = async (path: string, outputSet: Set<string>) => {
    const files = await fs.readdir(path);

    for (const file of files)
        try {
            const scanPath = nodePath.resolve(path, file)
            const status = await fs.stat(scanPath);

            if (status.isDirectory()) await mapDirectory(scanPath, outputSet);
            else if (status.isFile()) outputSet.add(nodePath.relative(process.cwd(), scanPath));
        } catch { }
}

export { openFile, writeFile, appendFile, readFile, createDirectory, mapDirectory }