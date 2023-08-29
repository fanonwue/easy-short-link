import Repository from "./Repository";
import {drive_v3, google} from 'googleapis';
import {exit} from "process";
import GoogleSheetsConfig from "../config/GoogleSheetsConfig";
import GoogleSheetsOAuth2Config from "../config/GoogleSheetsOAuth2Config";
import {Credentials, GoogleAuth, OAuth2Client} from "google-auth-library"
import GoogleSheetsServiceAccountConfig from "../config/GoogleSheetsServiceAccountConfig";

export default class GoogleSheetsRepository implements Repository {
    private readonly config: GoogleSheetsConfig;
    private readonly spreadsheetId: string;
    private lastUpdate: Date|undefined;
    private checkModificationTime: boolean = true;
    private oauth2Client: OAuth2Client;
    private serviceUserAuth: GoogleAuth;


    constructor(config: GoogleSheetsConfig) {
        this.config = config;
    }

    private async createOAuth2Client(config: GoogleSheetsOAuth2Config) : Promise<OAuth2Client> {
        throw Error('NOT YET IMPLEMENTED')
        // const client = new google.auth.OAuth2(
        //     config.clientId, config.clientSecret, config.redirectUrl
        // );
        // client.on('tokens', async (tokens) => {
        //     config.accessToken = tokens.access_token;
        //     if (tokens.refresh_token) {
        //         console.log('Received new refresh token, saving to credentials file')
        //         config.refreshToken = tokens.refresh_token;
        //         await config.saveToFile();
        //     }
        // });
        //
        // if (!config.canAuthorize()) {
        //     await this.getOAuth2Credentials(client, config)
        // }
        //
        // return client;
    }

    private getAuthOAuth2(config: GoogleSheetsOAuth2Config)  {
        throw Error('NOT YET IMPLEMENTED')
        // const oauth2Config = <GoogleSheetsOAuth2Config> this.config;
    }

    /**
     * Retrieves new OAuth2 Credentials using the clientId and clientSecret.
     * The user has to authorize the application using their google account.
     * The authorization code obtained by the authorization has to be manually
     * added to the config file.
     * @param config
     * @param oauth2Client
     * @private
     */
    private getOAuth2Credentials(oauth2Client: OAuth2Client, config: GoogleSheetsOAuth2Config) {
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: config.getScopes(),
            redirect_uri: config.redirectUrl
        })
        console.warn('OAuth2 access requires you to authorize this application. ' +
            'You have to follow the link beneath this message, log in with your google account and' +
            'copy the authorization code you receive into the oauth2-credentials.json file.'
        )
        console.info('---------------------------------------------------------------')
        console.info(`Please use this link to authorize this app: ${url}`);
        console.info('---------------------------------------------------------------')
        console.info('The program will now exit. Restart after you\'ve added the code.')
        exit(0);
    }

    private async authorizeOAuth2(config: GoogleSheetsOAuth2Config) : Promise<OAuth2Client> {
        const oauth2Client = this.oauth2Client;
        if (!config.isAuthorized()) {
            const {tokens} = await oauth2Client.getToken(config.authorizationCode);
            config.accessToken = tokens.access_token;
            config.refreshToken = tokens.refresh_token;
        }

        const tokens: Credentials = {
            access_token: config.accessToken,
            refresh_token: config.refreshToken
        }
        oauth2Client.setCredentials(tokens);
        return oauth2Client;
    }

    private async getAuth() : Promise<OAuth2Client|GoogleAuth|undefined> {
        if (this.config instanceof GoogleSheetsServiceAccountConfig) {
            if (!this.serviceUserAuth) this.serviceUserAuth = this.createServiceUserAuth(this.config)
            return this.serviceUserAuth
        }

        if (this.config instanceof GoogleSheetsOAuth2Config) {
            if (!this.oauth2Client) this.oauth2Client = await this.createOAuth2Client(this.config)
            return await this.authorizeOAuth2(this.config)
        }

        return undefined
    }

    private createServiceUserAuth(config: GoogleSheetsServiceAccountConfig) {
        if (config.shouldUseCredentials) {
            return new google.auth.GoogleAuth({
                projectId: config.projectId,
                credentials: {
                    type: config.credentialsType,
                    private_key: config.privateKey,
                    client_email: config.clientEmail
                },
                scopes: config.getScopes()
            })
        } else {
            return new google.auth.GoogleAuth({
                keyFile: config.keyFile,
                scopes: config.getScopes()
            })
        }

    }

    private async getDriveClient() : Promise<drive_v3.Drive> {
        return google.drive({version: "v3", auth: await this.getAuth()})
    }

    async getSpreadsheetWebLink() : Promise<string|undefined> {
        const drive = await this.getDriveClient()
        try {
            const res = await drive.files.get({
                fileId: this.config.sheetId,
                fields: 'webViewLink'
            })
            return res.data.webViewLink
        } catch (err: any) {
            return this.handleDriveError(err)
        }
    }

    async getModifiedTime() : Promise<Date|undefined> {
        const drive = await this.getDriveClient()
        try {
            const res = await drive.files.get({
                fileId: this.config.sheetId,
                fields: 'modifiedTime'
            })
            return new Date(res.data.modifiedTime)
        } catch (err: any) {
            return this.handleDriveError(err)
        }
    }

    private handleDriveError(err: any) {
        const errorObject = err.response ? err.response.data.error : null
        if (errorObject && errorObject.code === 403 && this.isAccessNotConfiguredError(errorObject.errors)) {
            console.warn("Google Drive API has not been added to the project, skipping modification checks")
            this.checkModificationTime = false;
            return
        }

        console.error(`Could not retrieve file metadata for file ${this.config.sheetId}`, err)
        return undefined
    }

    private isAccessNotConfiguredError(errors: Array<any>) {
        return errors.map((error) => error.reason).includes("accessNotConfigured")
    }

    async needsUpdate() : Promise<boolean> {
        if (!this.lastUpdate || !this.checkModificationTime) return true;
        const modifiedTime = await this.getModifiedTime();
        if (!(modifiedTime instanceof Date)) return true;
        return modifiedTime > this.lastUpdate;
    }

    private getRange() {
        return this.config.skipFirstRow ? "A2:B" : "A:B";
    }

    async getMapping(): Promise<Map<string, string>> {
        const sheets = google.sheets({version: "v4", auth: await this.getAuth()})
        return new Promise((resolve, reject) => {
            sheets.spreadsheets.values.get({
                spreadsheetId: this.config.sheetId,
                range: this.getRange()
            }, ((err, res) => {
                const rows = res.data.values
                if (rows.length) {
                    const map = new Map<string, string>()

                    for (const [alias, target] of rows) {
                        if (alias && target) {
                            map.set(alias, target)
                        }
                    }

                    resolve(map)

                    // Remember this run
                    this.lastUpdate = new Date()
                } else {
                    console.warn("No data found in spreadsheet")
                    reject()
                }
            }))
        })
    }
}