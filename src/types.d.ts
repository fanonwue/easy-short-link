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