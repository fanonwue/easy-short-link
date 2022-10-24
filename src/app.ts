import AppServer from "./AppServer";
import {
    ALLOW_REDIRECT_PAGE,
    CONFIG_PATH,
    PORT,
    REDIRECT_TIMEOUT,
    TEMPLATE_PATH,
    UPDATE_PERIOD
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
    { allow: ALLOW_REDIRECT_PAGE, timeout: REDIRECT_TIMEOUT, defaultLanguage: "en" }
);
appServer.run().then(() => {
    console.info("Server started")
})