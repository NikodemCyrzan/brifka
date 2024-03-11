import chalk from "chalk";
import ArgsParser from "../argsParser";
import { mapDirectory, readFile } from "../files";
import { readTracked } from "./parsers";

const fullLog = (tracked: Set<string>, all: Set<string>) => {
	console.log();

	// display tracked
	console.log(chalk.green("tracked\n======="));
	for (const file of tracked) console.log(chalk.green(file));

	// display not tracked
	console.log(`\n${chalk.red("not tracked\n===========")}`);
	for (const file of all) if (!tracked.has(file)) console.log(chalk.red(file));
};

const log = async (argsParser: ArgsParser) => {
	const full = argsParser.next();

	// get tracked files
	const trackedPath = ".brifka/mem/tracked",
		trackedRaw = await readFile(trackedPath);

	if (typeof trackedRaw === "boolean" && !trackedRaw) return;
	const tracked = new Set(readTracked(trackedRaw));

	// get all files
	const mappedFiles = new Set<string>();
	await mapDirectory(process.cwd(), mappedFiles);

	if (full) {
		fullLog(tracked, mappedFiles);
		return;
	}

	// count not tracked
	let count = 0;
	for (const file of mappedFiles) if (!tracked.has(file)) count++;

	console.log(`\n${chalk.green(tracked.size)} files are in tracked stage.\n${chalk.red(count)} files aren't in tracked stage.\n`);
};

export default log;
