import chalk from "chalk";
import ArgsParser from "./argsParser";
import interpretCommands from "./interpretCommands";
import fs from "node:fs/promises";
import path from "node:path";
import border from "./border";

(async () => {
	const argsParser = new ArgsParser(process.argv.slice(2));
	const command = argsParser.peek();

	let isInited = false;
	try {
		const status = await fs.stat(path.resolve(process.cwd(), ".brifka"));
		if (!status.isDirectory()) throw new Error();
		isInited = true;
	} catch {}

	if (!isInited && (!command || (command != "init" && command != "help"))) {
		console.log(chalk.red("\nBrifka repository is not initialised."));
		console.log(border("Type 'brifka init' to initialise repository.", "Help"));
		return;
	}

	interpretCommands(argsParser);
})();
