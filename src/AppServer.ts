import {Server, createServer, ServerResponse} from "http";
import {setInterval} from "timers/promises";
import Repository from "./repository/Repository";
import GoogleSheetsRepository from "./repository/GoogleSheetsRepository";
import {readFile} from "fs/promises";
import url from "url"
import GoogleSheetsConfig from "./config/GoogleSheetsConfig";
import path from "path";
import GoogleSheetsOAuth2Config from "./config/GoogleSheetsOAuth2Config";
import GoogleSheetsServiceAccountConfig from "./config/GoogleSheetsServiceAccountConfig";
import {AppConfig, RedirectPageTexts, RegisteredHook} from "./types";
import mustache, {RenderOptions} from "mustache"
import AcceptLanguagePicker from "./AcceptLanguagePicker";

export default class AppServer {
    private get configPath() { return this.config.paths.configPath }
    private get templatesPath() { return this.config.paths.templatesPath }
    private get allowRedirectPage() { return this.config.redirect.allowRedirectPage ?? false }
    private get redirectTimeout() { return this.config.redirect.redirectTimeout ?? 0 }
    private get defaultLanguage() { return this.config.redirect.defaultLanguage ?? "en" }
    private get ignoreCaseInPath() { return this.config.redirect.ignoreCaseInPath ?? true }

    private get port() { return this.config.port }
    private get updateInterval() { return this.config.updatePeriod }

    private readonly redirectTemplateMap = new Map<string, string>()

    private readonly config: AppConfig
    private readonly cacheControl: string

    private server: Server
    private repository: Repository
    private updateAbortController = new AbortController()
    private mapping: Map<string, string>
    private acceptLanguagePicker: AcceptLanguagePicker
    private notFoundTemplate: string|undefined
    private updateHooks = new Map<string, RegisteredHook<any>>()

    constructor(
        config: AppConfig
    ) {
        this.config = config
        this.cacheControl = `max-age=${config.httpCacheMaxAge}`
    }

    public async run() : Promise<any> {
        await this.init();
        await this.startAutoUpdate()
        console.info("Starting HTTP Server...");
        this.server = createServer(async (req, res) => {
            const parsedUrl = url.parse(req.url, true)
            const redirectName = parsedUrl.pathname
            const target = this.targetUrlFor(redirectName, req.headers.host)
            const useRedirectPage = this.allowRedirectPage && parsedUrl.query.confirm != null

            if (target) {
                if (!useRedirectPage) {
                    res.writeHead(307, {
                        Location: target,
                        "Cache-Control": this.cacheControl,
                        "X-Robots-Tag": "nofollow"
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
            "Content-Length": buffer.length,
            "Cache-Control": this.cacheControl
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

    private targetUrlFor(path: string, hostname?: string) : string|undefined {
        path = this.removeTrailingSlashes(
            this.removeLeadingSlashes(path)
        )
        if (this.ignoreCaseInPath) path = path.toLowerCase()
        if (path.length == 0 && hostname && this.mapping.has(hostname)) return this.mapping.get(hostname)
        return this.mapping.get(path);
    }


    private async init() {
        console.info("Setting up server...")

        // Prepare templates for HTML responses
        const promises: Array<Promise<any>> = [this.loadNotFoundTemplate()]
        if (this.allowRedirectPage) promises.push(this.loadRedirectTemplates())


        let sheetsConfig: GoogleSheetsConfig;

        switch (this.config.authenticationType) {
            case 'oauth2':
                sheetsConfig = await GoogleSheetsOAuth2Config.fromFile();
                break;
            case 'service':
            default:
                sheetsConfig = new GoogleSheetsServiceAccountConfig({
                    keyFile: this.config.serviceAccountKeyFile,
                    credentials: this.config.serviceAccountCredentials
                });
                break;
        }

        sheetsConfig.sheetId = this.config.spreadsheetId;
        sheetsConfig.skipFirstRow = this.config.skipFirstRow ?? true

        const googleSheetsRepo = new GoogleSheetsRepository(sheetsConfig)
        promises.push(googleSheetsRepo.getSpreadsheetWebLink().then((link) => {
            console.info("Using document available at: " + link)
        }))

        this.repository = googleSheetsRepo

        promises.push(this.addDefaultUpdateHooks())

        // Wait for all pending init steps to finish
        await Promise.all(promises)
    }

    private async addDefaultUpdateHooks() {
        console.info("Creating default update hooks...")
        const forEachInUpdateMap = (map: Map<string, string>, fn: (redirectPath, targetUrl) => [string, string]) => {
            const newMap = new Map<string, string>()
            map.forEach((targetUrl, redirectPath) => {
                const [newRedirectPath, newTargetUrl] = fn(redirectPath, targetUrl)
                newMap.set(newRedirectPath, newTargetUrl)
            })
            return newMap;
        }

        console.debug("Adding update hook to strip leading and trailing slashes")
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
        // Pre-parse template into template cache
        mustache.parse(this.notFoundTemplate)
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
            // Pre-parse template into template cache
            mustache.parse(template)
        }
        const keys = Array.from(this.redirectTemplateMap.keys())
        this.acceptLanguagePicker = new AcceptLanguagePicker(keys, this.defaultLanguage)
        console.info(`Generated templates for languages: ${keys.join(', ')}; with fallback "${this.defaultLanguage}"`)

    }

    /**
     * @private
     * @return Promise<void> which resolves once the initial update has been completed
     */
    private startAutoUpdate() : Promise<void> {
        const initialLoadPromise = this.updateMapping()
        // Schedule auto update loop to start executing after initial load
        initialLoadPromise.then(() => this.autoUpdateLoop())
        // Return initial load's promise to indicate when the mapping is ready
        return initialLoadPromise
    }

    /**
     * Starts an async loop using the promisified version of setInterval from "timers/promises"
     * The promise this async function produces will only fulfill once the interval gets aborted,
     * thus it's a separate function from startAutoUpdate()
     * @private
     */
    private async autoUpdateLoop() : Promise<void> {
        console.info(`Starting auto update at an interval of ${this.updateInterval} seconds`)
        this.updateAbortController = new AbortController()
        for await (const _ of setInterval(this.updateInterval * 1000, undefined, { signal: this.updateAbortController.signal })) {
            await this.updateMapping()
        }
    }

    private stopAutoUpdate() {
        console.info(`Stopping auto update`)
        this.updateAbortController.abort("cancelled by stopAutoUpdate()")
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