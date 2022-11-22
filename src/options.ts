import path from "path";
import {readFileSync, existsSync} from "fs"
import {AppConfig, AuthenticationType, ConfigFile, PathConfig} from "./types";

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
    return <"oauth2" | "service">value ?? undefined
}

let pathConfig: PathConfig = {
    templatesPath: path.join(__dirname, '..', 'resources'),
    configPath: path.join(__dirname, '..', 'config')
}


let configFile: ConfigFile

const configFilePath = path.join(pathConfig.configPath, "config.json")
if (existsSync(configFilePath)) {
    configFile = JSON.parse((readFileSync(configFilePath)).toString())
}

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
    updatePeriod: toInt(process.env.UPDATE_PERIOD) ?? 300, // 5 minutes default
    serviceAccountKeyFile: process.env.SERVICE_ACCOUNT_KEY_FILE,
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