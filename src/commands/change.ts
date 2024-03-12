import ArgsParser from "../argsParser";
import chalk from "chalk";
import { readFile } from "../files";
import { readCommits, readTree } from "./parsers";
import fs from "node:fs/promises";
import { writeFile } from "../files";
import nodePath from "node:path";

const clearIgnore: Set<string> = new Set([".brifka", "brifka.config.json"]);

const clearAll = async (directoryPath: string): Promise<number> => {
	const files = await fs.readdir(directoryPath);
	let filesLeftInDirectory: number = 0;

	for (const p of files) {
		const path = `${directoryPath}/${p}`;
		const status = await fs.stat(path);

		if (clearIgnore.has(nodePath.relative(process.cwd(), path))) {
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
		console.error(chalk.red(`\nChange command requires <commit_hash> argument.\n`));
		return;
	}

	// find commit
	const commitsPath = ".brifka/mem/commits",
		data = await readFile(commitsPath);

	if (typeof data === "boolean" && !data) return;
	const commits = readCommits(data);

	const commit = commits.filter(({ hash }) => commitHash == hash)[0];

	if (!commit) {
		console.error(`\nCommit with hash '${commitHash}' doesn't exist.\n`);
		return;
	}

	// clean working area
	clearAll(process.cwd());

	// load commit state
	const treePath = `.brifka/rep/${commit.hash.slice(0, 8)}`,
		treeRaw = await readFile(treePath);

	if (typeof treeRaw === "boolean" && !treeRaw) {
		return;
	}

	const tree = readTree(treeRaw),
		failedFiles: string[] = [];

	let loadedFiles = 0;

	for (const { hash, path } of tree) {
		const fileDataFromRepo = await readFile(`.brifka/rep/${hash.slice(0, 8)}`);

		if (typeof fileDataFromRepo === "boolean" && !fileDataFromRepo) {
			failedFiles.push(path);
			continue;
		}

		await writeFile(path, fileDataFromRepo);
		loadedFiles++;
	}

	// change head
	await writeFile(".brifka/mem/head", commitHash);

	if (failedFiles.length > 0) console.error(`\n${chalk.red(failedFiles.length)} files failed to load from repository.`);
	console.log(`\n${chalk.green(loadedFiles)} files successfully loaded from repository.\n`);
};

export default change;
