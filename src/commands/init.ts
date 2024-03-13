import chalk from "chalk";
import ArgsParser from "../argsParser";
import { Config } from "../config";
import { createDirectory, writeFile } from "../files";
import logText from "../console";
import { BRIGNORE, COMMITS, CONFIG, HEAD, REPOSITORY, TRACKED } from "../paths";

const init = (argsParser: ArgsParser) => {
	writeFile(COMMITS);
	writeFile(TRACKED);
	writeFile(HEAD);

	createDirectory(REPOSITORY);

	const defaultConfig: Config = {
		ftp: {
			host: "localhost",
			port: "default",
			user: "anonymus",
			password: "anonymus@",
			directory: "",
		},
	};

	writeFile(CONFIG, JSON.stringify(defaultConfig, undefined, 2));
	writeFile(BRIGNORE, CONFIG);

	console.log(chalk.green(`\n${logText.INIT_SUCCESS}\n`));
};

export default init;
