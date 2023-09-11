import AppServer from "./AppServer.js";
import {
    CONFIG
} from "./options.js";

console.info('Reading environment variables...')

const appServer = new AppServer(CONFIG);
await appServer.run()
console.info("Startup complete. App ready!")