import os from "node:os";

const readBrignore = (data: string): string[] => {
	return data.split(os.EOL);
};

const writeBrignore = (paths: string[]): string => {
	return paths.join(os.EOL);
};

export { readBrignore, writeBrignore };
