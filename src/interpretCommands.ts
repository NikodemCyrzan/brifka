import ArgsParser from "./argsParser";
import border from "./border";
import { interpret } from "./commands/index";
import chalk from "chalk";

const interpretCommands = (argsParser: ArgsParser) => {
	const command = argsParser.next();

	switch (command) {
		case "help":
			interpret.help(argsParser);
			break;
		case "init":
			interpret.init(argsParser);
			break;
		case "track":
			interpret.track(argsParser);
			break;
		case "untrack":
			interpret.untrack(argsParser);
			break;
		case "commit":
			interpret.commit(argsParser);
			break;
		case "commits":
			interpret.commits(argsParser);
			break;
		case "change":
			interpret.change(argsParser);
			break;
		default:
			console.error(chalk.red(`\nCommand '${command}' doesn't exist.`));
			console.log(border("To get documentation of all commands type 'brifka help' or 'brifka help <command_name>' to get documentation of specific command.", "Help"));
			break;
	}
};

export default interpretCommands;
