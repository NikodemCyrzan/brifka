import chalk from "chalk";
import os from "node:os";

type TreeBranch = {
	path: string;
	hash: string;
};

const writeTree = (breanches: TreeBranch[]) => {
	return breanches.map(({ path, hash }) => `${path.length}\u{001e}${path}\u{001e}${hash}`).join(os.EOL);
};

const readTree = (data: string): TreeBranch[] => {
	const lines = data.split(os.EOL);

	const branches: TreeBranch[] = [];

	try {
		lines.forEach((line) => {
			if (line.length <= 0) return;

			let pointer = 0,
				pathLength = "";
			for (; line[pointer] != "\u{001e}" && pointer < line.length; pointer++) pathLength += line[pointer];

			if (++pointer >= line.length) throw new Error();

			let path = "";
			for (; pointer < line.length && pointer < pathLength.length + 1 + Number(pathLength); pointer++) path += line[pointer];

			if (line[pointer] != "\u{001e}") throw new Error();
			if (++pointer >= line.length) throw new Error();

			let hash = "";
			for (; pointer < line.length; pointer++) hash += line[pointer];

			branches.push({
				path,
				hash,
			});
		});
	} catch {
		console.error(chalk.red("\nRepository memory corrupted :/\n"));
		return [];
	}

	return branches;
};

export { writeTree, readTree };
