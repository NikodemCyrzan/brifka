"use strict";var e=require("node:process"),t=require("node:os"),r=require("node:tty"),o=require("node:fs/promises"),n=require("node:path"),i=require("node:crypto");const s=(e=0)=>t=>`[${t+e}m`,l=(e=0)=>t=>`[${38+e};5;${t}m`,a=(e=0)=>(t,r,o)=>`[${38+e};2;${t};${r};${o}m`,c={modifier:{reset:[0,0],bold:[1,22],dim:[2,22],italic:[3,23],underline:[4,24],overline:[53,55],inverse:[7,27],hidden:[8,28],strikethrough:[9,29]},color:{black:[30,39],red:[31,39],green:[32,39],yellow:[33,39],blue:[34,39],magenta:[35,39],cyan:[36,39],white:[37,39],blackBright:[90,39],gray:[90,39],grey:[90,39],redBright:[91,39],greenBright:[92,39],yellowBright:[93,39],blueBright:[94,39],magentaBright:[95,39],cyanBright:[96,39],whiteBright:[97,39]},bgColor:{bgBlack:[40,49],bgRed:[41,49],bgGreen:[42,49],bgYellow:[43,49],bgBlue:[44,49],bgMagenta:[45,49],bgCyan:[46,49],bgWhite:[47,49],bgBlackBright:[100,49],bgGray:[100,49],bgGrey:[100,49],bgRedBright:[101,49],bgGreenBright:[102,49],bgYellowBright:[103,49],bgBlueBright:[104,49],bgMagentaBright:[105,49],bgCyanBright:[106,49],bgWhiteBright:[107,49]}};Object.keys(c.modifier);Object.keys(c.color),Object.keys(c.bgColor);const d=function(){const e=new Map;for(const[t,r]of Object.entries(c)){for(const[t,o]of Object.entries(r))c[t]={open:`[${o[0]}m`,close:`[${o[1]}m`},r[t]=c[t],e.set(o[0],o[1]);Object.defineProperty(c,t,{value:r,enumerable:!1})}return Object.defineProperty(c,"codes",{value:e,enumerable:!1}),c.color.close="[39m",c.bgColor.close="[49m",c.color.ansi=s(),c.color.ansi256=l(),c.color.ansi16m=a(),c.bgColor.ansi=s(10),c.bgColor.ansi256=l(10),c.bgColor.ansi16m=a(10),Object.defineProperties(c,{rgbToAnsi256:{value:(e,t,r)=>e===t&&t===r?e<8?16:e>248?231:Math.round((e-8)/247*24)+232:16+36*Math.round(e/255*5)+6*Math.round(t/255*5)+Math.round(r/255*5),enumerable:!1},hexToRgb:{value(e){const t=/[a-f\d]{6}|[a-f\d]{3}/i.exec(e.toString(16));if(!t)return[0,0,0];let[r]=t;3===r.length&&(r=[...r].map((e=>e+e)).join(""));const o=Number.parseInt(r,16);return[o>>16&255,o>>8&255,255&o]},enumerable:!1},hexToAnsi256:{value:e=>c.rgbToAnsi256(...c.hexToRgb(e)),enumerable:!1},ansi256ToAnsi:{value(e){if(e<8)return 30+e;if(e<16)return e-8+90;let t,r,o;if(e>=232)t=(10*(e-232)+8)/255,r=t,o=t;else{const n=(e-=16)%36;t=Math.floor(e/36)/5,r=Math.floor(n/6)/5,o=n%6/5}const n=2*Math.max(t,r,o);if(0===n)return 30;let i=30+(Math.round(o)<<2|Math.round(r)<<1|Math.round(t));return 2===n&&(i+=60),i},enumerable:!1},rgbToAnsi:{value:(e,t,r)=>c.ansi256ToAnsi(c.rgbToAnsi256(e,t,r)),enumerable:!1},hexToAnsi:{value:e=>c.ansi256ToAnsi(c.hexToAnsi256(e)),enumerable:!1}}),c}();function f(t,r=(globalThis.Deno?globalThis.Deno.args:e.argv)){const o=t.startsWith("-")?"":1===t.length?"-":"--",n=r.indexOf(o+t),i=r.indexOf("--");return-1!==n&&(-1===i||n<i)}const{env:h}=e;let u;function m(r,{streamIsTTY:o,sniffFlags:n=!0}={}){const i=function(){if("FORCE_COLOR"in h)return"true"===h.FORCE_COLOR?1:"false"===h.FORCE_COLOR?0:0===h.FORCE_COLOR.length?1:Math.min(Number.parseInt(h.FORCE_COLOR,10),3)}();void 0!==i&&(u=i);const s=n?u:i;if(0===s)return 0;if(n){if(f("color=16m")||f("color=full")||f("color=truecolor"))return 3;if(f("color=256"))return 2}if("TF_BUILD"in h&&"AGENT_NAME"in h)return 1;if(r&&!o&&void 0===s)return 0;const l=s||0;if("dumb"===h.TERM)return l;if("win32"===e.platform){const e=t.release().split(".");return Number(e[0])>=10&&Number(e[2])>=10586?Number(e[2])>=14931?3:2:1}if("CI"in h)return"GITHUB_ACTIONS"in h||"GITEA_ACTIONS"in h?3:["TRAVIS","CIRCLECI","APPVEYOR","GITLAB_CI","BUILDKITE","DRONE"].some((e=>e in h))||"codeship"===h.CI_NAME?1:l;if("TEAMCITY_VERSION"in h)return/^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(h.TEAMCITY_VERSION)?1:0;if("truecolor"===h.COLORTERM)return 3;if("xterm-kitty"===h.TERM)return 3;if("TERM_PROGRAM"in h){const e=Number.parseInt((h.TERM_PROGRAM_VERSION||"").split(".")[0],10);switch(h.TERM_PROGRAM){case"iTerm.app":return e>=3?3:2;case"Apple_Terminal":return 2}}return/-256(color)?$/i.test(h.TERM)?2:/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(h.TERM)||"COLORTERM"in h?1:l}function g(e,t={}){return function(e){return 0!==e&&{level:e,hasBasic:!0,has256:e>=2,has16m:e>=3}}(m(e,{streamIsTTY:e&&e.isTTY,...t}))}f("no-color")||f("no-colors")||f("color=false")||f("color=never")?u=0:(f("color")||f("colors")||f("color=true")||f("color=always"))&&(u=1);const p={stdout:g({isTTY:r.isatty(1)}),stderr:g({isTTY:r.isatty(2)})};function b(e,t,r){let o=e.indexOf(t);if(-1===o)return e;const n=t.length;let i=0,s="";do{s+=e.slice(i,o)+t+r,i=o+n,o=e.indexOf(t,i)}while(-1!==o);return s+=e.slice(i),s}const{stdout:y,stderr:v}=p,w=Symbol("GENERATOR"),k=Symbol("STYLER"),O=Symbol("IS_EMPTY"),T=["ansi","ansi","ansi256","ansi16m"],$=Object.create(null),R=e=>{const t=(...e)=>e.join(" ");return((e,t={})=>{if(t.level&&!(Number.isInteger(t.level)&&t.level>=0&&t.level<=3))throw new Error("The `level` option should be an integer from 0 to 3");const r=y?y.level:0;e.level=void 0===t.level?r:t.level})(t,e),Object.setPrototypeOf(t,A.prototype),t};function A(e){return R(e)}Object.setPrototypeOf(A.prototype,Function.prototype);for(const[e,t]of Object.entries(d))$[e]={get(){const r=_(this,C(t.open,t.close,this[k]),this[O]);return Object.defineProperty(this,e,{value:r}),r}};$.visible={get(){const e=_(this,this[k],!0);return Object.defineProperty(this,"visible",{value:e}),e}};const j=(e,t,r,...o)=>"rgb"===e?"ansi16m"===t?d[r].ansi16m(...o):"ansi256"===t?d[r].ansi256(d.rgbToAnsi256(...o)):d[r].ansi(d.rgbToAnsi(...o)):"hex"===e?j("rgb",t,r,...d.hexToRgb(...o)):d[r][e](...o),x=["rgb","hex","ansi256"];for(const e of x){$[e]={get(){const{level:t}=this;return function(...r){const o=C(j(e,T[t],"color",...r),d.color.close,this[k]);return _(this,o,this[O])}}};$["bg"+e[0].toUpperCase()+e.slice(1)]={get(){const{level:t}=this;return function(...r){const o=C(j(e,T[t],"bgColor",...r),d.bgColor.close,this[k]);return _(this,o,this[O])}}}}const E=Object.defineProperties((()=>{}),{...$,level:{enumerable:!0,get(){return this[w].level},set(e){this[w].level=e}}}),C=(e,t,r)=>{let o,n;return void 0===r?(o=e,n=t):(o=r.openAll+e,n=t+r.closeAll),{open:e,close:t,openAll:o,closeAll:n,parent:r}},_=(e,t,r)=>{const o=(...e)=>M(o,1===e.length?""+e[0]:e.join(" "));return Object.setPrototypeOf(o,E),o[w]=e,o[k]=t,o[O]=r,o},M=(e,t)=>{if(e.level<=0||!t)return e[O]?"":t;let r=e[k];if(void 0===r)return t;const{openAll:o,closeAll:n}=r;if(t.includes(""))for(;void 0!==r;)t=b(t,r.close,r.open),r=r.parent;const i=t.indexOf("\n");return-1!==i&&(t=function(e,t,r,o){let n=0,i="";do{const s="\r"===e[o-1];i+=e.slice(n,s?o-1:o)+t+(s?"\r\n":"\n")+r,n=o+1,o=e.indexOf("\n",n)}while(-1!==o);return i+=e.slice(n),i}(t,n,o,i)),o+t+n};Object.defineProperties(A.prototype,$);const B=A();A({level:v?v.level:0});class I{args;index=0;constructor(e){this.args=e}next(){return!(this.index>=this.args.length)&&this.args[this.index++]}prev(){return!(this.index-1<0)&&this.args[--this.index]}peek(){return!(this.index>=this.args.length)&&this.args[this.index]}}const S=(e,t="")=>{const r=[],o=Math.min(process.stdout.columns,45),n=e.split(" ");r.push(`╭╴${t}╶${Array(o-5-t.length).fill("─").join("")}─╮`);let i=[];for(let e=0;e<n.length;e++)if([...i,n[e]].join(" ").length<o-2)i.push(n[e]);else{const t=i.join(" ");r.push(`│${t}${Array(o-2-t.length).fill(" ").join("")}│`),i=[],e--}return i.length>0&&r.push(`│${i.join(" ")}${Array(o-2-i.join(" ").length).fill(" ").join("")}│`),r.push(`╰${Array(o-2).fill("─").join("")}╯`),`\n${r.join("\n")}\n`},F=B.yellow,L=B.blue,N={init:`${L("init")}\n\n\tCreates new brifka repository in current working path.`,track:`${L("track <directory_path> | <file_path> | .")}\n\n\tAdds files to the tracked stage.\n\t${F("<directory_path>")} - all files and directories in that directory will be tracked.\n\t${F("<file_path>")} - file will be tracked.\n\t${F(".")} - all files besides excluded in '.brignore' will be tracked.`,untrack:`${L("untrack <directory_path> | <file_path> | .")}\n\n\tRemoves files from tracked stage.\n\t${F("<directory_path>")} - all files and directories in that directory will be untracked.\n\t${F("<file_path>")} - file will be untracked.\n\t${F(".")} - all files  will be untracked.`,commit:`${L("commit <commit_name>")}\n\n\tAdds new commit to the repository.\n\t${F("<commit_name>")} - name of new commit.`,uncommit:`${L("uncommit")}\n\n\tRemoves last commit from the repository.`,commits:`${L("commits")}\n${L("commits <limit>")}\n\n\tDisplays commits.\n\t${F("<limit>")} - displays only last x commits.`,push:`${L("push")}\n\n\tSends repository to the ftp server specified in 'brifka.config.json'.`,pull:`${L("pull")}\n\n\tDownloads repository from ftp server specified in 'brifka.config.json'.`},P=async(e,t="")=>{const r=n.normalize(e),i=n.parse(r).dir.split(n.sep).filter((e=>e.length>0));e=n.resolve(process.cwd(),r);for(let e=0;e<i.length;e++)try{await o.mkdir(n.resolve(process.cwd(),...i.slice(0,e+1)))}catch{}await o.writeFile(e,t)},D=async(e,t)=>{const r=n.normalize(e),i=n.parse(r).dir.split(n.sep).filter((e=>e.length>0));e=n.resolve(process.cwd(),r);for(let e=0;e<i.length;e++)try{await o.mkdir(n.resolve(process.cwd(),...i.slice(0,e+1)))}catch{}await o.appendFile(e,t)},G=async e=>{e=n.resolve(process.cwd(),e);try{return await o.readFile(e,{encoding:"utf8"})}catch{return!1}},Y=async(e,t)=>{const r=await o.readdir(e);for(const i of r)try{const r=n.resolve(e,i),s=await o.stat(r);s.isDirectory()?await Y(r,t):s.isFile()&&t.add(n.relative(process.cwd(),r))}catch{}},q=e=>e.join(t.EOL),z=e=>e.split(t.EOL).filter((e=>e.length>0)),H=async(e,t)=>{const r=await o.readdir(e);for(const i of r)try{const r=n.resolve(e,i),s=await o.stat(r);s.isDirectory()?await H(r,t):s.isFile()&&t.add(n.relative(process.cwd(),r))}catch{}},U=async(e,t)=>{const r=`.brifka/rep/${t.slice(0,8)}`,o=await G(e);("boolean"!=typeof o||o)&&await P(r,o)},V=e=>{if(!e.peek())return void console.log(`\n${Object.values(N).join("\n\n")}\n`);const t=e.peek();Object.keys(N).find((e=>e==t))?.length?console.log(`\n${N[t]}\n`):(console.error(B.red(`\nCommand '${t}' doesn't exist.`)),console.log(S("Type 'brifka help' to view documentation of all commands.","Help")))},W=e=>{const t=(...e)=>n.join("./.brifka",...e);P(t("mem/commits")),P(t("mem/tracked")),(async e=>{const t=n.normalize(e),r=n.parse(t),i=[...r.dir.split(n.sep),r.name].filter((e=>e.length>0));for(let e=0;e<i.length;e++)try{await o.mkdir(n.resolve(process.cwd(),...i.slice(0,e+1)))}catch{}})(t("rep")),P("brifka.config.json",JSON.stringify({server:"",port:21,login:"",password:""})),P(".brignore","brifka.config.json")},J=async e=>{const r=e.next();if(!r||r.length<=0)return void console.error(B.red("\nTrack command requires <directory_path> | <file_path> | . argument.\n"));const i=".brifka/mem/tracked",s=n.resolve(process.cwd(),r);let l;try{l=await o.stat(s)}catch{return void console.error(B.red(`\nFile or directory '${r}' doesn't exist.\n`))}const a=await G(i);if("string"!=typeof a)return void console.error(B.red("\nRepository memory corrupted :/\n"));const c=new Set(z(a));if(l.isDirectory()){const e=new Set;await H(s,e);const o=new Set(Array.from(e).filter((e=>!c.has(e))));await D(i,q(Array.from(o))+t.EOL),console.log(`\n${B.green(o.size)} new files added to tracked stage from directory '${r}'.\n`)}else if(l.isFile()){const e=n.relative(process.cwd(),s);if(c.has(e))return void console.error(B.red(`\nFile '${e}' is already tracked.\n`));await D(i,q([e])+t.EOL),console.log(`\nAdded '${r}' to tracked stage.\n`)}},K=async e=>{const t=e.next();if(!t||t.length<=0)return void console.error(B.red("\nUntrack command requires <directory_path> | <file_path> | . argument.\n"));const r=".brifka/mem/tracked",i=await G(r);if("string"!=typeof i)return void console.error(B.red("\nRepository memory corrupted :/\n"));const s=n.normalize(t),l=n.resolve(process.cwd(),s),a=new Set(z(i));let c;try{c=await o.stat(l)}catch{return void console.log(B.red(`\nFile or directory '${t}' doesn't exist.\n`))}if(c.isFile())a.delete(s)?console.log(`\nRemoved '${t}' from tracked stage.\n`):console.log(B.red(`\nFile '${t}' wasn't tracked.\n`));else if(c.isDirectory()){const e=new Set;await Y(l,e);let r=0;for(const t of e)a.delete(t)&&r++;console.log(`\n${B.red(r)} files removed from tracked stage from directory '${t}'.\n`)}await P(r,q(Array.from(a)))},Q=async e=>{const r=e.next();if(!r||r.length<=0)return void console.error(B.red("\nCommit command requires <commit_name> argument.\n"));const o=i.randomBytes(32).toString("hex");var n;await D(".brifka/mem/commits",`${n=[{title:r,hash:o}],n.map((({title:e,hash:t})=>`${e.length}${e}${t}`)).join(t.EOL)}\n`);const s=await G(".brifka/mem/tracked");if("string"==typeof s&&s.length<=0)return void console.error(B.red("\nThere aren't any files in tracked stage.\n"));if("boolean"==typeof s&&!s)return void console.error(B.red("\nRepository memory corrupted :/\n"));const l=z(s),a=[];for(const e of l){const t=await G(e);if("boolean"==typeof t&&!t)continue;const r=i.createHash("sha256").update(t).digest("hex");await U(e,r),a.push({path:e,hash:r})}var c;await P(`.brifka/rep/${o.slice(0,8)}`,(c=a,c.map((({path:e,hash:t})=>`${e.length}${e}${t}`)).join(t.EOL)))};(async()=>{const e=new I(process.argv.slice(2)),t=e.peek();let r=!1;try{if(!(await o.stat(n.resolve(process.cwd(),".brifka"))).isDirectory())throw new Error;r=!0}catch{}if(!r&&(!t||"init"!=t&&"help"!=t))return console.log(B.red("\nBrifka repository is not initialised.")),void console.log(S("Type 'brifka init' to initialise repository.","Help"));(e=>{const t=e.next();switch(t){case"help":V(e);break;case"init":W(e);break;case"track":J(e);break;case"untrack":K(e);break;case"commit":Q(e);break;default:console.error(B.red(`\nCommand '${t}' doesn't exist.`)),console.log(S("To get documentation of all commands type 'brifka help' or 'brifka help <command_name>' to get documentation of specific command.","Help"))}})(e)})();
