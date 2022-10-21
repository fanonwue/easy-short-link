import {Server, createServer} from "http";
import Repository from "./repository/Repository";
import GoogleSheetsRepository from "./repository/GoogleSheetsRepository";
import {readFile} from "fs/promises";
import url from "url"
import GoogleSheetsConfig from "./config/GoogleSheetsConfig";
import path from "path";
import GoogleSheetsOAuth2Config from "./config/GoogleSheetsOAuth2Config";
import {CONFIG_PATH, TEMPLATE_PATH, ALLOW_REDIRECT_PAGE} from "./options";
import GoogleSheetsServiceAccountConfig from "./config/GoogleSheetsServiceAccountConfig";
import {ConfigFile, RedirectPageTexts} from "./types";
import mustache, {RenderOptions} from "mustache"

export default class AppServer {
    private readonly port: number;
    private readonly updateInterval: number;
    private server: Server;
    private repository: Repository;
    private mapping: Map<string, string>;
    private timer: NodeJS.Timer;
    private defaultRedirectPageLanguage = "en"
    private redirectTemplateMap = new Map<string, string>()

    constructor(port: number, updateInterval: number) {
        this.port = port;
        this.updateInterval = updateInterval
    }

    public async run() : Promise<any> {
        await this.init();
        if (ALLOW_REDIRECT_PAGE) await this.loadRedirectTemplates();
        console.info("Starting HTTP Server...");
        this.server = createServer(async (req, res) => {
            const parsedUrl = url.parse(req.url, true)
            const target = this.getTargetUrl(parsedUrl.pathname);
            const useRedirectPage = parsedUrl.query.confirm != null && ALLOW_REDIRECT_PAGE

            if (target) {
                if (!useRedirectPage) {
                    res.writeHead(302, {
                        //Location: target
                    })
                } else {
                    res.writeHead(200)
                    res.write(await this.redirectPageFor(target, req.headers["accept-language"]))
                }
            } else {
                res.statusCode = 404;
                res.write("Not found.")
            }
            res.end();
        }).listen(this.port);
        console.info(`HTTP Server listening on port ${this.port}`);
    }

    private async redirectPageFor(targetUrl: string, acceptLanguageHeader: string|undefined) : Promise<string> {
        const redirectTimeout = 50000
        const view = {
            link: targetUrl,
            redirectTimeout: redirectTimeout,
            redirectSeconds: redirectTimeout / 1000
        }

        let template = this.redirectTemplateMap.get(this.preferredLanguage(acceptLanguageHeader))
        if (template == null) template = this.redirectTemplateMap.get(this.defaultRedirectPageLanguage)

        return mustache.render(template.toString(), view)
    }

    private preferredLanguage(acceptLanguageHeader: string|undefined) : string {
        //TODO
        return "en"
    }

    private getTargetUrl(path: string) : string|undefined {
        if (path[0] === '/') path = path.substring(1);
        return this.mapping.get(path);
    }


    private async init() {
        console.info("Setting up server...")

        const config: ConfigFile = await readFile(path.join(CONFIG_PATH, 'config.json')).then(data => {
            return JSON.parse(data.toString())
        });

        let sheetsConfig: GoogleSheetsConfig;

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
        sheetsConfig.skipFirstRow = config.skipFirstRow !== undefined ? config.skipFirstRow : false;

        this.repository = new GoogleSheetsRepository(sheetsConfig);
        await this.startAutoUpdate();

    }

    private async loadRedirectTemplates() {
        console.info("Generating Mustache redirect page templates")
        const textObject = JSON.parse((await readFile(path.join(TEMPLATE_PATH, "texts.json"))).toString())
        const textMap = new Map<string, RedirectPageTexts>(Object.entries(textObject))

        const baseTemplate = (await readFile(path.join(TEMPLATE_PATH, "redirect.mustache"))).toString()
        const options: RenderOptions = {
            tags: ["<%=", "=%>"],
            escape: value => value
        }

        const replaceSecondCounterPlaceholder = (texts: RedirectPageTexts): RedirectPageTexts => {
            const secondCounterHtml = '<span id="seconds-left">{{redirectSeconds}}</span>'
            for (const [k, v] of Object.entries(texts)) {
                if (typeof v == "string") {
                    texts[k] = v.replace("%SECOND_COUNTER%", secondCounterHtml)
                }
            }
            return texts
        }

        for (let [lang, texts] of textMap) {
            texts = replaceSecondCounterPlaceholder(texts)

            const template = mustache.render(baseTemplate, texts, null, options)
            this.redirectTemplateMap.set(lang, template)
        }
        const keys = Array.from(this.redirectTemplateMap.keys()).join(', ')
        console.info(`Generated templates for languages: "${keys}" with fallback "${this.defaultRedirectPageLanguage}"`)

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