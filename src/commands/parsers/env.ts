import envVariables from "../../env";

const writeEnvVariables = (data: string): [string, number] => {
    let highestEnd = 0;

    for (const [varName, value] of Object.entries(envVariables)) {
        const regexp = new RegExp(`%${varName}%`, "gm"),
            matches = [...data.matchAll(regexp)].map(r => r.index!),
            len = `%${varName}%`.length;

        let offset = 0;
        for (const startIndex of matches) {
            data = `${data.slice(0, startIndex + offset)}${value}${data.slice(startIndex + len + offset)}`;
            offset += value.length - len;

            const end = startIndex + len + offset - 1;
            if (highestEnd < startIndex + len + offset - 1)
                highestEnd = end;
        }
    }

    return [data, highestEnd];
}

export default writeEnvVariables;