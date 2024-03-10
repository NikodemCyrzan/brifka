'use strict';

var process$1 = require('node:process');
var os = require('node:os');
var tty = require('node:tty');
var fs = require('node:fs/promises');
var nodePath = require('node:path');

const ANSI_BACKGROUND_OFFSET = 10;

const wrapAnsi16 = (offset = 0) => code => `\u001B[${code + offset}m`;

const wrapAnsi256 = (offset = 0) => code => `\u001B[${38 + offset};5;${code}m`;

const wrapAnsi16m = (offset = 0) => (red, green, blue) => `\u001B[${38 + offset};2;${red};${green};${blue}m`;

const styles$1 = {
	modifier: {
		reset: [0, 0],
		// 21 isn't widely supported and 22 does the same thing
		bold: [1, 22],
		dim: [2, 22],
		italic: [3, 23],
		underline: [4, 24],
		overline: [53, 55],
		inverse: [7, 27],
		hidden: [8, 28],
		strikethrough: [9, 29],
	},
	color: {
		black: [30, 39],
		red: [31, 39],
		green: [32, 39],
		yellow: [33, 39],
		blue: [34, 39],
		magenta: [35, 39],
		cyan: [36, 39],
		white: [37, 39],

		// Bright color
		blackBright: [90, 39],
		gray: [90, 39], // Alias of `blackBright`
		grey: [90, 39], // Alias of `blackBright`
		redBright: [91, 39],
		greenBright: [92, 39],
		yellowBright: [93, 39],
		blueBright: [94, 39],
		magentaBright: [95, 39],
		cyanBright: [96, 39],
		whiteBright: [97, 39],
	},
	bgColor: {
		bgBlack: [40, 49],
		bgRed: [41, 49],
		bgGreen: [42, 49],
		bgYellow: [43, 49],
		bgBlue: [44, 49],
		bgMagenta: [45, 49],
		bgCyan: [46, 49],
		bgWhite: [47, 49],

		// Bright color
		bgBlackBright: [100, 49],
		bgGray: [100, 49], // Alias of `bgBlackBright`
		bgGrey: [100, 49], // Alias of `bgBlackBright`
		bgRedBright: [101, 49],
		bgGreenBright: [102, 49],
		bgYellowBright: [103, 49],
		bgBlueBright: [104, 49],
		bgMagentaBright: [105, 49],
		bgCyanBright: [106, 49],
		bgWhiteBright: [107, 49],
	},
};

Object.keys(styles$1.modifier);
const foregroundColorNames = Object.keys(styles$1.color);
const backgroundColorNames = Object.keys(styles$1.bgColor);
[...foregroundColorNames, ...backgroundColorNames];

function assembleStyles() {
	const codes = new Map();

	for (const [groupName, group] of Object.entries(styles$1)) {
		for (const [styleName, style] of Object.entries(group)) {
			styles$1[styleName] = {
				open: `\u001B[${style[0]}m`,
				close: `\u001B[${style[1]}m`,
			};

			group[styleName] = styles$1[styleName];

			codes.set(style[0], style[1]);
		}

		Object.defineProperty(styles$1, groupName, {
			value: group,
			enumerable: false,
		});
	}

	Object.defineProperty(styles$1, 'codes', {
		value: codes,
		enumerable: false,
	});

	styles$1.color.close = '\u001B[39m';
	styles$1.bgColor.close = '\u001B[49m';

	styles$1.color.ansi = wrapAnsi16();
	styles$1.color.ansi256 = wrapAnsi256();
	styles$1.color.ansi16m = wrapAnsi16m();
	styles$1.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
	styles$1.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
	styles$1.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);

	// From https://github.com/Qix-/color-convert/blob/3f0e0d4e92e235796ccb17f6e85c72094a651f49/conversions.js
	Object.defineProperties(styles$1, {
		rgbToAnsi256: {
			value(red, green, blue) {
				// We use the extended greyscale palette here, with the exception of
				// black and white. normal palette only has 4 greyscale shades.
				if (red === green && green === blue) {
					if (red < 8) {
						return 16;
					}

					if (red > 248) {
						return 231;
					}

					return Math.round(((red - 8) / 247) * 24) + 232;
				}

				return 16
					+ (36 * Math.round(red / 255 * 5))
					+ (6 * Math.round(green / 255 * 5))
					+ Math.round(blue / 255 * 5);
			},
			enumerable: false,
		},
		hexToRgb: {
			value(hex) {
				const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
				if (!matches) {
					return [0, 0, 0];
				}

				let [colorString] = matches;

				if (colorString.length === 3) {
					colorString = [...colorString].map(character => character + character).join('');
				}

				const integer = Number.parseInt(colorString, 16);

				return [
					/* eslint-disable no-bitwise */
					(integer >> 16) & 0xFF,
					(integer >> 8) & 0xFF,
					integer & 0xFF,
					/* eslint-enable no-bitwise */
				];
			},
			enumerable: false,
		},
		hexToAnsi256: {
			value: hex => styles$1.rgbToAnsi256(...styles$1.hexToRgb(hex)),
			enumerable: false,
		},
		ansi256ToAnsi: {
			value(code) {
				if (code < 8) {
					return 30 + code;
				}

				if (code < 16) {
					return 90 + (code - 8);
				}

				let red;
				let green;
				let blue;

				if (code >= 232) {
					red = (((code - 232) * 10) + 8) / 255;
					green = red;
					blue = red;
				} else {
					code -= 16;

					const remainder = code % 36;

					red = Math.floor(code / 36) / 5;
					green = Math.floor(remainder / 6) / 5;
					blue = (remainder % 6) / 5;
				}

				const value = Math.max(red, green, blue) * 2;

				if (value === 0) {
					return 30;
				}

				// eslint-disable-next-line no-bitwise
				let result = 30 + ((Math.round(blue) << 2) | (Math.round(green) << 1) | Math.round(red));

				if (value === 2) {
					result += 60;
				}

				return result;
			},
			enumerable: false,
		},
		rgbToAnsi: {
			value: (red, green, blue) => styles$1.ansi256ToAnsi(styles$1.rgbToAnsi256(red, green, blue)),
			enumerable: false,
		},
		hexToAnsi: {
			value: hex => styles$1.ansi256ToAnsi(styles$1.hexToAnsi256(hex)),
			enumerable: false,
		},
	});

	return styles$1;
}

const ansiStyles = assembleStyles();

// From: https://github.com/sindresorhus/has-flag/blob/main/index.js
/// function hasFlag(flag, argv = globalThis.Deno?.args ?? process.argv) {
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process$1.argv) {
	const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
	const position = argv.indexOf(prefix + flag);
	const terminatorPosition = argv.indexOf('--');
	return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}

const {env} = process$1;

let flagForceColor;
if (
	hasFlag('no-color')
	|| hasFlag('no-colors')
	|| hasFlag('color=false')
	|| hasFlag('color=never')
) {
	flagForceColor = 0;
} else if (
	hasFlag('color')
	|| hasFlag('colors')
	|| hasFlag('color=true')
	|| hasFlag('color=always')
) {
	flagForceColor = 1;
}

function envForceColor() {
	if ('FORCE_COLOR' in env) {
		if (env.FORCE_COLOR === 'true') {
			return 1;
		}

		if (env.FORCE_COLOR === 'false') {
			return 0;
		}

		return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
	}
}

function translateLevel(level) {
	if (level === 0) {
		return false;
	}

	return {
		level,
		hasBasic: true,
		has256: level >= 2,
		has16m: level >= 3,
	};
}

function _supportsColor(haveStream, {streamIsTTY, sniffFlags = true} = {}) {
	const noFlagForceColor = envForceColor();
	if (noFlagForceColor !== undefined) {
		flagForceColor = noFlagForceColor;
	}

	const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;

	if (forceColor === 0) {
		return 0;
	}

	if (sniffFlags) {
		if (hasFlag('color=16m')
			|| hasFlag('color=full')
			|| hasFlag('color=truecolor')) {
			return 3;
		}

		if (hasFlag('color=256')) {
			return 2;
		}
	}

	// Check for Azure DevOps pipelines.
	// Has to be above the `!streamIsTTY` check.
	if ('TF_BUILD' in env && 'AGENT_NAME' in env) {
		return 1;
	}

	if (haveStream && !streamIsTTY && forceColor === undefined) {
		return 0;
	}

	const min = forceColor || 0;

	if (env.TERM === 'dumb') {
		return min;
	}

	if (process$1.platform === 'win32') {
		// Windows 10 build 10586 is the first Windows release that supports 256 colors.
		// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
		const osRelease = os.release().split('.');
		if (
			Number(osRelease[0]) >= 10
			&& Number(osRelease[2]) >= 10_586
		) {
			return Number(osRelease[2]) >= 14_931 ? 3 : 2;
		}

		return 1;
	}

	if ('CI' in env) {
		if ('GITHUB_ACTIONS' in env || 'GITEA_ACTIONS' in env) {
			return 3;
		}

		if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'BUILDKITE', 'DRONE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
			return 1;
		}

		return min;
	}

	if ('TEAMCITY_VERSION' in env) {
		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
	}

	if (env.COLORTERM === 'truecolor') {
		return 3;
	}

	if (env.TERM === 'xterm-kitty') {
		return 3;
	}

	if ('TERM_PROGRAM' in env) {
		const version = Number.parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

		switch (env.TERM_PROGRAM) {
			case 'iTerm.app': {
				return version >= 3 ? 3 : 2;
			}

			case 'Apple_Terminal': {
				return 2;
			}
			// No default
		}
	}

	if (/-256(color)?$/i.test(env.TERM)) {
		return 2;
	}

	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
		return 1;
	}

	if ('COLORTERM' in env) {
		return 1;
	}

	return min;
}

function createSupportsColor(stream, options = {}) {
	const level = _supportsColor(stream, {
		streamIsTTY: stream && stream.isTTY,
		...options,
	});

	return translateLevel(level);
}

const supportsColor = {
	stdout: createSupportsColor({isTTY: tty.isatty(1)}),
	stderr: createSupportsColor({isTTY: tty.isatty(2)}),
};

// TODO: When targeting Node.js 16, use `String.prototype.replaceAll`.
function stringReplaceAll(string, substring, replacer) {
	let index = string.indexOf(substring);
	if (index === -1) {
		return string;
	}

	const substringLength = substring.length;
	let endIndex = 0;
	let returnValue = '';
	do {
		returnValue += string.slice(endIndex, index) + substring + replacer;
		endIndex = index + substringLength;
		index = string.indexOf(substring, endIndex);
	} while (index !== -1);

	returnValue += string.slice(endIndex);
	return returnValue;
}

function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
	let endIndex = 0;
	let returnValue = '';
	do {
		const gotCR = string[index - 1] === '\r';
		returnValue += string.slice(endIndex, (gotCR ? index - 1 : index)) + prefix + (gotCR ? '\r\n' : '\n') + postfix;
		endIndex = index + 1;
		index = string.indexOf('\n', endIndex);
	} while (index !== -1);

	returnValue += string.slice(endIndex);
	return returnValue;
}

const {stdout: stdoutColor, stderr: stderrColor} = supportsColor;

const GENERATOR = Symbol('GENERATOR');
const STYLER = Symbol('STYLER');
const IS_EMPTY = Symbol('IS_EMPTY');

// `supportsColor.level` → `ansiStyles.color[name]` mapping
const levelMapping = [
	'ansi',
	'ansi',
	'ansi256',
	'ansi16m',
];

const styles = Object.create(null);

const applyOptions = (object, options = {}) => {
	if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
		throw new Error('The `level` option should be an integer from 0 to 3');
	}

	// Detect level if not set manually
	const colorLevel = stdoutColor ? stdoutColor.level : 0;
	object.level = options.level === undefined ? colorLevel : options.level;
};

const chalkFactory = options => {
	const chalk = (...strings) => strings.join(' ');
	applyOptions(chalk, options);

	Object.setPrototypeOf(chalk, createChalk.prototype);

	return chalk;
};

function createChalk(options) {
	return chalkFactory(options);
}

Object.setPrototypeOf(createChalk.prototype, Function.prototype);

for (const [styleName, style] of Object.entries(ansiStyles)) {
	styles[styleName] = {
		get() {
			const builder = createBuilder(this, createStyler(style.open, style.close, this[STYLER]), this[IS_EMPTY]);
			Object.defineProperty(this, styleName, {value: builder});
			return builder;
		},
	};
}

styles.visible = {
	get() {
		const builder = createBuilder(this, this[STYLER], true);
		Object.defineProperty(this, 'visible', {value: builder});
		return builder;
	},
};

const getModelAnsi = (model, level, type, ...arguments_) => {
	if (model === 'rgb') {
		if (level === 'ansi16m') {
			return ansiStyles[type].ansi16m(...arguments_);
		}

		if (level === 'ansi256') {
			return ansiStyles[type].ansi256(ansiStyles.rgbToAnsi256(...arguments_));
		}

		return ansiStyles[type].ansi(ansiStyles.rgbToAnsi(...arguments_));
	}

	if (model === 'hex') {
		return getModelAnsi('rgb', level, type, ...ansiStyles.hexToRgb(...arguments_));
	}

	return ansiStyles[type][model](...arguments_);
};

const usedModels = ['rgb', 'hex', 'ansi256'];

for (const model of usedModels) {
	styles[model] = {
		get() {
			const {level} = this;
			return function (...arguments_) {
				const styler = createStyler(getModelAnsi(model, levelMapping[level], 'color', ...arguments_), ansiStyles.color.close, this[STYLER]);
				return createBuilder(this, styler, this[IS_EMPTY]);
			};
		},
	};

	const bgModel = 'bg' + model[0].toUpperCase() + model.slice(1);
	styles[bgModel] = {
		get() {
			const {level} = this;
			return function (...arguments_) {
				const styler = createStyler(getModelAnsi(model, levelMapping[level], 'bgColor', ...arguments_), ansiStyles.bgColor.close, this[STYLER]);
				return createBuilder(this, styler, this[IS_EMPTY]);
			};
		},
	};
}

