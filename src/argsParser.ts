class ArgsParser {
    public args: string[];
    private index: number = 0;

    constructor(_args: string[]) {
        this.args = _args;
    }

    public next(): string | false {
        if (this.index >= this.args.length) return false;
        return this.args[this.index++];
    }

    public prev(): string | false {
        if (this.index - 1 < 0) return false;
        return this.args[--this.index];
    }

    public peek(): string | false {
        if (this.index + 1 >= this.args.length) return false;
        return this.args[this.index + 1];
    }
}

export default ArgsParser;