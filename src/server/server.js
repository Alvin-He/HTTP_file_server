const http = require("node:http");
const fs = require("node:fs");
const fsAsync = require("node:fs/promises");
const { Stream } = require("node:stream");
const StreamAsync = require("node:stream/promises");
const { Buffer } = require("node:buffer");
const crypto = require("node:crypto");
const time = require("node:timers")
const DEFAULT_CONFIG_PATH = "./config.json"

class Helpers {
    static generateRandomString(length = 8){
        return crypto.randomUUID().substring(0, length)
    }
}

class FileSystemOp {
    static async readConfig(configPath = DEFAULT_CONFIG_PATH) {
        const configAsbPath = await fsAsync.realpath(DEFAULT_CONFIG_PATH);
        let file = await fsAsync.readFile(configAsbPath, {flag: "r"}).catch((err) => { 
            console.error(Error("Failed to read config.\n" + err)); 
            process.exit(1);
        }); 

        return JSON.parse(file);
    }
    // TODO: Permission System
    static async hasAccess(path) {
        const absolutePath = await fsAsync.realpath(path);
        return true
    }
    static async readFile(path, abortSignal = undefined) {
        if (!(await FileSystemOp.hasAccess(path))) throw Error("No Permission to Access File") 
        const absolutePath = await fsAsync.realpath(path);
        return fs.createReadStream(absolutePath);
    }
    static async writeFile(path, fileStream, abortSignal = undefined) {
        if (!(await FileSystemOp.hasAccess(path))) throw Error("No Permission to Access File") 
        const absolutePath = await fsAsync.realpath(path);
        const temporaryPathHeader = "-" + Helpers.generateRandomString() + ".downloading";
        const absoluteTempPath = absolutePath + temporaryPathHeader; 
        let writeStream = fs.createWriteStream(absoluteTempPath);
        fileStream.pipe(writeStream);
        try {
            await StreamAsync.finished(fileStream).catch((err) => { throw Error("Download Stream Terminated Unexpectedly.\n" + err); }); 
            writeStream.close();
            await StreamAsync.finished(writeStream).catch((err) => { throw Error("Download Stream Terminated Unexpectedly.\n" + err); }) 
        } catch(err) { // clean up after failing 
            await fsAsync.rm(absoluteTempPath).catch((err) => { throw Error("Failed to remove Reference.\n" + err); });
            throw err
        } // changing references and removing the old one
        await fsAsync.rm(absolutePath).catch((err) => { throw Error("Failed to remove Previous Reference.\n" + err); });
        await fsAsync.rename(absoluteTempPath, absolutePath).catch((err) => { throw Error("Failed to rename Reference.\n" + err); });
    }
}

class HTTPFileServer {
    static Session = class FileServerUserSession {
        constructor(user, sessionToken) {
            this.user = user;
            this.sessionToken = sessionToken;
            this.lastActivityTime = Date.now();
            this.inactiveLimit = 1000 * 60 * 30 // 30 minutes in active log out  
        }
        updateActivityTime() {
            this.lastActivityTime = Date.now();
        }
        isSessionStillValid(updateActivityTimeIfValid = true) {
            if ((Date.now() - this.lastActivityTime) < this.inactiveLimit) {
                if (updateActivityTimeIfValid) this.updateActivityTime()
                return true
            } 
            return false
        }
    }

    static RequestParser = class FileServerRequestHandler {
        static handleAuth(body, req, res){
            body["User"]
            body["Password"]
        }
    }

    constructor(config) {
        this.config = config; 
        this._server = http.createServer();

        this.currentlyActiveSessions = {};
        
        this._server.on("request", this._requestListener.bind(this));
    }
    listen(port = 8080, host = "127.0.0.1") {
        this._server.listen(port, host, () => {
            console.log(`HTTP FILE SERVER Running on ${host}:${port}`)
        }); 
    }
    /**
     * Listens to incoming http requests, (http.server.prototype).on('request', requestListener);
     * @param {http.IncomingMessage} req Request sent from the client 
     * @param {http.ServerResponse} res Response that's going to be sent to the client
     */
    async _requestListener(req, res) {
        console.log(`INCOMING ${req.method} ${req.url}`)
        let cookies = req.headers.cookie
        if (req.method == "POST") {
            let body = '';
            req.on('data', (data) => {
                body += data.toString();
            })
            await new Promise((resolve) => { req.on("end", () => {resolve()}); }); 
            if (req.headers['content-type'] != 'application/json') return this.genErrorRes(res, "Bad Request", 400); 
            let payload = JSON.parse(body); 
            if (payload["Type"] == "Auth") {
                if (!payload["User"] && !payload["Password"]) return this.genErrorRes(res, "Bad Request", 400); 
                if (this.onAuth(payload["User"], payload["Password"])) {
                    const token = this.addSessionTokenForUser(payload["User"]); 
                    const resObj = {
                        "Token": token,
                        "Home": "/hello"
                    }
                    const resJSON = JSON.stringify(resObj); 
                    res.writeHead(201, {
                        'Content-Length': Buffer.byteLength(resJSON),
                        'Content-Type': "application/json",
                        'Set-Cookie': [`X-Auth-Token=${token}; SameSite=Strict`] 
                    }); 
                    res.end(resJSON); 
                    return true
                }
                return this.genErrorRes(res, "Unauthorized", 401)
            }
        }
        this.genErrorRes(res, "Not Implemented", 501);
    }
    genErrorRes(res, message = "ERROR!", errorCode = 404) {
        console.log(`RESPONSE ERROR ${errorCode}, ${message}`); 
        res.writeHead(errorCode, "Error");
        res.end(message);
    } 
    addSessionTokenForUser(user) {
        const token = Helpers.generateRandomString(36); 
        this.currentlyActiveSessions[token] = new HTTPFileServer.Session(user, token);
        return token;
    }
    onAuth(user, password) {
        let targetUserPassword = null
        if (this.config["Users"][user]) {
            console.log(`User ${user} requesting login`);
            targetUserPassword = this.config["Users"][user];
        } else if (this.config["Admins"][user]) {
            console.log(`Admin ${user} requesting login`);
            targetUserPassword = this.config["Users"][user];
        } else {
            console.log(`Rejected Unknown user ${user} login`);
            return false
        }
        
        if (password == targetUserPassword) {
            console.log(`${user} Login successful.`);
            return true
        } 
    }
}


async function main() {
    const config = await FileSystemOp.readConfig()
    const fileServer = new HTTPFileServer(config)
    fileServer.listen(8080, "127.0.0.1")
    
}
main()