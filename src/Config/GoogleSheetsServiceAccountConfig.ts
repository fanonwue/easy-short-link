import GoogleSheetsConfig from "./GoogleSheetsConfig";
import path from "path";
import {CONFIG_PATH} from "../options";

export default class GoogleSheetsServiceAccountConfig extends GoogleSheetsConfig {
    private static readonly defaultKeyFile = path.join(CONFIG_PATH, 'service-account-credentials.json');

    public readonly keyFile: string;

    constructor(keyFile: string = GoogleSheetsServiceAccountConfig.defaultKeyFile) {
        super();
        this.keyFile = keyFile;
    }
}