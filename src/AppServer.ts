import {Server, createServer} from "http";
import Repository from "./Repository/Repository";
import GoogleSheetsRepository from "./Repository/GoogleSheetsRepository";
import * as fs from "fs";
import GoogleSheetsConfig from "./GoogleSheetsConfig";
import path from "path";

export default class AppServer {

    static readonly CONFIG_PATH = path.join(__dirname, '..', 'config');

    private readonly port: number;
    private readonly updateInterval: number;
    private server: Server;
    private repository: Repository;
    private mapping: Map<string, string>;
    private timer: NodeJS.Timer;

    constructor(port: number, updateInterval: number) {
        this.port = port;
        this.updateInterval = updateInterval

    }

    public async run() : Promise<any> {
        await this.init();
        console.info("Starting HTTP Server...");
        this.server = createServer(async (req, res) => {
            const target = this.getTargetUrl(req.url);
            if (target) {
                res.writeHead(302, {
                    Location: target
                })
            } else {
                res.statusCode = 404;
                res.write("Not found.")
            }
            res.end();
        }).listen(this.port);
        console.info(`HTTP Server listening on port ${this.port}`);
    }

    private getTargetUrl(url: string) : string|undefined {
        if (url[0] === '/') url = url.substr(1);
        return this.mapping.get(url);
    }


    private async init() {
        console.info("Setting up server...")
        const config = await new Promise(resolve => {
            fs.readFile(path.join(AppServer.CONFIG_PATH, 'config.json'), (err, data) => {
                resolve(JSON.parse(data.toString()));
            })
        })

        const sheetsConfig = new GoogleSheetsConfig();
        // @ts-ignore
        sheetsConfig.sheetId = config.spreadsheetId;
        sheetsConfig.keyFile = path.join(AppServer.CONFIG_PATH, 'service-account.json');

        this.repository = new GoogleSheetsRepository(sheetsConfig);
        await this.updateMapping();
        this.startAutoUpdate();

    }

    private startAutoUpdate() {
        console.info(`Starting auto update at an interval of ${this.updateInterval} seconds`)
        this.timer = setTimeout(async () => {
            await this.updateMapping();
        }, this.updateInterval)
    }

    private stopAutoUpdate() {
        console.info(`Stopping auto update`)
        clearTimeout(this.timer);
    }

    private async updateMapping() {
        this.mapping = await this.repository.getMapping()
        console.info(`Updated mapping, received ${this.mapping.size} entries`)
    }

}