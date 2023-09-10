import AppServer from "./AppServer.js";
import {
    CONFIG
} from "./options.js";
import consoleStamp from "console-stamp";

// change console logging
consoleStamp(console, {
    format: ':date(yyyy-mm-dd HH:MM:ss.l) :label'
})

console.info('Reading environment variables...')

const appServer = new AppServer(CONFIG);
await appServer.run()
console.info("Startup complete. App ready!")