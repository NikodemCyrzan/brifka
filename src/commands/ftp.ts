import chalk from "chalk";
import ArgsParser from "../argsParser";
import { FTPConnect } from "../ftp";
import nodePath from "node:path/posix";
import logText from "../console";
import { COMMITS, REPOSITORY_FILE } from "../paths";
import { readCommits, readTree, writeEnvVariables } from "./parsers";
import { readFile } from "../files";
import { Readable, Transform, pipeline } from "node:stream";
import { createReadStream, createWriteStream } from "node:fs";
import { join, normalize, parse, sep } from "path/win32";
// @ts-ignore
import ProgressBar from "progress";
import getConfig from "../config";

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
	const [configStatus, config] = await getConfig();

	if (!configStatus) return;

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

	const bar = new ProgressBar("[:bar]", {
		total: tree.length,
		complete: chalk.bgWhiteBright("#"),
		incomplete: chalk.bgGray("."),
		width: 17,
	});

	// send tree to
	for (const { hash, path } of tree) {
		const buffer: [string, string] = ["", ""],
			readable = new Readable({ encoding: "utf8" })
		// @ts-ignore
		readable._read = () => { }

		// stream file to remote
		let i = 0;
		createReadStream(nodePath.resolve(path))
			.on("data", (data) => {
				if (i !== 0) {
					buffer[0] = buffer[1];
					buffer[1] = data.toString("utf8");

					const [full, end] = writeEnvVariables(buffer.join(""));
					if (end !== 0)
						readable.push(full.slice(0, end), "utf8");
					buffer[1] = full.slice(end);
				}
				else
					buffer[1] = data.toString("utf8");
				i++;
			})
			.on("end", () => {
				readable.push(i <= 1 ? writeEnvVariables(buffer[1])[0] : buffer[1], "utf8")
				readable.push(null);
			});


		let dir: string;
		try {
			const norm = normalize(path),
				parsed = parse(norm);
			await ftp.ensureDir(parsed.dir);
			await ftp.uploadFrom(readable, parsed.base);

			dir = await ftp.pwd();
		} catch {
			dir = await ftp.pwd();
		}

		let len = parse(dir).dir.split("/").length;
		while (len--) await ftp.cdup();
		await ftp.cd(normalize(config.ftp.directory))
		bar.tick()
	}
	ftp.close();

	console.log(chalk.green("\nSuccessfully pushed repository build.\n"))
};

const ftp = (argsParser: ArgsParser) => {
	const command = argsParser.next();

	if (!command || command.length <= 0) {
		console.error(chalk.red(`\nFtp command requires push | list argument.\n`));
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
			console.error(chalk.red(`\n'${command}' is not valid argument.Expected push | list argument.\n`));
			break;
	}
};

export default ftp;
