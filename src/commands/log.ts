import chalk from "chalk";
import ArgsParser from "../argsParser";
import { mapDirectory, readFile } from "../files";
import { readBrignore, readTracked } from "./parsers";

const fullLog = (tracked: Set<string>, all: Set<string>) => {
	// display tracked
	console.log(chalk.green("\ntracked\n======="));
	for (const file of tracked) console.log(chalk.green(file));

	// display not tracked
	console.log(chalk.red("\nnot tracked\n==========="));
	for (const file of all) if (!tracked.has(file)) console.log(chalk.red(file));
	console.log("\n");
};

const log = async (argsParser: ArgsParser) => {
	const full = argsParser.next();

	// get tracked files
	const trackedPath = ".brifka/mem/tracked",
		trackedRaw = await readFile(trackedPath);

	if (typeof trackedRaw === "boolean" && !trackedRaw) return;
	const tracked = new Set(readTracked(trackedRaw));

	// read brignore
	let ignore = new Set<string>();

	try {
		const brignoreRaw = await readFile(".brignore");
		if (typeof brignoreRaw === "boolean" && !brignoreRaw) throw new Error();
		ignore = new Set(readBrignore(brignoreRaw));
	} catch {}

	// get all files
	const mappedFiles = new Set<string>();
	await mapDirectory(process.cwd(), mappedFiles, ignore);

	if (full === "full") {
		fullLog(tracked, mappedFiles);
		return;
	}

	// count not tracked
	let count = 0;
	for (const file of mappedFiles) if (!tracked.has(file)) count++;

	console.log(`\n${chalk.green(tracked.size)} files are in tracked stage.\n${chalk.red(count)} files aren't in tracked stage.\n`);
};

export default log;
