import AppServer from "./AppServer";
import {
    ALLOW_REDIRECT_PAGE,
    CONFIG_PATH,
    PORT,
    REDIRECT_TIMEOUT,
    TEMPLATE_PATH,
    UPDATE_PERIOD,
    IGNORE_CASE_IN_PATH,
} from "./options";

// change console logging
require('console-stamp')(console, {
    format: ':date(yyyy-mm-dd HH:MM:ss.l) :label'
})

console.info('Reading environment variables...')

const appServer = new AppServer(
    PORT,
    UPDATE_PERIOD,
    { configPath: CONFIG_PATH, templatesPath: TEMPLATE_PATH },
    {
        ignoreCaseInPath: IGNORE_CASE_IN_PATH,
        allowRedirectPage: ALLOW_REDIRECT_PAGE,
        redirectTimeout: REDIRECT_TIMEOUT,
        defaultLanguage: "en"
    }
);
appServer.run().then(() => {
    console.info("Server started")
})