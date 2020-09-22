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
const url = require('url');

// https://localhost/api/media/d717e0d4-6166-4464-877c-865b41f084fd/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImV4cCI6MTU5Njg4Mzg0ODU0OCwiaWF0IjoxNTkxNjk5ODQ4fQ.ibkBsa5qIjM-wvg0rzdb4JIakda3jnyMacSx92ys-dc
/*router.get("/google", async (req, res) => {

    //con.log('Reached google');
    res.redirect('https://google.de');
})/**/

let handleRequest = async (req,res) => {

    const urlObj = url.parse(req.url,true);
    let pathName = urlObj.pathname;
    let arr = pathName.split('/');
    //con.log('arr',arr);
    let s3Key = arr[1]+'/'+arr[2];
    let token = arr[3];
    //con.log('arr',arr);
    //con.log('s3Key',s3Key);
    //con.log('token',token);
    if (!s3Key)
    {
        //con.log('No key');
        res.sendStatus(404);
        return
    }
    let [err,user] = serverHelper.verifyToken(token);
    if (!err)
    {
        let [err,url] = await s3Manager.getSignedUrl(s3Key,{});
        //con.log('Success',user,url);
        //res.redirect('blob:'+url);
        if (req.query.link)
        {
            res.json({url:url});
        }
        else
        {
            //con.log('REDIRECT',req.headers)
            res.redirect(url);
        }

    }
    else
    {
        con.log('UNAUTHENTICATED_CALL TO MEDIA');
        res.sendStatus(400);
    }
};

router.get("*", async (req, res) => {
    //con.log('media serve',req.originalUrl);
    await handleRequest(req,res)
});
/**/

module.exports = {
    socket:null,
    router:router
};