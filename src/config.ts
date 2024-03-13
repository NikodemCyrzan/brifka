import logText from "./console";
import { readFile } from "./files";
import { CONFIG } from "./paths";

export type Config = {
	ftp: {
		host: string;
		port: number | "default";
		user: string;
		password: string;
		directory: string;
		secure?: boolean;
	};
};

type GetConfigResult = [true, Config] | [false, string];

type ConfigCallback = (config: GetConfigResult) => void;

const configListeners: ConfigCallback[] = [];

let willConfigBeLoaded = true,
	wasError: boolean = false,
	errorText: string = "";

// loading config file
let loadedConfig: Config;
const callAllListeners = () => {
	let res: GetConfigResult;
	if (wasError) res = [false, errorText];
	else res = [true, loadedConfig];
	configListeners.forEach((callback) => callback(res));
};

(async () => {
	const [configStatus, config] = await readFile(CONFIG);

	if (!configStatus) {
		willConfigBeLoaded = false;
		wasError = true;
		errorText = logText.CONFIG_NOT_EXISTING;
		callAllListeners();
		return;
	}

	try {
		loadedConfig = JSON.parse(config);
	} catch {
		wasError = true;
		errorText = logText.CONFIG_FORMAT_ERROR;
	}
	willConfigBeLoaded = false;
	callAllListeners();
})();

const getConfig = async (): Promise<GetConfigResult> => {
	if (!willConfigBeLoaded) {
		if (wasError) return [false, errorText];
		else return [true, loadedConfig]
	}
	return new Promise((resolve) => configListeners.push(resolve));
};

export default getConfig;
