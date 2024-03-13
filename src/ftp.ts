import { Client, FTPError } from "basic-ftp";
import getConfig from "./config";

type FTPConnectResult = [false, string] | [true, Client];

const FTPConnect = async (): Promise<FTPConnectResult> => {
	const [configStatus, config] = await getConfig();

	if (!configStatus) return [false, config];

	const client = new Client(),
		{ user, password, port, host, secure } = config.ftp,
		promise = new Promise<FTPConnectResult>(async (resolve) => {
			try {
				await client.access({
					host,
					password,
					user,
					port: typeof port === "string" && port === "default" ? undefined : port,
					secure,
				});
				resolve([true, client]);
			} catch (error) {
				client.close();
				resolve([false, `FTP error: ${(error as FTPError)?.code}`]);
			}
		});

	return promise;
};

export { FTPConnect };
