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
	console.log();
};

const logIgnore = [".brifka", "brifka.config.json"];

const log = async (argsParser: ArgsParser) => {
	const full = argsParser.next();

	// get tracked files
	const trackedPath = ".brifka/mem/tracked",
		[trackedStatus, tracked] = await readFile(trackedPath, readTracked);

	if (!trackedStatus) return;
	const trackedSet = new Set(tracked);

	// read brignore
	let ignore = new Set<string>();

	try {
		const [brignoreStatus, brignore] = await readFile(".brignore", readBrignore);
		if (!brignoreStatus) throw new Error();
		ignore = new Set([...brignore, ...logIgnore]);
	} catch { }

	// get all files
	const mappedFiles = new Set<string>();
	await mapDirectory(process.cwd(), mappedFiles, ignore);

	if (full === "full") {
		fullLog(trackedSet, mappedFiles);
		return;
	}

	// count not tracked
	let count = 0;
	for (const file of mappedFiles) if (!trackedSet.has(file)) count++;

	console.log(`\n${chalk.green(trackedSet.size)} files are in tracked stage.\n${chalk.red(count)} files aren't in tracked stage.\n`);
};

export default log;
