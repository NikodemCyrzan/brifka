import ArgsParser from "../argsParser";
import chalk from "chalk";
import { readFile } from "../files";
import { readCommits, readTree } from "./parsers";
import fs from "node:fs/promises";
import { writeFile } from "../files";
import { relative } from "node:path";
import logText from "../console";
import { COMMITS, CONFIG, HEAD, REPOSITORY_FILE } from "../paths";

const clearIgnore: Set<string> = new Set([".brifka", CONFIG]);

const clearAll = async (directoryPath: string): Promise<number> => {
	const files = await fs.readdir(directoryPath);
	let filesLeftInDirectory: number = 0;

	for (const p of files) {
		const path = `${directoryPath}/${p}`;
		const status = await fs.stat(path);

		if (clearIgnore.has(relative(process.cwd(), path))) {
			if (status.isFile()) filesLeftInDirectory++;
			continue;
		}

		if (status.isFile()) await fs.unlink(path);
		else {
			const filesLeft = await clearAll(path);
			if (filesLeft <= 0) await fs.rmdir(path);
		}
	}

	return filesLeftInDirectory;
};

const change = async (argsParser: ArgsParser) => {
	const commitHash = argsParser.next();

	if (!commitHash || commitHash.length <= 0) {
		console.error(chalk.red(`\n${logText.CHANGE_NO_ARGUMENT}\n`));
		return;
	}

	// find commit
	const [dataStatus, commits] = await readFile(COMMITS, readCommits);

	if (!dataStatus) return;

	const commit = commits.filter(({ hash }) => commitHash == hash)[0];

	if (!commit) {
		console.error(chalk.red(`\n${logText.COMMIT_DOES_NOT_EXIST(commitHash)}\n`));
		return;
	}

	// clean working area
	clearAll(process.cwd());

	// load commit state
	const [treeStatus, tree] = await readFile(REPOSITORY_FILE(commit.hash), readTree);
	if (!treeStatus) return;


	const failedFiles: string[] = [];

	let loadedFiles = 0;

	for (const { hash, path } of tree) {
		const [dataStatus, fileDataFromRepo] = await readFile(REPOSITORY_FILE(hash));

		if (!dataStatus) {
			failedFiles.push(path);
			continue;
		}

		await writeFile(path, fileDataFromRepo);
		loadedFiles++;
	}

	// change head
	await writeFile(HEAD, commitHash);

	if (failedFiles.length > 0) console.error(`\n${chalk.red(failedFiles.length)} files failed to load from repository.`);
	console.log(`\n${chalk.green(loadedFiles)} files successfully loaded from repository.\n`);
};

export default change;
