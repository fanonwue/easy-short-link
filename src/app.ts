import AppServer from "./AppServer";

// change console logging
require('console-stamp')(console, {
    format: ':date(yyyy-mm-dd HH:MM:ss.l) :label'
})

console.log('Reading environment variables...')
const PORT = parseInt(process.env.APP_PORT) || 5000;
const UPDATE_PERIOD = parseInt(process.env.APP_UPDATE_PERIOD) || 300; // 5 minutes default

const appServer = new AppServer(PORT, UPDATE_PERIOD);
appServer.run()