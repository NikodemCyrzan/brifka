import ArgsParser from "../argsParser";
import { readFile } from "../files";
import { readCommits } from "./parsers";
import chalk from "chalk";

const commits = async (argsParser: ArgsParser) => {
	const commitsPath = ".brifka/mem/commits",
		data = await readFile(commitsPath);

	if (typeof data === "boolean" && !data) return;
	const commits = readCommits(data);

	if (commits.length <= 0) {
		console.error(chalk.red(`\nThere aren't any commits yet.\n`));
		return;
	}

	console.log(
		`\n${commits
			.reverse()
			.map(({ title, hash, timestamp }) => `${chalk.yellow("commit: " + hash)}` + `\nDate: ${new Date(timestamp).toLocaleString()}` + `\n\n\t${title}`)
			.join("\n\n")}\n`
	);
};

export default commits;
