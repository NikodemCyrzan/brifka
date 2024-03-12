import chalk from "chalk";
import ArgsParser from "../argsParser";
import crypto from "node:crypto";
import os from "node:os";
import { appendFile, readFile, writeFile } from "../files";
import { readTracked, writeCommits, writeTree } from "./parsers";

const saveFile = async (path: string, hash: string) => {
	const repoPath = `.brifka/rep/${hash.slice(0, 8)}`,
		fileData = await readFile(path);

	if (typeof fileData === "boolean" && !fileData) return;

	await writeFile(repoPath, fileData);
};

const commit = async (argsParser: ArgsParser) => {
	const commitTitle = argsParser.next();

	if (!commitTitle || commitTitle.length <= 0) {
		console.error(chalk.red(`\nCommit command requires <commit_name> argument.\n`));
		return;
	}

	// add commit to memory
	const commitsPath = ".brifka/mem/commits",
		commitHash = crypto.randomBytes(32).toString("hex");

	await appendFile(
		commitsPath,
		`${writeCommits([
			{
				title: commitTitle,
				hash: commitHash,
				timestamp: Date.now(),
			},
		])}${os.EOL}`
	);

	// create commit tree
	const trackedPath = ".brifka/mem/tracked",
		trackedData = await readFile(trackedPath);

	if (typeof trackedData === "string" && trackedData.length <= 0) {
		console.error(chalk.red(`\nThere aren't any files in tracked stage.\n`));
		return;
	} else if (typeof trackedData === "boolean" && !trackedData) {
		console.error(chalk.red(`\nRepository memory corrupted :/\n`));
		return;
	}

	const trackedFiles = readTracked(trackedData);
	const branches = [];

	for (const filePath of trackedFiles) {
		const fileContent = await readFile(filePath);
		if (typeof fileContent === "boolean" && !fileContent) continue;
		const hash = crypto.createHash("sha256").update(fileContent).digest("hex");

		await saveFile(filePath, hash);

		branches.push({
			path: filePath,
			hash,
		});
	}
	await writeFile(`.brifka/rep/${commitHash.slice(0, 8)}`, writeTree(branches));

	// change head
	await writeFile(".brifka/mem/head", commitHash);

	console.log(chalk.green("\nSuccessfully commited\n"));
};

export default commit;
