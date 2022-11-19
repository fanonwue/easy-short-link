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

export interface RedirectConfig {
    ignoreCaseInPath: boolean|undefined
    allowRedirectPage: boolean|undefined
    redirectTimeout: number|undefined
    defaultLanguage: string|undefined
}

export interface RegisteredHook<T> {
    name: string,
    order: number,
    fn: (subject: T) => T
}