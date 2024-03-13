import chalk from "chalk";
import ArgsParser from "../argsParser";
import { resolve, normalize } from "node:path";
import fs from "node:fs/promises";
import { mapDirectory, readFile, writeFile } from "../files";
import { readBrignore, readTracked, writeTracked } from "./parsers";
import logText from "../console";
import { TRACKED } from "../paths";

const untrack = async (argsParser: ArgsParser) => {
	const target = argsParser.next();

	if (!target || target.length <= 0) {
		console.error(chalk.red(`\n${logText.UNTRACK_NO_ARGUMENT}\n`));
		return;
	}

	const [trackedState, tracked] = await readFile(TRACKED, readTracked);

	if (!trackedState) {
		console.error(chalk.red(`\n${logText.TRACKED_FILE_NOT_EXISTING}\n`));
		return;
	}

	const normalisedTarget = normalize(target),
		targetPath = resolve(target);
	const trackedFiles = new Set(tracked);

	let status;
	try {
		status = await fs.stat(targetPath);
	} catch {
		console.log(chalk.red(`\n${logText.TRACKED_DOES_NOT_EXIST(target)}\n`));
		return;
	}

	if (status.isFile()) {
		if (trackedFiles.delete(normalisedTarget)) console.log(`\n${logText.TRACKED_REMOVED_FILE}\n`);
		else console.log(chalk.red(`\n${logText.TRACKED_FILE_WAS_NOT_TRACKED(target)}\n`));
	} else if (status.isDirectory()) {
		const paths = new Set<string>();
		await mapDirectory(targetPath, paths);

		let counter = 0;
		for (const path of paths) if (trackedFiles.delete(path)) counter++;

		console.log(`\n${logText.TRACKED_PATHS_REMOVED(counter, target)}\n`);
	}

	await writeFile(TRACKED, writeTracked(Array.from(trackedFiles)));
};

export default untrack;
