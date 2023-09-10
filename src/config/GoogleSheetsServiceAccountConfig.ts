import GoogleSheetsConfig from "./GoogleSheetsConfig.js";
import path from "path";
import {writeFileSync, existsSync} from "fs";
import {CONFIG_PATH} from "../options.js";
import type {ServiceAccountCredentials} from "../types";

export default class GoogleSheetsServiceAccountConfig extends GoogleSheetsConfig {
    static readonly defaultKeyFile = path.join(CONFIG_PATH, 'service-account-credentials.json');

    public readonly credentialsType = "service_account"
    get projectId() { return  this.credentials?.projectId }
    get privateKeyId() { return this.credentials?.privateKeyId }
    get privateKey() { return this.credentials?.privateKey }
    get clientEmail() { return this.credentials?.clientEmail }
    get clientId() { return this.credentials?.clientId }

    private readonly credentials?: ServiceAccountCredentials

    get shouldUseCredentials() : boolean {
        return this.projectId !== undefined
            && this.privateKey !== undefined
            && this.clientEmail !== undefined
    }

    public readonly keyFile: string|undefined;

    constructor(options?: { keyFile?: string, credentials?: ServiceAccountCredentials }) {
        super();

        if (!options) options = { keyFile: GoogleSheetsServiceAccountConfig.defaultKeyFile }

        this.credentials = options.credentials

        if (!options.keyFile || !existsSync(options.keyFile)) {
            options.keyFile = GoogleSheetsServiceAccountConfig.defaultKeyFile
        }

        this.keyFile = options.keyFile;
    }
}