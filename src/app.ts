import AppServer from "./AppServer";
import {
    CONFIG
} from "./options";

// change console logging
require('console-stamp')(console, {
    format: ':date(yyyy-mm-dd HH:MM:ss.l) :label'
})

console.info('Reading environment variables...')

const appServer = new AppServer(CONFIG);
appServer.run().then(() => {
    console.info("Server started")
})