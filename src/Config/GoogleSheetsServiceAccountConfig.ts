import GoogleSheetsConfig from "./GoogleSheetsConfig";
import path from "path";
import {CONFIG_PATH} from "../options";

export default class GoogleSheetsServiceAccountConfig extends GoogleSheetsConfig {
    private static readonly defaultKeyFile = path.join(CONFIG_PATH, 'service-account-credentials.json');

    public readonly keyFile: string|undefined;

    constructor(keyFile: string|undefined = undefined) {
        super();
        if (!keyFile) keyFile = GoogleSheetsServiceAccountConfig.defaultKeyFile;
        this.keyFile = keyFile;
    }
}