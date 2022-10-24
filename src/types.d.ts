type authenticationType = 'oauth2'|'service';

export interface ConfigFile {
    authentication: authenticationType
    spreadsheetId: string
    skipFirstRow: boolean|undefined
}

export interface OAuth2Credentials {
    clientSecret: string
    clientId: string
    redirectUrl: string|undefined
    accessToken: string|undefined
    refreshToken: string|undefined
    authorizationCode: string|undefined
}

export interface RedirectPageTexts {
    title: string
    line1: string
    line2: string
    cancel: string
}

export interface PathConfig {
    configPath: string
    templatesPath: string
}

export interface RedirectPageConfig {
    allow: boolean
    timeout: number
    defaultLanguage: string
}