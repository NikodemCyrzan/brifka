import chalk from "chalk";
import ArgsParser from "../argsParser";
import nodePath from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { readBrignore, readTracked, writeTracked } from "./parsers";
import { appendFile, mapDirectory, readFile } from "../files";
import logText from "../console";

const trackIgnore: string[] = [".brifka"];

const track = async (argsParser: ArgsParser) => {
	const target = argsParser.next();

	if (!target || target.length <= 0) {
		console.error(chalk.red(`\n${logText.TRACK_NO_ARGUMENT}\n`));
		return;
	}

	// get target status
	const targetPath = nodePath.resolve(process.cwd(), target);
	let status;
	try {
		status = await fs.stat(targetPath);
	} catch {
		console.error(chalk.red(`\nFile or directory '${target}' doesn't exist.\n`));
		return;
	}

	// read brignore
	let ignore = new Set<string>();

	try {
		const [brignoreStatus, brignore] = await readFile(".brignore", readBrignore);
		if (!brignoreStatus) throw new Error();
		ignore = new Set([...brignore, ...trackIgnore]);
	} catch {
		ignore = new Set(trackIgnore);
	}

	// get tracked files
	const trackedPath = ".brifka/mem/tracked";
	const [trackedStatus, tracked] = await readFile(trackedPath, readTracked);

	if (!trackedStatus) {
		console.error(chalk.red(`\n${logText.TRACKED_FILE_NOT_EXISTING}\n`));
		return;
	}

	const trackedFiles = new Set(tracked);

	if (status.isDirectory()) {
		const paths = new Set<string>();
		await mapDirectory(targetPath, paths, ignore);

		const newFiles = new Set(Array.from(paths).filter((p) => !trackedFiles.has(p)));
		await appendFile(trackedPath, writeTracked(Array.from(newFiles)) + os.EOL);

		console.log(`\n${logText.TRACKED_PATHS_ADDED(newFiles.size, target)}\n`);
	} else if (status.isFile()) {
		const newFile = nodePath.relative(process.cwd(), targetPath);

		if (!trackedFiles.has(newFile)) {
			await appendFile(trackedPath, writeTracked([newFile]) + os.EOL);
			console.log(chalk.green(`\n${logText.TRACKED_PATH_ADDED(target)}\n`));
		} else {
			console.error(chalk.red(`\n${logText.TRACKED_PATH_ALREADY_TRACKED(target)}\n`));
			return;
		}
	}
};

export default track;
