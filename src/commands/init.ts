import ArgsParser from "../argsParser";
import { createDirectory, writeFile } from "../files";
import path from "node:path";

const init = (argsParser: ArgsParser) => {
	const repo = "./.brifka";

	const join = (...paths: string[]) => path.join(repo, ...paths);

	writeFile(join("mem/commits"));
	writeFile(join("mem/tracked"));
	writeFile(join("mem/head"));

	createDirectory(join("rep"));

	writeFile(
		"brifka.config.json",
		JSON.stringify({
			ftp: {
				server: "",
				port: "default",
				login: "",
				password: "",
			},
		})
	);
	writeFile(".brignore", "brifka.config.json");
};

export default init;
