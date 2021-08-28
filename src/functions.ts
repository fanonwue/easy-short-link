import {promisify} from "util";

export const setTimeoutPromise = promisify(setTimeout);
export const setIntervalPromise = promisify(setInterval);
export const setImmediatePromise = promisify(setImmediate);