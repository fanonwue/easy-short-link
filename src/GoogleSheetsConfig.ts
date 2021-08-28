export default class GoogleSheetsConfig {
    public sheetId: string;
    public keyFile: string;
    public scopes = [
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly'
    ];
}