import chalk from "chalk";
import ArgsParser from "../argsParser";
import getConfig from "../config";
import { FTPConnect } from "../ftp";
import nodePath from "node:path";
import logText from "../console";

const list = async (argsParser: ArgsParser) => {
	let directory = argsParser.next();

	if (directory === false) directory = ".";

	// get config
	const [configStatus, config] = await getConfig();

	if (!configStatus) {
		console.error(chalk.red(`\n${config}\n`));
		return;
	}
	const { directory: remoteDir } = config.ftp;

	// connect to FTP server
	const [ftpStatus, ftp] = await FTPConnect();

	if (!ftpStatus) {
		console.error(chalk.red(`\n${ftp}\n`));
		return;
	}

	// list files
	try {
		const files = await ftp.list(nodePath.join(remoteDir, directory).replace("\\", "/"));

		console.log();
		for (const fileInfo of files) {
			const pre = fileInfo.isDirectory ? chalk.cyan("D") : fileInfo.isFile ? chalk.yellow("F") : " ";
			console.log(`${pre} ${nodePath.join(directory, fileInfo.name)}`);
		}
		console.log();
	} catch (error) {
		console.log(error, "err");
	}

	ftp.close();
};

const push = async () => {
	const config = await getConfig();

	if (!config) {
		console.error(chalk.red(`\n${logText.CONFIG_NOT_EXISTING}\n`));
		return;
	}
};

const pull = async () => {
	const [configStatus, config] = await getConfig();

	if (!configStatus) {
		console.error(chalk.red(`\n${config}\n`));
		return;
	}

	const { directory } = config.ftp;

	const [ftpStatus, ftp] = await FTPConnect();

	if (!ftpStatus) {
		console.error(chalk.red(`\n${ftp}\n`));
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
