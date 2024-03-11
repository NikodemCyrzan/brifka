import chalk from "chalk";
import ArgsParser from "../argsParser";
import { readFile, writeFile } from "../files";
import { readCommits, writeCommits } from "./parsers";

const uncommit = async (argsParser: ArgsParser) => {
	// read all commits
	const commitsPath = ".brifka/mem/commits",
		commitsRaw = await readFile(commitsPath);

	if (typeof commitsRaw === "boolean" && !commitsRaw) {
		console.error(chalk.red("\nRepository memory corrupted :/\n"));
		return;
	}

	// remove last
	let commits = readCommits(commitsRaw);
	const removedCommit = commits.pop();

	if (!removedCommit) {
		console.error(chalk.red(`\nThere aren't any commits yet.\n`));
		return;
	}

	// write commits
	await writeFile(commitsPath, writeCommits(commits));

	console.error(
		`\n${chalk.green("Successfully removed last commit.")}\n\n${chalk.yellow(`commit: ${removedCommit.hash}`)}\nDate: ${new Date(removedCommit.timestamp).toLocaleString()}\n\n\t${removedCommit.title}\n`
	);
};

export default uncommit;
