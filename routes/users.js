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

let err,_, pushSub;



let socket = function (socket)
{
    socket.on("post:webPush", async (subscription) =>
    {
        con.logRouteC(socket, 'post:webPush',subscription ? subscription.endpoint : false);
        if (subscription)
        {
            let [err,pushSub] = await userManager.getPushSubBy('endpoint',subscription.endpoint,{});
            if (!pushSub)
            {
                let newPushSub = {
                    userId:socket.userId,
                    platform:'web',
                    endpoint:subscription.endpoint,
                    subscription:JSON.stringify(subscription,false,4),
                    createdAt:new Date()
                };
                [err,_] = await userManager.createPushSubscription(newPushSub);
            }
            else
            {
                //con.log('Push Sub Exists');
            }
        }
        socket.emit('post:webPush')
    });

    socket.on("put:users/settings", async (udate) =>
    {
        con.logRouteC(socket, 'put:users/settings',udate);
        let [err,_] = await userManager.update(udate,socket.userId);
        socket.emit('put:users/settings',!!err)
    });

    socket.on("put:users", async (udate) =>
    {
        con.logRouteC(socket, 'put:users',udate);
        let [err,_] = await userManager.update(udate,socket.userId);
        socket.emit('put:users',!!err)
    });

    socket.on("post:users/iosPush", async (subscription) =>
    {
        con.logRouteC(socket, 'post:users/iosPush',subscription ? subscription.token : false);
        let [err,pushSub] = await userManager.getPushSubBy('endpoint',subscription.token,{});
        if (!pushSub)
        {
            let newPushSub = {
                userId:socket.userId,
                platform:'ios',
                endpoint:subscription.token,
                subscription:JSON.stringify({token:subscription.token},false,4),
                createdAt:new Date()
            };
            [err,_] = await userManager.createPushSubscription(newPushSub);
        }
        else
        {
            //con.log('Push Sub Exists');
        }
    });

    socket.on("delete:users/iosPush", async (subscription) =>
    {
        con.logRouteC(socket, 'delete:users/iosPush',subscription.token);
        if (subscription)
        {
            let [err,_] = await userManager.deletePushSubBy('endpoint',subscription.token,{});
        }
        socket.emit('delete:users/webPush')
    });

    socket.on("delete:webPush", async (subscription) =>
    {
        con.logRouteC(socket, 'delete:webPush',subscription);
        if (subscription)
        {
            let [err,_] = await userManager.deletePushSubBy('endpoint',subscription.endpoint,{});
        }
        socket.emit('delete:webPush')
    });
};

module.exports = {
    socket:socket,
    router:router
};