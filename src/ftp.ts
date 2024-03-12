import { Client, FTPError } from "basic-ftp";
import getConfig from "./config";
import chalk from "chalk";

type Result =
	| {
			status: "success";
			client: Client;
	  }
	| {
			status: "error";
			text: string;
	  };

const FTPConnect = async (): Promise<Result> => {
	const config = await getConfig();

	if (!config)
		return {
			status: "error",
			text: chalk.red("\nCouldn't get 'brifka.config.json' file.\n"),
		};

	const client = new Client(),
		{ user, password, port, host, secure } = config.ftp,
		promise = new Promise<Result>(async (resolve) => {
			try {
				await client.access({
					host,
					password,
					user,
					port: typeof port === "string" && port === "default" ? undefined : port,
					secure,
				});
				resolve({
					status: "success",
					client,
				});
			} catch (error) {
				client.close();
				resolve({
					status: "error",
					text: `FTP error: ${(error as FTPError)?.code}`,
				});
			}
		});

	return promise;
};

export { FTPConnect };
