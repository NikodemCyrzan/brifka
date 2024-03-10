'use strict';

var process$1 = require('node:process');
var os = require('node:os');
var tty = require('node:tty');
var fs = require('node:fs/promises');
var nodePath = require('node:path');

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

const y = chalk.yellow, b = chalk.blue;
const documentation = {
    init: `${b("init")}`
        + `\n\n\tCreates new brifka repository in current working path.`,
    track: `${b("track <directory_path> | <file_path> | .")}`
        + `\n\n\tAdds files to the tracked stage.`
        + `\n\t${y("<directory_path>")} - all files and directories in that directory will be tracked.`
        + `\n\t${y("<file_path>")} - file will be tracked.`
        + `\n\t${y(".")} - all files besides paths excluded in .brignore will be tracked.`,
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
    commits: `${b("commits empty | <limit>")}`
        + `\n\n\tDisplays commits.`
        + `\n\t${y("<limit>")} - displays only last x commits.`,
    push: `${b("push")}`
        + `\n\n\tSends repository to the ftp server.`,
    pull: `${b("pull")}`
        + `\n\n\tDownloads repository from ftp server.`
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
    writeFile(join("mem/traced"));
    createDirectory(join("rep"));
    writeFile("brifka.config.json", JSON.stringify({
        server: "",
        port: 21,
        login: "",
        password: ""
    }));
    writeFile(".brignore", "brifka.config.json");
};

const track = (argsParser) => {
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
            break;
        default:
            console.error(chalk.red(`\nCommand '${command}' doesn't exist.`));
            console.log(border("To get documentation of all commands type 'brifka help' or 'brifka help <command_name>' to get documentation of specific command.", "Help"));
            break;
    }
};

