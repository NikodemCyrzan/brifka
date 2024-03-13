import * as CONFIG from "./config";
import * as TRACKED from "./tracked";
import * as COMMIT from "./commit";
import * as CHANGE from "./change";
import * as INIT from "./init";

const logText = {
    ...CONFIG,
    ...TRACKED,
    ...COMMIT,
    ...CHANGE,
    ...INIT
}

export default logText;