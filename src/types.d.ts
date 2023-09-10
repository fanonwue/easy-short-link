type AuthenticationType = 'oauth2'|'service';

export interface ConfigFile {
    authenticationType: AuthenticationType
    spreadsheetId: string
    skipFirstRow: boolean|undefined
    redirect: RedirectConfig
}

export interface AppConfig extends ConfigFile {
    paths: PathConfig,
    serviceAccountCredentials?: ServiceAccountCredentials
    serviceAccountKeyFile?: string
    port: number
    updatePeriod: number,
    httpCacheMaxAge: number,
    logLevel: string
}

export interface ServiceAccountCredentials {
    projectId: string,
    privateKey: string,
    privateKeyId?: string,
    clientId: string,
    clientEmail: string
}

export interface OAuth2Credentials {
    clientSecret: string
    clientId: string
    redirectUrl?: string
    accessToken?: string
    refreshToken?: string
    authorizationCode?: string
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
    ignoreCaseInPath?: boolean
    allowRedirectPage?: boolean
    redirectTimeout?: number
    defaultLanguage?: string
}

export interface RegisteredHook<T> {
    name: string,
    order: number,
    fn: (subject: T) => T
}