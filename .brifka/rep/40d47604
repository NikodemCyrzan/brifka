import os from "node:os";

const writeTracked = (paths: string[]): string => {
    return paths.join(os.EOL);
}

const readTracked = (data: string): string[] => {
    return data.split(os.EOL).filter(l => l.length > 0);
}

export { writeTracked, readTracked };