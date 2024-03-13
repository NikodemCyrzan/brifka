import envVariables from "../../env";

const writeEnvVariables = (data: string) => {
    for (const [varName, value] of Object.entries(envVariables))
        data = data.replaceAll(new RegExp(`%${varName}%`, "gm"), value);
    return data;
}

export default writeEnvVariables;