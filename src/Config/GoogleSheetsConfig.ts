export default abstract class GoogleSheetsConfig {
    protected scopes = [
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly'
    ];
    public sheetId: string;
    public skipFirstRow: boolean;

    public getScopes() : string[] {
        return this.scopes;
    }
}