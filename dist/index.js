"use strict";var e=require("node:process"),t=require("node:os"),r=require("node:tty"),o=require("node:fs/promises"),n=require("node:path"),i=require("node:crypto");const s=(e=0)=>t=>`[${t+e}m`,l=(e=0)=>t=>`[${38+e};5;${t}m`,a=(e=0)=>(t,r,o)=>`[${38+e};2;${t};${r};${o}m`,c={modifier:{reset:[0,0],bold:[1,22],dim:[2,22],italic:[3,23],underline:[4,24],overline:[53,55],inverse:[7,27],hidden:[8,28],strikethrough:[9,29]},color:{black:[30,39],red:[31,39],green:[32,39],yellow:[33,39],blue:[34,39],magenta:[35,39],cyan:[36,39],white:[37,39],blackBright:[90,39],gray:[90,39],grey:[90,39],redBright:[91,39],greenBright:[92,39],yellowBright:[93,39],blueBright:[94,39],magentaBright:[95,39],cyanBright:[96,39],whiteBright:[97,39]},bgColor:{bgBlack:[40,49],bgRed:[41,49],bgGreen:[42,49],bgYellow:[43,49],bgBlue:[44,49],bgMagenta:[45,49],bgCyan:[46,49],bgWhite:[47,49],bgBlackBright:[100,49],bgGray:[100,49],bgGrey:[100,49],bgRedBright:[101,49],bgGreenBright:[102,49],bgYellowBright:[103,49],bgBlueBright:[104,49],bgMagentaBright:[105,49],bgCyanBright:[106,49],bgWhiteBright:[107,49]}};Object.keys(c.modifier);Object.keys(c.color),Object.keys(c.bgColor);const h=function(){const e=new Map;for(const[t,r]of Object.entries(c)){for(const[t,o]of Object.entries(r))c[t]={open:`[${o[0]}m`,close:`[${o[1]}m`},r[t]=c[t],e.set(o[0],o[1]);Object.defineProperty(c,t,{value:r,enumerable:!1})}return Object.defineProperty(c,"codes",{value:e,enumerable:!1}),c.color.close="[39m",c.bgColor.close="[49m",c.color.ansi=s(),c.color.ansi256=l(),c.color.ansi16m=a(),c.bgColor.ansi=s(10),c.bgColor.ansi256=l(10),c.bgColor.ansi16m=a(10),Object.defineProperties(c,{rgbToAnsi256:{value:(e,t,r)=>e===t&&t===r?e<8?16:e>248?231:Math.round((e-8)/247*24)+232:16+36*Math.round(e/255*5)+6*Math.round(t/255*5)+Math.round(r/255*5),enumerable:!1},hexToRgb:{value(e){const t=/[a-f\d]{6}|[a-f\d]{3}/i.exec(e.toString(16));if(!t)return[0,0,0];let[r]=t;3===r.length&&(r=[...r].map((e=>e+e)).join(""));const o=Number.parseInt(r,16);return[o>>16&255,o>>8&255,255&o]},enumerable:!1},hexToAnsi256:{value:e=>c.rgbToAnsi256(...c.hexToRgb(e)),enumerable:!1},ansi256ToAnsi:{value(e){if(e<8)return 30+e;if(e<16)return e-8+90;let t,r,o;if(e>=232)t=(10*(e-232)+8)/255,r=t,o=t;else{const n=(e-=16)%36;t=Math.floor(e/36)/5,r=Math.floor(n/6)/5,o=n%6/5}const n=2*Math.max(t,r,o);if(0===n)return 30;let i=30+(Math.round(o)<<2|Math.round(r)<<1|Math.round(t));return 2===n&&(i+=60),i},enumerable:!1},rgbToAnsi:{value:(e,t,r)=>c.ansi256ToAnsi(c.rgbToAnsi256(e,t,r)),enumerable:!1},hexToAnsi:{value:e=>c.ansi256ToAnsi(c.hexToAnsi256(e)),enumerable:!1}}),c}();function d(t,r=(globalThis.Deno?globalThis.Deno.args:e.argv)){const o=t.startsWith("-")?"":1===t.length?"-":"--",n=r.indexOf(o+t),i=r.indexOf("--");return-1!==n&&(-1===i||n<i)}const{env:f}=e;let m;function u(r,{streamIsTTY:o,sniffFlags:n=!0}={}){const i=function(){if("FORCE_COLOR"in f)return"true"===f.FORCE_COLOR?1:"false"===f.FORCE_COLOR?0:0===f.FORCE_COLOR.length?1:Math.min(Number.parseInt(f.FORCE_COLOR,10),3)}();void 0!==i&&(m=i);const s=n?m:i;if(0===s)return 0;if(n){if(d("color=16m")||d("color=full")||d("color=truecolor"))return 3;if(d("color=256"))return 2}if("TF_BUILD"in f&&"AGENT_NAME"in f)return 1;if(r&&!o&&void 0===s)return 0;const l=s||0;if("dumb"===f.TERM)return l;if("win32"===e.platform){const e=t.release().split(".");return Number(e[0])>=10&&Number(e[2])>=10586?Number(e[2])>=14931?3:2:1}if("CI"in f)return"GITHUB_ACTIONS"in f||"GITEA_ACTIONS"in f?3:["TRAVIS","CIRCLECI","APPVEYOR","GITLAB_CI","BUILDKITE","DRONE"].some((e=>e in f))||"codeship"===f.CI_NAME?1:l;if("TEAMCITY_VERSION"in f)return/^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(f.TEAMCITY_VERSION)?1:0;if("truecolor"===f.COLORTERM)return 3;if("xterm-kitty"===f.TERM)return 3;if("TERM_PROGRAM"in f){const e=Number.parseInt((f.TERM_PROGRAM_VERSION||"").split(".")[0],10);switch(f.TERM_PROGRAM){case"iTerm.app":return e>=3?3:2;case"Apple_Terminal":return 2}}return/-256(color)?$/i.test(f.TERM)?2:/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(f.TERM)||"COLORTERM"in f?1:l}function g(e,t={}){return function(e){return 0!==e&&{level:e,hasBasic:!0,has256:e>=2,has16m:e>=3}}(u(e,{streamIsTTY:e&&e.isTTY,...t}))}d("no-color")||d("no-colors")||d("color=false")||d("color=never")?m=0:(d("color")||d("colors")||d("color=true")||d("color=always"))&&(m=1);const p={stdout:g({isTTY:r.isatty(1)}),stderr:g({isTTY:r.isatty(2)})};function b(e,t,r){let o=e.indexOf(t);if(-1===o)return e;const n=t.length;let i=0,s="";do{s+=e.slice(i,o)+t+r,i=o+n,o=e.indexOf(t,i)}while(-1!==o);return s+=e.slice(i),s}const{stdout:y,stderr:w}=p,v=Symbol("GENERATOR"),k=Symbol("STYLER"),$=Symbol("IS_EMPTY"),O=["ansi","ansi","ansi256","ansi16m"],T=Object.create(null),E=e=>{const t=(...e)=>e.join(" ");return((e,t={})=>{if(t.level&&!(Number.isInteger(t.level)&&t.level>=0&&t.level<=3))throw new Error("The `level` option should be an integer from 0 to 3");const r=y?y.level:0;e.level=void 0===t.level?r:t.level})(t,e),Object.setPrototypeOf(t,R.prototype),t};function R(e){return E(e)}Object.setPrototypeOf(R.prototype,Function.prototype);for(const[e,t]of Object.entries(h))T[e]={get(){const r=_(this,C(t.open,t.close,this[k]),this[$]);return Object.defineProperty(this,e,{value:r}),r}};T.visible={get(){const e=_(this,this[k],!0);return Object.defineProperty(this,"visible",{value:e}),e}};const A=(e,t,r,...o)=>"rgb"===e?"ansi16m"===t?h[r].ansi16m(...o):"ansi256"===t?h[r].ansi256(h.rgbToAnsi256(...o)):h[r].ansi(h.rgbToAnsi(...o)):"hex"===e?A("rgb",t,r,...h.hexToRgb(...o)):h[r][e](...o),x=["rgb","hex","ansi256"];for(const e of x){T[e]={get(){const{level:t}=this;return function(...r){const o=C(A(e,O[t],"color",...r),h.color.close,this[k]);return _(this,o,this[$])}}};T["bg"+e[0].toUpperCase()+e.slice(1)]={get(){const{level:t}=this;return function(...r){const o=C(A(e,O[t],"bgColor",...r),h.bgColor.close,this[k]);return _(this,o,this[$])}}}}const j=Object.defineProperties((()=>{}),{...T,level:{enumerable:!0,get(){return this[v].level},set(e){this[v].level=e}}}),C=(e,t,r)=>{let o,n;return void 0===r?(o=e,n=t):(o=r.openAll+e,n=t+r.closeAll),{open:e,close:t,openAll:o,closeAll:n,parent:r}},_=(e,t,r)=>{const o=(...e)=>M(o,1===e.length?""+e[0]:e.join(" "));return Object.setPrototypeOf(o,j),o[v]=e,o[k]=t,o[$]=r,o},M=(e,t)=>{if(e.level<=0||!t)return e[$]?"":t;let r=e[k];if(void 0===r)return t;const{openAll:o,closeAll:n}=r;if(t.includes(""))for(;void 0!==r;)t=b(t,r.close,r.open),r=r.parent;const i=t.indexOf("\n");return-1!==i&&(t=function(e,t,r,o){let n=0,i="";do{const s="\r"===e[o-1];i+=e.slice(n,s?o-1:o)+t+(s?"\r\n":"\n")+r,n=o+1,o=e.indexOf("\n",n)}while(-1!==o);return i+=e.slice(n),i}(t,n,o,i)),o+t+n};Object.defineProperties(R.prototype,T);const B=R();R({level:w?w.level:0});class I{args;index=0;constructor(e){this.args=e}next(){return!(this.index>=this.args.length)&&this.args[this.index++]}prev(){return!(this.index-1<0)&&this.args[--this.index]}peek(){return!(this.index>=this.args.length)&&this.args[this.index]}}const L=(e,t="")=>{const r=[],o=Math.min(process.stdout.columns,45),n=e.split(" ");r.push(`╭╴${t}╶${Array(o-5-t.length).fill("─").join("")}─╮`);let i=[];for(let e=0;e<n.length;e++)if([...i,n[e]].join(" ").length<o-2)i.push(n[e]);else{const t=i.join(" ");r.push(`│${t}${Array(o-2-t.length).fill(" ").join("")}│`),i=[],e--}return i.length>0&&r.push(`│${i.join(" ")}${Array(o-2-i.join(" ").length).fill(" ").join("")}│`),r.push(`╰${Array(o-2).fill("─").join("")}╯`),`\n${r.join("\n")}\n`},N=B.yellow,S=B.blue,F={init:`${S("init")}\n\n\tCreates new brifka repository in current working path.`,track:`${S("track <directory_path> | <file_path> | .")}\n\n\tAdds files to the tracked stage.\n\t${N("<directory_path>")} - all files and directories in that directory will be tracked.\n\t${N("<file_path>")} - file will be tracked.\n\t${N(".")} - all files besides excluded in '.brignore' will be tracked.`,untrack:`${S("untrack <directory_path> | <file_path> | .")}\n\n\tRemoves files from tracked stage.\n\t${N("<directory_path>")} - all files and directories in that directory will be untracked.\n\t${N("<file_path>")} - file will be untracked.\n\t${N(".")} - all files  will be untracked.`,commit:`${S("commit <commit_name>")}\n\n\tAdds new commit to the repository.\n\t${N("<commit_name>")} - name of new commit.`,uncommit:`${S("uncommit")}\n\n\tRemoves last commit from the repository.`,commits:`${S("commits")}\n${S("commits <limit>")}\n\n\tDisplays commits.\n\t${N("<limit>")} - displays only last x commits.`,change:`${S("change <commit_hash>")}\n\n\tChanges commit that is currently loaded.\n\t${N("<commit_hash>")} - hash of commit which you want to load.`,push:`${S("push")}\n\n\tSends repository to the ftp server specified in 'brifka.config.json'.`,pull:`${S("pull")}\n\n\tDownloads repository from ftp server specified in 'brifka.config.json'.`},P=async(e,t="")=>{const r=n.normalize(e),i=n.parse(r).dir.split(n.sep).filter((e=>e.length>0));e=n.resolve(process.cwd(),r);for(let e=0;e<i.length;e++)try{await o.mkdir(n.resolve(process.cwd(),...i.slice(0,e+1)))}catch{}await o.writeFile(e,t)},D=async(e,t)=>{const r=n.normalize(e),i=n.parse(r).dir.split(n.sep).filter((e=>e.length>0));e=n.resolve(process.cwd(),r);for(let e=0;e<i.length;e++)try{await o.mkdir(n.resolve(process.cwd(),...i.slice(0,e+1)))}catch{}await o.appendFile(e,t)},G=async e=>{e=n.resolve(process.cwd(),e);try{return await o.readFile(e,{encoding:"utf8"})}catch{return!1}},Y=async(e,t)=>{const r=await o.readdir(e);for(const i of r)try{const r=n.resolve(e,i),s=await o.stat(r);s.isDirectory()?await Y(r,t):s.isFile()&&t.add(n.relative(process.cwd(),r))}catch{}},q=e=>e.join(t.EOL),z=e=>e.split(t.EOL).filter((e=>e.length>0)),H=e=>{const r=e.split(t.EOL),o=[];try{r.forEach((e=>{if(e.length<=0)return;let t=0,r="";for(;""!=e[t]&&t<e.length;t++)r+=e[t];if(++t>=e.length)throw new Error;let n="",i=t;for(;t<e.length&&t<i+Number(r);t++)n+=e[t];if(""!=e[t])throw new Error;if(++t>=e.length)throw new Error;let s="";for(;""!=e[t]&&t<e.length;t++)s+=e[t];if(++t>=e.length)throw new Error;let l="";for(i=t;t<e.length&&t<i+Number(s);t++)l+=e[t];if(++t>=e.length)throw new Error;let a="";for(;t<e.length;t++)a+=e[t];o.push({title:n,hash:a,timestamp:Number(l)})}))}catch{return console.error(B.red("\nRepository memory corrupted :/\n")),[]}return o},U=async(e,t)=>{const r=await o.readdir(e);for(const i of r)try{const r=n.resolve(e,i),s=await o.stat(r);s.isDirectory()?await U(r,t):s.isFile()&&t.add(n.relative(process.cwd(),r))}catch{}},V=async(e,t)=>{const r=`.brifka/rep/${t.slice(0,8)}`,o=await G(e);("boolean"!=typeof o||o)&&await P(r,o)},W=e=>{if(!e.peek())return void console.log(`\n${Object.values(F).join("\n\n")}\n`);const t=e.peek();Object.keys(F).find((e=>e==t))?.length?console.log(`\n${F[t]}\n`):(console.error(B.red(`\nCommand '${t}' doesn't exist.`)),console.log(L("Type 'brifka help' to view documentation of all commands.","Help")))},J=e=>{const t=(...e)=>n.join("./.brifka",...e);P(t("mem/commits")),P(t("mem/tracked")),(async e=>{const t=n.normalize(e),r=n.parse(t),i=[...r.dir.split(n.sep),r.name].filter((e=>e.length>0));for(let e=0;e<i.length;e++)try{await o.mkdir(n.resolve(process.cwd(),...i.slice(0,e+1)))}catch{}})(t("rep")),P("brifka.config.json",JSON.stringify({server:"",port:21,login:"",password:""})),P(".brignore","brifka.config.json")},K=async e=>{const r=e.next();if(!r||r.length<=0)return void console.error(B.red("\nTrack command requires <directory_path> | <file_path> | . argument.\n"));const i=".brifka/mem/tracked",s=n.resolve(process.cwd(),r);let l;try{l=await o.stat(s)}catch{return void console.error(B.red(`\nFile or directory '${r}' doesn't exist.\n`))}const a=await G(i);if("string"!=typeof a)return void console.error(B.red("\nRepository memory corrupted :/\n"));const c=new Set(z(a));if(l.isDirectory()){const e=new Set;await U(s,e);const o=new Set(Array.from(e).filter((e=>!c.has(e))));await D(i,q(Array.from(o))+t.EOL),console.log(`\n${B.green(o.size)} new files added to tracked stage from directory '${r}'.\n`)}else if(l.isFile()){const e=n.relative(process.cwd(),s);if(c.has(e))return void console.error(B.red(`\nFile '${e}' is already tracked.\n`));await D(i,q([e])+t.EOL),console.log(`\nAdded '${r}' to tracked stage.\n`)}},Q=async e=>{const t=e.next();if(!t||t.length<=0)return void console.error(B.red("\nUntrack command requires <directory_path> | <file_path> | . argument.\n"));const r=".brifka/mem/tracked",i=await G(r);if("string"!=typeof i)return void console.error(B.red("\nRepository memory corrupted :/\n"));const s=n.normalize(t),l=n.resolve(process.cwd(),s),a=new Set(z(i));let c;try{c=await o.stat(l)}catch{return void console.log(B.red(`\nFile or directory '${t}' doesn't exist.\n`))}if(c.isFile())a.delete(s)?console.log(`\nRemoved '${t}' from tracked stage.\n`):console.log(B.red(`\nFile '${t}' wasn't tracked.\n`));else if(c.isDirectory()){const e=new Set;await Y(l,e);let r=0;for(const t of e)a.delete(t)&&r++;console.log(`\n${B.red(r)} files removed from tracked stage from directory '${t}'.\n`)}await P(r,q(Array.from(a)))},X=async e=>{const r=e.next();if(!r||r.length<=0)return void console.error(B.red("\nCommit command requires <commit_name> argument.\n"));const o=i.randomBytes(32).toString("hex");await D(".brifka/mem/commits",`${(e=>e.map((({title:e,hash:t,timestamp:r})=>{const o=r.toString();return`${e.length}${e}${o.length}${o}${t}`})).join(t.EOL))([{title:r,hash:o,timestamp:Date.now()}])}${t.EOL}`);const n=await G(".brifka/mem/tracked");if("string"==typeof n&&n.length<=0)return void console.error(B.red("\nThere aren't any files in tracked stage.\n"));if("boolean"==typeof n&&!n)return void console.error(B.red("\nRepository memory corrupted :/\n"));const s=z(n),l=[];for(const e of s){const t=await G(e);if("boolean"==typeof t&&!t)continue;const r=i.createHash("sha256").update(t).digest("hex");await V(e,r),l.push({path:e,hash:r})}var a;await P(`.brifka/rep/${o.slice(0,8)}`,(a=l,a.map((({path:e,hash:t})=>`${e.length}${e}${t}`)).join(t.EOL)))},Z=async e=>{const t=await G(".brifka/mem/commits");if("boolean"==typeof t&&!t)return;const r=H(t);console.log(`\n${r.reverse().map((({title:e,hash:t,timestamp:r})=>`${B.yellow("commit: "+t)}\nDate: ${new Date(r).toLocaleString()}\n\n\t${e}`)).join("\n\n")}\n`)},ee=async e=>{const r=e.next();if(!r||r.length<=0)return void console.error(B.red("Change command requires <commit_hash> argument.\n"));const o=await G(".brifka/mem/commits");if("boolean"==typeof o&&!o)return;const n=H(o).filter((({hash:e})=>r==e))[0];if(!n)return void console.error(`\nCommit with hash '${r}' doesn't exist.\n`);const i=`.brifka/rep/${n.hash.slice(0,8)}`,s=await G(i);if("boolean"==typeof s&&!s)return;const l=(e=>{const r=e.split(t.EOL),o=[];try{r.forEach((e=>{if(e.length<=0)return;let t=0,r="";for(;""!=e[t]&&t<e.length;t++)r+=e[t];if(++t>=e.length)throw new Error;let n="";for(;t<e.length&&t<r.length+1+Number(r);t++)n+=e[t];if(""!=e[t])throw new Error;if(++t>=e.length)throw new Error;let i="";for(;t<e.length;t++)i+=e[t];o.push({path:n,hash:i})}))}catch{return console.error(B.red("\nRepository memory corrupted :/\n")),[]}return o})(s),a=[];let c=0;for(const{hash:e,path:t}of l){const r=await G(`.brifka/rep/${e.slice(0,8)}`);"boolean"!=typeof r||r?(await P(t,r),c++):a.push(t)}a.length>0&&console.error(`\n${B.red(a.length)} files failed to load from repository.`),console.log(`\n${B.green(c)} files successfully loaded from repository.\n`)};(async()=>{const e=new I(process.argv.slice(2)),t=e.peek();let r=!1;try{if(!(await o.stat(n.resolve(process.cwd(),".brifka"))).isDirectory())throw new Error;r=!0}catch{}if(!r&&(!t||"init"!=t&&"help"!=t))return console.log(B.red("\nBrifka repository is not initialised.")),void console.log(L("Type 'brifka init' to initialise repository.","Help"));(e=>{const t=e.next();switch(t){case"help":W(e);break;case"init":J(e);break;case"track":K(e);break;case"untrack":Q(e);break;case"commit":X(e);break;case"commits":Z(e);break;case"change":ee(e);break;default:console.error(B.red(`\nCommand '${t}' doesn't exist.`)),console.log(L("To get documentation of all commands type 'brifka help' or 'brifka help <command_name>' to get documentation of specific command.","Help"))}})(e)})();
