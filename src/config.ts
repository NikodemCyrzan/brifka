import logText from "./console";
import envVariables from "./env";
import { readFile } from "./files";
import { CONFIG } from "./paths";

export type Config = {
	env?: Record<string, any>,
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

const addEnvVariables = () => {
	const env = loadedConfig.env!;

	for (const [varName, value] of Object.entries(env))
		if (/^brifka_.+/i.test(varName)) envVariables[varName] = value;
}

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
		if (loadedConfig.env) addEnvVariables();
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
