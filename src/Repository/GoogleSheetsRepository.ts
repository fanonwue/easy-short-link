import Repository from "./Repository";
import {google} from 'googleapis';
import GoogleSheetsConfig from "../GoogleSheetsConfig";

export default class GoogleSheetsRepository implements Repository {
    private readonly config: GoogleSheetsConfig;
    private readonly spreadsheetId: string;
    private auth: any;
    private lastUpdate: Date|null;


    constructor(config: GoogleSheetsConfig) {
        this.config = config;
    }

    private createAuth() {
        return new google.auth.GoogleAuth({
            keyFile: this.config.keyFile,
            scopes: this.config.scopes
        })
    }

    async getMapping(): Promise<Map<string, string>> {
        const sheets = google.sheets({version: "v4", auth: this.createAuth()})
        return new Promise((resolve, reject) => {
            sheets.spreadsheets.values.get({
                spreadsheetId: this.config.sheetId,
                range: "A:B"
            }, ((err, res) => {
                const rows = res.data.values;

                if (rows.length) {
                    const map = new Map<string, string>();
                    rows.map(row => {
                        map.set(row[0], row[1])
                    })
                    resolve(map);
                } else {
                    console.warn("No data found in spreadsheet")
                    reject();
                }

            }))
        })
    }
}