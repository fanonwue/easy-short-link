import path from "path";
import {configDotenv} from "dotenv";
import {fileURLToPath} from "url";
import {readFileSync, existsSync} from "fs"
import consoleStamp from "console-stamp";
import type {AppConfig, AuthenticationType, ConfigFile, PathConfig} from "./types";

const toBoolean = (value: string) => {
    switch (value?.toLowerCase()) {
        case "true":
        case "yes":
        case "1":
            return true
        case "false":
        case "no":
        case "0":
            return false
        default:
            return undefined
    }
}

const toInt = (value: string) => {
    const num = parseInt(value)
    if (isNaN(num)) return undefined
    return num
}

const toObject = (value: string) => {
    if (value.length == 0) return undefined
    try {
        return JSON.parse(value)
    } catch (e) {
        return undefined
    }
}

const toAuthenticationType = (value: string): AuthenticationType => {
    switch (value) {
        case "oauth2":
        case "service":
            return value
        default:
            return undefined
    }
}

configDotenv()

let logLevel = process.env.LOG_LEVEL
if (!logLevel && process.env.NODE_ENV === "production") logLevel = "info"
if (!logLevel) logLevel = "debug"

// change console logging
consoleStamp(console, {
    format: ':date(yyyy-mm-dd HH:MM:ss.l).yellowBright :label(8).cyanBright',
    level: logLevel
})

const __dirname = fileURLToPath(new URL('.', import.meta.url));
let pathConfig: PathConfig = {
    templatesPath: path.join(__dirname, '..', 'resources'),
    configPath: path.join(__dirname, '..', 'config')
}

let configFile: ConfigFile

const configFilePath = path.join(pathConfig.configPath, "config.json")
if (existsSync(configFilePath)) {
    configFile = JSON.parse((readFileSync(configFilePath)).toString())
}

const updatePeriod = toInt(process.env.UPDATE_PERIOD) ?? 300

const config: AppConfig = {
    paths: pathConfig,
    spreadsheetId: configFile?.spreadsheetId ?? process.env.SPREADSHEET_ID ?? "",
    authenticationType: configFile?.authenticationType ?? toAuthenticationType(process.env.AUTHENTICATION_MODE) ?? "service",
    skipFirstRow: configFile?.skipFirstRow ?? toBoolean(process.env.SKIP_FIRST_ROW) ?? true,
    redirect: configFile?.redirect ?? {
        ignoreCaseInPath: toBoolean(process.env.IGNORE_CASE_IN_PATH) ?? true,
        redirectTimeout: toInt(process.env.REDIRECT_TIMEOUT) ?? 0,
        allowRedirectPage: toBoolean(process.env.ALLOW_REDIRECT_PAGE) ?? false,
        defaultLanguage: process.env.DEFAULT_LANGUAGE ?? "en"
    },
    port: toInt(process.env.APP_PORT) ?? 3000,
    updatePeriod: updatePeriod, // 5 minutes default
    httpCacheMaxAge: toInt(process.env.HTTP_CACHE_MAX_AGE) ?? updatePeriod, // use updatePeriod as default,
    serviceAccountKeyFile: process.env.SERVICE_ACCOUNT_KEY_FILE,
    logLevel: logLevel.toLowerCase()
}

if (config.authenticationType == "service") {
    config.serviceAccountCredentials = {
        clientId: process.env.SERVICE_ACCOUNT_CLIENT_ID,
        clientEmail: process.env.SERVICE_ACCOUNT_CLIENT_EMAIL,
        projectId: process.env.PROJECT_ID,
        privateKey: process.env.SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Replace wrong newlines with correct ones
        privateKeyId: process.env.SERVICE_ACCOUNT_PRIVATE_KEY_ID
    }
}

export const CONFIG = config
export const CONFIG_PATH = config.paths.configPath
export const TEMPLATES_PATH = config.paths.templatesPath