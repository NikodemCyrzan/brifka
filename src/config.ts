import { readFile } from "./files";

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

type ConfigCallback = (config: Config | null) => void;

const configListeners: ConfigCallback[] = [];

let willConfigBeLoaded = true;

// loading config file
let loadedConfig: Config | null = null;
const callAllListeners = () => {
	configListeners.forEach((callback) => callback(loadedConfig));
};

(async () => {
	const config = await readFile("brifka.config.json");

	if (typeof config === "boolean" && !config) {
		willConfigBeLoaded = false;
		callAllListeners();
		return;
	}

	try {
		loadedConfig = JSON.parse(config);
	} catch {}
	willConfigBeLoaded = false;
	callAllListeners();
})();

const getConfig = async (): Promise<Config | null> => {
	if (!willConfigBeLoaded) return loadedConfig;

	return new Promise((resolve) => configListeners.push(resolve));
};

export default getConfig;
