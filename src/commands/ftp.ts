import chalk from "chalk";
import ArgsParser from "../argsParser";
import { FTPConnect } from "../ftp";
import nodePath from "node:path/posix";
import logText from "../console";
import { pipeline } from "stream/promises";
import { createReadStream } from "node:fs";
import { COMMITS, REPOSITORY_FILE } from "../paths";
import { readCommits, readTree } from "./parsers";
import { readFile } from "../files";

const list = async (argsParser: ArgsParser) => {
	let directory = argsParser.next();

	if (directory === false) directory = ".";

	// connect to FTP server
	const [ftpStatus, ftp] = await FTPConnect();

	if (!ftpStatus) {
		console.error(chalk.red(`\n${ftp}\n`));
		return;
	}

	// list files
	try {
		const files = await ftp.list(nodePath.normalize(directory));

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
	// connect to FTP server
	const [ftpStatus, ftp] = await FTPConnect();

	if (!ftpStatus) {
		console.error(chalk.red(`\n${ftp}\n`));
		return;
	}

	// get last commit
	const [commitsStatus, commits] = await readFile(COMMITS, readCommits);

	if (!commitsStatus) {
		console.error(chalk.red(`\n${logText.COMMIT_NOT_EXISTING}\n`));
		return;
	}

	const { hash } = commits.at(-1)!;

	// get tree
	const [treeStatus, tree] = await readFile(REPOSITORY_FILE(hash), readTree);
	if (!treeStatus) return;

	// clear remote directory
	await ftp.clearWorkingDir();

	// send tree to
};

const ftp = (argsParser: ArgsParser) => {
	const command = argsParser.next();

	if (!command || command.length <= 0) {
		console.error(chalk.red(`\nFtp command requires pull | push | list argument.\n`));
		return;
	}

	switch (command) {
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
