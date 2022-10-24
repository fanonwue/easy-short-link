import {Server, createServer} from "http";
import Repository from "./repository/Repository";
import GoogleSheetsRepository from "./repository/GoogleSheetsRepository";
import {readFile} from "fs/promises";
import url from "url"
import GoogleSheetsConfig from "./config/GoogleSheetsConfig";
import path from "path";
import GoogleSheetsOAuth2Config from "./config/GoogleSheetsOAuth2Config";
import GoogleSheetsServiceAccountConfig from "./config/GoogleSheetsServiceAccountConfig";
import {ConfigFile, PathConfig, RedirectPageConfig, RedirectPageTexts} from "./types";
import mustache, {RenderOptions} from "mustache"
import AcceptLanguagePicker from "./AcceptLanguagePicker";
import {setInterval} from "timers";

export default class AppServer {
    private readonly configPath: string
    private readonly templatesPath: string
    private readonly allowRedirectPage: boolean
    private readonly redirectTimeout: number = 5000
    private readonly defaultLanguage: string = "en"
    private readonly redirectTemplateMap = new Map<string, string>()

    private server: Server;
    private repository: Repository;
    private mapping: Map<string, string>;
    private timer: NodeJS.Timer;
    private acceptLanguagePicker: AcceptLanguagePicker


    constructor(
        private readonly port: number,
        private readonly updateInterval: number,
        pathConfig: PathConfig = { configPath: "../config", templatesPath: "../resources" },
        redirectPageConfig?: RedirectPageConfig
    ) {
        this.configPath = pathConfig.configPath
        this.templatesPath = pathConfig.templatesPath

        if (redirectPageConfig) {
            this.allowRedirectPage = redirectPageConfig.allow
            this.redirectTimeout = redirectPageConfig.timeout
            this.defaultLanguage = redirectPageConfig.defaultLanguage
        } else {
            this.allowRedirectPage = false
        }


    }

    public async run() : Promise<any> {
        await this.init();
        console.info("Starting HTTP Server...");
        this.server = createServer(async (req, res) => {
            const parsedUrl = url.parse(req.url, true)
            const target = this.getTargetUrl(parsedUrl.pathname);
            const useRedirectPage = parsedUrl.query.confirm != null && this.allowRedirectPage

            if (target) {
                if (!useRedirectPage) {
                    res.writeHead(302, {
                        Location: target
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
        const view = {
            link: targetUrl,
            redirectTimeout: this.redirectTimeout,
            redirectSeconds: this.redirectTimeout / 1000
        }

        let template = this.redirectTemplateMap.get(this.preferredLanguage(acceptLanguageHeader))
        if (template == null) template = this.redirectTemplateMap.get(this.defaultLanguage)

        return mustache.render(template.toString(), view)
    }

    private preferredLanguage(acceptLanguageHeader: string|undefined) : string {
        return this.acceptLanguagePicker?.pick(acceptLanguageHeader) || this.defaultLanguage
    }

    private getTargetUrl(path: string) : string|undefined {
        if (path[0] === '/') path = path.substring(1);
        return this.mapping.get(path);
    }


    private async init() {
        console.info("Setting up server...")

        const config: ConfigFile = await readFile(path.join(this.configPath, 'config.json')).then(data => {
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
        if (this.allowRedirectPage) await this.loadRedirectTemplates();
    }

    private async loadRedirectTemplates() {
        console.info("Generating Mustache redirect page templates")
        const textObject = JSON.parse((await readFile(path.join(this.templatesPath, "texts.json"))).toString())
        const textMap = new Map<string, RedirectPageTexts>(Object.entries(textObject))

        const baseTemplate = (await readFile(path.join(this.templatesPath, "redirect.mustache"))).toString()
        const options: RenderOptions = {
            tags: ["<%=", "=%>"],
            escape: value => value
        }

        const replaceSecondCounterPlaceholder = (texts: RedirectPageTexts): RedirectPageTexts => {
            const secondCounterHtml = '<span id="seconds-left" class="bold">{{redirectSeconds}}</span>'
            for (const [k, v] of Object.entries(texts)) {
                if (typeof v == "string") {
                    texts[k] = v.replace("%SECOND_COUNTER%", secondCounterHtml)
                }
            }
            return texts
        }

        for (let [lang, texts] of textMap) {
            texts = Object.assign({
                lang: lang
            }, replaceSecondCounterPlaceholder(texts))

            const template = mustache.render(baseTemplate, texts, null, options)
            this.redirectTemplateMap.set(lang, template)
        }
        const keys = Array.from(this.redirectTemplateMap.keys())
        this.acceptLanguagePicker = new AcceptLanguagePicker(keys, this.defaultLanguage)
        console.info(`Generated templates for languages: ${keys.join(', ')}; with fallback "${this.defaultLanguage}"`)

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
        clearInterval(this.timer);
    }

    private async updateMapping() {
        if (await this.repository.needsUpdate()) {
            this.mapping = await this.repository.getMapping()
            console.info(`Updated mapping, received ${this.mapping.size} entries`)
        } else {
            console.debug('Data source not modified, skipping update')
        }
    }

}