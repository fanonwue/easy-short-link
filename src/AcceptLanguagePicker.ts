export default class AcceptLanguagePicker {
    static readonly DEFAULT_LANGUAGE = "en"
    private regex = /((([a-zA-Z]+(-[a-zA-Z0-9]+){0,2})|\*)(;q=[0-1](\.[0-9]+)?)?)*/g

    constructor(private supportedLanguages: Array<string>) {}

    parse(rawAcceptLanguage: string|undefined) : Array<AcceptLanguageParseResult> {
        if (rawAcceptLanguage === undefined) return []
        const strings = (rawAcceptLanguage).match(this.regex);
        return strings.map(function(m) {
            if (!m) return

            const bits = m.split(';');
            const ietf = bits[0].split('-');
            const hasScript = ietf.length === 3;

            return <AcceptLanguageParseResult>{
                lang: ietf[0],
                script: hasScript ? ietf[1] : null,
                region: hasScript ? ietf[2] : ietf[1],
                quality: bits[1] ? parseFloat(bits[1].split('=')[1]) : 1.0
            };
        }).filter((value) => {
            // filter out undefined and null
            return value
        }).sort((a, b) => {
            return b.quality - a.quality;
        });
    }

    pick(rawAcceptLanguage: string|undefined) : string {
        const parsed = this.parse(rawAcceptLanguage)
        const pickedLanguage = parsed.find((parseResult) => {
            if (this.supportedLanguages.indexOf(parseResult.lang) > -1) return true
        })
        if (!pickedLanguage) return AcceptLanguagePicker.DEFAULT_LANGUAGE
        return pickedLanguage.lang
    }
}

export interface AcceptLanguageParseResult {
    lang: string,
    script: string|null,
    region: string,
    quality: number
}