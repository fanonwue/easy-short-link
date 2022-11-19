import {Server, createServer, ServerResponse} from "http";
import Repository from "./repository/Repository";
import GoogleSheetsRepository from "./repository/GoogleSheetsRepository";
import {readFile} from "fs/promises";
import url from "url"
import GoogleSheetsConfig from "./config/GoogleSheetsConfig";
import path from "path";
import GoogleSheetsOAuth2Config from "./config/GoogleSheetsOAuth2Config";
import GoogleSheetsServiceAccountConfig from "./config/GoogleSheetsServiceAccountConfig";
import {ConfigFile, PathConfig, RedirectConfig, RedirectPageTexts, RegisteredHook} from "./types";
import mustache, {RenderOptions} from "mustache"
import AcceptLanguagePicker from "./AcceptLanguagePicker";

export default class AppServer {
    private readonly configPath: string
    private readonly templatesPath: string
    private readonly allowRedirectPage: boolean = false
    private readonly redirectTimeout: number = 5000
    private readonly defaultLanguage: string = "en"
    private readonly redirectTemplateMap = new Map<string, string>()
    private readonly ignoreCaseInPath: boolean = true

    private server: Server;
    private repository: Repository;
    private mapping: Map<string, string>;
    private timer: NodeJS.Timer;
    private acceptLanguagePicker: AcceptLanguagePicker
    private notFoundTemplate: string|undefined
    private updateHooks = new Map<string, RegisteredHook<any>>()

    constructor(
        private readonly port: number,
        private readonly updateInterval: number,
        pathConfig: PathConfig = { configPath: "../config", templatesPath: "../resources" },
        redirectConfig?: RedirectConfig
    ) {
        this.configPath         = pathConfig.configPath
        this.templatesPath      = pathConfig.templatesPath

        this.ignoreCaseInPath   = redirectConfig?.ignoreCaseInPath ?? true
        this.allowRedirectPage  = redirectConfig?.allowRedirectPage ?? false
        this.redirectTimeout    = redirectConfig?.redirectTimeout ?? 0
        this.defaultLanguage    = redirectConfig?.defaultLanguage ?? "en"
    }

    public async run() : Promise<any> {
        await this.init();
        await this.startAutoUpdate()
        console.info("Starting HTTP Server...");
        this.server = createServer(async (req, res) => {
            const parsedUrl = url.parse(req.url, true)
            const redirectName = parsedUrl.pathname
            const target = this.targetUrlFor(redirectName)
            const useRedirectPage = this.allowRedirectPage && parsedUrl.query.confirm != null

            if (target) {
                if (!useRedirectPage) {
                    res.writeHead(302, {
                        Location: target
                    })
                } else {
                    this.writeHtmlResponse(
                        res,
                        200,
                        await this.redirectPageFor(target, req.headers["accept-language"])
                    )
                }
            } else {
                this.writeHtmlResponse(res, 404, await this.notFoundPageFor(redirectName))
            }
            res.end();
        }).listen(this.port);
        console.info(`HTTP Server listening on port ${this.port}`);
    }

    private writeHtmlResponse(res: ServerResponse, responseCode: number, responseBody: string|Buffer) {
        const charset = "utf-8"
        let buffer: Buffer
        if (typeof responseBody == "string") {
            buffer = Buffer.from(responseBody, charset)
        } else {
            buffer = responseBody
        }

        res.writeHead(responseCode, {
            "Content-Type": `text/html; charset=${charset}`,
            "Content-Length": buffer.length
        })
        res.write(buffer)
    }

    private async notFoundPageFor(redirectName: string) {
        return mustache.render(this.notFoundTemplate, {
            redirectName: redirectName
        })
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

    private targetUrlFor(path: string) : string|undefined {
        path = this.removeTrailingSlashes(
            this.removeLeadingSlashes(path)
        )
        if (this.ignoreCaseInPath) path = path.toLowerCase()
        return this.mapping.get(path);
    }


    private async init() {
        console.info("Setting up server...")

        // Prepare templates for HTML responses
        const promises: Array<Promise<any>> = [this.loadNotFoundTemplate()]
        if (this.allowRedirectPage) promises.push(this.loadRedirectTemplates())

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

        promises.push(this.addDefaultUpdateHooks())

        // Wait for all pending init steps to finish
        await Promise.all(promises)
    }

    private async addDefaultUpdateHooks() {
        const forEachInUpdateMap = (map: Map<string, string>, fn: (redirectPath, targetUrl) => [string, string]) => {
            const newMap = new Map<string, string>()
            map.forEach((targetUrl, redirectPath) => {
                const [newRedirectPath, newTargetUrl] = fn(redirectPath, targetUrl)
                newMap.set(newRedirectPath, newTargetUrl)
            })
            return newMap;
        }

        console.debug("Adding update hook to strip trailing slashes")
        this.registerUpdateHook(<RegisteredHook<Map<string, string>>>{
            name: "strip-slashes",
            order: 1000,
            fn: subject => forEachInUpdateMap(subject, (redirectPath, targetUrl) => {
                redirectPath = this.removeLeadingSlashes(redirectPath)
                redirectPath = this.removeTrailingSlashes(redirectPath)
                return [redirectPath, targetUrl]
            })
        })

        if (this.ignoreCaseInPath) {
            console.debug("Adding update hook to make redirect paths lowercase")
            this.registerUpdateHook(<RegisteredHook<Map<string, string>>>{
                name: "make-lowercase",
                order: 1,
                fn: subject => forEachInUpdateMap(subject, (redirectPath, targetUrl) => {
                    return [redirectPath.toLowerCase(), targetUrl]
                })
            })
        }
    }

    private async loadNotFoundTemplate() {
        console.info("Reading template for Not Found Page")
        try {
            const filePath = path.join(this.templatesPath, "not-found.mustache")
            this.notFoundTemplate = (await readFile(filePath)).toString()
        } catch {
            this.notFoundTemplate = "Not Found."
        }
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

    private removeLeadingSlashes(str: string) {
        while (str.startsWith('/')) {
            str = str.slice(1)
        }
        return str
    }

    private removeTrailingSlashes(str: string) {
        while (str.endsWith('/')) {
            str = str.slice(0, -1)
        }
        return str;
    }

    public registerUpdateHook(hook: RegisteredHook<any>) {
        this.updateHooks.set(hook.name, hook)
    }

    public removeUpdateHook(name: string) {
        this.updateHooks.delete(name)
    }

    private async updateMapping() {
        if (await this.repository.needsUpdate()) {
            let newMapping = await this.repository.getMapping()

            // Execute update hooks in the correct order, if any are present
            if (this.updateHooks.size > 0) {
                Array.from(this.updateHooks.values()).sort((a, b) => {
                    return a.order - b.order
                }).forEach((hook) => {
                    newMapping = hook.fn(newMapping)
                })
            }

            this.mapping = newMapping
            console.info(`Updated mapping, received ${this.mapping.size} entries`)
        } else {
            console.debug('Data source not modified, skipping update')
        }
    }

}