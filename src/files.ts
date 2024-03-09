import fs from "node:fs/promises";
import nodePath from "node:path";

type Flags = "r" | "r+" | "rs+" | "w" | "wx" | "w+" | "wx+" | "a" | "ax" | "a+" | "ax+";

const openFile = async (path: string, flags: Flags): Promise<fs.FileHandle | false> => {
    path = nodePath.resolve(process.cwd(), path);
    let fileHandle: fs.FileHandle | false;
    try {
        fileHandle = await fs.open(path, flags);
    } catch {
        fileHandle = false;
    }

    return fileHandle;
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

const createDirectory = async (path: string) => {
    const normalized = nodePath.normalize(path),
        parsed = nodePath.parse(normalized),
        split = [...parsed.dir.split(nodePath.sep), parsed.name].filter(d => d.length > 0);

    for (let i = 0; i < split.length; i++)
        try {
            await fs.mkdir(nodePath.resolve(process.cwd(), ...split.slice(0, i + 1)));
        } catch { }
}

export { openFile, writeFile, createDirectory }