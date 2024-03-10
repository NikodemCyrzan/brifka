import os from "node:os";

type TreeBranch = {
    path: string,
    hash: string
};

const writeTree = (breanches: TreeBranch[]) => {
    return breanches.map(({ path, hash }) => `${path.length}\u{001e}${path}\u{001e}${hash}`).join(os.EOL);
}

const readTree = () => {

}

export { writeTree, readTree }