const proto = Object.defineProperties(() => {}, {
	...styles,
	level: {
		enumerable: true,
		get() {
			return this[GENERATOR].level;
		},
		set(level) {
			this[GENERATOR].level = level;
		},
	},
});

const createStyler = (open, close, parent) => {
	let openAll;
	let closeAll;
	if (parent === undefined) {
		openAll = open;
		closeAll = close;
	} else {
		openAll = parent.openAll + open;
		closeAll = close + parent.closeAll;
	}

	return {
		open,
		close,
		openAll,
		closeAll,
		parent,
	};
};

const createBuilder = (self, _styler, _isEmpty) => {
	// Single argument is hot path, implicit coercion is faster than anything
	// eslint-disable-next-line no-implicit-coercion
	const builder = (...arguments_) => applyStyle(builder, (arguments_.length === 1) ? ('' + arguments_[0]) : arguments_.join(' '));

	// We alter the prototype because we must return a function, but there is
	// no way to create a function with a different prototype
	Object.setPrototypeOf(builder, proto);

	builder[GENERATOR] = self;
	builder[STYLER] = _styler;
	builder[IS_EMPTY] = _isEmpty;

	return builder;
};

const applyStyle = (self, string) => {
	if (self.level <= 0 || !string) {
		return self[IS_EMPTY] ? '' : string;
	}

	let styler = self[STYLER];

	if (styler === undefined) {
		return string;
	}

	const {openAll, closeAll} = styler;
	if (string.includes('\u001B')) {
		while (styler !== undefined) {
			// Replace any instances already present with a re-opening code
			// otherwise only the part of the string until said closing code
			// will be colored, and the rest will simply be 'plain'.
			string = stringReplaceAll(string, styler.close, styler.open);

			styler = styler.parent;
		}
	}

	// We can move both next actions out of loop, because remaining actions in loop won't have
	// any/visible effect on parts we add here. Close the styling before a linebreak and reopen
	// after next line to fix a bleed issue on macOS: https://github.com/chalk/chalk/pull/92
	const lfIndex = string.indexOf('\n');
	if (lfIndex !== -1) {
		string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
	}

	return openAll + string + closeAll;
};

Object.defineProperties(createChalk.prototype, styles);

const chalk = createChalk();
createChalk({level: stderrColor ? stderrColor.level : 0});

class ArgsParser {
    args;
    index = 0;
    constructor(_args) {
        this.args = _args;
    }
    next() {
        if (this.index >= this.args.length)
            return false;
        return this.args[this.index++];
    }
    prev() {
        if (this.index - 1 < 0)
            return false;
        return this.args[--this.index];
    }
    peek() {
        if (this.index >= this.args.length)
            return false;
        return this.args[this.index];
    }
}

const border = (text, title = "") => {
    const lines = [];
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
            lineFactory = [];
            i--;
        }
    if (lineFactory.length > 0)
        lines.push(`│${lineFactory.join(" ")}${Array(width - 2 - lineFactory.join(" ").length).fill(" ").join("")}│`);
    lines.push(`╰${Array(width - 2).fill("─").join("")}╯`);
    return `\n${lines.join("\n")}\n`;
};
//│     │
//╰─────╯

const y = chalk.yellow, b = chalk.blue;
const documentation = {
    init: `${b("init")}`
        + `\n\n\tCreates new brifka repository in current working path.`,
    track: `${b("track <directory_path> | <file_path> | .")}`
        + `\n\n\tAdds files to the tracked stage.`
        + `\n\t${y("<directory_path>")} - all files and directories in that directory will be tracked.`
        + `\n\t${y("<file_path>")} - file will be tracked.`
        + `\n\t${y(".")} - all files besides excluded in '.brignore' will be tracked.`,
    untrack: `${b("untrack <directory_path> | <file_path> | .")}`
        + `\n\n\tRemoves files from tracked stage.`
        + `\n\t${y("<directory_path>")} - all files and directories in that directory will be untracked.`
        + `\n\t${y("<file_path>")} - file will be untracked.`
        + `\n\t${y(".")} - all files  will be untracked.`,
    commit: `${b("commit <commit_name>")}`
        + `\n\n\tAdds new commit to the repository.`
        + `\n\t${y("<commit_name>")} - name of new commit.`,
    uncommit: `${b("uncommit")}`
        + `\n\n\tRemoves last commit from the repository.`,
    commits: `${b("commits")}`
        + `\n${b("commits <limit>")}`
        + `\n\n\tDisplays commits.`
        + `\n\t${y("<limit>")} - displays only last x commits.`,
    push: `${b("push")}`
        + `\n\n\tSends repository to the ftp server specified in 'brifka.config.json'.`,
    pull: `${b("pull")}`
        + `\n\n\tDownloads repository from ftp server specified in 'brifka.config.json'.`
};
const help = (argsParser) => {
    if (!argsParser.peek()) {
        console.log(`\n${Object.values(documentation).join("\n\n")}\n`);
        return;
    }
    const command = argsParser.peek();
    if (Object.keys(documentation).find(key => key == command)?.length ?? 0 > 1)
        // @ts-ignore
        console.log(`\n${documentation[command]}\n`);
    else {
        console.error(chalk.red(`\nCommand '${command}' doesn't exist.`));
        console.log(border("Type 'brifka help' to view documentation of all commands.", "Help"));
    }
};

const writeFile = async (path, data = "") => {
    const normalized = nodePath.normalize(path), parsed = nodePath.parse(normalized), split = parsed.dir.split(nodePath.sep).filter(d => d.length > 0);
    path = nodePath.resolve(process.cwd(), normalized);
    for (let i = 0; i < split.length; i++)
        try {
            await fs.mkdir(nodePath.resolve(process.cwd(), ...split.slice(0, i + 1)));
        }
        catch { }
    await fs.writeFile(path, data);
};
const readFile = async (path) => {
    path = nodePath.resolve(process.cwd(), path);
    try {
        return await fs.readFile(path, { encoding: "utf8" });
    }
    catch {
        return false;
    }
};
const createDirectory = async (path) => {
    const normalized = nodePath.normalize(path), parsed = nodePath.parse(normalized), split = [...parsed.dir.split(nodePath.sep), parsed.name].filter(d => d.length > 0);
    for (let i = 0; i < split.length; i++)
        try {
            await fs.mkdir(nodePath.resolve(process.cwd(), ...split.slice(0, i + 1)));
        }
        catch { }
};

const init = (argsParser) => {
    const repo = "./.brifka";
    const join = (...paths) => nodePath.join(repo, ...paths);
    writeFile(join("mem/commits"));
    writeFile(join("mem/tracked"));
    createDirectory(join("rep"));
    writeFile("brifka.config.json", JSON.stringify({
        server: "",
        port: 21,
        login: "",
        password: ""
    }));
    writeFile(".brignore", "brifka.config.json");
};

const writeTracked = (paths) => {
    return paths.join(os.EOL);
};
const readTracked = (data) => {
    return data.split(os.EOL).filter(l => l.length > 0);
};

const mapDir = async (path) => {
    const files = await fs.readdir(path);
    const output = [];
    for (const file of files) {
        try {
            const scanPath = nodePath.resolve(path, file);
            const status = await fs.stat(scanPath);
            if (status.isDirectory())
                output.push(...await mapDir(scanPath));
            else if (status.isFile())
                output.push(nodePath.relative(process.cwd(), scanPath));
        }
        catch { }
    }
    return output;
};
const track = async (argsParser) => {
    const target = argsParser.next();
    if (!target) {
        console.error(chalk.red(`\nTrack command requires <directory_path> | <file_path> | . argument.\n`));
        return;
    }
    const trackedPath = nodePath.resolve(process.cwd(), ".brifka/mem/tracked");
    const path = nodePath.resolve(process.cwd(), target);
    let status;
    try {
        status = await fs.stat(path);
    }
    catch {
        console.error(chalk.red(`\nFile or directory '${target}' doesn't exist.\n`));
        return;
    }
    if (status.isDirectory()) {
        const paths = await mapDir(path);
        const data = await readFile(trackedPath);
        if (typeof data !== "string")
            throw new Error();
        const trackedFiles = readTracked(data);
        for (const newFile of paths) {
            let isRepeated = false;
            for (const trackedFile of trackedFiles)
                if (trackedFile == newFile) {
                    isRepeated = true;
                    break;
                }
            if (!isRepeated)
                trackedFiles.push(newFile);
        }
        await writeFile(trackedPath, writeTracked(trackedFiles));
    }
    else if (status.isFile()) {
        const data = await readFile(trackedPath);
        if (typeof data !== "string") {
            console.error(chalk.red(`\nRepository memory corrupted :/\n`));
            return;
        }
        const trackedFiles = readTracked(data);
        const newFile = nodePath.relative(process.cwd(), path);
        let isRepeated = false;
        for (const trackedFile of trackedFiles)
            if (trackedFile == newFile) {
                isRepeated = true;
                break;
            }
        if (!isRepeated)
            trackedFiles.push(newFile);
        else {
            console.error(chalk.red(`\nFile '${newFile}' is already tracked.\n`));
            return;
        }
        await writeFile(trackedPath, writeTracked(trackedFiles));
    }
};

const interpret = {
    help, init, track
};

const interpretCommands = (argsParser) => {
    const command = argsParser.next();
    switch (command) {
        case "help":
            interpret.help(argsParser);
            break;
        case "init":
            interpret.init(argsParser);
            break;
        case "track":
            interpret.track(argsParser);
            break;
        default:
            console.error(chalk.red(`\nCommand '${command}' doesn't exist.`));
            console.log(border("To get documentation of all commands type 'brifka help' or 'brifka help <command_name>' to get documentation of specific command.", "Help"));
            break;
    }
};

