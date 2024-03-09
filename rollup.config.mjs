import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default {
    input: "./src/index.ts",
    output: {
        file: "dist/index.js",
        format: "cjs",
        // plugins: [terser()],
        sourcemap: "inline",
        external: ["chalk"],
    },
    plugins: [
        nodeResolve({ exportConditions: ["node"] }),
        typescript({ tsconfig: "tsconfig.json" }),
    ],
};
