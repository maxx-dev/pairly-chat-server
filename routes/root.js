const path = require('path');
const express = require('express');
const router = express.Router();
const serverHelper = require('../lib/Helper');
const packageJSON = require('../package.json');
const dbManager = require("../lib/DatabaseManager");
const userManager = require("../lib/UserManager");
const chatManager = require("../lib/ChatManager");
const socketManager = require("../lib/SocketManager");
const s3Manager = require("../lib/S3Manager");
const uuid = require("uuid");

router.get("/health", (req, res) => {
    con.log('health')
    res.json({version:packageJSON.version})
    //res.sendFile(path.join(__dirname, "../public/index.html"));
});

router.get("/newMsg", (req, res) => {
    con.log('NewMsg',req.query);
    ////res.sendFile(path.join(__dirname, "../public/index.html"));
});

router.get("/users", (req, res) => {
    res.json(app.users)
    ////res.sendFile(path.join(__dirname, "../public/index.html"));
});

router.post("/share-target", (req, res) => {
    con.log('share-target',req.originalUrl);
    res.sendFile('index.html',{'root':servePath});
});

let servePath = __dirname+'/../../client/';
if (process.env.ENV === 'DEVELOPMENT') servePath = '../client/public/';
//con.log(process.env.ENV,'servePath',servePath);
if (process.env.ENV === 'PRODUCTION')
{
    router.get("/", (req, res) => {

        res.sendFile('index.html',{'root':servePath});
    });

    router.get("/favicon.ico", (req, res) => {

        res.sendFile('favicon.ico',{'root':servePath});
    });

    router.get("/manifest.json", (req, res) => {

        res.sendFile('manifest.json',{'root':servePath});
    });

    router.get("/main.js", (req, res) => {

        res.sendFile('main.js',{'root':servePath});
    });

    router.get("/sw.js", (req, res) => {

        res.sendFile('sw.js',{'root':servePath});
    });
}

/*router.get("*", (req, res) => {

	con.log("ALL",req.originalUrl);
});*/

module.exports = {
    socket:null,
    router:router
};
