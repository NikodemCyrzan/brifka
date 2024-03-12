import chalk from "chalk";
import ArgsParser from "../argsParser";
import nodePath from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { readBrignore, readTracked, writeTracked } from "./parsers";
import { appendFile, mapDirectory, readFile } from "../files";

const track = async (argsParser: ArgsParser) => {
	const target = argsParser.next();

	if (!target || target.length <= 0) {
		console.error(chalk.red(`\nTrack command requires <directory_path> | <file_path> | . argument.\n`));
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
		const brignoreRaw = await readFile(".brignore");
		if (typeof brignoreRaw === "boolean" && !brignoreRaw) throw new Error();
		ignore = new Set(readBrignore(brignoreRaw));
	} catch {}

	// get tracked files
	const trackedPath = ".brifka/mem/tracked";
	const trackedRaw = await readFile(trackedPath);

	if (typeof trackedRaw !== "string") {
		console.error(chalk.red(`\nRepository memory corrupted :/\n`));
		return;
	}

	const trackedFiles = new Set(readTracked(trackedRaw));

	if (status.isDirectory()) {
		const paths = new Set<string>();
		await mapDirectory(targetPath, paths, ignore);

		const newFiles = new Set(Array.from(paths).filter((p) => !trackedFiles.has(p)));
		await appendFile(trackedPath, writeTracked(Array.from(newFiles)) + os.EOL);

		console.log(`\n${chalk.green(newFiles.size)} new files added to tracked stage from directory '${target}'.\n`);
	} else if (status.isFile()) {
		const newFile = nodePath.relative(process.cwd(), targetPath);

		if (!trackedFiles.has(newFile)) {
			await appendFile(trackedPath, writeTracked([newFile]) + os.EOL);
			console.log(chalk.green(`\nAdded '${target}' to tracked stage.\n`));
		} else {
			console.error(chalk.red(`\nFile '${newFile}' is already tracked.\n`));
			return;
		}
	}
};

export default track;
