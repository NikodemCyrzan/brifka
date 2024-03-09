import ArgsParser from "./argsParser";
import interpretCommands from "./interpretCommands";

const argsParser = new ArgsParser(process.argv.slice(2));
interpretCommands(argsParser);