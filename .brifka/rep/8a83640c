const border = (text: string, title: string = ""): string => {
    const { length } = text;
    const lines: string[] = [];
    const width = Math.min(process.stdout.columns, 45);
    const textSplited = text.split(" ");

    lines.push(`╭╴${title}╶${Array(width - 5 - title.length).fill("─").join("")}─╮`);

    let lineFactory = [];
    for (let i = 0; i < textSplited.length; i++)
        if ([...lineFactory, textSplited[i]].join(" ").length < width - 2)
            lineFactory.push(textSplited[i]);
        else {
            const joined = lineFactory.join(" ");
            lines.push(`│${joined}${Array(width - 2 - joined.length).fill(" ").join("")}│`);
            lineFactory = []
            i--;
        }

    if (lineFactory.length > 0)
        lines.push(`│${lineFactory.join(" ")}${Array(width - 2 - lineFactory.join(" ").length).fill(" ").join("")}│`);

    lines.push(`╰${Array(width - 2).fill("─").join("")}╯`);

    return `\n${lines.join("\n")}\n`;
}

export default border;
//│     │
//╰─────╯