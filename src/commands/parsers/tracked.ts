import os from "node:os";

const writeTracked = (paths: string[]): string => {
    return paths.join(os.EOL);
}

const readTracked = (data: string): string[] => {
    const lines = data.split(os.EOL);
    return lines;
}

export { writeTracked, readTracked };