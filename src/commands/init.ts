import ArgsParser from "../argsParser";
import { Config } from "../config";
import { createDirectory, writeFile } from "../files";
import path from "node:path";

const init = (argsParser: ArgsParser) => {
	const repo = "./.brifka";

	const join = (...paths: string[]) => path.join(repo, ...paths);

	writeFile(join("mem/commits"));
	writeFile(join("mem/tracked"));
	writeFile(join("mem/head"));

	createDirectory(join("rep"));

	const defaultConfig: Config = {
		ftp: {
			host: "localhost",
			port: "default",
			user: "anonymus",
			password: "anonymus@",
			directory: "",
		},
	};

	writeFile("brifka.config.json", JSON.stringify(defaultConfig, undefined, 2));
	writeFile(".brignore", "brifka.config.json");
};

export default init;
