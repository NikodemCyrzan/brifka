import chalk from "chalk";
import ArgsParser from "../argsParser";
import border from "../border";

const y = chalk.yellow, b = chalk.blue;

const documentation = {
    init: `${b("init")}`
        + `\n\n\tCreates new brifka repository in current working path.`,
    track: `${b("track <directory_path> | <file_path> | .")}`
        + `\n\n\tAdds files to the tracked stage.`
        + `\n\t${y("<directory_path>")} - all files and directories in that directory will be tracked.`
        + `\n\t${y("<file_path>")} - file will be tracked.`
        + `\n\t${y(".")} - all files besides excluded in '.brignore' will be tracked.`,
    untrack: `${b("untrack <directory_path> | <file_path> | .")}`
        + `\n\n\tRemoves files from tracked stage.`
        + `\n\t${y("<directory_path>")} - all files and directories in that directory will be untracked.`
        + `\n\t${y("<file_path>")} - file will be untracked.`
        + `\n\t${y(".")} - all files  will be untracked.`,
    commit: `${b("commit <commit_name>")}`
        + `\n\n\tAdds new commit to the repository.`
        + `\n\t${y("<commit_name>")} - name of new commit.`,
    uncommit: `${b("uncommit")}`
        + `\n\n\tRemoves last commit from the repository.`,
    commits: `${b("commits")}`
        + `\n${b("commits <limit>")}`
        + `\n\n\tDisplays commits.`
        + `\n\t${y("<limit>")} - displays only last x commits.`,
    push: `${b("push")}`
        + `\n\n\tSends repository to the ftp server specified in 'brifka.config.json'.`,
    pull: `${b("pull")}`
        + `\n\n\tDownloads repository from ftp server specified in 'brifka.config.json'.`
}

const help = (argsParser: ArgsParser) => {
    if (!argsParser.peek()) {
        console.log(`\n${Object.values(documentation).join("\n\n")}\n`);
        return;
    }

    const command = argsParser.peek() as string;
    if (Object.keys(documentation).find(key => key == command)?.length ?? 0 > 1)
        // @ts-ignore
        console.log(`\n${documentation[command]}\n`);
    else {
        console.error(chalk.red(`\nCommand '${command}' doesn't exist.`));
        console.log(border("Type 'brifka help' to view documentation of all commands.", "Help"));
    }
}

export default help;