(async () => {
    const argsParser = new ArgsParser(process.argv.slice(2));
    const command = argsParser.peek();
    let isInited = false;
    try {
        const status = await fs.stat(nodePath.resolve(process.cwd(), ".brifka"));
        if (!status.isDirectory())
            throw new Error();
        isInited = true;
    }
    catch { }
    if (!isInited && (!command || command != "init" && command != "help")) {
        console.log(chalk.red("\nBrifka repository is not initialised."));
        console.log(border("Type 'brifka init' to initialise repository.", "Help"));
        return;
    }
    interpretCommands(argsParser);
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9jaGFsay9zb3VyY2UvdmVuZG9yL2Fuc2ktc3R5bGVzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2NoYWxrL3NvdXJjZS92ZW5kb3Ivc3VwcG9ydHMtY29sb3IvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvY2hhbGsvc291cmNlL3V0aWxpdGllcy5qcyIsIi4uL25vZGVfbW9kdWxlcy9jaGFsay9zb3VyY2UvaW5kZXguanMiLCIuLi9zcmMvYXJnc1BhcnNlci50cyIsIi4uL3NyYy9ib3JkZXIudHMiLCIuLi9zcmMvY29tbWFuZHMvaGVscC50cyIsIi4uL3NyYy9maWxlcy50cyIsIi4uL3NyYy9jb21tYW5kcy9pbml0LnRzIiwiLi4vc3JjL2NvbW1hbmRzL3BhcnNlcnMvdHJhY2tlZC50cyIsIi4uL3NyYy9jb21tYW5kcy90cmFjay50cyIsIi4uL3NyYy9jb21tYW5kcy9pbmRleC50cyIsIi4uL3NyYy9pbnRlcnByZXRDb21tYW5kcy50cyIsIi4uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBBTlNJX0JBQ0tHUk9VTkRfT0ZGU0VUID0gMTA7XG5cbmNvbnN0IHdyYXBBbnNpMTYgPSAob2Zmc2V0ID0gMCkgPT4gY29kZSA9PiBgXFx1MDAxQlske2NvZGUgKyBvZmZzZXR9bWA7XG5cbmNvbnN0IHdyYXBBbnNpMjU2ID0gKG9mZnNldCA9IDApID0+IGNvZGUgPT4gYFxcdTAwMUJbJHszOCArIG9mZnNldH07NTske2NvZGV9bWA7XG5cbmNvbnN0IHdyYXBBbnNpMTZtID0gKG9mZnNldCA9IDApID0+IChyZWQsIGdyZWVuLCBibHVlKSA9PiBgXFx1MDAxQlskezM4ICsgb2Zmc2V0fTsyOyR7cmVkfTske2dyZWVufTske2JsdWV9bWA7XG5cbmNvbnN0IHN0eWxlcyA9IHtcblx0bW9kaWZpZXI6IHtcblx0XHRyZXNldDogWzAsIDBdLFxuXHRcdC8vIDIxIGlzbid0IHdpZGVseSBzdXBwb3J0ZWQgYW5kIDIyIGRvZXMgdGhlIHNhbWUgdGhpbmdcblx0XHRib2xkOiBbMSwgMjJdLFxuXHRcdGRpbTogWzIsIDIyXSxcblx0XHRpdGFsaWM6IFszLCAyM10sXG5cdFx0dW5kZXJsaW5lOiBbNCwgMjRdLFxuXHRcdG92ZXJsaW5lOiBbNTMsIDU1XSxcblx0XHRpbnZlcnNlOiBbNywgMjddLFxuXHRcdGhpZGRlbjogWzgsIDI4XSxcblx0XHRzdHJpa2V0aHJvdWdoOiBbOSwgMjldLFxuXHR9LFxuXHRjb2xvcjoge1xuXHRcdGJsYWNrOiBbMzAsIDM5XSxcblx0XHRyZWQ6IFszMSwgMzldLFxuXHRcdGdyZWVuOiBbMzIsIDM5XSxcblx0XHR5ZWxsb3c6IFszMywgMzldLFxuXHRcdGJsdWU6IFszNCwgMzldLFxuXHRcdG1hZ2VudGE6IFszNSwgMzldLFxuXHRcdGN5YW46IFszNiwgMzldLFxuXHRcdHdoaXRlOiBbMzcsIDM5XSxcblxuXHRcdC8vIEJyaWdodCBjb2xvclxuXHRcdGJsYWNrQnJpZ2h0OiBbOTAsIDM5XSxcblx0XHRncmF5OiBbOTAsIDM5XSwgLy8gQWxpYXMgb2YgYGJsYWNrQnJpZ2h0YFxuXHRcdGdyZXk6IFs5MCwgMzldLCAvLyBBbGlhcyBvZiBgYmxhY2tCcmlnaHRgXG5cdFx0cmVkQnJpZ2h0OiBbOTEsIDM5XSxcblx0XHRncmVlbkJyaWdodDogWzkyLCAzOV0sXG5cdFx0eWVsbG93QnJpZ2h0OiBbOTMsIDM5XSxcblx0XHRibHVlQnJpZ2h0OiBbOTQsIDM5XSxcblx0XHRtYWdlbnRhQnJpZ2h0OiBbOTUsIDM5XSxcblx0XHRjeWFuQnJpZ2h0OiBbOTYsIDM5XSxcblx0XHR3aGl0ZUJyaWdodDogWzk3LCAzOV0sXG5cdH0sXG5cdGJnQ29sb3I6IHtcblx0XHRiZ0JsYWNrOiBbNDAsIDQ5XSxcblx0XHRiZ1JlZDogWzQxLCA0OV0sXG5cdFx0YmdHcmVlbjogWzQyLCA0OV0sXG5cdFx0YmdZZWxsb3c6IFs0MywgNDldLFxuXHRcdGJnQmx1ZTogWzQ0LCA0OV0sXG5cdFx0YmdNYWdlbnRhOiBbNDUsIDQ5XSxcblx0XHRiZ0N5YW46IFs0NiwgNDldLFxuXHRcdGJnV2hpdGU6IFs0NywgNDldLFxuXG5cdFx0Ly8gQnJpZ2h0IGNvbG9yXG5cdFx0YmdCbGFja0JyaWdodDogWzEwMCwgNDldLFxuXHRcdGJnR3JheTogWzEwMCwgNDldLCAvLyBBbGlhcyBvZiBgYmdCbGFja0JyaWdodGBcblx0XHRiZ0dyZXk6IFsxMDAsIDQ5XSwgLy8gQWxpYXMgb2YgYGJnQmxhY2tCcmlnaHRgXG5cdFx0YmdSZWRCcmlnaHQ6IFsxMDEsIDQ5XSxcblx0XHRiZ0dyZWVuQnJpZ2h0OiBbMTAyLCA0OV0sXG5cdFx0YmdZZWxsb3dCcmlnaHQ6IFsxMDMsIDQ5XSxcblx0XHRiZ0JsdWVCcmlnaHQ6IFsxMDQsIDQ5XSxcblx0XHRiZ01hZ2VudGFCcmlnaHQ6IFsxMDUsIDQ5XSxcblx0XHRiZ0N5YW5CcmlnaHQ6IFsxMDYsIDQ5XSxcblx0XHRiZ1doaXRlQnJpZ2h0OiBbMTA3LCA0OV0sXG5cdH0sXG59O1xuXG5leHBvcnQgY29uc3QgbW9kaWZpZXJOYW1lcyA9IE9iamVjdC5rZXlzKHN0eWxlcy5tb2RpZmllcik7XG5leHBvcnQgY29uc3QgZm9yZWdyb3VuZENvbG9yTmFtZXMgPSBPYmplY3Qua2V5cyhzdHlsZXMuY29sb3IpO1xuZXhwb3J0IGNvbnN0IGJhY2tncm91bmRDb2xvck5hbWVzID0gT2JqZWN0LmtleXMoc3R5bGVzLmJnQ29sb3IpO1xuZXhwb3J0IGNvbnN0IGNvbG9yTmFtZXMgPSBbLi4uZm9yZWdyb3VuZENvbG9yTmFtZXMsIC4uLmJhY2tncm91bmRDb2xvck5hbWVzXTtcblxuZnVuY3Rpb24gYXNzZW1ibGVTdHlsZXMoKSB7XG5cdGNvbnN0IGNvZGVzID0gbmV3IE1hcCgpO1xuXG5cdGZvciAoY29uc3QgW2dyb3VwTmFtZSwgZ3JvdXBdIG9mIE9iamVjdC5lbnRyaWVzKHN0eWxlcykpIHtcblx0XHRmb3IgKGNvbnN0IFtzdHlsZU5hbWUsIHN0eWxlXSBvZiBPYmplY3QuZW50cmllcyhncm91cCkpIHtcblx0XHRcdHN0eWxlc1tzdHlsZU5hbWVdID0ge1xuXHRcdFx0XHRvcGVuOiBgXFx1MDAxQlske3N0eWxlWzBdfW1gLFxuXHRcdFx0XHRjbG9zZTogYFxcdTAwMUJbJHtzdHlsZVsxXX1tYCxcblx0XHRcdH07XG5cblx0XHRcdGdyb3VwW3N0eWxlTmFtZV0gPSBzdHlsZXNbc3R5bGVOYW1lXTtcblxuXHRcdFx0Y29kZXMuc2V0KHN0eWxlWzBdLCBzdHlsZVsxXSk7XG5cdFx0fVxuXG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHN0eWxlcywgZ3JvdXBOYW1lLCB7XG5cdFx0XHR2YWx1ZTogZ3JvdXAsXG5cdFx0XHRlbnVtZXJhYmxlOiBmYWxzZSxcblx0XHR9KTtcblx0fVxuXG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzdHlsZXMsICdjb2RlcycsIHtcblx0XHR2YWx1ZTogY29kZXMsXG5cdFx0ZW51bWVyYWJsZTogZmFsc2UsXG5cdH0pO1xuXG5cdHN0eWxlcy5jb2xvci5jbG9zZSA9ICdcXHUwMDFCWzM5bSc7XG5cdHN0eWxlcy5iZ0NvbG9yLmNsb3NlID0gJ1xcdTAwMUJbNDltJztcblxuXHRzdHlsZXMuY29sb3IuYW5zaSA9IHdyYXBBbnNpMTYoKTtcblx0c3R5bGVzLmNvbG9yLmFuc2kyNTYgPSB3cmFwQW5zaTI1NigpO1xuXHRzdHlsZXMuY29sb3IuYW5zaTE2bSA9IHdyYXBBbnNpMTZtKCk7XG5cdHN0eWxlcy5iZ0NvbG9yLmFuc2kgPSB3cmFwQW5zaTE2KEFOU0lfQkFDS0dST1VORF9PRkZTRVQpO1xuXHRzdHlsZXMuYmdDb2xvci5hbnNpMjU2ID0gd3JhcEFuc2kyNTYoQU5TSV9CQUNLR1JPVU5EX09GRlNFVCk7XG5cdHN0eWxlcy5iZ0NvbG9yLmFuc2kxNm0gPSB3cmFwQW5zaTE2bShBTlNJX0JBQ0tHUk9VTkRfT0ZGU0VUKTtcblxuXHQvLyBGcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9RaXgtL2NvbG9yLWNvbnZlcnQvYmxvYi8zZjBlMGQ0ZTkyZTIzNTc5NmNjYjE3ZjZlODVjNzIwOTRhNjUxZjQ5L2NvbnZlcnNpb25zLmpzXG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHN0eWxlcywge1xuXHRcdHJnYlRvQW5zaTI1Njoge1xuXHRcdFx0dmFsdWUocmVkLCBncmVlbiwgYmx1ZSkge1xuXHRcdFx0XHQvLyBXZSB1c2UgdGhlIGV4dGVuZGVkIGdyZXlzY2FsZSBwYWxldHRlIGhlcmUsIHdpdGggdGhlIGV4Y2VwdGlvbiBvZlxuXHRcdFx0XHQvLyBibGFjayBhbmQgd2hpdGUuIG5vcm1hbCBwYWxldHRlIG9ubHkgaGFzIDQgZ3JleXNjYWxlIHNoYWRlcy5cblx0XHRcdFx0aWYgKHJlZCA9PT0gZ3JlZW4gJiYgZ3JlZW4gPT09IGJsdWUpIHtcblx0XHRcdFx0XHRpZiAocmVkIDwgOCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIDE2O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChyZWQgPiAyNDgpIHtcblx0XHRcdFx0XHRcdHJldHVybiAyMzE7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIE1hdGgucm91bmQoKChyZWQgLSA4KSAvIDI0NykgKiAyNCkgKyAyMzI7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gMTZcblx0XHRcdFx0XHQrICgzNiAqIE1hdGgucm91bmQocmVkIC8gMjU1ICogNSkpXG5cdFx0XHRcdFx0KyAoNiAqIE1hdGgucm91bmQoZ3JlZW4gLyAyNTUgKiA1KSlcblx0XHRcdFx0XHQrIE1hdGgucm91bmQoYmx1ZSAvIDI1NSAqIDUpO1xuXHRcdFx0fSxcblx0XHRcdGVudW1lcmFibGU6IGZhbHNlLFxuXHRcdH0sXG5cdFx0aGV4VG9SZ2I6IHtcblx0XHRcdHZhbHVlKGhleCkge1xuXHRcdFx0XHRjb25zdCBtYXRjaGVzID0gL1thLWZcXGRdezZ9fFthLWZcXGRdezN9L2kuZXhlYyhoZXgudG9TdHJpbmcoMTYpKTtcblx0XHRcdFx0aWYgKCFtYXRjaGVzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFswLCAwLCAwXTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxldCBbY29sb3JTdHJpbmddID0gbWF0Y2hlcztcblxuXHRcdFx0XHRpZiAoY29sb3JTdHJpbmcubGVuZ3RoID09PSAzKSB7XG5cdFx0XHRcdFx0Y29sb3JTdHJpbmcgPSBbLi4uY29sb3JTdHJpbmddLm1hcChjaGFyYWN0ZXIgPT4gY2hhcmFjdGVyICsgY2hhcmFjdGVyKS5qb2luKCcnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGludGVnZXIgPSBOdW1iZXIucGFyc2VJbnQoY29sb3JTdHJpbmcsIDE2KTtcblxuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdC8qIGVzbGludC1kaXNhYmxlIG5vLWJpdHdpc2UgKi9cblx0XHRcdFx0XHQoaW50ZWdlciA+PiAxNikgJiAweEZGLFxuXHRcdFx0XHRcdChpbnRlZ2VyID4+IDgpICYgMHhGRixcblx0XHRcdFx0XHRpbnRlZ2VyICYgMHhGRixcblx0XHRcdFx0XHQvKiBlc2xpbnQtZW5hYmxlIG5vLWJpdHdpc2UgKi9cblx0XHRcdFx0XTtcblx0XHRcdH0sXG5cdFx0XHRlbnVtZXJhYmxlOiBmYWxzZSxcblx0XHR9LFxuXHRcdGhleFRvQW5zaTI1Njoge1xuXHRcdFx0dmFsdWU6IGhleCA9PiBzdHlsZXMucmdiVG9BbnNpMjU2KC4uLnN0eWxlcy5oZXhUb1JnYihoZXgpKSxcblx0XHRcdGVudW1lcmFibGU6IGZhbHNlLFxuXHRcdH0sXG5cdFx0YW5zaTI1NlRvQW5zaToge1xuXHRcdFx0dmFsdWUoY29kZSkge1xuXHRcdFx0XHRpZiAoY29kZSA8IDgpIHtcblx0XHRcdFx0XHRyZXR1cm4gMzAgKyBjb2RlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGNvZGUgPCAxNikge1xuXHRcdFx0XHRcdHJldHVybiA5MCArIChjb2RlIC0gOCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgcmVkO1xuXHRcdFx0XHRsZXQgZ3JlZW47XG5cdFx0XHRcdGxldCBibHVlO1xuXG5cdFx0XHRcdGlmIChjb2RlID49IDIzMikge1xuXHRcdFx0XHRcdHJlZCA9ICgoKGNvZGUgLSAyMzIpICogMTApICsgOCkgLyAyNTU7XG5cdFx0XHRcdFx0Z3JlZW4gPSByZWQ7XG5cdFx0XHRcdFx0Ymx1ZSA9IHJlZDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb2RlIC09IDE2O1xuXG5cdFx0XHRcdFx0Y29uc3QgcmVtYWluZGVyID0gY29kZSAlIDM2O1xuXG5cdFx0XHRcdFx0cmVkID0gTWF0aC5mbG9vcihjb2RlIC8gMzYpIC8gNTtcblx0XHRcdFx0XHRncmVlbiA9IE1hdGguZmxvb3IocmVtYWluZGVyIC8gNikgLyA1O1xuXHRcdFx0XHRcdGJsdWUgPSAocmVtYWluZGVyICUgNikgLyA1O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgdmFsdWUgPSBNYXRoLm1heChyZWQsIGdyZWVuLCBibHVlKSAqIDI7XG5cblx0XHRcdFx0aWYgKHZhbHVlID09PSAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIDMwO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWJpdHdpc2Vcblx0XHRcdFx0bGV0IHJlc3VsdCA9IDMwICsgKChNYXRoLnJvdW5kKGJsdWUpIDw8IDIpIHwgKE1hdGgucm91bmQoZ3JlZW4pIDw8IDEpIHwgTWF0aC5yb3VuZChyZWQpKTtcblxuXHRcdFx0XHRpZiAodmFsdWUgPT09IDIpIHtcblx0XHRcdFx0XHRyZXN1bHQgKz0gNjA7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSxcblx0XHRcdGVudW1lcmFibGU6IGZhbHNlLFxuXHRcdH0sXG5cdFx0cmdiVG9BbnNpOiB7XG5cdFx0XHR2YWx1ZTogKHJlZCwgZ3JlZW4sIGJsdWUpID0+IHN0eWxlcy5hbnNpMjU2VG9BbnNpKHN0eWxlcy5yZ2JUb0Fuc2kyNTYocmVkLCBncmVlbiwgYmx1ZSkpLFxuXHRcdFx0ZW51bWVyYWJsZTogZmFsc2UsXG5cdFx0fSxcblx0XHRoZXhUb0Fuc2k6IHtcblx0XHRcdHZhbHVlOiBoZXggPT4gc3R5bGVzLmFuc2kyNTZUb0Fuc2koc3R5bGVzLmhleFRvQW5zaTI1NihoZXgpKSxcblx0XHRcdGVudW1lcmFibGU6IGZhbHNlLFxuXHRcdH0sXG5cdH0pO1xuXG5cdHJldHVybiBzdHlsZXM7XG59XG5cbmNvbnN0IGFuc2lTdHlsZXMgPSBhc3NlbWJsZVN0eWxlcygpO1xuXG5leHBvcnQgZGVmYXVsdCBhbnNpU3R5bGVzO1xuIiwiaW1wb3J0IHByb2Nlc3MgZnJvbSAnbm9kZTpwcm9jZXNzJztcbmltcG9ydCBvcyBmcm9tICdub2RlOm9zJztcbmltcG9ydCB0dHkgZnJvbSAnbm9kZTp0dHknO1xuXG4vLyBGcm9tOiBodHRwczovL2dpdGh1Yi5jb20vc2luZHJlc29yaHVzL2hhcy1mbGFnL2Jsb2IvbWFpbi9pbmRleC5qc1xuLy8vIGZ1bmN0aW9uIGhhc0ZsYWcoZmxhZywgYXJndiA9IGdsb2JhbFRoaXMuRGVubz8uYXJncyA/PyBwcm9jZXNzLmFyZ3YpIHtcbmZ1bmN0aW9uIGhhc0ZsYWcoZmxhZywgYXJndiA9IGdsb2JhbFRoaXMuRGVubyA/IGdsb2JhbFRoaXMuRGVuby5hcmdzIDogcHJvY2Vzcy5hcmd2KSB7XG5cdGNvbnN0IHByZWZpeCA9IGZsYWcuc3RhcnRzV2l0aCgnLScpID8gJycgOiAoZmxhZy5sZW5ndGggPT09IDEgPyAnLScgOiAnLS0nKTtcblx0Y29uc3QgcG9zaXRpb24gPSBhcmd2LmluZGV4T2YocHJlZml4ICsgZmxhZyk7XG5cdGNvbnN0IHRlcm1pbmF0b3JQb3NpdGlvbiA9IGFyZ3YuaW5kZXhPZignLS0nKTtcblx0cmV0dXJuIHBvc2l0aW9uICE9PSAtMSAmJiAodGVybWluYXRvclBvc2l0aW9uID09PSAtMSB8fCBwb3NpdGlvbiA8IHRlcm1pbmF0b3JQb3NpdGlvbik7XG59XG5cbmNvbnN0IHtlbnZ9ID0gcHJvY2VzcztcblxubGV0IGZsYWdGb3JjZUNvbG9yO1xuaWYgKFxuXHRoYXNGbGFnKCduby1jb2xvcicpXG5cdHx8IGhhc0ZsYWcoJ25vLWNvbG9ycycpXG5cdHx8IGhhc0ZsYWcoJ2NvbG9yPWZhbHNlJylcblx0fHwgaGFzRmxhZygnY29sb3I9bmV2ZXInKVxuKSB7XG5cdGZsYWdGb3JjZUNvbG9yID0gMDtcbn0gZWxzZSBpZiAoXG5cdGhhc0ZsYWcoJ2NvbG9yJylcblx0fHwgaGFzRmxhZygnY29sb3JzJylcblx0fHwgaGFzRmxhZygnY29sb3I9dHJ1ZScpXG5cdHx8IGhhc0ZsYWcoJ2NvbG9yPWFsd2F5cycpXG4pIHtcblx0ZmxhZ0ZvcmNlQ29sb3IgPSAxO1xufVxuXG5mdW5jdGlvbiBlbnZGb3JjZUNvbG9yKCkge1xuXHRpZiAoJ0ZPUkNFX0NPTE9SJyBpbiBlbnYpIHtcblx0XHRpZiAoZW52LkZPUkNFX0NPTE9SID09PSAndHJ1ZScpIHtcblx0XHRcdHJldHVybiAxO1xuXHRcdH1cblxuXHRcdGlmIChlbnYuRk9SQ0VfQ09MT1IgPT09ICdmYWxzZScpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdHJldHVybiBlbnYuRk9SQ0VfQ09MT1IubGVuZ3RoID09PSAwID8gMSA6IE1hdGgubWluKE51bWJlci5wYXJzZUludChlbnYuRk9SQ0VfQ09MT1IsIDEwKSwgMyk7XG5cdH1cbn1cblxuZnVuY3Rpb24gdHJhbnNsYXRlTGV2ZWwobGV2ZWwpIHtcblx0aWYgKGxldmVsID09PSAwKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRsZXZlbCxcblx0XHRoYXNCYXNpYzogdHJ1ZSxcblx0XHRoYXMyNTY6IGxldmVsID49IDIsXG5cdFx0aGFzMTZtOiBsZXZlbCA+PSAzLFxuXHR9O1xufVxuXG5mdW5jdGlvbiBfc3VwcG9ydHNDb2xvcihoYXZlU3RyZWFtLCB7c3RyZWFtSXNUVFksIHNuaWZmRmxhZ3MgPSB0cnVlfSA9IHt9KSB7XG5cdGNvbnN0IG5vRmxhZ0ZvcmNlQ29sb3IgPSBlbnZGb3JjZUNvbG9yKCk7XG5cdGlmIChub0ZsYWdGb3JjZUNvbG9yICE9PSB1bmRlZmluZWQpIHtcblx0XHRmbGFnRm9yY2VDb2xvciA9IG5vRmxhZ0ZvcmNlQ29sb3I7XG5cdH1cblxuXHRjb25zdCBmb3JjZUNvbG9yID0gc25pZmZGbGFncyA/IGZsYWdGb3JjZUNvbG9yIDogbm9GbGFnRm9yY2VDb2xvcjtcblxuXHRpZiAoZm9yY2VDb2xvciA9PT0gMCkge1xuXHRcdHJldHVybiAwO1xuXHR9XG5cblx0aWYgKHNuaWZmRmxhZ3MpIHtcblx0XHRpZiAoaGFzRmxhZygnY29sb3I9MTZtJylcblx0XHRcdHx8IGhhc0ZsYWcoJ2NvbG9yPWZ1bGwnKVxuXHRcdFx0fHwgaGFzRmxhZygnY29sb3I9dHJ1ZWNvbG9yJykpIHtcblx0XHRcdHJldHVybiAzO1xuXHRcdH1cblxuXHRcdGlmIChoYXNGbGFnKCdjb2xvcj0yNTYnKSkge1xuXHRcdFx0cmV0dXJuIDI7XG5cdFx0fVxuXHR9XG5cblx0Ly8gQ2hlY2sgZm9yIEF6dXJlIERldk9wcyBwaXBlbGluZXMuXG5cdC8vIEhhcyB0byBiZSBhYm92ZSB0aGUgYCFzdHJlYW1Jc1RUWWAgY2hlY2suXG5cdGlmICgnVEZfQlVJTEQnIGluIGVudiAmJiAnQUdFTlRfTkFNRScgaW4gZW52KSB7XG5cdFx0cmV0dXJuIDE7XG5cdH1cblxuXHRpZiAoaGF2ZVN0cmVhbSAmJiAhc3RyZWFtSXNUVFkgJiYgZm9yY2VDb2xvciA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRjb25zdCBtaW4gPSBmb3JjZUNvbG9yIHx8IDA7XG5cblx0aWYgKGVudi5URVJNID09PSAnZHVtYicpIHtcblx0XHRyZXR1cm4gbWluO1xuXHR9XG5cblx0aWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcblx0XHQvLyBXaW5kb3dzIDEwIGJ1aWxkIDEwNTg2IGlzIHRoZSBmaXJzdCBXaW5kb3dzIHJlbGVhc2UgdGhhdCBzdXBwb3J0cyAyNTYgY29sb3JzLlxuXHRcdC8vIFdpbmRvd3MgMTAgYnVpbGQgMTQ5MzEgaXMgdGhlIGZpcnN0IHJlbGVhc2UgdGhhdCBzdXBwb3J0cyAxNm0vVHJ1ZUNvbG9yLlxuXHRcdGNvbnN0IG9zUmVsZWFzZSA9IG9zLnJlbGVhc2UoKS5zcGxpdCgnLicpO1xuXHRcdGlmIChcblx0XHRcdE51bWJlcihvc1JlbGVhc2VbMF0pID49IDEwXG5cdFx0XHQmJiBOdW1iZXIob3NSZWxlYXNlWzJdKSA+PSAxMF81ODZcblx0XHQpIHtcblx0XHRcdHJldHVybiBOdW1iZXIob3NSZWxlYXNlWzJdKSA+PSAxNF85MzEgPyAzIDogMjtcblx0XHR9XG5cblx0XHRyZXR1cm4gMTtcblx0fVxuXG5cdGlmICgnQ0knIGluIGVudikge1xuXHRcdGlmICgnR0lUSFVCX0FDVElPTlMnIGluIGVudiB8fCAnR0lURUFfQUNUSU9OUycgaW4gZW52KSB7XG5cdFx0XHRyZXR1cm4gMztcblx0XHR9XG5cblx0XHRpZiAoWydUUkFWSVMnLCAnQ0lSQ0xFQ0knLCAnQVBQVkVZT1InLCAnR0lUTEFCX0NJJywgJ0JVSUxES0lURScsICdEUk9ORSddLnNvbWUoc2lnbiA9PiBzaWduIGluIGVudikgfHwgZW52LkNJX05BTUUgPT09ICdjb2Rlc2hpcCcpIHtcblx0XHRcdHJldHVybiAxO1xuXHRcdH1cblxuXHRcdHJldHVybiBtaW47XG5cdH1cblxuXHRpZiAoJ1RFQU1DSVRZX1ZFUlNJT04nIGluIGVudikge1xuXHRcdHJldHVybiAvXig5XFwuKDAqWzEtOV1cXGQqKVxcLnxcXGR7Mix9XFwuKS8udGVzdChlbnYuVEVBTUNJVFlfVkVSU0lPTikgPyAxIDogMDtcblx0fVxuXG5cdGlmIChlbnYuQ09MT1JURVJNID09PSAndHJ1ZWNvbG9yJykge1xuXHRcdHJldHVybiAzO1xuXHR9XG5cblx0aWYgKGVudi5URVJNID09PSAneHRlcm0ta2l0dHknKSB7XG5cdFx0cmV0dXJuIDM7XG5cdH1cblxuXHRpZiAoJ1RFUk1fUFJPR1JBTScgaW4gZW52KSB7XG5cdFx0Y29uc3QgdmVyc2lvbiA9IE51bWJlci5wYXJzZUludCgoZW52LlRFUk1fUFJPR1JBTV9WRVJTSU9OIHx8ICcnKS5zcGxpdCgnLicpWzBdLCAxMCk7XG5cblx0XHRzd2l0Y2ggKGVudi5URVJNX1BST0dSQU0pIHtcblx0XHRcdGNhc2UgJ2lUZXJtLmFwcCc6IHtcblx0XHRcdFx0cmV0dXJuIHZlcnNpb24gPj0gMyA/IDMgOiAyO1xuXHRcdFx0fVxuXG5cdFx0XHRjYXNlICdBcHBsZV9UZXJtaW5hbCc6IHtcblx0XHRcdFx0cmV0dXJuIDI7XG5cdFx0XHR9XG5cdFx0XHQvLyBObyBkZWZhdWx0XG5cdFx0fVxuXHR9XG5cblx0aWYgKC8tMjU2KGNvbG9yKT8kL2kudGVzdChlbnYuVEVSTSkpIHtcblx0XHRyZXR1cm4gMjtcblx0fVxuXG5cdGlmICgvXnNjcmVlbnxeeHRlcm18XnZ0MTAwfF52dDIyMHxecnh2dHxjb2xvcnxhbnNpfGN5Z3dpbnxsaW51eC9pLnRlc3QoZW52LlRFUk0pKSB7XG5cdFx0cmV0dXJuIDE7XG5cdH1cblxuXHRpZiAoJ0NPTE9SVEVSTScgaW4gZW52KSB7XG5cdFx0cmV0dXJuIDE7XG5cdH1cblxuXHRyZXR1cm4gbWluO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3VwcG9ydHNDb2xvcihzdHJlYW0sIG9wdGlvbnMgPSB7fSkge1xuXHRjb25zdCBsZXZlbCA9IF9zdXBwb3J0c0NvbG9yKHN0cmVhbSwge1xuXHRcdHN0cmVhbUlzVFRZOiBzdHJlYW0gJiYgc3RyZWFtLmlzVFRZLFxuXHRcdC4uLm9wdGlvbnMsXG5cdH0pO1xuXG5cdHJldHVybiB0cmFuc2xhdGVMZXZlbChsZXZlbCk7XG59XG5cbmNvbnN0IHN1cHBvcnRzQ29sb3IgPSB7XG5cdHN0ZG91dDogY3JlYXRlU3VwcG9ydHNDb2xvcih7aXNUVFk6IHR0eS5pc2F0dHkoMSl9KSxcblx0c3RkZXJyOiBjcmVhdGVTdXBwb3J0c0NvbG9yKHtpc1RUWTogdHR5LmlzYXR0eSgyKX0pLFxufTtcblxuZXhwb3J0IGRlZmF1bHQgc3VwcG9ydHNDb2xvcjtcbiIsIi8vIFRPRE86IFdoZW4gdGFyZ2V0aW5nIE5vZGUuanMgMTYsIHVzZSBgU3RyaW5nLnByb3RvdHlwZS5yZXBsYWNlQWxsYC5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpbmdSZXBsYWNlQWxsKHN0cmluZywgc3Vic3RyaW5nLCByZXBsYWNlcikge1xuXHRsZXQgaW5kZXggPSBzdHJpbmcuaW5kZXhPZihzdWJzdHJpbmcpO1xuXHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0cmV0dXJuIHN0cmluZztcblx0fVxuXG5cdGNvbnN0IHN1YnN0cmluZ0xlbmd0aCA9IHN1YnN0cmluZy5sZW5ndGg7XG5cdGxldCBlbmRJbmRleCA9IDA7XG5cdGxldCByZXR1cm5WYWx1ZSA9ICcnO1xuXHRkbyB7XG5cdFx0cmV0dXJuVmFsdWUgKz0gc3RyaW5nLnNsaWNlKGVuZEluZGV4LCBpbmRleCkgKyBzdWJzdHJpbmcgKyByZXBsYWNlcjtcblx0XHRlbmRJbmRleCA9IGluZGV4ICsgc3Vic3RyaW5nTGVuZ3RoO1xuXHRcdGluZGV4ID0gc3RyaW5nLmluZGV4T2Yoc3Vic3RyaW5nLCBlbmRJbmRleCk7XG5cdH0gd2hpbGUgKGluZGV4ICE9PSAtMSk7XG5cblx0cmV0dXJuVmFsdWUgKz0gc3RyaW5nLnNsaWNlKGVuZEluZGV4KTtcblx0cmV0dXJuIHJldHVyblZhbHVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RyaW5nRW5jYXNlQ1JMRldpdGhGaXJzdEluZGV4KHN0cmluZywgcHJlZml4LCBwb3N0Zml4LCBpbmRleCkge1xuXHRsZXQgZW5kSW5kZXggPSAwO1xuXHRsZXQgcmV0dXJuVmFsdWUgPSAnJztcblx0ZG8ge1xuXHRcdGNvbnN0IGdvdENSID0gc3RyaW5nW2luZGV4IC0gMV0gPT09ICdcXHInO1xuXHRcdHJldHVyblZhbHVlICs9IHN0cmluZy5zbGljZShlbmRJbmRleCwgKGdvdENSID8gaW5kZXggLSAxIDogaW5kZXgpKSArIHByZWZpeCArIChnb3RDUiA/ICdcXHJcXG4nIDogJ1xcbicpICsgcG9zdGZpeDtcblx0XHRlbmRJbmRleCA9IGluZGV4ICsgMTtcblx0XHRpbmRleCA9IHN0cmluZy5pbmRleE9mKCdcXG4nLCBlbmRJbmRleCk7XG5cdH0gd2hpbGUgKGluZGV4ICE9PSAtMSk7XG5cblx0cmV0dXJuVmFsdWUgKz0gc3RyaW5nLnNsaWNlKGVuZEluZGV4KTtcblx0cmV0dXJuIHJldHVyblZhbHVlO1xufVxuIiwiaW1wb3J0IGFuc2lTdHlsZXMgZnJvbSAnI2Fuc2ktc3R5bGVzJztcbmltcG9ydCBzdXBwb3J0c0NvbG9yIGZyb20gJyNzdXBwb3J0cy1jb2xvcic7XG5pbXBvcnQgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGltcG9ydC9vcmRlclxuXHRzdHJpbmdSZXBsYWNlQWxsLFxuXHRzdHJpbmdFbmNhc2VDUkxGV2l0aEZpcnN0SW5kZXgsXG59IGZyb20gJy4vdXRpbGl0aWVzLmpzJztcblxuY29uc3Qge3N0ZG91dDogc3Rkb3V0Q29sb3IsIHN0ZGVycjogc3RkZXJyQ29sb3J9ID0gc3VwcG9ydHNDb2xvcjtcblxuY29uc3QgR0VORVJBVE9SID0gU3ltYm9sKCdHRU5FUkFUT1InKTtcbmNvbnN0IFNUWUxFUiA9IFN5bWJvbCgnU1RZTEVSJyk7XG5jb25zdCBJU19FTVBUWSA9IFN5bWJvbCgnSVNfRU1QVFknKTtcblxuLy8gYHN1cHBvcnRzQ29sb3IubGV2ZWxgIOKGkiBgYW5zaVN0eWxlcy5jb2xvcltuYW1lXWAgbWFwcGluZ1xuY29uc3QgbGV2ZWxNYXBwaW5nID0gW1xuXHQnYW5zaScsXG5cdCdhbnNpJyxcblx0J2Fuc2kyNTYnLFxuXHQnYW5zaTE2bScsXG5dO1xuXG5jb25zdCBzdHlsZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG5jb25zdCBhcHBseU9wdGlvbnMgPSAob2JqZWN0LCBvcHRpb25zID0ge30pID0+IHtcblx0aWYgKG9wdGlvbnMubGV2ZWwgJiYgIShOdW1iZXIuaXNJbnRlZ2VyKG9wdGlvbnMubGV2ZWwpICYmIG9wdGlvbnMubGV2ZWwgPj0gMCAmJiBvcHRpb25zLmxldmVsIDw9IDMpKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdUaGUgYGxldmVsYCBvcHRpb24gc2hvdWxkIGJlIGFuIGludGVnZXIgZnJvbSAwIHRvIDMnKTtcblx0fVxuXG5cdC8vIERldGVjdCBsZXZlbCBpZiBub3Qgc2V0IG1hbnVhbGx5XG5cdGNvbnN0IGNvbG9yTGV2ZWwgPSBzdGRvdXRDb2xvciA/IHN0ZG91dENvbG9yLmxldmVsIDogMDtcblx0b2JqZWN0LmxldmVsID0gb3B0aW9ucy5sZXZlbCA9PT0gdW5kZWZpbmVkID8gY29sb3JMZXZlbCA6IG9wdGlvbnMubGV2ZWw7XG59O1xuXG5leHBvcnQgY2xhc3MgQ2hhbGsge1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnN0cnVjdG9yLXJldHVyblxuXHRcdHJldHVybiBjaGFsa0ZhY3Rvcnkob3B0aW9ucyk7XG5cdH1cbn1cblxuY29uc3QgY2hhbGtGYWN0b3J5ID0gb3B0aW9ucyA9PiB7XG5cdGNvbnN0IGNoYWxrID0gKC4uLnN0cmluZ3MpID0+IHN0cmluZ3Muam9pbignICcpO1xuXHRhcHBseU9wdGlvbnMoY2hhbGssIG9wdGlvbnMpO1xuXG5cdE9iamVjdC5zZXRQcm90b3R5cGVPZihjaGFsaywgY3JlYXRlQ2hhbGsucHJvdG90eXBlKTtcblxuXHRyZXR1cm4gY2hhbGs7XG59O1xuXG5mdW5jdGlvbiBjcmVhdGVDaGFsayhvcHRpb25zKSB7XG5cdHJldHVybiBjaGFsa0ZhY3Rvcnkob3B0aW9ucyk7XG59XG5cbk9iamVjdC5zZXRQcm90b3R5cGVPZihjcmVhdGVDaGFsay5wcm90b3R5cGUsIEZ1bmN0aW9uLnByb3RvdHlwZSk7XG5cbmZvciAoY29uc3QgW3N0eWxlTmFtZSwgc3R5bGVdIG9mIE9iamVjdC5lbnRyaWVzKGFuc2lTdHlsZXMpKSB7XG5cdHN0eWxlc1tzdHlsZU5hbWVdID0ge1xuXHRcdGdldCgpIHtcblx0XHRcdGNvbnN0IGJ1aWxkZXIgPSBjcmVhdGVCdWlsZGVyKHRoaXMsIGNyZWF0ZVN0eWxlcihzdHlsZS5vcGVuLCBzdHlsZS5jbG9zZSwgdGhpc1tTVFlMRVJdKSwgdGhpc1tJU19FTVBUWV0pO1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIHN0eWxlTmFtZSwge3ZhbHVlOiBidWlsZGVyfSk7XG5cdFx0XHRyZXR1cm4gYnVpbGRlcjtcblx0XHR9LFxuXHR9O1xufVxuXG5zdHlsZXMudmlzaWJsZSA9IHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBjcmVhdGVCdWlsZGVyKHRoaXMsIHRoaXNbU1RZTEVSXSwgdHJ1ZSk7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICd2aXNpYmxlJywge3ZhbHVlOiBidWlsZGVyfSk7XG5cdFx0cmV0dXJuIGJ1aWxkZXI7XG5cdH0sXG59O1xuXG5jb25zdCBnZXRNb2RlbEFuc2kgPSAobW9kZWwsIGxldmVsLCB0eXBlLCAuLi5hcmd1bWVudHNfKSA9PiB7XG5cdGlmIChtb2RlbCA9PT0gJ3JnYicpIHtcblx0XHRpZiAobGV2ZWwgPT09ICdhbnNpMTZtJykge1xuXHRcdFx0cmV0dXJuIGFuc2lTdHlsZXNbdHlwZV0uYW5zaTE2bSguLi5hcmd1bWVudHNfKTtcblx0XHR9XG5cblx0XHRpZiAobGV2ZWwgPT09ICdhbnNpMjU2Jykge1xuXHRcdFx0cmV0dXJuIGFuc2lTdHlsZXNbdHlwZV0uYW5zaTI1NihhbnNpU3R5bGVzLnJnYlRvQW5zaTI1NiguLi5hcmd1bWVudHNfKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFuc2lTdHlsZXNbdHlwZV0uYW5zaShhbnNpU3R5bGVzLnJnYlRvQW5zaSguLi5hcmd1bWVudHNfKSk7XG5cdH1cblxuXHRpZiAobW9kZWwgPT09ICdoZXgnKSB7XG5cdFx0cmV0dXJuIGdldE1vZGVsQW5zaSgncmdiJywgbGV2ZWwsIHR5cGUsIC4uLmFuc2lTdHlsZXMuaGV4VG9SZ2IoLi4uYXJndW1lbnRzXykpO1xuXHR9XG5cblx0cmV0dXJuIGFuc2lTdHlsZXNbdHlwZV1bbW9kZWxdKC4uLmFyZ3VtZW50c18pO1xufTtcblxuY29uc3QgdXNlZE1vZGVscyA9IFsncmdiJywgJ2hleCcsICdhbnNpMjU2J107XG5cbmZvciAoY29uc3QgbW9kZWwgb2YgdXNlZE1vZGVscykge1xuXHRzdHlsZXNbbW9kZWxdID0ge1xuXHRcdGdldCgpIHtcblx0XHRcdGNvbnN0IHtsZXZlbH0gPSB0aGlzO1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uICguLi5hcmd1bWVudHNfKSB7XG5cdFx0XHRcdGNvbnN0IHN0eWxlciA9IGNyZWF0ZVN0eWxlcihnZXRNb2RlbEFuc2kobW9kZWwsIGxldmVsTWFwcGluZ1tsZXZlbF0sICdjb2xvcicsIC4uLmFyZ3VtZW50c18pLCBhbnNpU3R5bGVzLmNvbG9yLmNsb3NlLCB0aGlzW1NUWUxFUl0pO1xuXHRcdFx0XHRyZXR1cm4gY3JlYXRlQnVpbGRlcih0aGlzLCBzdHlsZXIsIHRoaXNbSVNfRU1QVFldKTtcblx0XHRcdH07XG5cdFx0fSxcblx0fTtcblxuXHRjb25zdCBiZ01vZGVsID0gJ2JnJyArIG1vZGVsWzBdLnRvVXBwZXJDYXNlKCkgKyBtb2RlbC5zbGljZSgxKTtcblx0c3R5bGVzW2JnTW9kZWxdID0ge1xuXHRcdGdldCgpIHtcblx0XHRcdGNvbnN0IHtsZXZlbH0gPSB0aGlzO1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uICguLi5hcmd1bWVudHNfKSB7XG5cdFx0XHRcdGNvbnN0IHN0eWxlciA9IGNyZWF0ZVN0eWxlcihnZXRNb2RlbEFuc2kobW9kZWwsIGxldmVsTWFwcGluZ1tsZXZlbF0sICdiZ0NvbG9yJywgLi4uYXJndW1lbnRzXyksIGFuc2lTdHlsZXMuYmdDb2xvci5jbG9zZSwgdGhpc1tTVFlMRVJdKTtcblx0XHRcdFx0cmV0dXJuIGNyZWF0ZUJ1aWxkZXIodGhpcywgc3R5bGVyLCB0aGlzW0lTX0VNUFRZXSk7XG5cdFx0XHR9O1xuXHRcdH0sXG5cdH07XG59XG5cbmNvbnN0IHByb3RvID0gT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoKCkgPT4ge30sIHtcblx0Li4uc3R5bGVzLFxuXHRsZXZlbDoge1xuXHRcdGVudW1lcmFibGU6IHRydWUsXG5cdFx0Z2V0KCkge1xuXHRcdFx0cmV0dXJuIHRoaXNbR0VORVJBVE9SXS5sZXZlbDtcblx0XHR9LFxuXHRcdHNldChsZXZlbCkge1xuXHRcdFx0dGhpc1tHRU5FUkFUT1JdLmxldmVsID0gbGV2ZWw7XG5cdFx0fSxcblx0fSxcbn0pO1xuXG5jb25zdCBjcmVhdGVTdHlsZXIgPSAob3BlbiwgY2xvc2UsIHBhcmVudCkgPT4ge1xuXHRsZXQgb3BlbkFsbDtcblx0bGV0IGNsb3NlQWxsO1xuXHRpZiAocGFyZW50ID09PSB1bmRlZmluZWQpIHtcblx0XHRvcGVuQWxsID0gb3Blbjtcblx0XHRjbG9zZUFsbCA9IGNsb3NlO1xuXHR9IGVsc2Uge1xuXHRcdG9wZW5BbGwgPSBwYXJlbnQub3BlbkFsbCArIG9wZW47XG5cdFx0Y2xvc2VBbGwgPSBjbG9zZSArIHBhcmVudC5jbG9zZUFsbDtcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0b3Blbixcblx0XHRjbG9zZSxcblx0XHRvcGVuQWxsLFxuXHRcdGNsb3NlQWxsLFxuXHRcdHBhcmVudCxcblx0fTtcbn07XG5cbmNvbnN0IGNyZWF0ZUJ1aWxkZXIgPSAoc2VsZiwgX3N0eWxlciwgX2lzRW1wdHkpID0+IHtcblx0Ly8gU2luZ2xlIGFyZ3VtZW50IGlzIGhvdCBwYXRoLCBpbXBsaWNpdCBjb2VyY2lvbiBpcyBmYXN0ZXIgdGhhbiBhbnl0aGluZ1xuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8taW1wbGljaXQtY29lcmNpb25cblx0Y29uc3QgYnVpbGRlciA9ICguLi5hcmd1bWVudHNfKSA9PiBhcHBseVN0eWxlKGJ1aWxkZXIsIChhcmd1bWVudHNfLmxlbmd0aCA9PT0gMSkgPyAoJycgKyBhcmd1bWVudHNfWzBdKSA6IGFyZ3VtZW50c18uam9pbignICcpKTtcblxuXHQvLyBXZSBhbHRlciB0aGUgcHJvdG90eXBlIGJlY2F1c2Ugd2UgbXVzdCByZXR1cm4gYSBmdW5jdGlvbiwgYnV0IHRoZXJlIGlzXG5cdC8vIG5vIHdheSB0byBjcmVhdGUgYSBmdW5jdGlvbiB3aXRoIGEgZGlmZmVyZW50IHByb3RvdHlwZVxuXHRPYmplY3Quc2V0UHJvdG90eXBlT2YoYnVpbGRlciwgcHJvdG8pO1xuXG5cdGJ1aWxkZXJbR0VORVJBVE9SXSA9IHNlbGY7XG5cdGJ1aWxkZXJbU1RZTEVSXSA9IF9zdHlsZXI7XG5cdGJ1aWxkZXJbSVNfRU1QVFldID0gX2lzRW1wdHk7XG5cblx0cmV0dXJuIGJ1aWxkZXI7XG59O1xuXG5jb25zdCBhcHBseVN0eWxlID0gKHNlbGYsIHN0cmluZykgPT4ge1xuXHRpZiAoc2VsZi5sZXZlbCA8PSAwIHx8ICFzdHJpbmcpIHtcblx0XHRyZXR1cm4gc2VsZltJU19FTVBUWV0gPyAnJyA6IHN0cmluZztcblx0fVxuXG5cdGxldCBzdHlsZXIgPSBzZWxmW1NUWUxFUl07XG5cblx0aWYgKHN0eWxlciA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIHN0cmluZztcblx0fVxuXG5cdGNvbnN0IHtvcGVuQWxsLCBjbG9zZUFsbH0gPSBzdHlsZXI7XG5cdGlmIChzdHJpbmcuaW5jbHVkZXMoJ1xcdTAwMUInKSkge1xuXHRcdHdoaWxlIChzdHlsZXIgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Ly8gUmVwbGFjZSBhbnkgaW5zdGFuY2VzIGFscmVhZHkgcHJlc2VudCB3aXRoIGEgcmUtb3BlbmluZyBjb2RlXG5cdFx0XHQvLyBvdGhlcndpc2Ugb25seSB0aGUgcGFydCBvZiB0aGUgc3RyaW5nIHVudGlsIHNhaWQgY2xvc2luZyBjb2RlXG5cdFx0XHQvLyB3aWxsIGJlIGNvbG9yZWQsIGFuZCB0aGUgcmVzdCB3aWxsIHNpbXBseSBiZSAncGxhaW4nLlxuXHRcdFx0c3RyaW5nID0gc3RyaW5nUmVwbGFjZUFsbChzdHJpbmcsIHN0eWxlci5jbG9zZSwgc3R5bGVyLm9wZW4pO1xuXG5cdFx0XHRzdHlsZXIgPSBzdHlsZXIucGFyZW50O1xuXHRcdH1cblx0fVxuXG5cdC8vIFdlIGNhbiBtb3ZlIGJvdGggbmV4dCBhY3Rpb25zIG91dCBvZiBsb29wLCBiZWNhdXNlIHJlbWFpbmluZyBhY3Rpb25zIGluIGxvb3Agd29uJ3QgaGF2ZVxuXHQvLyBhbnkvdmlzaWJsZSBlZmZlY3Qgb24gcGFydHMgd2UgYWRkIGhlcmUuIENsb3NlIHRoZSBzdHlsaW5nIGJlZm9yZSBhIGxpbmVicmVhayBhbmQgcmVvcGVuXG5cdC8vIGFmdGVyIG5leHQgbGluZSB0byBmaXggYSBibGVlZCBpc3N1ZSBvbiBtYWNPUzogaHR0cHM6Ly9naXRodWIuY29tL2NoYWxrL2NoYWxrL3B1bGwvOTJcblx0Y29uc3QgbGZJbmRleCA9IHN0cmluZy5pbmRleE9mKCdcXG4nKTtcblx0aWYgKGxmSW5kZXggIT09IC0xKSB7XG5cdFx0c3RyaW5nID0gc3RyaW5nRW5jYXNlQ1JMRldpdGhGaXJzdEluZGV4KHN0cmluZywgY2xvc2VBbGwsIG9wZW5BbGwsIGxmSW5kZXgpO1xuXHR9XG5cblx0cmV0dXJuIG9wZW5BbGwgKyBzdHJpbmcgKyBjbG9zZUFsbDtcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKGNyZWF0ZUNoYWxrLnByb3RvdHlwZSwgc3R5bGVzKTtcblxuY29uc3QgY2hhbGsgPSBjcmVhdGVDaGFsaygpO1xuZXhwb3J0IGNvbnN0IGNoYWxrU3RkZXJyID0gY3JlYXRlQ2hhbGsoe2xldmVsOiBzdGRlcnJDb2xvciA/IHN0ZGVyckNvbG9yLmxldmVsIDogMH0pO1xuXG5leHBvcnQge1xuXHRtb2RpZmllck5hbWVzLFxuXHRmb3JlZ3JvdW5kQ29sb3JOYW1lcyxcblx0YmFja2dyb3VuZENvbG9yTmFtZXMsXG5cdGNvbG9yTmFtZXMsXG5cblx0Ly8gVE9ETzogUmVtb3ZlIHRoZXNlIGFsaWFzZXMgaW4gdGhlIG5leHQgbWFqb3IgdmVyc2lvblxuXHRtb2RpZmllck5hbWVzIGFzIG1vZGlmaWVycyxcblx0Zm9yZWdyb3VuZENvbG9yTmFtZXMgYXMgZm9yZWdyb3VuZENvbG9ycyxcblx0YmFja2dyb3VuZENvbG9yTmFtZXMgYXMgYmFja2dyb3VuZENvbG9ycyxcblx0Y29sb3JOYW1lcyBhcyBjb2xvcnMsXG59IGZyb20gJy4vdmVuZG9yL2Fuc2ktc3R5bGVzL2luZGV4LmpzJztcblxuZXhwb3J0IHtcblx0c3Rkb3V0Q29sb3IgYXMgc3VwcG9ydHNDb2xvcixcblx0c3RkZXJyQ29sb3IgYXMgc3VwcG9ydHNDb2xvclN0ZGVycixcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNoYWxrO1xuIiwiY2xhc3MgQXJnc1BhcnNlciB7XHJcbiAgICBwdWJsaWMgYXJnczogc3RyaW5nW107XHJcbiAgICBwcml2YXRlIGluZGV4OiBudW1iZXIgPSAwO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKF9hcmdzOiBzdHJpbmdbXSkge1xyXG4gICAgICAgIHRoaXMuYXJncyA9IF9hcmdzO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBuZXh0KCk6IHN0cmluZyB8IGZhbHNlIHtcclxuICAgICAgICBpZiAodGhpcy5pbmRleCA+PSB0aGlzLmFyZ3MubGVuZ3RoKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuYXJnc1t0aGlzLmluZGV4KytdO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBwcmV2KCk6IHN0cmluZyB8IGZhbHNlIHtcclxuICAgICAgICBpZiAodGhpcy5pbmRleCAtIDEgPCAwKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuYXJnc1stLXRoaXMuaW5kZXhdO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBwZWVrKCk6IHN0cmluZyB8IGZhbHNlIHtcclxuICAgICAgICBpZiAodGhpcy5pbmRleCA+PSB0aGlzLmFyZ3MubGVuZ3RoKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuYXJnc1t0aGlzLmluZGV4XTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgQXJnc1BhcnNlcjsiLCJjb25zdCBib3JkZXIgPSAodGV4dDogc3RyaW5nLCB0aXRsZTogc3RyaW5nID0gXCJcIik6IHN0cmluZyA9PiB7XHJcbiAgICBjb25zdCB7IGxlbmd0aCB9ID0gdGV4dDtcclxuICAgIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgY29uc3Qgd2lkdGggPSBNYXRoLm1pbihwcm9jZXNzLnN0ZG91dC5jb2x1bW5zLCA0NSk7XHJcbiAgICBjb25zdCB0ZXh0U3BsaXRlZCA9IHRleHQuc3BsaXQoXCIgXCIpO1xyXG5cclxuICAgIGxpbmVzLnB1c2goYOKVreKVtCR7dGl0bGV94pW2JHtBcnJheSh3aWR0aCAtIDUgLSB0aXRsZS5sZW5ndGgpLmZpbGwoXCLilIBcIikuam9pbihcIlwiKX3ilIDila5gKTtcclxuXHJcbiAgICBsZXQgbGluZUZhY3RvcnkgPSBbXTtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dFNwbGl0ZWQubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgaWYgKFsuLi5saW5lRmFjdG9yeSwgdGV4dFNwbGl0ZWRbaV1dLmpvaW4oXCIgXCIpLmxlbmd0aCA8IHdpZHRoIC0gMilcclxuICAgICAgICAgICAgbGluZUZhY3RvcnkucHVzaCh0ZXh0U3BsaXRlZFtpXSk7XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGpvaW5lZCA9IGxpbmVGYWN0b3J5LmpvaW4oXCIgXCIpO1xyXG4gICAgICAgICAgICBsaW5lcy5wdXNoKGDilIIke2pvaW5lZH0ke0FycmF5KHdpZHRoIC0gMiAtIGpvaW5lZC5sZW5ndGgpLmZpbGwoXCIgXCIpLmpvaW4oXCJcIil94pSCYCk7XHJcbiAgICAgICAgICAgIGxpbmVGYWN0b3J5ID0gW11cclxuICAgICAgICAgICAgaS0tO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICBpZiAobGluZUZhY3RvcnkubGVuZ3RoID4gMClcclxuICAgICAgICBsaW5lcy5wdXNoKGDilIIke2xpbmVGYWN0b3J5LmpvaW4oXCIgXCIpfSR7QXJyYXkod2lkdGggLSAyIC0gbGluZUZhY3Rvcnkuam9pbihcIiBcIikubGVuZ3RoKS5maWxsKFwiIFwiKS5qb2luKFwiXCIpfeKUgmApO1xyXG5cclxuICAgIGxpbmVzLnB1c2goYOKVsCR7QXJyYXkod2lkdGggLSAyKS5maWxsKFwi4pSAXCIpLmpvaW4oXCJcIil94pWvYCk7XHJcblxyXG4gICAgcmV0dXJuIGBcXG4ke2xpbmVzLmpvaW4oXCJcXG5cIil9XFxuYDtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgYm9yZGVyO1xyXG4vL+KUgiAgICAg4pSCXHJcbi8v4pWw4pSA4pSA4pSA4pSA4pSA4pWvIiwiaW1wb3J0IGNoYWxrIGZyb20gXCJjaGFsa1wiO1xyXG5pbXBvcnQgQXJnc1BhcnNlciBmcm9tIFwiLi4vYXJnc1BhcnNlclwiO1xyXG5pbXBvcnQgYm9yZGVyIGZyb20gXCIuLi9ib3JkZXJcIjtcclxuXHJcbmNvbnN0IHkgPSBjaGFsay55ZWxsb3csIGIgPSBjaGFsay5ibHVlO1xyXG5cclxuY29uc3QgZG9jdW1lbnRhdGlvbiA9IHtcclxuICAgIGluaXQ6IGAke2IoXCJpbml0XCIpfWBcclxuICAgICAgICArIGBcXG5cXG5cXHRDcmVhdGVzIG5ldyBicmlma2EgcmVwb3NpdG9yeSBpbiBjdXJyZW50IHdvcmtpbmcgcGF0aC5gLFxyXG4gICAgdHJhY2s6IGAke2IoXCJ0cmFjayA8ZGlyZWN0b3J5X3BhdGg+IHwgPGZpbGVfcGF0aD4gfCAuXCIpfWBcclxuICAgICAgICArIGBcXG5cXG5cXHRBZGRzIGZpbGVzIHRvIHRoZSB0cmFja2VkIHN0YWdlLmBcclxuICAgICAgICArIGBcXG5cXHQke3koXCI8ZGlyZWN0b3J5X3BhdGg+XCIpfSAtIGFsbCBmaWxlcyBhbmQgZGlyZWN0b3JpZXMgaW4gdGhhdCBkaXJlY3Rvcnkgd2lsbCBiZSB0cmFja2VkLmBcclxuICAgICAgICArIGBcXG5cXHQke3koXCI8ZmlsZV9wYXRoPlwiKX0gLSBmaWxlIHdpbGwgYmUgdHJhY2tlZC5gXHJcbiAgICAgICAgKyBgXFxuXFx0JHt5KFwiLlwiKX0gLSBhbGwgZmlsZXMgYmVzaWRlcyBleGNsdWRlZCBpbiAnLmJyaWdub3JlJyB3aWxsIGJlIHRyYWNrZWQuYCxcclxuICAgIHVudHJhY2s6IGAke2IoXCJ1bnRyYWNrIDxkaXJlY3RvcnlfcGF0aD4gfCA8ZmlsZV9wYXRoPiB8IC5cIil9YFxyXG4gICAgICAgICsgYFxcblxcblxcdFJlbW92ZXMgZmlsZXMgZnJvbSB0cmFja2VkIHN0YWdlLmBcclxuICAgICAgICArIGBcXG5cXHQke3koXCI8ZGlyZWN0b3J5X3BhdGg+XCIpfSAtIGFsbCBmaWxlcyBhbmQgZGlyZWN0b3JpZXMgaW4gdGhhdCBkaXJlY3Rvcnkgd2lsbCBiZSB1bnRyYWNrZWQuYFxyXG4gICAgICAgICsgYFxcblxcdCR7eShcIjxmaWxlX3BhdGg+XCIpfSAtIGZpbGUgd2lsbCBiZSB1bnRyYWNrZWQuYFxyXG4gICAgICAgICsgYFxcblxcdCR7eShcIi5cIil9IC0gYWxsIGZpbGVzICB3aWxsIGJlIHVudHJhY2tlZC5gLFxyXG4gICAgY29tbWl0OiBgJHtiKFwiY29tbWl0IDxjb21taXRfbmFtZT5cIil9YFxyXG4gICAgICAgICsgYFxcblxcblxcdEFkZHMgbmV3IGNvbW1pdCB0byB0aGUgcmVwb3NpdG9yeS5gXHJcbiAgICAgICAgKyBgXFxuXFx0JHt5KFwiPGNvbW1pdF9uYW1lPlwiKX0gLSBuYW1lIG9mIG5ldyBjb21taXQuYCxcclxuICAgIHVuY29tbWl0OiBgJHtiKFwidW5jb21taXRcIil9YFxyXG4gICAgICAgICsgYFxcblxcblxcdFJlbW92ZXMgbGFzdCBjb21taXQgZnJvbSB0aGUgcmVwb3NpdG9yeS5gLFxyXG4gICAgY29tbWl0czogYCR7YihcImNvbW1pdHNcIil9YFxyXG4gICAgICAgICsgYFxcbiR7YihcImNvbW1pdHMgPGxpbWl0PlwiKX1gXHJcbiAgICAgICAgKyBgXFxuXFxuXFx0RGlzcGxheXMgY29tbWl0cy5gXHJcbiAgICAgICAgKyBgXFxuXFx0JHt5KFwiPGxpbWl0PlwiKX0gLSBkaXNwbGF5cyBvbmx5IGxhc3QgeCBjb21taXRzLmAsXHJcbiAgICBwdXNoOiBgJHtiKFwicHVzaFwiKX1gXHJcbiAgICAgICAgKyBgXFxuXFxuXFx0U2VuZHMgcmVwb3NpdG9yeSB0byB0aGUgZnRwIHNlcnZlciBzcGVjaWZpZWQgaW4gJ2JyaWZrYS5jb25maWcuanNvbicuYCxcclxuICAgIHB1bGw6IGAke2IoXCJwdWxsXCIpfWBcclxuICAgICAgICArIGBcXG5cXG5cXHREb3dubG9hZHMgcmVwb3NpdG9yeSBmcm9tIGZ0cCBzZXJ2ZXIgc3BlY2lmaWVkIGluICdicmlma2EuY29uZmlnLmpzb24nLmBcclxufVxyXG5cclxuY29uc3QgaGVscCA9IChhcmdzUGFyc2VyOiBBcmdzUGFyc2VyKSA9PiB7XHJcbiAgICBpZiAoIWFyZ3NQYXJzZXIucGVlaygpKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFxcbiR7T2JqZWN0LnZhbHVlcyhkb2N1bWVudGF0aW9uKS5qb2luKFwiXFxuXFxuXCIpfVxcbmApO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb21tYW5kID0gYXJnc1BhcnNlci5wZWVrKCkgYXMgc3RyaW5nO1xyXG4gICAgaWYgKE9iamVjdC5rZXlzKGRvY3VtZW50YXRpb24pLmZpbmQoa2V5ID0+IGtleSA9PSBjb21tYW5kKT8ubGVuZ3RoID8/IDAgPiAxKVxyXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcclxuICAgICAgICBjb25zb2xlLmxvZyhgXFxuJHtkb2N1bWVudGF0aW9uW2NvbW1hbmRdfVxcbmApO1xyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihjaGFsay5yZWQoYFxcbkNvbW1hbmQgJyR7Y29tbWFuZH0nIGRvZXNuJ3QgZXhpc3QuYCkpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGJvcmRlcihcIlR5cGUgJ2JyaWZrYSBoZWxwJyB0byB2aWV3IGRvY3VtZW50YXRpb24gb2YgYWxsIGNvbW1hbmRzLlwiLCBcIkhlbHBcIikpO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBoZWxwOyIsImltcG9ydCBmcyBmcm9tIFwibm9kZTpmcy9wcm9taXNlc1wiO1xyXG5pbXBvcnQgbm9kZVBhdGggZnJvbSBcIm5vZGU6cGF0aFwiO1xyXG5cclxudHlwZSBGbGFncyA9IFwiclwiIHwgXCJyK1wiIHwgXCJycytcIiB8IFwid1wiIHwgXCJ3eFwiIHwgXCJ3K1wiIHwgXCJ3eCtcIiB8IFwiYVwiIHwgXCJheFwiIHwgXCJhK1wiIHwgXCJheCtcIjtcclxuXHJcbmNvbnN0IG9wZW5GaWxlID0gYXN5bmMgKHBhdGg6IHN0cmluZywgZmxhZ3M6IEZsYWdzKTogUHJvbWlzZTxmcy5GaWxlSGFuZGxlIHwgZmFsc2U+ID0+IHtcclxuICAgIHBhdGggPSBub2RlUGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIHBhdGgpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICByZXR1cm4gYXdhaXQgZnMub3BlbihwYXRoLCBmbGFncyk7XHJcbiAgICB9IGNhdGNoIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbn1cclxuXHJcbmNvbnN0IHdyaXRlRmlsZSA9IGFzeW5jIChwYXRoOiBzdHJpbmcsIGRhdGE6IHN0cmluZyA9IFwiXCIpID0+IHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub2RlUGF0aC5ub3JtYWxpemUocGF0aCksXHJcbiAgICAgICAgcGFyc2VkID0gbm9kZVBhdGgucGFyc2Uobm9ybWFsaXplZCksXHJcbiAgICAgICAgc3BsaXQgPSBwYXJzZWQuZGlyLnNwbGl0KG5vZGVQYXRoLnNlcCkuZmlsdGVyKGQgPT4gZC5sZW5ndGggPiAwKTtcclxuICAgIHBhdGggPSBub2RlUGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIG5vcm1hbGl6ZWQpO1xyXG5cclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3BsaXQubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgZnMubWtkaXIobm9kZVBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCAuLi5zcGxpdC5zbGljZSgwLCBpICsgMSkpKTtcclxuICAgICAgICB9IGNhdGNoIHsgfVxyXG5cclxuICAgIGF3YWl0IGZzLndyaXRlRmlsZShwYXRoLCBkYXRhKTtcclxufVxyXG5cclxuY29uc3QgcmVhZEZpbGUgPSBhc3luYyAocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBmYWxzZT4gPT4ge1xyXG4gICAgcGF0aCA9IG5vZGVQYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgcGF0aCk7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIHJldHVybiBhd2FpdCBmcy5yZWFkRmlsZShwYXRoLCB7IGVuY29kaW5nOiBcInV0ZjhcIiB9KVxyXG4gICAgfSBjYXRjaCB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG59XHJcblxyXG5jb25zdCBjcmVhdGVEaXJlY3RvcnkgPSBhc3luYyAocGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gbm9kZVBhdGgubm9ybWFsaXplKHBhdGgpLFxyXG4gICAgICAgIHBhcnNlZCA9IG5vZGVQYXRoLnBhcnNlKG5vcm1hbGl6ZWQpLFxyXG4gICAgICAgIHNwbGl0ID0gWy4uLnBhcnNlZC5kaXIuc3BsaXQobm9kZVBhdGguc2VwKSwgcGFyc2VkLm5hbWVdLmZpbHRlcihkID0+IGQubGVuZ3RoID4gMCk7XHJcblxyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcGxpdC5sZW5ndGg7IGkrKylcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBmcy5ta2Rpcihub2RlUGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIC4uLnNwbGl0LnNsaWNlKDAsIGkgKyAxKSkpO1xyXG4gICAgICAgIH0gY2F0Y2ggeyB9XHJcbn1cclxuXHJcbmV4cG9ydCB7IG9wZW5GaWxlLCB3cml0ZUZpbGUsIHJlYWRGaWxlLCBjcmVhdGVEaXJlY3RvcnkgfSIsImltcG9ydCBBcmdzUGFyc2VyIGZyb20gXCIuLi9hcmdzUGFyc2VyXCI7XHJcbmltcG9ydCB7IGNyZWF0ZURpcmVjdG9yeSwgd3JpdGVGaWxlIH0gZnJvbSBcIi4uL2ZpbGVzXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJub2RlOnBhdGhcIjtcclxuXHJcbmNvbnN0IGluaXQgPSAoYXJnc1BhcnNlcjogQXJnc1BhcnNlcikgPT4ge1xyXG4gICAgY29uc3QgcmVwbyA9IFwiLi8uYnJpZmthXCI7XHJcblxyXG4gICAgY29uc3Qgam9pbiA9ICguLi5wYXRoczogc3RyaW5nW10pID0+IHBhdGguam9pbihyZXBvLCAuLi5wYXRocyk7XHJcblxyXG4gICAgd3JpdGVGaWxlKGpvaW4oXCJtZW0vY29tbWl0c1wiKSk7XHJcbiAgICB3cml0ZUZpbGUoam9pbihcIm1lbS90cmFja2VkXCIpKTtcclxuXHJcbiAgICBjcmVhdGVEaXJlY3Rvcnkoam9pbihcInJlcFwiKSlcclxuXHJcbiAgICB3cml0ZUZpbGUoXCJicmlma2EuY29uZmlnLmpzb25cIiwgSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgIHNlcnZlcjogXCJcIixcclxuICAgICAgICBwb3J0OiAyMSxcclxuICAgICAgICBsb2dpbjogXCJcIixcclxuICAgICAgICBwYXNzd29yZDogXCJcIlxyXG4gICAgfSkpO1xyXG4gICAgd3JpdGVGaWxlKFwiLmJyaWdub3JlXCIsIFwiYnJpZmthLmNvbmZpZy5qc29uXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBpbml0OyIsImltcG9ydCBvcyBmcm9tIFwibm9kZTpvc1wiO1xyXG5cclxuY29uc3Qgd3JpdGVUcmFja2VkID0gKHBhdGhzOiBzdHJpbmdbXSk6IHN0cmluZyA9PiB7XHJcbiAgICByZXR1cm4gcGF0aHMuam9pbihvcy5FT0wpO1xyXG59XHJcblxyXG5jb25zdCByZWFkVHJhY2tlZCA9IChkYXRhOiBzdHJpbmcpOiBzdHJpbmdbXSA9PiB7XHJcbiAgICByZXR1cm4gZGF0YS5zcGxpdChvcy5FT0wpLmZpbHRlcihsID0+IGwubGVuZ3RoID4gMCk7XHJcbn1cclxuXHJcbmV4cG9ydCB7IHdyaXRlVHJhY2tlZCwgcmVhZFRyYWNrZWQgfTsiLCJpbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCI7XHJcbmltcG9ydCBBcmdzUGFyc2VyIGZyb20gXCIuLi9hcmdzUGFyc2VyXCI7XHJcbmltcG9ydCBub2RlUGF0aCBmcm9tIFwibm9kZTpwYXRoXCI7XHJcbmltcG9ydCBmcyBmcm9tIFwibm9kZTpmcy9wcm9taXNlc1wiO1xyXG5pbXBvcnQgeyByZWFkVHJhY2tlZCwgd3JpdGVUcmFja2VkIH0gZnJvbSBcIi4vcGFyc2Vyc1wiO1xyXG5pbXBvcnQgeyByZWFkRmlsZSwgd3JpdGVGaWxlIH0gZnJvbSBcIi4uL2ZpbGVzXCI7XHJcblxyXG5jb25zdCBtYXBEaXIgPSBhc3luYyAocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXT4gPT4ge1xyXG4gICAgY29uc3QgZmlsZXMgPSBhd2FpdCBmcy5yZWFkZGlyKHBhdGgpO1xyXG5cclxuICAgIGNvbnN0IG91dHB1dDogc3RyaW5nW10gPSBbXVxyXG5cclxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNjYW5QYXRoID0gbm9kZVBhdGgucmVzb2x2ZShwYXRoLCBmaWxlKVxyXG4gICAgICAgICAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBmcy5zdGF0KHNjYW5QYXRoKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChzdGF0dXMuaXNEaXJlY3RvcnkoKSkgb3V0cHV0LnB1c2goLi4uYXdhaXQgbWFwRGlyKHNjYW5QYXRoKSk7XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHN0YXR1cy5pc0ZpbGUoKSkgb3V0cHV0LnB1c2gobm9kZVBhdGgucmVsYXRpdmUocHJvY2Vzcy5jd2QoKSwgc2NhblBhdGgpKTtcclxuICAgICAgICB9IGNhdGNoIHsgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBvdXRwdXQ7XHJcbn1cclxuXHJcbmNvbnN0IHRyYWNrID0gYXN5bmMgKGFyZ3NQYXJzZXI6IEFyZ3NQYXJzZXIpID0+IHtcclxuICAgIGNvbnN0IHRhcmdldCA9IGFyZ3NQYXJzZXIubmV4dCgpO1xyXG5cclxuICAgIGlmICghdGFyZ2V0KSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihjaGFsay5yZWQoYFxcblRyYWNrIGNvbW1hbmQgcmVxdWlyZXMgPGRpcmVjdG9yeV9wYXRoPiB8IDxmaWxlX3BhdGg+IHwgLiBhcmd1bWVudC5cXG5gKSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHRyYWNrZWRQYXRoID0gbm9kZVBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcIi5icmlma2EvbWVtL3RyYWNrZWRcIik7XHJcbiAgICBjb25zdCBwYXRoID0gbm9kZVBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCB0YXJnZXQpO1xyXG4gICAgbGV0IHN0YXR1cztcclxuICAgIHRyeSB7XHJcbiAgICAgICAgc3RhdHVzID0gYXdhaXQgZnMuc3RhdChwYXRoKTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoY2hhbGsucmVkKGBcXG5GaWxlIG9yIGRpcmVjdG9yeSAnJHt0YXJnZXR9JyBkb2Vzbid0IGV4aXN0LlxcbmApKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHN0YXR1cy5pc0RpcmVjdG9yeSgpKSB7XHJcbiAgICAgICAgY29uc3QgcGF0aHM6IHN0cmluZ1tdID0gYXdhaXQgbWFwRGlyKHBhdGgpO1xyXG5cclxuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZEZpbGUodHJhY2tlZFBhdGgpO1xyXG4gICAgICAgIGlmICh0eXBlb2YgZGF0YSAhPT0gXCJzdHJpbmdcIikgdGhyb3cgbmV3IEVycm9yKCk7XHJcblxyXG4gICAgICAgIGNvbnN0IHRyYWNrZWRGaWxlcyA9IHJlYWRUcmFja2VkKGRhdGEpO1xyXG4gICAgICAgIGZvciAoY29uc3QgbmV3RmlsZSBvZiBwYXRocykge1xyXG4gICAgICAgICAgICBsZXQgaXNSZXBlYXRlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHRyYWNrZWRGaWxlIG9mIHRyYWNrZWRGaWxlcylcclxuICAgICAgICAgICAgICAgIGlmICh0cmFja2VkRmlsZSA9PSBuZXdGaWxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaXNSZXBlYXRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIWlzUmVwZWF0ZWQpIHRyYWNrZWRGaWxlcy5wdXNoKG5ld0ZpbGUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYXdhaXQgd3JpdGVGaWxlKHRyYWNrZWRQYXRoLCB3cml0ZVRyYWNrZWQodHJhY2tlZEZpbGVzKSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChzdGF0dXMuaXNGaWxlKCkpIHtcclxuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZEZpbGUodHJhY2tlZFBhdGgpO1xyXG4gICAgICAgIGlmICh0eXBlb2YgZGF0YSAhPT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGNoYWxrLnJlZChgXFxuUmVwb3NpdG9yeSBtZW1vcnkgY29ycnVwdGVkIDovXFxuYCkpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCB0cmFja2VkRmlsZXMgPSByZWFkVHJhY2tlZChkYXRhKTtcclxuICAgICAgICBjb25zdCBuZXdGaWxlID0gbm9kZVBhdGgucmVsYXRpdmUocHJvY2Vzcy5jd2QoKSwgcGF0aClcclxuXHJcbiAgICAgICAgbGV0IGlzUmVwZWF0ZWQgPSBmYWxzZTtcclxuICAgICAgICBmb3IgKGNvbnN0IHRyYWNrZWRGaWxlIG9mIHRyYWNrZWRGaWxlcylcclxuICAgICAgICAgICAgaWYgKHRyYWNrZWRGaWxlID09IG5ld0ZpbGUpIHtcclxuICAgICAgICAgICAgICAgIGlzUmVwZWF0ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCFpc1JlcGVhdGVkKSB0cmFja2VkRmlsZXMucHVzaChuZXdGaWxlKTtcclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihjaGFsay5yZWQoYFxcbkZpbGUgJyR7bmV3RmlsZX0nIGlzIGFscmVhZHkgdHJhY2tlZC5cXG5gKSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGF3YWl0IHdyaXRlRmlsZSh0cmFja2VkUGF0aCwgd3JpdGVUcmFja2VkKHRyYWNrZWRGaWxlcykpO1xyXG4gICAgfVxyXG5cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgdHJhY2s7IiwiaW1wb3J0IGhlbHAgZnJvbSBcIi4vaGVscFwiO1xyXG5pbXBvcnQgaW5pdCBmcm9tIFwiLi9pbml0XCI7XHJcbmltcG9ydCB0cmFjayBmcm9tIFwiLi90cmFja1wiO1xyXG5cclxuY29uc3QgaW50ZXJwcmV0ID0ge1xyXG4gICAgaGVscCwgaW5pdCwgdHJhY2tcclxufTtcclxuXHJcbmV4cG9ydCB7IGludGVycHJldCB9OyIsImltcG9ydCBBcmdzUGFyc2VyIGZyb20gXCIuL2FyZ3NQYXJzZXJcIjtcclxuaW1wb3J0IGJvcmRlciBmcm9tIFwiLi9ib3JkZXJcIjtcclxuaW1wb3J0IHsgaW50ZXJwcmV0IH0gZnJvbSBcIi4vY29tbWFuZHMvaW5kZXhcIjtcclxuaW1wb3J0IGNoYWxrIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuY29uc3QgaW50ZXJwcmV0Q29tbWFuZHMgPSAoYXJnc1BhcnNlcjogQXJnc1BhcnNlcikgPT4ge1xyXG4gICAgY29uc3QgY29tbWFuZCA9IGFyZ3NQYXJzZXIubmV4dCgpO1xyXG5cclxuICAgIHN3aXRjaCAoY29tbWFuZCkge1xyXG4gICAgICAgIGNhc2UgXCJoZWxwXCI6XHJcbiAgICAgICAgICAgIGludGVycHJldC5oZWxwKGFyZ3NQYXJzZXIpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIFwiaW5pdFwiOlxyXG4gICAgICAgICAgICBpbnRlcnByZXQuaW5pdChhcmdzUGFyc2VyKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBcInRyYWNrXCI6XHJcbiAgICAgICAgICAgIGludGVycHJldC50cmFjayhhcmdzUGFyc2VyKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihjaGFsay5yZWQoYFxcbkNvbW1hbmQgJyR7Y29tbWFuZH0nIGRvZXNuJ3QgZXhpc3QuYCkpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhib3JkZXIoXCJUbyBnZXQgZG9jdW1lbnRhdGlvbiBvZiBhbGwgY29tbWFuZHMgdHlwZSAnYnJpZmthIGhlbHAnIG9yICdicmlma2EgaGVscCA8Y29tbWFuZF9uYW1lPicgdG8gZ2V0IGRvY3VtZW50YXRpb24gb2Ygc3BlY2lmaWMgY29tbWFuZC5cIiwgXCJIZWxwXCIpKVxyXG4gICAgICAgICAgICBicmVhaztcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgaW50ZXJwcmV0Q29tbWFuZHM7IiwiaW1wb3J0IGNoYWxrIGZyb20gXCJjaGFsa1wiO1xyXG5pbXBvcnQgQXJnc1BhcnNlciBmcm9tIFwiLi9hcmdzUGFyc2VyXCI7XHJcbmltcG9ydCBpbnRlcnByZXRDb21tYW5kcyBmcm9tIFwiLi9pbnRlcnByZXRDb21tYW5kc1wiO1xyXG5pbXBvcnQgZnMgZnJvbSBcIm5vZGU6ZnMvcHJvbWlzZXNcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiO1xyXG5pbXBvcnQgYm9yZGVyIGZyb20gXCIuL2JvcmRlclwiO1xyXG5cclxuKGFzeW5jICgpID0+IHtcclxuICAgIGNvbnN0IGFyZ3NQYXJzZXIgPSBuZXcgQXJnc1BhcnNlcihwcm9jZXNzLmFyZ3Yuc2xpY2UoMikpO1xyXG4gICAgY29uc3QgY29tbWFuZCA9IGFyZ3NQYXJzZXIucGVlaygpO1xyXG5cclxuICAgIGxldCBpc0luaXRlZCA9IGZhbHNlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBmcy5zdGF0KHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcIi5icmlma2FcIikpXHJcbiAgICAgICAgaWYgKCFzdGF0dXMuaXNEaXJlY3RvcnkoKSkgdGhyb3cgbmV3IEVycm9yKCk7XHJcbiAgICAgICAgaXNJbml0ZWQgPSB0cnVlO1xyXG4gICAgfSBjYXRjaCB7IH1cclxuXHJcbiAgICBpZiAoIWlzSW5pdGVkICYmICghY29tbWFuZCB8fCBjb21tYW5kICE9IFwiaW5pdFwiICYmIGNvbW1hbmQgIT0gXCJoZWxwXCIpKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coY2hhbGsucmVkKFwiXFxuQnJpZmthIHJlcG9zaXRvcnkgaXMgbm90IGluaXRpYWxpc2VkLlwiKSk7XHJcbiAgICAgICAgY29uc29sZS5sb2coYm9yZGVyKFwiVHlwZSAnYnJpZmthIGluaXQnIHRvIGluaXRpYWxpc2UgcmVwb3NpdG9yeS5cIiwgXCJIZWxwXCIpKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaW50ZXJwcmV0Q29tbWFuZHMoYXJnc1BhcnNlcik7XHJcbn0pKClcclxuIl0sIm5hbWVzIjpbInN0eWxlcyIsInByb2Nlc3MiLCJwYXRoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBLE1BQU0sc0JBQXNCLEdBQUcsRUFBRSxDQUFDO0FBQ2xDO0FBQ0EsTUFBTSxVQUFVLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RFO0FBQ0EsTUFBTSxXQUFXLEdBQUcsQ0FBQyxNQUFN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QixFQUFFLE1BQU07QUFDUixFQUFFLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztBQUNsQyxFQUFFLFFBQVEsR0FBRyxLQUFLLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQztBQUNyQyxFQUFFO0FBQ0Y7QUFDQSxDQUFDLE9BQU87QUFDUixFQUFFLElBQUk7QUFDTixFQUFFLEtBQUs7QUFDUCxFQUFFLE9BQU87QUFDVCxFQUFFLFFBQVE7QUFDVixFQUFFLE1BQU07QUFDUixFQUFFLENBQUM7QUFDSCxDQUFDLENBQUM7QUFDRjtBQUNBLE1BQU0sYUFBYSxHQUFHLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxRQUFRLEtBQUs7QUFDbkQ7QUFDQTtBQUNBLENBQUMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxHQUFHLFVBQVUsS0FBSyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEtBQUssRUFBRSxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDakk7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztBQUN2QztBQUNBLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUMzQixDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxPQUFPLENBQUM7QUFDM0IsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEdBQUcsUUFBUSxDQUFDO0FBQzlCO0FBQ0EsQ0FBQyxPQUFPLE9BQU8sQ0FBQztBQUNoQixDQUFDLENBQUM7QUFDRjtBQUNBLE1BQU0sVUFBVSxHQUFHLENBQUMsSUFBSSxFQUFFLE1BQU0sS0FBSztBQUNyQyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDakMsRUFBRSxPQUFPLElBQUksQ0FBQyxRQUFRLENB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LENBQUM7QUFFcEMsSUFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUEsRUFBQSxFQUFLLEtBQUssQ0FBQSxDQUFBLEVBQUksS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUksRUFBQSxDQUFBLENBQUMsQ0FBQztJQUVqRixJQUFJLFdBQVcsR0FBRyxFQUFFLENBQUM7QUFDckIsSUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUU7QUFDdkMsUUFBQSxJQUFJLENBQUMsR0FBRyxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxLQUFLLEdBQUcsQ0FBQztZQUM3RCxXQUFXLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ2hDO1lBQ0QsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNyQyxZQUFBLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQSxDQUFBLEVBQUksTUFBTSxDQUFBLEVBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUcsQ0FBQSxDQUFBLENBQUMsQ0FBQztZQUNoRixXQUFXLEdBQUcsRUFBRSxDQUFBO0FBQ2hCLFlBQUEsQ0FBQyxFQUFFLENBQUM7U0FDUDtBQUVMLElBQUEsSUFBSSxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUM7QUFDdEIsUUFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUksQ0FBQSxFQUFBLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFD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