const argsParser = new ArgsParser(process.argv.slice(2));
interpretCommands(argsParser);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9hcmdzUGFyc2VyLnRzIiwiLi4vc3JjL2JvcmRlci50cyIsIi4uL25vZGVfbW9kdWxlcy9jaGFsay9zb3VyY2UvdmVuZG9yL2Fuc2ktc3R5bGVzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2NoYWxrL3NvdXJjZS92ZW5kb3Ivc3VwcG9ydHMtY29sb3IvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvY2hhbGsvc291cmNlL3V0aWxpdGllcy5qcyIsIi4uL25vZGVfbW9kdWxlcy9jaGFsay9zb3VyY2UvaW5kZXguanMiLCIuLi9zcmMvY29tbWFuZHMvaGVscC50cyIsIi4uL3NyYy9maWxlcy50cyIsIi4uL3NyYy9jb21tYW5kcy9pbml0LnRzIiwiLi4vc3JjL2NvbW1hbmRzL3RyYWNrLnRzIiwiLi4vc3JjL2NvbW1hbmRzL2luZGV4LnRzIiwiLi4vc3JjL2ludGVycHJldENvbW1hbmRzLnRzIiwiLi4vc3JjL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImNsYXNzIEFyZ3NQYXJzZXIge1xyXG4gICAgcHVibGljIGFyZ3M6IHN0cmluZ1tdO1xyXG4gICAgcHJpdmF0ZSBpbmRleDogbnVtYmVyID0gMDtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihfYXJnczogc3RyaW5nW10pIHtcclxuICAgICAgICB0aGlzLmFyZ3MgPSBfYXJncztcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgbmV4dCgpOiBzdHJpbmcgfCBmYWxzZSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaW5kZXggPj0gdGhpcy5hcmdzLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIHJldHVybiB0aGlzLmFyZ3NbdGhpcy5pbmRleCsrXTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgcHJldigpOiBzdHJpbmcgfCBmYWxzZSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaW5kZXggLSAxIDwgMCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIHJldHVybiB0aGlzLmFyZ3NbLS10aGlzLmluZGV4XTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgcGVlaygpOiBzdHJpbmcgfCBmYWxzZSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaW5kZXggPj0gdGhpcy5hcmdzLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIHJldHVybiB0aGlzLmFyZ3NbdGhpcy5pbmRleF07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IEFyZ3NQYXJzZXI7IiwiY29uc3QgYm9yZGVyID0gKHRleHQ6IHN0cmluZywgdGl0bGU6IHN0cmluZyA9IFwiXCIpOiBzdHJpbmcgPT4ge1xyXG4gICAgY29uc3QgeyBsZW5ndGggfSA9IHRleHQ7XHJcbiAgICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcclxuICAgIGNvbnN0IHdpZHRoID0gTWF0aC5taW4ocHJvY2Vzcy5zdGRvdXQuY29sdW1ucywgNDUpO1xyXG4gICAgY29uc3QgdGV4dFNwbGl0ZWQgPSB0ZXh0LnNwbGl0KFwiIFwiKTtcclxuXHJcbiAgICBsaW5lcy5wdXNoKGDila3ilbQke3RpdGxlfeKVtiR7QXJyYXkod2lkdGggLSA1IC0gdGl0bGUubGVuZ3RoKS5maWxsKFwi4pSAXCIpLmpvaW4oXCJcIil94pSA4pWuYCk7XHJcblxyXG4gICAgbGV0IGxpbmVGYWN0b3J5ID0gW107XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRleHRTcGxpdGVkLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGlmIChbLi4ubGluZUZhY3RvcnksIHRleHRTcGxpdGVkW2ldXS5qb2luKFwiIFwiKS5sZW5ndGggPCB3aWR0aCAtIDIpXHJcbiAgICAgICAgICAgIGxpbmVGYWN0b3J5LnB1c2godGV4dFNwbGl0ZWRbaV0pO1xyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCBqb2luZWQgPSBsaW5lRmFjdG9yeS5qb2luKFwiIFwiKTtcclxuICAgICAgICAgICAgbGluZXMucHVzaChg4pSCJHtqb2luZWR9JHtBcnJheSh3aWR0aCAtIDIgLSBqb2luZWQubGVuZ3RoKS5maWxsKFwiIFwiKS5qb2luKFwiXCIpfeKUgmApO1xyXG4gICAgICAgICAgICBsaW5lRmFjdG9yeSA9IFtdXHJcbiAgICAgICAgICAgIGktLTtcclxuICAgICAgICB9XHJcblxyXG4gICAgaWYgKGxpbmVGYWN0b3J5Lmxlbmd0aCA+IDApXHJcbiAgICAgICAgbGluZXMucHVzaChg4pSCJHtsaW5lRmFjdG9yeS5qb2luKFwiIFwiKX0ke0FycmF5KHdpZHRoIC0gMiAtIGxpbmVGYWN0b3J5LmpvaW4oXCIgXCIpLmxlbmd0aCkuZmlsbChcIiBcIikuam9pbihcIlwiKX3ilIJgKTtcclxuXHJcbiAgICBsaW5lcy5wdXNoKGDilbAke0FycmF5KHdpZHRoIC0gMikuZmlsbChcIuKUgFwiKS5qb2luKFwiXCIpfeKVr2ApO1xyXG5cclxuICAgIHJldHVybiBgXFxuJHtsaW5lcy5qb2luKFwiXFxuXCIpfVxcbmA7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGJvcmRlcjtcclxuLy/ilIIgICAgIOKUglxyXG4vL+KVsOKUgOKUgOKUgOKUgOKUgOKVryIsImNvbnN0IEFOU0lfQkFDS0dST1VORF9PRkZTRVQgPSAxMDtcblxuY29uc3Qgd3JhcEFuc2kxNiA9IChvZmZzZXQgPSAwKSA9PiBjb2RlID0+IGBcXHUwMDFCWyR7Y29kZSArIG9mZnNldH1tYDtcblxuY29uc3Qgd3JhcEFuc2kyNTYgPSAob2Zmc2V0ID0gMCkgPT4gY29kZSA9PiBgXFx1MDAxQlskezM4ICsgb2Zmc2V0fTs1OyR7Y29kZX1tYDtcblxuY29uc3Qgd3JhcEFuc2kxNm0gPSAob2Zmc2V0ID0gMCkgPT4gKHJlZCwgZ3JlZW4sIGJsdWUpID0+IGBcXHUwMDFCWyR7MzggKyBvZmZzZXR9OzI7JHtyZWR9OyR7Z3JlZW59OyR7Ymx1ZX1tYDtcblxuY29uc3Qgc3R5bGVzID0ge1xuXHRtb2RpZmllcjoge1xuXHRcdHJlc2V0OiBbMCwgMF0sXG5cdFx0Ly8gMjEgaXNuJ3Qgd2lkZWx5IHN1cHBvcnRlZCBhbmQgMjIgZG9lcyB0aGUgc2FtZSB0aGluZ1xuXHRcdGJvbGQ6IFsxLCAyMl0sXG5cdFx0ZGltOiBbMiwgMjJdLFxuXHRcdGl0YWxpYzogWzMsIDIzXSxcblx0XHR1bmRlcmxpbmU6IFs0LCAyNF0sXG5cdFx0b3ZlcmxpbmU6IFs1MywgNTVdLFxuXHRcdGludmVyc2U6IFs3LCAyN10sXG5cdFx0aGlkZGVuOiBbOCwgMjhdLFxuXHRcdHN0cmlrZXRocm91Z2g6IFs5LCAyOV0sXG5cdH0sXG5cdGNvbG9yOiB7XG5cdFx0YmxhY2s6IFszMCwgMzldLFxuXHRcdHJlZDogWzMxLCAzOV0sXG5cdFx0Z3JlZW46IFszMiwgMzldLFxuXHRcdHllbGxvdzogWzMzLCAzOV0sXG5cdFx0Ymx1ZTogWzM0LCAzOV0sXG5cdFx0bWFnZW50YTogWzM1LCAzOV0sXG5cdFx0Y3lhbjogWzM2LCAzOV0sXG5cdFx0d2hpdGU6IFszNywgMzldLFxuXG5cdFx0Ly8gQnJpZ2h0IGNvbG9yXG5cdFx0YmxhY2tCcmlnaHQ6IFs5MCwgMzldLFxuXHRcdGdyYXk6IFs5MCwgMzldLCAvLyBBbGlhcyBvZiBgYmxhY2tCcmlnaHRgXG5cdFx0Z3JleTogWzkwLCAzOV0sIC8vIEFsaWFzIG9mIGBibGFja0JyaWdodGBcblx0XHRyZWRCcmlnaHQ6IFs5MSwgMzldLFxuXHRcdGdyZWVuQnJpZ2h0OiBbOTIsIDM5XSxcblx0XHR5ZWxsb3dCcmlnaHQ6IFs5MywgMzldLFxuXHRcdGJsdWVCcmlnaHQ6IFs5NCwgMzldLFxuXHRcdG1hZ2VudGFCcmlnaHQ6IFs5NSwgMzldLFxuXHRcdGN5YW5CcmlnaHQ6IFs5NiwgMzldLFxuXHRcdHdoaXRlQnJpZ2h0OiBbOTcsIDM5XSxcblx0fSxcblx0YmdDb2xvcjoge1xuXHRcdGJnQmxhY2s6IFs0MCwgNDldLFxuXHRcdGJnUmVkOiBbNDEsIDQ5XSxcblx0XHRiZ0dyZWVuOiBbNDIsIDQ5XSxcblx0XHRiZ1llbGxvdzogWzQzLCA0OV0sXG5cdFx0YmdCbHVlOiBbNDQsIDQ5XSxcblx0XHRiZ01hZ2VudGE6IFs0NSwgNDldLFxuXHRcdGJnQ3lhbjogWzQ2LCA0OV0sXG5cdFx0YmdXaGl0ZTogWzQ3LCA0OV0sXG5cblx0XHQvLyBCcmlnaHQgY29sb3Jcblx0XHRiZ0JsYWNrQnJpZ2h0OiBbMTAwLCA0OV0sXG5cdFx0YmdHcmF5OiBbMTAwLCA0OV0sIC8vIEFsaWFzIG9mIGBiZ0JsYWNrQnJpZ2h0YFxuXHRcdGJnR3JleTogWzEwMCwgNDldLCAvLyBBbGlhcyBvZiBgYmdCbGFja0JyaWdodGBcblx0XHRiZ1JlZEJyaWdodDogWzEwMSwgNDldLFxuXHRcdGJnR3JlZW5CcmlnaHQ6IFsxMDIsIDQ5XSxcblx0XHRiZ1llbGxvd0JyaWdodDogWzEwMywgNDldLFxuXHRcdGJnQmx1ZUJyaWdodDogWzEwNCwgNDldLFxuXHRcdGJnTWFnZW50YUJyaWdodDogWzEwNSwgNDldLFxuXHRcdGJnQ3lhbkJyaWdodDogWzEwNiwgNDldLFxuXHRcdGJnV2hpdGVCcmlnaHQ6IFsxMDcsIDQ5XSxcblx0fSxcbn07XG5cbmV4cG9ydCBjb25zdCBtb2RpZmllck5hbWVzID0gT2JqZWN0LmtleXMoc3R5bGVzLm1vZGlmaWVyKTtcbmV4cG9ydCBjb25zdCBmb3JlZ3JvdW5kQ29sb3JOYW1lcyA9IE9iamVjdC5rZXlzKHN0eWxlcy5jb2xvcik7XG5leHBvcnQgY29uc3QgYmFja2dyb3VuZENvbG9yTmFtZXMgPSBPYmplY3Qua2V5cyhzdHlsZXMuYmdDb2xvcik7XG5leHBvcnQgY29uc3QgY29sb3JOYW1lcyA9IFsuLi5mb3JlZ3JvdW5kQ29sb3JOYW1lcywgLi4uYmFja2dyb3VuZENvbG9yTmFtZXNdO1xuXG5mdW5jdGlvbiBhc3NlbWJsZVN0eWxlcygpIHtcblx0Y29uc3QgY29kZXMgPSBuZXcgTWFwKCk7XG5cblx0Zm9yIChjb25zdCBbZ3JvdXBOYW1lLCBncm91cF0gb2YgT2JqZWN0LmVudHJpZXMoc3R5bGVzKSkge1xuXHRcdGZvciAoY29uc3QgW3N0eWxlTmFtZSwgc3R5bGVdIG9mIE9iamVjdC5lbnRyaWVzKGdyb3VwKSkge1xuXHRcdFx0c3R5bGVzW3N0eWxlTmFtZV0gPSB7XG5cdFx0XHRcdG9wZW46IGBcXHUwMDFCWyR7c3R5bGVbMF19bWAsXG5cdFx0XHRcdGNsb3NlOiBgXFx1MDAxQlske3N0eWxlWzFdfW1gLFxuXHRcdFx0fTtcblxuXHRcdFx0Z3JvdXBbc3R5bGVOYW1lXSA9IHN0eWxlc1tzdHlsZU5hbWVdO1xuXG5cdFx0XHRjb2Rlcy5zZXQoc3R5bGVbMF0sIHN0eWxlWzFdKTtcblx0XHR9XG5cblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoc3R5bGVzLCBncm91cE5hbWUsIHtcblx0XHRcdHZhbHVlOiBncm91cCxcblx0XHRcdGVudW1lcmFibGU6IGZhbHNlLFxuXHRcdH0pO1xuXHR9XG5cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHN0eWxlcywgJ2NvZGVzJywge1xuXHRcdHZhbHVlOiBjb2Rlcyxcblx0XHRlbnVtZXJhYmxlOiBmYWxzZSxcblx0fSk7XG5cblx0c3R5bGVzLmNvbG9yLmNsb3NlID0gJ1xcdTAwMUJbMzltJztcblx0c3R5bGVzLmJnQ29sb3IuY2xvc2UgPSAnXFx1MDAxQls0OW0nO1xuXG5cdHN0eWxlcy5jb2xvci5hbnNpID0gd3JhcEFuc2kxNigpO1xuXHRzdHlsZXMuY29sb3IuYW5zaTI1NiA9IHdyYXBBbnNpMjU2KCk7XG5cdHN0eWxlcy5jb2xvci5hbnNpMTZtID0gd3JhcEFuc2kxNm0oKTtcblx0c3R5bGVzLmJnQ29sb3IuYW5zaSA9IHdyYXBBbnNpMTYoQU5TSV9CQUNLR1JPVU5EX09GRlNFVCk7XG5cdHN0eWxlcy5iZ0NvbG9yLmFuc2kyNTYgPSB3cmFwQW5zaTI1NihBTlNJX0JBQ0tHUk9VTkRfT0ZGU0VUKTtcblx0c3R5bGVzLmJnQ29sb3IuYW5zaTE2bSA9IHdyYXBBbnNpMTZtKEFOU0lfQkFDS0dST1VORF9PRkZTRVQpO1xuXG5cdC8vIEZyb20gaHR0cHM6Ly9naXRodWIuY29tL1FpeC0vY29sb3ItY29udmVydC9ibG9iLzNmMGUwZDRlOTJlMjM1Nzk2Y2NiMTdmNmU4NWM3MjA5NGE2NTFmNDkvY29udmVyc2lvbnMuanNcblx0T2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc3R5bGVzLCB7XG5cdFx0cmdiVG9BbnNpMjU2OiB7XG5cdFx0XHR2YWx1ZShyZWQsIGdyZWVuLCBibHVlKSB7XG5cdFx0XHRcdC8vIFdlIHVzZSB0aGUgZXh0ZW5kZWQgZ3JleXNjYWxlIHBhbGV0dGUgaGVyZSwgd2l0aCB0aGUgZXhjZXB0aW9uIG9mXG5cdFx0XHRcdC8vIGJsYWNrIGFuZCB3aGl0ZS4gbm9ybWFsIHBhbGV0dGUgb25seSBoYXMgNCBncmV5c2NhbGUgc2hhZGVzLlxuXHRcdFx0XHRpZiAocmVkID09PSBncmVlbiAmJiBncmVlbiA9PT0gYmx1ZSkge1xuXHRcdFx0XHRcdGlmIChyZWQgPCA4KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gMTY7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHJlZCA+IDI0OCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIDIzMTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gTWF0aC5yb3VuZCgoKHJlZCAtIDgpIC8gMjQ3KSAqIDI0KSArIDIzMjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiAxNlxuXHRcdFx0XHRcdCsgKDM2ICogTWF0aC5yb3VuZChyZWQgLyAyNTUgKiA1KSlcblx0XHRcdFx0XHQrICg2ICogTWF0aC5yb3VuZChncmVlbiAvIDI1NSAqIDUpKVxuXHRcdFx0XHRcdCsgTWF0aC5yb3VuZChibHVlIC8gMjU1ICogNSk7XG5cdFx0XHR9LFxuXHRcdFx0ZW51bWVyYWJsZTogZmFsc2UsXG5cdFx0fSxcblx0XHRoZXhUb1JnYjoge1xuXHRcdFx0dmFsdWUoaGV4KSB7XG5cdFx0XHRcdGNvbnN0IG1hdGNoZXMgPSAvW2EtZlxcZF17Nn18W2EtZlxcZF17M30vaS5leGVjKGhleC50b1N0cmluZygxNikpO1xuXHRcdFx0XHRpZiAoIW1hdGNoZXMpIHtcblx0XHRcdFx0XHRyZXR1cm4gWzAsIDAsIDBdO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IFtjb2xvclN0cmluZ10gPSBtYXRjaGVzO1xuXG5cdFx0XHRcdGlmIChjb2xvclN0cmluZy5sZW5ndGggPT09IDMpIHtcblx0XHRcdFx0XHRjb2xvclN0cmluZyA9IFsuLi5jb2xvclN0cmluZ10ubWFwKGNoYXJhY3RlciA9PiBjaGFyYWN0ZXIgKyBjaGFyYWN0ZXIpLmpvaW4oJycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgaW50ZWdlciA9IE51bWJlci5wYXJzZUludChjb2xvclN0cmluZywgMTYpO1xuXG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0LyogZXNsaW50LWRpc2FibGUgbm8tYml0d2lzZSAqL1xuXHRcdFx0XHRcdChpbnRlZ2VyID4+IDE2KSAmIDB4RkYsXG5cdFx0XHRcdFx0KGludGVnZXIgPj4gOCkgJiAweEZGLFxuXHRcdFx0XHRcdGludGVnZXIgJiAweEZGLFxuXHRcdFx0XHRcdC8qIGVzbGludC1lbmFibGUgbm8tYml0d2lzZSAqL1xuXHRcdFx0XHRdO1xuXHRcdFx0fSxcblx0XHRcdGVudW1lcmFibGU6IGZhbHNlLFxuXHRcdH0sXG5cdFx0aGV4VG9BbnNpMjU2OiB7XG5cdFx0XHR2YWx1ZTogaGV4ID0+IHN0eWxlcy5yZ2JUb0Fuc2kyNTYoLi4uc3R5bGVzLmhleFRvUmdiKGhleCkpLFxuXHRcdFx0ZW51bWVyYWJsZTogZmFsc2UsXG5cdFx0fSxcblx0XHRhbnNpMjU2VG9BbnNpOiB7XG5cdFx0XHR2YWx1ZShjb2RlKSB7XG5cdFx0XHRcdGlmIChjb2RlIDwgOCkge1xuXHRcdFx0XHRcdHJldHVybiAzMCArIGNvZGU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY29kZSA8IDE2KSB7XG5cdFx0XHRcdFx0cmV0dXJuIDkwICsgKGNvZGUgLSA4KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxldCByZWQ7XG5cdFx0XHRcdGxldCBncmVlbjtcblx0XHRcdFx0bGV0IGJsdWU7XG5cblx0XHRcdFx0aWYgKGNvZGUgPj0gMjMyKSB7XG5cdFx0XHRcdFx0cmVkID0gKCgoY29kZSAtIDIzMikgKiAxMCkgKyA4KSAvIDI1NTtcblx0XHRcdFx0XHRncmVlbiA9IHJlZDtcblx0XHRcdFx0XHRibHVlID0gcmVkO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvZGUgLT0gMTY7XG5cblx0XHRcdFx0XHRjb25zdCByZW1haW5kZXIgPSBjb2RlICUgMzY7XG5cblx0XHRcdFx0XHRyZWQgPSBNYXRoLmZsb29yKGNvZGUgLyAzNikgLyA1O1xuXHRcdFx0XHRcdGdyZWVuID0gTWF0aC5mbG9vcihyZW1haW5kZXIgLyA2KSAvIDU7XG5cdFx0XHRcdFx0Ymx1ZSA9IChyZW1haW5kZXIgJSA2KSAvIDU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IE1hdGgubWF4KHJlZCwgZ3JlZW4sIGJsdWUpICogMjtcblxuXHRcdFx0XHRpZiAodmFsdWUgPT09IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gMzA7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tYml0d2lzZVxuXHRcdFx0XHRsZXQgcmVzdWx0ID0gMzAgKyAoKE1hdGgucm91bmQoYmx1ZSkgPDwgMikgfCAoTWF0aC5yb3VuZChncmVlbikgPDwgMSkgfCBNYXRoLnJvdW5kKHJlZCkpO1xuXG5cdFx0XHRcdGlmICh2YWx1ZSA9PT0gMikge1xuXHRcdFx0XHRcdHJlc3VsdCArPSA2MDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9LFxuXHRcdFx0ZW51bWVyYWJsZTogZmFsc2UsXG5cdFx0fSxcblx0XHRyZ2JUb0Fuc2k6IHtcblx0XHRcdHZhbHVlOiAocmVkLCBncmVlbiwgYmx1ZSkgPT4gc3R5bGVzLmFuc2kyNTZUb0Fuc2koc3R5bGVzLnJnYlRvQW5zaTI1NihyZWQsIGdyZWVuLCBibHVlKSksXG5cdFx0XHRlbnVtZXJhYmxlOiBmYWxzZSxcblx0XHR9LFxuXHRcdGhleFRvQW5zaToge1xuXHRcdFx0dmFsdWU6IGhleCA9PiBzdHlsZXMuYW5zaTI1NlRvQW5zaShzdHlsZXMuaGV4VG9BbnNpMjU2KGhleCkpLFxuXHRcdFx0ZW51bWVyYWJsZTogZmFsc2UsXG5cdFx0fSxcblx0fSk7XG5cblx0cmV0dXJuIHN0eWxlcztcbn1cblxuY29uc3QgYW5zaVN0eWxlcyA9IGFzc2VtYmxlU3R5bGVzKCk7XG5cbmV4cG9ydCBkZWZhdWx0IGFuc2lTdHlsZXM7XG4iLCJpbXBvcnQgcHJvY2VzcyBmcm9tICdub2RlOnByb2Nlc3MnO1xuaW1wb3J0IG9zIGZyb20gJ25vZGU6b3MnO1xuaW1wb3J0IHR0eSBmcm9tICdub2RlOnR0eSc7XG5cbi8vIEZyb206IGh0dHBzOi8vZ2l0aHViLmNvbS9zaW5kcmVzb3JodXMvaGFzLWZsYWcvYmxvYi9tYWluL2luZGV4LmpzXG4vLy8gZnVuY3Rpb24gaGFzRmxhZyhmbGFnLCBhcmd2ID0gZ2xvYmFsVGhpcy5EZW5vPy5hcmdzID8/IHByb2Nlc3MuYXJndikge1xuZnVuY3Rpb24gaGFzRmxhZyhmbGFnLCBhcmd2ID0gZ2xvYmFsVGhpcy5EZW5vID8gZ2xvYmFsVGhpcy5EZW5vLmFyZ3MgOiBwcm9jZXNzLmFyZ3YpIHtcblx0Y29uc3QgcHJlZml4ID0gZmxhZy5zdGFydHNXaXRoKCctJykgPyAnJyA6IChmbGFnLmxlbmd0aCA9PT0gMSA/ICctJyA6ICctLScpO1xuXHRjb25zdCBwb3NpdGlvbiA9IGFyZ3YuaW5kZXhPZihwcmVmaXggKyBmbGFnKTtcblx0Y29uc3QgdGVybWluYXRvclBvc2l0aW9uID0gYXJndi5pbmRleE9mKCctLScpO1xuXHRyZXR1cm4gcG9zaXRpb24gIT09IC0xICYmICh0ZXJtaW5hdG9yUG9zaXRpb24gPT09IC0xIHx8IHBvc2l0aW9uIDwgdGVybWluYXRvclBvc2l0aW9uKTtcbn1cblxuY29uc3Qge2Vudn0gPSBwcm9jZXNzO1xuXG5sZXQgZmxhZ0ZvcmNlQ29sb3I7XG5pZiAoXG5cdGhhc0ZsYWcoJ25vLWNvbG9yJylcblx0fHwgaGFzRmxhZygnbm8tY29sb3JzJylcblx0fHwgaGFzRmxhZygnY29sb3I9ZmFsc2UnKVxuXHR8fCBoYXNGbGFnKCdjb2xvcj1uZXZlcicpXG4pIHtcblx0ZmxhZ0ZvcmNlQ29sb3IgPSAwO1xufSBlbHNlIGlmIChcblx0aGFzRmxhZygnY29sb3InKVxuXHR8fCBoYXNGbGFnKCdjb2xvcnMnKVxuXHR8fCBoYXNGbGFnKCdjb2xvcj10cnVlJylcblx0fHwgaGFzRmxhZygnY29sb3I9YWx3YXlzJylcbikge1xuXHRmbGFnRm9yY2VDb2xvciA9IDE7XG59XG5cbmZ1bmN0aW9uIGVudkZvcmNlQ29sb3IoKSB7XG5cdGlmICgnRk9SQ0VfQ09MT1InIGluIGVudikge1xuXHRcdGlmIChlbnYuRk9SQ0VfQ09MT1IgPT09ICd0cnVlJykge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fVxuXG5cdFx0aWYgKGVudi5GT1JDRV9DT0xPUiA9PT0gJ2ZhbHNlJykge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVudi5GT1JDRV9DT0xPUi5sZW5ndGggPT09IDAgPyAxIDogTWF0aC5taW4oTnVtYmVyLnBhcnNlSW50KGVudi5GT1JDRV9DT0xPUiwgMTApLCAzKTtcblx0fVxufVxuXG5mdW5jdGlvbiB0cmFuc2xhdGVMZXZlbChsZXZlbCkge1xuXHRpZiAobGV2ZWwgPT09IDApIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGxldmVsLFxuXHRcdGhhc0Jhc2ljOiB0cnVlLFxuXHRcdGhhczI1NjogbGV2ZWwgPj0gMixcblx0XHRoYXMxNm06IGxldmVsID49IDMsXG5cdH07XG59XG5cbmZ1bmN0aW9uIF9zdXBwb3J0c0NvbG9yKGhhdmVTdHJlYW0sIHtzdHJlYW1Jc1RUWSwgc25pZmZGbGFncyA9IHRydWV9ID0ge30pIHtcblx0Y29uc3Qgbm9GbGFnRm9yY2VDb2xvciA9IGVudkZvcmNlQ29sb3IoKTtcblx0aWYgKG5vRmxhZ0ZvcmNlQ29sb3IgIT09IHVuZGVmaW5lZCkge1xuXHRcdGZsYWdGb3JjZUNvbG9yID0gbm9GbGFnRm9yY2VDb2xvcjtcblx0fVxuXG5cdGNvbnN0IGZvcmNlQ29sb3IgPSBzbmlmZkZsYWdzID8gZmxhZ0ZvcmNlQ29sb3IgOiBub0ZsYWdGb3JjZUNvbG9yO1xuXG5cdGlmIChmb3JjZUNvbG9yID09PSAwKSB7XG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRpZiAoc25pZmZGbGFncykge1xuXHRcdGlmIChoYXNGbGFnKCdjb2xvcj0xNm0nKVxuXHRcdFx0fHwgaGFzRmxhZygnY29sb3I9ZnVsbCcpXG5cdFx0XHR8fCBoYXNGbGFnKCdjb2xvcj10cnVlY29sb3InKSkge1xuXHRcdFx0cmV0dXJuIDM7XG5cdFx0fVxuXG5cdFx0aWYgKGhhc0ZsYWcoJ2NvbG9yPTI1NicpKSB7XG5cdFx0XHRyZXR1cm4gMjtcblx0XHR9XG5cdH1cblxuXHQvLyBDaGVjayBmb3IgQXp1cmUgRGV2T3BzIHBpcGVsaW5lcy5cblx0Ly8gSGFzIHRvIGJlIGFib3ZlIHRoZSBgIXN0cmVhbUlzVFRZYCBjaGVjay5cblx0aWYgKCdURl9CVUlMRCcgaW4gZW52ICYmICdBR0VOVF9OQU1FJyBpbiBlbnYpIHtcblx0XHRyZXR1cm4gMTtcblx0fVxuXG5cdGlmIChoYXZlU3RyZWFtICYmICFzdHJlYW1Jc1RUWSAmJiBmb3JjZUNvbG9yID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdGNvbnN0IG1pbiA9IGZvcmNlQ29sb3IgfHwgMDtcblxuXHRpZiAoZW52LlRFUk0gPT09ICdkdW1iJykge1xuXHRcdHJldHVybiBtaW47XG5cdH1cblxuXHRpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuXHRcdC8vIFdpbmRvd3MgMTAgYnVpbGQgMTA1ODYgaXMgdGhlIGZpcnN0IFdpbmRvd3MgcmVsZWFzZSB0aGF0IHN1cHBvcnRzIDI1NiBjb2xvcnMuXG5cdFx0Ly8gV2luZG93cyAxMCBidWlsZCAxNDkzMSBpcyB0aGUgZmlyc3QgcmVsZWFzZSB0aGF0IHN1cHBvcnRzIDE2bS9UcnVlQ29sb3IuXG5cdFx0Y29uc3Qgb3NSZWxlYXNlID0gb3MucmVsZWFzZSgpLnNwbGl0KCcuJyk7XG5cdFx0aWYgKFxuXHRcdFx0TnVtYmVyKG9zUmVsZWFzZVswXSkgPj0gMTBcblx0XHRcdCYmIE51bWJlcihvc1JlbGVhc2VbMl0pID49IDEwXzU4NlxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIE51bWJlcihvc1JlbGVhc2VbMl0pID49IDE0XzkzMSA/IDMgOiAyO1xuXHRcdH1cblxuXHRcdHJldHVybiAxO1xuXHR9XG5cblx0aWYgKCdDSScgaW4gZW52KSB7XG5cdFx0aWYgKCdHSVRIVUJfQUNUSU9OUycgaW4gZW52IHx8ICdHSVRFQV9BQ1RJT05TJyBpbiBlbnYpIHtcblx0XHRcdHJldHVybiAzO1xuXHRcdH1cblxuXHRcdGlmIChbJ1RSQVZJUycsICdDSVJDTEVDSScsICdBUFBWRVlPUicsICdHSVRMQUJfQ0knLCAnQlVJTERLSVRFJywgJ0RST05FJ10uc29tZShzaWduID0+IHNpZ24gaW4gZW52KSB8fCBlbnYuQ0lfTkFNRSA9PT0gJ2NvZGVzaGlwJykge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG1pbjtcblx0fVxuXG5cdGlmICgnVEVBTUNJVFlfVkVSU0lPTicgaW4gZW52KSB7XG5cdFx0cmV0dXJuIC9eKDlcXC4oMCpbMS05XVxcZCopXFwufFxcZHsyLH1cXC4pLy50ZXN0KGVudi5URUFNQ0lUWV9WRVJTSU9OKSA/IDEgOiAwO1xuXHR9XG5cblx0aWYgKGVudi5DT0xPUlRFUk0gPT09ICd0cnVlY29sb3InKSB7XG5cdFx0cmV0dXJuIDM7XG5cdH1cblxuXHRpZiAoZW52LlRFUk0gPT09ICd4dGVybS1raXR0eScpIHtcblx0XHRyZXR1cm4gMztcblx0fVxuXG5cdGlmICgnVEVSTV9QUk9HUkFNJyBpbiBlbnYpIHtcblx0XHRjb25zdCB2ZXJzaW9uID0gTnVtYmVyLnBhcnNlSW50KChlbnYuVEVSTV9QUk9HUkFNX1ZFUlNJT04gfHwgJycpLnNwbGl0KCcuJylbMF0sIDEwKTtcblxuXHRcdHN3aXRjaCAoZW52LlRFUk1fUFJPR1JBTSkge1xuXHRcdFx0Y2FzZSAnaVRlcm0uYXBwJzoge1xuXHRcdFx0XHRyZXR1cm4gdmVyc2lvbiA+PSAzID8gMyA6IDI7XG5cdFx0XHR9XG5cblx0XHRcdGNhc2UgJ0FwcGxlX1Rlcm1pbmFsJzoge1xuXHRcdFx0XHRyZXR1cm4gMjtcblx0XHRcdH1cblx0XHRcdC8vIE5vIGRlZmF1bHRcblx0XHR9XG5cdH1cblxuXHRpZiAoLy0yNTYoY29sb3IpPyQvaS50ZXN0KGVudi5URVJNKSkge1xuXHRcdHJldHVybiAyO1xuXHR9XG5cblx0aWYgKC9ec2NyZWVufF54dGVybXxednQxMDB8XnZ0MjIwfF5yeHZ0fGNvbG9yfGFuc2l8Y3lnd2lufGxpbnV4L2kudGVzdChlbnYuVEVSTSkpIHtcblx0XHRyZXR1cm4gMTtcblx0fVxuXG5cdGlmICgnQ09MT1JURVJNJyBpbiBlbnYpIHtcblx0XHRyZXR1cm4gMTtcblx0fVxuXG5cdHJldHVybiBtaW47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdXBwb3J0c0NvbG9yKHN0cmVhbSwgb3B0aW9ucyA9IHt9KSB7XG5cdGNvbnN0IGxldmVsID0gX3N1cHBvcnRzQ29sb3Ioc3RyZWFtLCB7XG5cdFx0c3RyZWFtSXNUVFk6IHN0cmVhbSAmJiBzdHJlYW0uaXNUVFksXG5cdFx0Li4ub3B0aW9ucyxcblx0fSk7XG5cblx0cmV0dXJuIHRyYW5zbGF0ZUxldmVsKGxldmVsKTtcbn1cblxuY29uc3Qgc3VwcG9ydHNDb2xvciA9IHtcblx0c3Rkb3V0OiBjcmVhdGVTdXBwb3J0c0NvbG9yKHtpc1RUWTogdHR5LmlzYXR0eSgxKX0pLFxuXHRzdGRlcnI6IGNyZWF0ZVN1cHBvcnRzQ29sb3Ioe2lzVFRZOiB0dHkuaXNhdHR5KDIpfSksXG59O1xuXG5leHBvcnQgZGVmYXVsdCBzdXBwb3J0c0NvbG9yO1xuIiwiLy8gVE9ETzogV2hlbiB0YXJnZXRpbmcgTm9kZS5qcyAxNiwgdXNlIGBTdHJpbmcucHJvdG90eXBlLnJlcGxhY2VBbGxgLlxuZXhwb3J0IGZ1bmN0aW9uIHN0cmluZ1JlcGxhY2VBbGwoc3RyaW5nLCBzdWJzdHJpbmcsIHJlcGxhY2VyKSB7XG5cdGxldCBpbmRleCA9IHN0cmluZy5pbmRleE9mKHN1YnN0cmluZyk7XG5cdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRyZXR1cm4gc3RyaW5nO1xuXHR9XG5cblx0Y29uc3Qgc3Vic3RyaW5nTGVuZ3RoID0gc3Vic3RyaW5nLmxlbmd0aDtcblx0bGV0IGVuZEluZGV4ID0gMDtcblx0bGV0IHJldHVyblZhbHVlID0gJyc7XG5cdGRvIHtcblx0XHRyZXR1cm5WYWx1ZSArPSBzdHJpbmcuc2xpY2UoZW5kSW5kZXgsIGluZGV4KSArIHN1YnN0cmluZyArIHJlcGxhY2VyO1xuXHRcdGVuZEluZGV4ID0gaW5kZXggKyBzdWJzdHJpbmdMZW5ndGg7XG5cdFx0aW5kZXggPSBzdHJpbmcuaW5kZXhPZihzdWJzdHJpbmcsIGVuZEluZGV4KTtcblx0fSB3aGlsZSAoaW5kZXggIT09IC0xKTtcblxuXHRyZXR1cm5WYWx1ZSArPSBzdHJpbmcuc2xpY2UoZW5kSW5kZXgpO1xuXHRyZXR1cm4gcmV0dXJuVmFsdWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpbmdFbmNhc2VDUkxGV2l0aEZpcnN0SW5kZXgoc3RyaW5nLCBwcmVmaXgsIHBvc3RmaXgsIGluZGV4KSB7XG5cdGxldCBlbmRJbmRleCA9IDA7XG5cdGxldCByZXR1cm5WYWx1ZSA9ICcnO1xuXHRkbyB7XG5cdFx0Y29uc3QgZ290Q1IgPSBzdHJpbmdbaW5kZXggLSAxXSA9PT0gJ1xccic7XG5cdFx0cmV0dXJuVmFsdWUgKz0gc3RyaW5nLnNsaWNlKGVuZEluZGV4LCAoZ290Q1IgPyBpbmRleCAtIDEgOiBpbmRleCkpICsgcHJlZml4ICsgKGdvdENSID8gJ1xcclxcbicgOiAnXFxuJykgKyBwb3N0Zml4O1xuXHRcdGVuZEluZGV4ID0gaW5kZXggKyAxO1xuXHRcdGluZGV4ID0gc3RyaW5nLmluZGV4T2YoJ1xcbicsIGVuZEluZGV4KTtcblx0fSB3aGlsZSAoaW5kZXggIT09IC0xKTtcblxuXHRyZXR1cm5WYWx1ZSArPSBzdHJpbmcuc2xpY2UoZW5kSW5kZXgpO1xuXHRyZXR1cm4gcmV0dXJuVmFsdWU7XG59XG4iLCJpbXBvcnQgYW5zaVN0eWxlcyBmcm9tICcjYW5zaS1zdHlsZXMnO1xuaW1wb3J0IHN1cHBvcnRzQ29sb3IgZnJvbSAnI3N1cHBvcnRzLWNvbG9yJztcbmltcG9ydCB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgaW1wb3J0L29yZGVyXG5cdHN0cmluZ1JlcGxhY2VBbGwsXG5cdHN0cmluZ0VuY2FzZUNSTEZXaXRoRmlyc3RJbmRleCxcbn0gZnJvbSAnLi91dGlsaXRpZXMuanMnO1xuXG5jb25zdCB7c3Rkb3V0OiBzdGRvdXRDb2xvciwgc3RkZXJyOiBzdGRlcnJDb2xvcn0gPSBzdXBwb3J0c0NvbG9yO1xuXG5jb25zdCBHRU5FUkFUT1IgPSBTeW1ib2woJ0dFTkVSQVRPUicpO1xuY29uc3QgU1RZTEVSID0gU3ltYm9sKCdTVFlMRVInKTtcbmNvbnN0IElTX0VNUFRZID0gU3ltYm9sKCdJU19FTVBUWScpO1xuXG4vLyBgc3VwcG9ydHNDb2xvci5sZXZlbGAg4oaSIGBhbnNpU3R5bGVzLmNvbG9yW25hbWVdYCBtYXBwaW5nXG5jb25zdCBsZXZlbE1hcHBpbmcgPSBbXG5cdCdhbnNpJyxcblx0J2Fuc2knLFxuXHQnYW5zaTI1NicsXG5cdCdhbnNpMTZtJyxcbl07XG5cbmNvbnN0IHN0eWxlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbmNvbnN0IGFwcGx5T3B0aW9ucyA9IChvYmplY3QsIG9wdGlvbnMgPSB7fSkgPT4ge1xuXHRpZiAob3B0aW9ucy5sZXZlbCAmJiAhKE51bWJlci5pc0ludGVnZXIob3B0aW9ucy5sZXZlbCkgJiYgb3B0aW9ucy5sZXZlbCA+PSAwICYmIG9wdGlvbnMubGV2ZWwgPD0gMykpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ1RoZSBgbGV2ZWxgIG9wdGlvbiBzaG91bGQgYmUgYW4gaW50ZWdlciBmcm9tIDAgdG8gMycpO1xuXHR9XG5cblx0Ly8gRGV0ZWN0IGxldmVsIGlmIG5vdCBzZXQgbWFudWFsbHlcblx0Y29uc3QgY29sb3JMZXZlbCA9IHN0ZG91dENvbG9yID8gc3Rkb3V0Q29sb3IubGV2ZWwgOiAwO1xuXHRvYmplY3QubGV2ZWwgPSBvcHRpb25zLmxldmVsID09PSB1bmRlZmluZWQgPyBjb2xvckxldmVsIDogb3B0aW9ucy5sZXZlbDtcbn07XG5cbmV4cG9ydCBjbGFzcyBDaGFsayB7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcblx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RydWN0b3ItcmV0dXJuXG5cdFx0cmV0dXJuIGNoYWxrRmFjdG9yeShvcHRpb25zKTtcblx0fVxufVxuXG5jb25zdCBjaGFsa0ZhY3RvcnkgPSBvcHRpb25zID0+IHtcblx0Y29uc3QgY2hhbGsgPSAoLi4uc3RyaW5ncykgPT4gc3RyaW5ncy5qb2luKCcgJyk7XG5cdGFwcGx5T3B0aW9ucyhjaGFsaywgb3B0aW9ucyk7XG5cblx0T2JqZWN0LnNldFByb3RvdHlwZU9mKGNoYWxrLCBjcmVhdGVDaGFsay5wcm90b3R5cGUpO1xuXG5cdHJldHVybiBjaGFsaztcbn07XG5cbmZ1bmN0aW9uIGNyZWF0ZUNoYWxrKG9wdGlvbnMpIHtcblx0cmV0dXJuIGNoYWxrRmFjdG9yeShvcHRpb25zKTtcbn1cblxuT2JqZWN0LnNldFByb3RvdHlwZU9mKGNyZWF0ZUNoYWxrLnByb3RvdHlwZSwgRnVuY3Rpb24ucHJvdG90eXBlKTtcblxuZm9yIChjb25zdCBbc3R5bGVOYW1lLCBzdHlsZV0gb2YgT2JqZWN0LmVudHJpZXMoYW5zaVN0eWxlcykpIHtcblx0c3R5bGVzW3N0eWxlTmFtZV0gPSB7XG5cdFx0Z2V0KCkge1xuXHRcdFx0Y29uc3QgYnVpbGRlciA9IGNyZWF0ZUJ1aWxkZXIodGhpcywgY3JlYXRlU3R5bGVyKHN0eWxlLm9wZW4sIHN0eWxlLmNsb3NlLCB0aGlzW1NUWUxFUl0pLCB0aGlzW0lTX0VNUFRZXSk7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgc3R5bGVOYW1lLCB7dmFsdWU6IGJ1aWxkZXJ9KTtcblx0XHRcdHJldHVybiBidWlsZGVyO1xuXHRcdH0sXG5cdH07XG59XG5cbnN0eWxlcy52aXNpYmxlID0ge1xuXHRnZXQoKSB7XG5cdFx0Y29uc3QgYnVpbGRlciA9IGNyZWF0ZUJ1aWxkZXIodGhpcywgdGhpc1tTVFlMRVJdLCB0cnVlKTtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3Zpc2libGUnLCB7dmFsdWU6IGJ1aWxkZXJ9KTtcblx0XHRyZXR1cm4gYnVpbGRlcjtcblx0fSxcbn07XG5cbmNvbnN0IGdldE1vZGVsQW5zaSA9IChtb2RlbCwgbGV2ZWwsIHR5cGUsIC4uLmFyZ3VtZW50c18pID0+IHtcblx0aWYgKG1vZGVsID09PSAncmdiJykge1xuXHRcdGlmIChsZXZlbCA9PT0gJ2Fuc2kxNm0nKSB7XG5cdFx0XHRyZXR1cm4gYW5zaVN0eWxlc1t0eXBlXS5hbnNpMTZtKC4uLmFyZ3VtZW50c18pO1xuXHRcdH1cblxuXHRcdGlmIChsZXZlbCA9PT0gJ2Fuc2kyNTYnKSB7XG5cdFx0XHRyZXR1cm4gYW5zaVN0eWxlc1t0eXBlXS5hbnNpMjU2KGFuc2lTdHlsZXMucmdiVG9BbnNpMjU2KC4uLmFyZ3VtZW50c18pKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYW5zaVN0eWxlc1t0eXBlXS5hbnNpKGFuc2lTdHlsZXMucmdiVG9BbnNpKC4uLmFyZ3VtZW50c18pKTtcblx0fVxuXG5cdGlmIChtb2RlbCA9PT0gJ2hleCcpIHtcblx0XHRyZXR1cm4gZ2V0TW9kZWxBbnNpKCdyZ2InLCBsZXZlbCwgdHlwZSwgLi4uYW5zaVN0eWxlcy5oZXhUb1JnYiguLi5hcmd1bWVudHNfKSk7XG5cdH1cblxuXHRyZXR1cm4gYW5zaVN0eWxlc1t0eXBlXVttb2RlbF0oLi4uYXJndW1lbnRzXyk7XG59O1xuXG5jb25zdCB1c2VkTW9kZWxzID0gWydyZ2InLCAnaGV4JywgJ2Fuc2kyNTYnXTtcblxuZm9yIChjb25zdCBtb2RlbCBvZiB1c2VkTW9kZWxzKSB7XG5cdHN0eWxlc1ttb2RlbF0gPSB7XG5cdFx0Z2V0KCkge1xuXHRcdFx0Y29uc3Qge2xldmVsfSA9IHRoaXM7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24gKC4uLmFyZ3VtZW50c18pIHtcblx0XHRcdFx0Y29uc3Qgc3R5bGVyID0gY3JlYXRlU3R5bGVyKGdldE1vZGVsQW5zaShtb2RlbCwgbGV2ZWxNYXBwaW5nW2xldmVsXSwgJ2NvbG9yJywgLi4uYXJndW1lbnRzXyksIGFuc2lTdHlsZXMuY29sb3IuY2xvc2UsIHRoaXNbU1RZTEVSXSk7XG5cdFx0XHRcdHJldHVybiBjcmVhdGVCdWlsZGVyKHRoaXMsIHN0eWxlciwgdGhpc1tJU19FTVBUWV0pO1xuXHRcdFx0fTtcblx0XHR9LFxuXHR9O1xuXG5cdGNvbnN0IGJnTW9kZWwgPSAnYmcnICsgbW9kZWxbMF0udG9VcHBlckNhc2UoKSArIG1vZGVsLnNsaWNlKDEpO1xuXHRzdHlsZXNbYmdNb2RlbF0gPSB7XG5cdFx0Z2V0KCkge1xuXHRcdFx0Y29uc3Qge2xldmVsfSA9IHRoaXM7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24gKC4uLmFyZ3VtZW50c18pIHtcblx0XHRcdFx0Y29uc3Qgc3R5bGVyID0gY3JlYXRlU3R5bGVyKGdldE1vZGVsQW5zaShtb2RlbCwgbGV2ZWxNYXBwaW5nW2xldmVsXSwgJ2JnQ29sb3InLCAuLi5hcmd1bWVudHNfKSwgYW5zaVN0eWxlcy5iZ0NvbG9yLmNsb3NlLCB0aGlzW1NUWUxFUl0pO1xuXHRcdFx0XHRyZXR1cm4gY3JlYXRlQnVpbGRlcih0aGlzLCBzdHlsZXIsIHRoaXNbSVNfRU1QVFldKTtcblx0XHRcdH07XG5cdFx0fSxcblx0fTtcbn1cblxuY29uc3QgcHJvdG8gPSBPYmplY3QuZGVmaW5lUHJvcGVydGllcygoKSA9PiB7fSwge1xuXHQuLi5zdHlsZXMsXG5cdGxldmVsOiB7XG5cdFx0ZW51bWVyYWJsZTogdHJ1ZSxcblx0XHRnZXQoKSB7XG5cdFx0XHRyZXR1cm4gdGhpc1tHRU5FUkFUT1JdLmxldmVsO1xuXHRcdH0sXG5cdFx0c2V0KGxldmVsKSB7XG5cdFx0XHR0aGlzW0dFTkVSQVRPUl0ubGV2ZWwgPSBsZXZlbDtcblx0XHR9LFxuXHR9LFxufSk7XG5cbmNvbnN0IGNyZWF0ZVN0eWxlciA9IChvcGVuLCBjbG9zZSwgcGFyZW50KSA9PiB7XG5cdGxldCBvcGVuQWxsO1xuXHRsZXQgY2xvc2VBbGw7XG5cdGlmIChwYXJlbnQgPT09IHVuZGVmaW5lZCkge1xuXHRcdG9wZW5BbGwgPSBvcGVuO1xuXHRcdGNsb3NlQWxsID0gY2xvc2U7XG5cdH0gZWxzZSB7XG5cdFx0b3BlbkFsbCA9IHBhcmVudC5vcGVuQWxsICsgb3Blbjtcblx0XHRjbG9zZUFsbCA9IGNsb3NlICsgcGFyZW50LmNsb3NlQWxsO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRvcGVuLFxuXHRcdGNsb3NlLFxuXHRcdG9wZW5BbGwsXG5cdFx0Y2xvc2VBbGwsXG5cdFx0cGFyZW50LFxuXHR9O1xufTtcblxuY29uc3QgY3JlYXRlQnVpbGRlciA9IChzZWxmLCBfc3R5bGVyLCBfaXNFbXB0eSkgPT4ge1xuXHQvLyBTaW5nbGUgYXJndW1lbnQgaXMgaG90IHBhdGgsIGltcGxpY2l0IGNvZXJjaW9uIGlzIGZhc3RlciB0aGFuIGFueXRoaW5nXG5cdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1pbXBsaWNpdC1jb2VyY2lvblxuXHRjb25zdCBidWlsZGVyID0gKC4uLmFyZ3VtZW50c18pID0+IGFwcGx5U3R5bGUoYnVpbGRlciwgKGFyZ3VtZW50c18ubGVuZ3RoID09PSAxKSA/ICgnJyArIGFyZ3VtZW50c19bMF0pIDogYXJndW1lbnRzXy5qb2luKCcgJykpO1xuXG5cdC8vIFdlIGFsdGVyIHRoZSBwcm90b3R5cGUgYmVjYXVzZSB3ZSBtdXN0IHJldHVybiBhIGZ1bmN0aW9uLCBidXQgdGhlcmUgaXNcblx0Ly8gbm8gd2F5IHRvIGNyZWF0ZSBhIGZ1bmN0aW9uIHdpdGggYSBkaWZmZXJlbnQgcHJvdG90eXBlXG5cdE9iamVjdC5zZXRQcm90b3R5cGVPZihidWlsZGVyLCBwcm90byk7XG5cblx0YnVpbGRlcltHRU5FUkFUT1JdID0gc2VsZjtcblx0YnVpbGRlcltTVFlMRVJdID0gX3N0eWxlcjtcblx0YnVpbGRlcltJU19FTVBUWV0gPSBfaXNFbXB0eTtcblxuXHRyZXR1cm4gYnVpbGRlcjtcbn07XG5cbmNvbnN0IGFwcGx5U3R5bGUgPSAoc2VsZiwgc3RyaW5nKSA9PiB7XG5cdGlmIChzZWxmLmxldmVsIDw9IDAgfHwgIXN0cmluZykge1xuXHRcdHJldHVybiBzZWxmW0lTX0VNUFRZXSA/ICcnIDogc3RyaW5nO1xuXHR9XG5cblx0bGV0IHN0eWxlciA9IHNlbGZbU1RZTEVSXTtcblxuXHRpZiAoc3R5bGVyID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gc3RyaW5nO1xuXHR9XG5cblx0Y29uc3Qge29wZW5BbGwsIGNsb3NlQWxsfSA9IHN0eWxlcjtcblx0aWYgKHN0cmluZy5pbmNsdWRlcygnXFx1MDAxQicpKSB7XG5cdFx0d2hpbGUgKHN0eWxlciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHQvLyBSZXBsYWNlIGFueSBpbnN0YW5jZXMgYWxyZWFkeSBwcmVzZW50IHdpdGggYSByZS1vcGVuaW5nIGNvZGVcblx0XHRcdC8vIG90aGVyd2lzZSBvbmx5IHRoZSBwYXJ0IG9mIHRoZSBzdHJpbmcgdW50aWwgc2FpZCBjbG9zaW5nIGNvZGVcblx0XHRcdC8vIHdpbGwgYmUgY29sb3JlZCwgYW5kIHRoZSByZXN0IHdpbGwgc2ltcGx5IGJlICdwbGFpbicuXG5cdFx0XHRzdHJpbmcgPSBzdHJpbmdSZXBsYWNlQWxsKHN0cmluZywgc3R5bGVyLmNsb3NlLCBzdHlsZXIub3Blbik7XG5cblx0XHRcdHN0eWxlciA9IHN0eWxlci5wYXJlbnQ7XG5cdFx0fVxuXHR9XG5cblx0Ly8gV2UgY2FuIG1vdmUgYm90aCBuZXh0IGFjdGlvbnMgb3V0IG9mIGxvb3AsIGJlY2F1c2UgcmVtYWluaW5nIGFjdGlvbnMgaW4gbG9vcCB3b24ndCBoYXZlXG5cdC8vIGFueS92aXNpYmxlIGVmZmVjdCBvbiBwYXJ0cyB3ZSBhZGQgaGVyZS4gQ2xvc2UgdGhlIHN0eWxpbmcgYmVmb3JlIGEgbGluZWJyZWFrIGFuZCByZW9wZW5cblx0Ly8gYWZ0ZXIgbmV4dCBsaW5lIHRvIGZpeCBhIGJsZWVkIGlzc3VlIG9uIG1hY09TOiBodHRwczovL2dpdGh1Yi5jb20vY2hhbGsvY2hhbGsvcHVsbC85MlxuXHRjb25zdCBsZkluZGV4ID0gc3RyaW5nLmluZGV4T2YoJ1xcbicpO1xuXHRpZiAobGZJbmRleCAhPT0gLTEpIHtcblx0XHRzdHJpbmcgPSBzdHJpbmdFbmNhc2VDUkxGV2l0aEZpcnN0SW5kZXgoc3RyaW5nLCBjbG9zZUFsbCwgb3BlbkFsbCwgbGZJbmRleCk7XG5cdH1cblxuXHRyZXR1cm4gb3BlbkFsbCArIHN0cmluZyArIGNsb3NlQWxsO1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoY3JlYXRlQ2hhbGsucHJvdG90eXBlLCBzdHlsZXMpO1xuXG5jb25zdCBjaGFsayA9IGNyZWF0ZUNoYWxrKCk7XG5leHBvcnQgY29uc3QgY2hhbGtTdGRlcnIgPSBjcmVhdGVDaGFsayh7bGV2ZWw6IHN0ZGVyckNvbG9yID8gc3RkZXJyQ29sb3IubGV2ZWwgOiAwfSk7XG5cbmV4cG9ydCB7XG5cdG1vZGlmaWVyTmFtZXMsXG5cdGZvcmVncm91bmRDb2xvck5hbWVzLFxuXHRiYWNrZ3JvdW5kQ29sb3JOYW1lcyxcblx0Y29sb3JOYW1lcyxcblxuXHQvLyBUT0RPOiBSZW1vdmUgdGhlc2UgYWxpYXNlcyBpbiB0aGUgbmV4dCBtYWpvciB2ZXJzaW9uXG5cdG1vZGlmaWVyTmFtZXMgYXMgbW9kaWZpZXJzLFxuXHRmb3JlZ3JvdW5kQ29sb3JOYW1lcyBhcyBmb3JlZ3JvdW5kQ29sb3JzLFxuXHRiYWNrZ3JvdW5kQ29sb3JOYW1lcyBhcyBiYWNrZ3JvdW5kQ29sb3JzLFxuXHRjb2xvck5hbWVzIGFzIGNvbG9ycyxcbn0gZnJvbSAnLi92ZW5kb3IvYW5zaS1zdHlsZXMvaW5kZXguanMnO1xuXG5leHBvcnQge1xuXHRzdGRvdXRDb2xvciBhcyBzdXBwb3J0c0NvbG9yLFxuXHRzdGRlcnJDb2xvciBhcyBzdXBwb3J0c0NvbG9yU3RkZXJyLFxufTtcblxuZXhwb3J0IGRlZmF1bHQgY2hhbGs7XG4iLCJpbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCI7XHJcbmltcG9ydCBBcmdzUGFyc2VyIGZyb20gXCIuLi9hcmdzUGFyc2VyXCI7XHJcbmltcG9ydCBib3JkZXIgZnJvbSBcIi4uL2JvcmRlclwiO1xyXG5cclxuY29uc3QgeSA9IGNoYWxrLnllbGxvdywgYiA9IGNoYWxrLmJsdWU7XHJcblxyXG5jb25zdCBkb2N1bWVudGF0aW9uID0ge1xyXG4gICAgaW5pdDogYCR7YihcImluaXRcIil9YFxyXG4gICAgICAgICsgYFxcblxcblxcdENyZWF0ZXMgbmV3IGJyaWZrYSByZXBvc2l0b3J5IGluIGN1cnJlbnQgd29ya2luZyBwYXRoLmAsXHJcbiAgICB0cmFjazogYCR7YihcInRyYWNrIDxkaXJlY3RvcnlfcGF0aD4gfCA8ZmlsZV9wYXRoPiB8IC5cIil9YFxyXG4gICAgICAgICsgYFxcblxcblxcdEFkZHMgZmlsZXMgdG8gdGhlIHRyYWNrZWQgc3RhZ2UuYFxyXG4gICAgICAgICsgYFxcblxcdCR7eShcIjxkaXJlY3RvcnlfcGF0aD5cIil9IC0gYWxsIGZpbGVzIGFuZCBkaXJlY3RvcmllcyBpbiB0aGF0IGRpcmVjdG9yeSB3aWxsIGJlIHRyYWNrZWQuYFxyXG4gICAgICAgICsgYFxcblxcdCR7eShcIjxmaWxlX3BhdGg+XCIpfSAtIGZpbGUgd2lsbCBiZSB0cmFja2VkLmBcclxuICAgICAgICArIGBcXG5cXHQke3koXCIuXCIpfSAtIGFsbCBmaWxlcyBiZXNpZGVzIHBhdGhzIGV4Y2x1ZGVkIGluIC5icmlnbm9yZSB3aWxsIGJlIHRyYWNrZWQuYCxcclxuICAgIHVudHJhY2s6IGAke2IoXCJ1bnRyYWNrIDxkaXJlY3RvcnlfcGF0aD4gfCA8ZmlsZV9wYXRoPiB8IC5cIil9YFxyXG4gICAgICAgICsgYFxcblxcblxcdFJlbW92ZXMgZmlsZXMgZnJvbSB0cmFja2VkIHN0YWdlLmBcclxuICAgICAgICArIGBcXG5cXHQke3koXCI8ZGlyZWN0b3J5X3BhdGg+XCIpfSAtIGFsbCBmaWxlcyBhbmQgZGlyZWN0b3JpZXMgaW4gdGhhdCBkaXJlY3Rvcnkgd2lsbCBiZSB1bnRyYWNrZWQuYFxyXG4gICAgICAgICsgYFxcblxcdCR7eShcIjxmaWxlX3BhdGg+XCIpfSAtIGZpbGUgd2lsbCBiZSB1bnRyYWNrZWQuYFxyXG4gICAgICAgICsgYFxcblxcdCR7eShcIi5cIil9IC0gYWxsIGZpbGVzICB3aWxsIGJlIHVudHJhY2tlZC5gLFxyXG4gICAgY29tbWl0OiBgJHtiKFwiY29tbWl0IDxjb21taXRfbmFtZT5cIil9YFxyXG4gICAgICAgICsgYFxcblxcblxcdEFkZHMgbmV3IGNvbW1pdCB0byB0aGUgcmVwb3NpdG9yeS5gXHJcbiAgICAgICAgKyBgXFxuXFx0JHt5KFwiPGNvbW1pdF9uYW1lPlwiKX0gLSBuYW1lIG9mIG5ldyBjb21taXQuYCxcclxuICAgIHVuY29tbWl0OiBgJHtiKFwidW5jb21taXRcIil9YFxyXG4gICAgICAgICsgYFxcblxcblxcdFJlbW92ZXMgbGFzdCBjb21taXQgZnJvbSB0aGUgcmVwb3NpdG9yeS5gLFxyXG4gICAgY29tbWl0czogYCR7YihcImNvbW1pdHMgZW1wdHkgfCA8bGltaXQ+XCIpfWBcclxuICAgICAgICArIGBcXG5cXG5cXHREaXNwbGF5cyBjb21taXRzLmBcclxuICAgICAgICArIGBcXG5cXHQke3koXCI8bGltaXQ+XCIpfSAtIGRpc3BsYXlzIG9ubHkgbGFzdCB4IGNvbW1pdHMuYCxcclxuICAgIHB1c2g6IGAke2IoXCJwdXNoXCIpfWBcclxuICAgICAgICArIGBcXG5cXG5cXHRTZW5kcyByZXBvc2l0b3J5IHRvIHRoZSBmdHAgc2VydmVyLmAsXHJcbiAgICBwdWxsOiBgJHtiKFwicHVsbFwiKX1gXHJcbiAgICAgICAgKyBgXFxuXFxuXFx0RG93bmxvYWRzIHJlcG9zaXRvcnkgZnJvbSBmdHAgc2VydmVyLmBcclxufVxyXG5cclxuY29uc3QgaGVscCA9IChhcmdzUGFyc2VyOiBBcmdzUGFyc2VyKSA9PiB7XHJcbiAgICBpZiAoIWFyZ3NQYXJzZXIucGVlaygpKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFxcbiR7T2JqZWN0LnZhbHVlcyhkb2N1bWVudGF0aW9uKS5qb2luKFwiXFxuXFxuXCIpfVxcbmApO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb21tYW5kID0gYXJnc1BhcnNlci5wZWVrKCkgYXMgc3RyaW5nO1xyXG4gICAgaWYgKE9iamVjdC5rZXlzKGRvY3VtZW50YXRpb24pLmZpbmQoa2V5ID0+IGtleSA9PSBjb21tYW5kKT8ubGVuZ3RoID8/IDAgPiAxKVxyXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcclxuICAgICAgICBjb25zb2xlLmxvZyhgXFxuJHtkb2N1bWVudGF0aW9uW2NvbW1hbmRdfVxcbmApO1xyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihjaGFsay5yZWQoYFxcbkNvbW1hbmQgJyR7Y29tbWFuZH0nIGRvZXNuJ3QgZXhpc3QuYCkpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGJvcmRlcihcIlR5cGUgJ2JyaWZrYSBoZWxwJyB0byB2aWV3IGRvY3VtZW50YXRpb24gb2YgYWxsIGNvbW1hbmRzLlwiLCBcIkhlbHBcIikpO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBoZWxwOyIsImltcG9ydCBmcyBmcm9tIFwibm9kZTpmcy9wcm9taXNlc1wiO1xyXG5pbXBvcnQgbm9kZVBhdGggZnJvbSBcIm5vZGU6cGF0aFwiO1xyXG5cclxudHlwZSBGbGFncyA9IFwiclwiIHwgXCJyK1wiIHwgXCJycytcIiB8IFwid1wiIHwgXCJ3eFwiIHwgXCJ3K1wiIHwgXCJ3eCtcIiB8IFwiYVwiIHwgXCJheFwiIHwgXCJhK1wiIHwgXCJheCtcIjtcclxuXHJcbmNvbnN0IG9wZW5GaWxlID0gYXN5bmMgKHBhdGg6IHN0cmluZywgZmxhZ3M6IEZsYWdzKTogUHJvbWlzZTxmcy5GaWxlSGFuZGxlIHwgZmFsc2U+ID0+IHtcclxuICAgIHBhdGggPSBub2RlUGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIHBhdGgpO1xyXG4gICAgbGV0IGZpbGVIYW5kbGU6IGZzLkZpbGVIYW5kbGUgfCBmYWxzZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgZmlsZUhhbmRsZSA9IGF3YWl0IGZzLm9wZW4ocGF0aCwgZmxhZ3MpO1xyXG4gICAgfSBjYXRjaCB7XHJcbiAgICAgICAgZmlsZUhhbmRsZSA9IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmaWxlSGFuZGxlO1xyXG59XHJcblxyXG5jb25zdCB3cml0ZUZpbGUgPSBhc3luYyAocGF0aDogc3RyaW5nLCBkYXRhOiBzdHJpbmcgPSBcIlwiKSA9PiB7XHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gbm9kZVBhdGgubm9ybWFsaXplKHBhdGgpLFxyXG4gICAgICAgIHBhcnNlZCA9IG5vZGVQYXRoLnBhcnNlKG5vcm1hbGl6ZWQpLFxyXG4gICAgICAgIHNwbGl0ID0gcGFyc2VkLmRpci5zcGxpdChub2RlUGF0aC5zZXApLmZpbHRlcihkID0+IGQubGVuZ3RoID4gMCk7XHJcbiAgICBwYXRoID0gbm9kZVBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBub3JtYWxpemVkKTtcclxuXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwbGl0Lmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IGZzLm1rZGlyKG5vZGVQYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgLi4uc3BsaXQuc2xpY2UoMCwgaSArIDEpKSk7XHJcbiAgICAgICAgfSBjYXRjaCB7IH1cclxuXHJcbiAgICBhd2FpdCBmcy53cml0ZUZpbGUocGF0aCwgZGF0YSk7XHJcbn1cclxuXHJcbmNvbnN0IGNyZWF0ZURpcmVjdG9yeSA9IGFzeW5jIChwYXRoOiBzdHJpbmcpID0+IHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub2RlUGF0aC5ub3JtYWxpemUocGF0aCksXHJcbiAgICAgICAgcGFyc2VkID0gbm9kZVBhdGgucGFyc2Uobm9ybWFsaXplZCksXHJcbiAgICAgICAgc3BsaXQgPSBbLi4ucGFyc2VkLmRpci5zcGxpdChub2RlUGF0aC5zZXApLCBwYXJzZWQubmFtZV0uZmlsdGVyKGQgPT4gZC5sZW5ndGggPiAwKTtcclxuXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwbGl0Lmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IGZzLm1rZGlyKG5vZGVQYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgLi4uc3BsaXQuc2xpY2UoMCwgaSArIDEpKSk7XHJcbiAgICAgICAgfSBjYXRjaCB7IH1cclxufVxyXG5cclxuZXhwb3J0IHsgb3BlbkZpbGUsIHdyaXRlRmlsZSwgY3JlYXRlRGlyZWN0b3J5IH0iLCJpbXBvcnQgQXJnc1BhcnNlciBmcm9tIFwiLi4vYXJnc1BhcnNlclwiO1xyXG5pbXBvcnQgeyBjcmVhdGVEaXJlY3RvcnksIHdyaXRlRmlsZSB9IGZyb20gXCIuLi9maWxlc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwibm9kZTpwYXRoXCI7XHJcblxyXG5jb25zdCBpbml0ID0gKGFyZ3NQYXJzZXI6IEFyZ3NQYXJzZXIpID0+IHtcclxuICAgIGNvbnN0IHJlcG8gPSBcIi4vLmJyaWZrYVwiO1xyXG5cclxuICAgIGNvbnN0IGpvaW4gPSAoLi4ucGF0aHM6IHN0cmluZ1tdKSA9PiBwYXRoLmpvaW4ocmVwbywgLi4ucGF0aHMpO1xyXG5cclxuICAgIHdyaXRlRmlsZShqb2luKFwibWVtL2NvbW1pdHNcIikpO1xyXG4gICAgd3JpdGVGaWxlKGpvaW4oXCJtZW0vdHJhY2VkXCIpKTtcclxuXHJcbiAgICBjcmVhdGVEaXJlY3Rvcnkoam9pbihcInJlcFwiKSlcclxuXHJcbiAgICB3cml0ZUZpbGUoXCJicmlma2EuY29uZmlnLmpzb25cIiwgSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgIHNlcnZlcjogXCJcIixcclxuICAgICAgICBwb3J0OiAyMSxcclxuICAgICAgICBsb2dpbjogXCJcIixcclxuICAgICAgICBwYXNzd29yZDogXCJcIlxyXG4gICAgfSkpO1xyXG4gICAgd3JpdGVGaWxlKFwiLmJyaWdub3JlXCIsIFwiYnJpZmthLmNvbmZpZy5qc29uXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBpbml0OyIsImltcG9ydCBBcmdzUGFyc2VyIGZyb20gXCIuLi9hcmdzUGFyc2VyXCI7XHJcblxyXG5jb25zdCB0cmFjayA9IChhcmdzUGFyc2VyOiBBcmdzUGFyc2VyKSA9PiB7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHRyYWNrOyIsImltcG9ydCBoZWxwIGZyb20gXCIuL2hlbHBcIjtcclxuaW1wb3J0IGluaXQgZnJvbSBcIi4vaW5pdFwiO1xyXG5pbXBvcnQgdHJhY2sgZnJvbSBcIi4vdHJhY2tcIjtcclxuXHJcbmNvbnN0IGludGVycHJldCA9IHtcclxuICAgIGhlbHAsIGluaXQsIHRyYWNrXHJcbn07XHJcblxyXG5leHBvcnQgeyBpbnRlcnByZXQgfTsiLCJpbXBvcnQgQXJnc1BhcnNlciBmcm9tIFwiLi9hcmdzUGFyc2VyXCI7XHJcbmltcG9ydCBib3JkZXIgZnJvbSBcIi4vYm9yZGVyXCI7XHJcbmltcG9ydCB7IGludGVycHJldCB9IGZyb20gXCIuL2NvbW1hbmRzL2luZGV4XCI7XHJcbmltcG9ydCBjaGFsayBmcm9tIFwiY2hhbGtcIjtcclxuXHJcbmNvbnN0IGludGVycHJldENvbW1hbmRzID0gKGFyZ3NQYXJzZXI6IEFyZ3NQYXJzZXIpID0+IHtcclxuICAgIGNvbnN0IGNvbW1hbmQgPSBhcmdzUGFyc2VyLm5leHQoKTtcclxuXHJcbiAgICBzd2l0Y2ggKGNvbW1hbmQpIHtcclxuICAgICAgICBjYXNlIFwiaGVscFwiOlxyXG4gICAgICAgICAgICBpbnRlcnByZXQuaGVscChhcmdzUGFyc2VyKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBcImluaXRcIjpcclxuICAgICAgICAgICAgaW50ZXJwcmV0LmluaXQoYXJnc1BhcnNlcik7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgXCJ0cmFja1wiOlxyXG4gICAgICAgICAgICBpbnRlcnByZXQudHJhY2soYXJnc1BhcnNlcik7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoY2hhbGsucmVkKGBcXG5Db21tYW5kICcke2NvbW1hbmR9JyBkb2Vzbid0IGV4aXN0LmApKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYm9yZGVyKFwiVG8gZ2V0IGRvY3VtZW50YXRpb24gb2YgYWxsIGNvbW1hbmRzIHR5cGUgJ2JyaWZrYSBoZWxwJyBvciAnYnJpZmthIGhlbHAgPGNvbW1hbmRfbmFtZT4nIHRvIGdldCBkb2N1bWVudGF0aW9uIG9mIHNwZWNpZmljIGNvbW1hbmQuXCIsIFwiSGVscFwiKSlcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGludGVycHJldENvbW1hbmRzOyIsImltcG9ydCBBcmdzUGFyc2VyIGZyb20gXCIuL2FyZ3NQYXJzZXJcIjtcclxuaW1wb3J0IGludGVycHJldENvbW1hbmRzIGZyb20gXCIuL2ludGVycHJldENvbW1hbmRzXCI7XHJcblxyXG5jb25zdCBhcmdzUGFyc2VyID0gbmV3IEFyZ3NQYXJzZXIocHJvY2Vzcy5hcmd2LnNsaWNlKDIpKTtcclxuaW50ZXJwcmV0Q29tbWFuZHMoYXJnc1BhcnNlcik7Il0sIm5hbWVzIjpbInN0eWxlcyIsInByb2Nlc3MiLCJwYXRoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBLE1BQU0sVUFBVSxDQUFBO0FBQ0wsSUFBQSxJQUFJLENBQVc7SUFDZCxLQUFLLEdBQVcsQ0FBQyxDQUFDO0FBRTFCLElBQUEsV0FBQSxDQUFZLEtBQWUsRUFBQTtBQUN2QixRQUFBLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDO0tBQ3JCO0lBRU0sSUFBSSxHQUFBO1FBQ1AsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTTtBQUFFLFlBQUEsT0FBTyxLQUFLLENBQUM7UUFDakQsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0tBQ2xDO0lBRU0sSUFBSSxHQUFBO0FBQ1AsUUFBQSxJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxHQUFHLENBQUM7QUFBRSxZQUFBLE9BQU8sS0FBSyxDQUFDO1FBQ3JDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNsQztJQUVNLElBQUksR0FBQTtRQUNQLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU07QUFBRSxZQUFBLE9BQU8sS0FBSyxDQUFDO1FBQ2pELE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDaEM7QUFDSjs7QUN0QkQsTUFBTSxNQUFNLEdBQUcsQ0FBQyxJQUFZLEVBQUUsS0FBZ0IsR0FBQSxFQUFFLEtBQVk7SUFFeEQsTUFBTSxLQUFLLEdBQWEsRUFBRSxDQUFDO0FBQzNCLElBQUEsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNuRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBRXBDLElBQUEsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFBLEVBQUEsRUFBSyxLQUFLLENBQUEsQ0FBQSxFQUFJLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFJLEVBQUEsQ0FBQSxDQUFDLENBQUM7SUFFakYsSUFBSSxXQUFXLEdBQUcsRUFBRSxDQUFDO0FBQ3JCLElBQUEsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFO0FBQ3ZDLFFBQUEsSUFBSSxDQUFDLEdBQUcsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEdBQUcsS0FBSyxHQUFHLENBQUM7WUFDN0QsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNoQztZQUNELE1BQU0sTUFBTSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDckMsWUFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUEsQ0FBQSxFQUFJLE1BQU0sQ0FBQSxFQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFHLENBQUEsQ0FBQSxDQUFDLENBQUM7WUFDaEYsV0FBVyxHQUFHLEVBQUUsQ0FBQTtBQUNoQixZQUFBLENBQUMsRUFBRSxDQUFDO1NBQ1A7QUFFTCxJQUFBLElBQUksV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDO0FBQ3RCLFFBQUEsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFJLENBQUEsRUFBQSxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQSxDQUFBLENBQUcsQ0FBQyxDQUFDO0lBRWxILEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQSxDQUFBLEVBQUksS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFHLENBQUEsQ0FBQSxDQUFDLENBQUM7SUFFdkQsT0FBTyxDQUFBLEVBQUEsRUFBSyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDckMsQ0FBQyxDQUFBO0FBR0Q7QUFDQTs7QUM3QkEsTUFBTSxzQkFBc0IsR0FBRyxFQUFFLENBQUM7QUFDbEM7QUFDQSxNQUFNLFVBQVUsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEU7QUFDQSxNQUFNLFdBQVcsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsR0FBRyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMvRTtBQUNBLE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLEVBQUUsR0FBRyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDN0c7QUFDQSxNQUFNQSxRQUFNLEdBQUc7QUFDZixDQUFDLFFBQVEsRUFBRTtBQUNYLEVBQUUsS0FBSyxF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QUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEdBQUcsVUFBVSxLQUFLO0FBQzVELENBQUMsSUFBSSxLQUFLLEtBQUssS0FBSyxFQUFFO0FBQ3RCLEVBQUUsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO0FBQzNCLEdBQUcsT0FBTyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUM7QUFDbEQsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUU7QUFDM0IsR0FBRyxPQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUM7QUFDM0UsR0FBRztBQUNIO0FBQ0EsRUFBRSxPQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUM7QUFDcEUsRUFBRTtBQUNGO0FBQ0EsQ0FBQyxJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUU7QUFDdEIsRUFBRSxPQUFPLFlBQVksQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDO0FBQ2pGLEVBQUU7QUFDRjtBQUNBLENBQUMsT0FBTyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQztBQUMvQyxDQUFDLENBQUM7QUFDRjtBQUNBLE1BQU0sVUFBVSxHQUFHLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztBQUM3QztBQUNBLEtBQUssTUFBTSxLQUFLLElBQUksVUFBVSxFQUFFO0FBQ2hDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHO0FBQ2pCLEVBQUUsR0FBRyxHQUFHO0FBQ1IsR0FBRyxNQUFNLENBQUMsS0FB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LENBQUMsRUFDbkMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDckUsSUFBQSxJQUFJLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFFbkQsSUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUU7QUFDakMsUUFBQSxJQUFJO1lBQ0EsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUM3RTtRQUFDLE1BQU0sR0FBRztJQUVmLE1BQU0sRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDbkMsQ0FBQyxDQUFBO0FBRUQsTUFBTSxlQUFlLEdBQUcsT0FBTyxJQUFZLEtBQUk7SUFDM0MsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFDdkMsTUFBTSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLEVBQ25DLEtBQUssR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFFdkYsSUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFD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
