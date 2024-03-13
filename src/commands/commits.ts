import ArgsParser from "../argsParser";
import logText from "../console";
import { readFile } from "../files";
import { COMMITS, HEAD } from "../paths";
import { readCommits } from "./parsers";
import chalk from "chalk";

const commits = async (argsParser: ArgsParser) => {
	const [dataStatus, commits] = await readFile(COMMITS, readCommits);
	if (!dataStatus) return;

	if (commits.length <= 0) {
		console.error(chalk.red(`\n${logText.COMMITS_EMPTY}\n`));
		return;
	}

	// read head
	const [, head] = await readFile(HEAD);

	console.log(
		`\n${commits
			.reverse()
			.map(({ title, hash, timestamp }) => `${chalk.yellow("commit: " + hash)}${head && head === hash ? chalk.blue(" <- HEAD") : ""}\nDate: ${new Date(timestamp).toLocaleString()}` + `\n\n\t${title}`)
			.join("\n\n")}\n`
	);
};

export default commits;
