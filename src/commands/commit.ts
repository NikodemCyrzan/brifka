import chalk from "chalk";
import ArgsParser from "../argsParser";
import crypto from "node:crypto";
import os from "node:os";
import { appendFile, readFile, writeFile } from "../files";
import { readTracked, writeCommits, writeTree } from "./parsers";
import logText from "../console";
import { COMMITS, HEAD, REPOSITORY_FILE, TRACKED } from "../paths";

const saveFile = async (path: string, hash: string) => {
	const [dataStatus, fileData] = await readFile(path);
	if (!dataStatus) return;

	await writeFile(REPOSITORY_FILE(hash), fileData);
};

const commit = async (argsParser: ArgsParser) => {
	const commitTitle = argsParser.next();

	if (!commitTitle || commitTitle.length <= 0) {
		console.error(chalk.red(`\n${logText.COMMIT_NO_ARGUMENT}\n`));
		return;
	}

	// create commit tree
	const [trackedStatus, trackedFiles] = await readFile(TRACKED, readTracked);

	if (!trackedStatus || trackedFiles.length <= 0) {
		console.error(chalk.red(`\n${logText.TRACKED_EMPTY}\n`));
		return;
	} else if (!trackedStatus) {
		console.error(chalk.red(`\n${logText.TRACKED_FILE_NOT_EXISTING}\n`));
		return;
	}

	const branches = [];

	// add commit to memory
	const commitHash = crypto.randomBytes(32).toString("hex");

	await appendFile(
		COMMITS,
		`${writeCommits([
			{
				title: commitTitle,
				hash: commitHash,
				timestamp: Date.now(),
			},
		])}${os.EOL}`
	);

	for (const filePath of trackedFiles) {
		const [fileStatus, fileContent] = await readFile(filePath);
		if (!fileStatus) continue;
		const hash = crypto.createHash("sha256").update(fileContent).digest("hex");

		await saveFile(filePath, hash);

		branches.push({
			path: filePath,
			hash,
		});
	}
	await writeFile(REPOSITORY_FILE(commitHash), writeTree(branches));

	// change head
	await writeFile(HEAD, commitHash);

	console.log(chalk.green(`\n${logText.COMMIT_SUCCESS}\n`));
};

export default commit;
