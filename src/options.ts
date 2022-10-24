import path from "path";
import {readFileSync} from "fs"

export const CONFIG_PATH = path.join(__dirname, '..', 'config')
export const TEMPLATE_PATH = path.join(__dirname, '..', 'resources')

const config = JSON.parse((readFileSync(path.join(CONFIG_PATH, "config.json"))).toString())
let allowRedirectPage = config.allowRedirectPage
if (allowRedirectPage == null) allowRedirectPage = true
export const ALLOW_REDIRECT_PAGE = allowRedirectPage
let redirectTimeout = config.redirectTimeout
if (redirectTimeout == null) redirectTimeout = 5000
export const REDIRECT_TIMEOUT = redirectTimeout

export const PORT = parseInt(process.env.APP_PORT) || 5000;
export const UPDATE_PERIOD = parseInt(process.env.APP_UPDATE_PERIOD) || 300; // 5 minutes default