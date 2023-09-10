import GoogleSheetsConfig from "./GoogleSheetsConfig.js";
import path from "path";
import {readFile, writeFile} from "fs/promises";
import {CONFIG_PATH} from "../options.js";
import type {OAuth2Credentials} from "../types";

export default class GoogleSheetsOAuth2Config extends GoogleSheetsConfig {
    private static readonly defaultFilePath = path.join(CONFIG_PATH, 'oauth2-credentials.json');

    public readonly redirectUrl : string|undefined = 'http://localhost:9999';
    public readonly clientId: string|undefined;
    public readonly clientSecret: string|undefined
    public readonly authorizationCode: string|undefined;
    public refreshToken: string|undefined;
    public accessToken: string|undefined;

    private readonly filePath: string;

    static fromTokenPair(accessToken: string, refreshToken: string) : GoogleSheetsOAuth2Config {
        return new GoogleSheetsOAuth2Config({
            accessToken: accessToken,
            refreshToken : refreshToken
        });
    }

    static fromAuthorizationCode(authorizationCode: string) : GoogleSheetsOAuth2Config {
        return new GoogleSheetsOAuth2Config({
            authorizationCode: authorizationCode
        });
    }

    static fromClientConfig(clientId: string, clientSecret: string, redirectUrl: string|undefined = undefined) {
        return new GoogleSheetsOAuth2Config({
            clientId: clientSecret,
            clientSecret: clientSecret,
            redirectUrl: redirectUrl
        })
    }

    static async fromFile(filePath: string|undefined = undefined) : Promise<GoogleSheetsOAuth2Config> {
        if (!filePath) filePath = GoogleSheetsOAuth2Config.defaultFilePath;

        const props: OAuth2Credentials = await readFile(filePath).then(data => {
            return JSON.parse(data.toString());
        }).catch(err => {
            console.error(`error reading ${path}`, err);
        })
        return new GoogleSheetsOAuth2Config(props, filePath);
    }



    public constructor(props: Partial<GoogleSheetsOAuth2Config>, filePath: string|undefined = undefined) {
        super();
        Object.assign(this, props);

        if (!filePath) filePath = GoogleSheetsOAuth2Config.defaultFilePath;
        this.filePath = filePath;
    }

    public isAuthorized() : boolean {
        return typeof this.refreshToken == 'string' && this.refreshToken.length > 0;
    }

    public hasAuthorizationCode() : boolean {
        return typeof this.authorizationCode == 'string' && this.authorizationCode.length > 0;
    }

    public canAuthorize() : boolean {
        return this.isAuthorized() || this.hasAuthorizationCode();
    }

    public async saveToFile(path: string|undefined = undefined) {
        if (!path) path = this.filePath;

        const allowedProperties = [
            'accessToken',
            'refreshToken',
            'authorizationCode',
            'redirectUrl',
            'clientId',
            'clientSecret'
        ]

        await writeFile(path, JSON.stringify(this, allowedProperties, 4)).catch(err => {
            if (err) console.error(`error writing ${path}`, err);
            console.log(`OAuth2 config file written to ${path}`);
        })
    }


}