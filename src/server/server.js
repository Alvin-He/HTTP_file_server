const http = require("node:http");
const express = require("express")
const fs = require("node:fs");
const fsAsync = require("node:fs/promises");
const { Stream } = require("node:stream");
const StreamAsync = require("node:stream/promises");
const { Buffer } = require("node:buffer");
const crypto = require("node:crypto");
const time = require("node:timers");
const ws = require("ws"); 
const Path = require('path');
const DEFAULT_CONFIG_PATH = "./config.json"

class Helpers {
    static generateRandomString(length = 8){
        return crypto.randomUUID().substring(0, length)
    }
    static genError(status, message = "") {
        let err = new Error(message);
        err.status = status;
        return err
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
        const absolutePath = Path.resolve(path); 
        return true
    }

    static async dirList(path, abortSignal = undefined) {
        if (!(await FileSystemOp.hasAccess(path))) throw Error("No Permission to Access File"); 
        const absolutePath = await fsAsync.realpath(path);
        const listing = await fsAsync.readdir(absolutePath, {withFileTypes: true}); 
        let directoryObject = {}
        for (let i = 0; i < listing.length; i++) {
            let obj = listing[i]; 
            const type = (
                (obj.isDirectory() && "Dir") ||
                (obj.isFile() && "File") ||
                (obj.isSymbolicLink() && "SymLink") ||
                undefined
            ); 
            directoryObject[obj.name] = type; 
        }
        return directoryObject; 
    } 
    static async mkdir(path) {
        if (!(await FileSystemOp.hasAccess(path))) throw Error("No Permission to Access File") 
        await fsAsync.mkdir(path, {recursive: true}).catch((err) => {throw Error("Make Dir Failed"); });
        return true
    }
    static async del(path) {
        if (!(await FileSystemOp.hasAccess(path))) throw Error("No Permission to Access File");
        await fsAsync.rm(path).catch((err) => {throw err; });
        return true
    }
    static async readFile(path, abortSignal = undefined) {
        if (!(await FileSystemOp.hasAccess(path))) throw Error("No Permission to Access File") 
        const absolutePath = await fsAsync.realpath(path);
        return fs.createReadStream(absolutePath);
    }
    static async writeFile(path, fileStream, abortSignal = undefined) {
        if (!(await FileSystemOp.hasAccess(path))) throw Error("No Permission to Access File") 
        const absolutePath = Path.resolve(path); // not resolving with real path here cuz the file prob doesn't exist  
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
        if (fs.existsSync(absolutePath)) {
            await fsAsync.rm(absolutePath).catch((err) => { throw Error("Failed to remove Previous Reference.\n" + err); });
        }
        await fsAsync.rename(absoluteTempPath, absolutePath).catch((err) => { throw Error("Failed to rename Reference.\n" + err); });
        return true
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
        this._server = express();

        this.currentlyActiveSessions = {};
        this.currentlyActiveUploads = {}; 
        this.currentlyActiveReads = {}; 

        this._server.use("/", express.static("./src/client/")); 

        // auto decode json
        this._server.use("/api/" ,express.json(
            {
                "inflate": true,
                "strict": false, 
                "type": "application/json",
            }
        ));

        // checks Auth validation 
        // this._server.post("/api/", (req, res, next) => {
        //     const token = req.body["Token"];
        //     if (!token){
        //         if (req.body["User"] && req.body["Password"]){
        //             if (!this.onAuth(req.body["User"], req.body["Password"])) 
        //                 return next(Helpers.genError(401, "Incorrect Info")); 
        //             const token = this.addSessionTokenForUser(req.body["User"]); 
        //             res.status(201).json({
        //                 "Token": token,
        //             });
        //         }
        //         return next(Helpers.genError(400, "Need Token")); 
        //     } 
        //     if (!(this.currentlyActiveSessions[token] && this.currentlyActiveSessions[token].isSessionStillValid())) {
        //         return next(Helpers.genError(401, "Session Invalid."))
        //     }
        //     next()
        // });
        
        this._server.post("/endpoints/binary/uploader", async (req, res, next) => {
            const writeToken = req.headers["x-write-token"]
            if (!writeToken || !this.currentlyActiveUploads[writeToken]) return next(Helpers.genError(400, "Need Write Approve"));
            let path = this.currentlyActiveUploads[writeToken]; 
            if (await FileSystemOp.writeFile(path, req).catch((err) => {next(err)})) {
                return res.status(201).json("Success"); 
            }
        }); 

        this._server.use("/endpoints/binary/read/", async(req, res, next) => {
            const readToken = req.headers["x-read-token"]
            if (!readToken || !this.currentlyActiveReads[readToken]) return next(Helpers.genError(400, "Need Read Approve"));
            delete this.currentlyActiveReads[readToken];
            return next(); 
        });
        this._server.use('/endpoints/binary/read/', express.static("./", {
            "dotfiles": "allow", 
        }));

        this._server.post("/api/fs/:op", async (req, res, next) => {
            if (!req.body["Path"]) return next(Helpers.genError(400, "Path required")); 
            const filePath = req.body["Path"]
            try {
            switch (req.params.op) {
                case "dirList":
                    const listing = await FileSystemOp.dirList(filePath).catch((err) => { throw Helpers.genError(500, err); });
                    return res.status(201).json(listing); 
                    break;
                case "mkdir":
                    if (await FileSystemOp.mkdir(filePath).catch((err) => next(err))) {
                        return res.status(201).json("Success");
                    }
                case "del": 
                    if (await FileSystemOp.del(filePath).catch((err) => next(err))) {
                        return res.status(201).json("Success");
                    }
                case "uploadPreApprove": 
                    if (!await FileSystemOp.hasAccess(filePath)) throw Helpers.genError(401, "No Access");
                    const writeToken = Helpers.generateRandomString(36);
                    this.currentlyActiveUploads[writeToken] = filePath
                    return res.status(201).json({"writeToken": writeToken}); 

                    break; 
                case "readPreApprove":
                    if (!await FileSystemOp.hasAccess(filePath)) throw Helpers.genError(401, "No Access");
                    const readToken = Helpers.generateRandomString(36);
                    this.currentlyActiveReads[readToken] = filePath;
                    return res.status(201).json({ "readToken": readToken });

                    break; 
                default:
                    throw Helpers.genError(400, "Unknown Op");
                    break;
            } 
            } catch(err) {
                next(err);
            }
        })
        // this._server.post("/api/", this._requestListener.bind(this));

        // err message response 
        this._server.use(function (err, req, res, next) {
            res.status(err.status || 500);
            res.send({ error: err.message });
        })

        //default response 
        this._server.use(function (req, res) {
            res.status(404);
            res.send({ error: "Not Found" })
        });

    }
    listen(port = 8080, host = "127.0.0.1") {
        this._server.listen(port, host, () => {
            console.log(`HTTP FILE SERVER Running on ${host}:${port}`)
        }); 
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
        return false
    }
}


async function main() {
    const config = await FileSystemOp.readConfig()
    const fileServer = new HTTPFileServer(config)
    fileServer.listen(8080, "127.0.0.1")
    
}
main()