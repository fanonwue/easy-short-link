import {Server, createServer} from "http";
import Repository from "./Repository/Repository";
import GoogleSheetsRepository from "./Repository/GoogleSheetsRepository";
import {readFile} from "fs/promises";
import GoogleSheetsConfig from "./Config/GoogleSheetsConfig";
import path from "path";
import GoogleSheetsOAuth2Config from "./Config/GoogleSheetsOAuth2Config";
import {CONFIG_PATH} from "./options";
import GoogleSheetsServiceAccountConfig from "./Config/GoogleSheetsServiceAccountConfig";
import {ConfigFile} from "./types";

export default class AppServer {
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

        const config: ConfigFile = await readFile(path.join(CONFIG_PATH, 'config.json')).then(data => {
            return JSON.parse(data.toString())
        });

        let sheetsConfig;

        switch (config.authentication) {
            case 'oauth2':
                sheetsConfig = await GoogleSheetsOAuth2Config.fromFile();
                break;
            case 'service':
            default:
                sheetsConfig = new GoogleSheetsServiceAccountConfig();
                break;
        }

        sheetsConfig.sheetId = config.spreadsheetId;

        this.repository = new GoogleSheetsRepository(sheetsConfig);
        await this.startAutoUpdate();

    }

    /**
     *
     * @private
     * @return Promise<any> which resolves once the initial update has been completed
     */
    private async startAutoUpdate() : Promise<void> {
        console.info(`Starting auto update at an interval of ${this.updateInterval} seconds`)
        const promise = this.updateMapping();
        this.timer = setInterval(async () => {
            await this.updateMapping();
        }, this.updateInterval * 1000)
        return promise;
    }

    private stopAutoUpdate() {
        console.info(`Stopping auto update`)
        clearTimeout(this.timer);
    }

    private async updateMapping() {
        if (await this.repository.needsUpdate()) {
            this.mapping = await this.repository.getMapping()
            console.info(`Updated mapping, received ${this.mapping.size} entries`)
        } else {
            console.log('Data source not modified, skipping update')
        }
    }

}