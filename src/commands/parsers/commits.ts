import chalk from "chalk";
import os from "node:os";

type Commit = {
    title: string,
    hash: string,
    timestamp: number
}
const writeCommits = (commits: Commit[]): string => {
    return commits.map(({ title, hash, timestamp }) => {
        const strTimestamp = timestamp.toString();
        return `${title.length}\u{001e}${title}`
            + `\u{001e}${strTimestamp.length}\u{001e}${strTimestamp}`
            + `\u{001e}${hash}`;
    }).join(os.EOL);
}

const readCommits = (data: string): Commit[] => {
    const lines = data.split(os.EOL),
        commits: Commit[] = [];

    try {
        lines.forEach(line => {
            if (line.length <= 0) return;
            console.log(line)

            let pointer = 0,
                titleLength = "";
            for (; line[pointer] != "\u{001e}" && pointer < line.length; pointer++) titleLength += line[pointer];

            if (++pointer >= line.length) throw new Error();

            let title = "";
            let start = pointer;
            for (; pointer < line.length && pointer < start + Number(titleLength); pointer++)
                title += line[pointer];

            if (line[pointer] != "\u{001e}") throw new Error();
            if (++pointer >= line.length) throw new Error();


            let timestampLength = "";
            for (; line[pointer] != "\u{001e}" && pointer < line.length; pointer++) timestampLength += line[pointer];

            if (++pointer >= line.length) throw new Error();

            let timestamp = "";
            start = pointer;
            for (; pointer < line.length && pointer < start + Number(timestampLength); pointer++)
                timestamp += line[pointer];

            if (++pointer >= line.length) throw new Error();

            let hash = "";
            for (; pointer < line.length; pointer++)
                hash += line[pointer];

            commits.push({
                title,
                hash,
                timestamp: Number(timestamp)
            })
        })
    } catch {
        console.error(chalk.red("\nRepository memory corrupted :/\n"));
        return [];
    }

    return commits;
}

export { writeCommits, readCommits };