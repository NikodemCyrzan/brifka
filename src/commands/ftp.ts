import chalk from "chalk";
import ArgsParser from "../argsParser";
import getConfig from "../config";
import { FTPConnect } from "../ftp";
import nodePath from "node:path";

const list = async (argsParser: ArgsParser) => {
	let directory = argsParser.next();

	if (directory === false) directory = ".";

	// get config
	const config = await getConfig();

	if (!config) {
		console.error(chalk.red(`\nCouldn't load config file.\n`));
		return;
	}
	const { directory: remoteDir } = config.ftp;

	// connect to FTP server
	const result = await FTPConnect();

	if (result.status === "error") {
		console.error(chalk.red(`\n${result.text}\n`));
		return;
	}
	const { client } = result;

	// list files
	try {
		const files = await client.list(nodePath.join(remoteDir, directory).replace("\\", "/"));

		console.log();
		for (const fileInfo of files) {
			const pre = fileInfo.isDirectory ? chalk.cyan("D") : fileInfo.isFile ? chalk.yellow("F") : " ";
			console.log(`${pre} ${nodePath.join(directory, fileInfo.name)}`);
		}
		console.log();
	} catch (error) {
		console.log(error, "err");
	}

	client.close();
};

const push = async () => {
	const config = await getConfig();

	if (!config) {
		console.error(chalk.red(`\nCouldn't load config file.\n`));
		return;
	}
};

const pull = async () => {
	const config = await getConfig();

	if (!config) {
		console.error(chalk.red(`\nCouldn't load config file.\n`));
		return;
	}

	const { directory } = config.ftp;

	const result = await FTPConnect();

	if (result.status === "error") {
		console.error(chalk.red(`\n${result.text}\n`));
		return;
	}
};

const ftp = (argsParser: ArgsParser) => {
	const command = argsParser.next();

	if (!command || command.length <= 0) {
		console.error(chalk.red(`\nFtp command requires pull | push | list argument.\n`));
		return;
	}

	switch (command) {
		case "pull":
			pull();
			break;
		case "push":
			push();
			break;
		case "list":
			list(argsParser);
			break;
		default:
			console.error(chalk.red(`\n'${command}' is not valid argument. Expected pull | push | list argument.\n`));
			break;
	}
};

export default ftp;
