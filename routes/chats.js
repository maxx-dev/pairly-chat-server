const express = require('express');
const router = express.Router();
const serverHelper = require('../lib/Helper');
const packageJSON = require('../package.json');
const dbManager = require("../lib/DatabaseManager");
const userManager = require("../lib/UserManager");
const chatManager = require("../lib/ChatManager");
const socketManager = require("../lib/SocketManager");
const msgManager = require("../lib/MsgManager");

const s3Manager = require("../lib/S3Manager");
const emailManager = require("../lib/email/EmailManager");
const uuid = require("uuid");

let err,_, chatMessages, firstMsg, url, chatMembers, pushSubs, newMsg, user, chat, userChat, userChatOwn, res;

let getChatMsgs = async (chatId,opts) => {

    if (opts.from) opts.from = new Date(opts.from);
    if (opts.to) opts.to = new Date(opts.to);
    //con.log('opts.to',opts.to);
    [err,chatMessages] = await chatManager.getChatMessages([chatId],opts);
    [err,firstMsg] = await chatManager.getChatsFirstMessage([chatId],opts);
    for (let s=0;s<chatMessages.length;s++)
    {
        let msg = chatMessages[s];
        if (msg.id === firstMsg.id)
        {
            msg.isFirst = true;
        }
    }
    return [err, chatMessages]
}

router.post("/message", async (req, res) =>
{
    con.log('/api/chats/message',req.body);
    req.body.msg.userId = req.userId;
    [err,msg] = await msgManager.post(req.body.msg,req.body.opts = {});
    res.json(msg);
});

router.post("/test", async (req, res) =>
{
    con.log('/api/chats/test',req.body);
    res.json({ok:true})
});

router.get('/messages', async (req,res) => {

    con.log('/api/chats/messages',req.query);
    [err,chatMessages] = await getChatMsgs(req.query.chatId,{limit:parseInt(req.query.limit),to:req.query.to});
    con.log('chatMessages',chatMessages.length);
    res.json(chatMessages);
})


let socket = function (socket)
{
    socket.on("post:message", async (msg,opts = {}) =>
    {
        con.logRouteC(socket,'post:message',msg.text,msg.type,'opts',opts);
        if (!opts.onlyEmit)
        {
            msg.userId = socket.userId;
            [err,msg] = await msgManager.post(msg,opts);
            //con.log('msgManager.isFileMsg(msg)',msgManager.isFileMsg(msg))
            if (msgManager.isFileMsg(msg))
            {
                socket.emit('post:message/uploadReady',msg);
            }
        }
        else
        {
            msgManager.emit(msg)
        }
    });

    socket.on("post:chats/invite", async (contacts) =>
    {
        con.logRouteC(socket,'post:chats/invite',contacts);
        let chats = [];
        for (let s=0;s<contacts.length;s++)
        {
            let contact = contacts[s];
            contact.email = contact.firstName+'@lametrain.icu';
            let {raw,hash} = serverHelper.generatePassword();
            let newUser = {
                firstName:contact.firstName,
                lastName:contact.lastName,
                email:contact.email,
                phone: contact.phone || "",
                state: contact.state || "",
                img: contact.img || "",
                password:hash,
                createdAt:new Date()
            };
            [err,user] = await userManager.create(newUser);
            [err,chat] = await chatManager.create({createdAt: new Date()});
            [err,userChat] = await chatManager.createUserChat({userId:user.id,chatId:chat.id,createdAt:new Date()});
            [err,userChatOwn] = await chatManager.createUserChat({userId:socket.userId,chatId:chat.id,createdAt:new Date()});

            let userClone = serverHelper.clone(user);
            userClone.token = null;
            userClone.chats = [];

            delete userClone.password;
            chats.push({
                id: chat.id,
                createdAt: chat.createdAt,
                userChat:userChat,
                user:userClone,
                latestMsg: null,
                active:false,
                msgs:[]
            });
            [err,res] = await emailManager.send('REGISTRATION',{user:userClone,pw:raw});
            if (err) con.error(err);
        }
        socket.emit('post:chats/invite',chats)
    });

    socket.on("put:messageArrived", async (msg) => {

        con.logRouteC(socket,'put:messageArrived',msg.id,msg.type,msg.text);
        msg.state = 1;
        [err,_] = await chatManager.updateBy({state:msg.state},'id',msg.id,{table:'chatMessages'});
        //app.io.in('chat_'+msg.chatId).emit('messageArrived', msg);
        socket.broadcast.to('chat_'+msg.chatId).emit('put:messageArrived',msg);
    });

    // marks a message and all previous messages as read
    socket.on("put:messageRead", async (msg) => {

        con.logRouteC(socket,'put:messageRead',msg.id,msg.type,msg.text);
        msg.state = 2;
        [err,_] = await chatManager.markMessagesAsRead(msg.chatId,socket.userId);
        //app.io.in('chat_'+msg.chatId).emit('messageRead', msg);
        socket.broadcast.to('chat_'+msg.chatId).emit('put:messageRead',msg);
    });

    socket.on("put:statusChanged", async (status) => {

        con.logRouteC(socket,'put:statusChanged',status);
        await socketManager.statusChanged(socket,status,false);
    });

    socket.on("get:chatMessages", async (chatId,opts = {}) => {

        con.logRouteC(socket,'get:chatMessages',chatId,opts);
        [err,chatMessages] = await getChatMsgs(chatId,opts);
        //con.log('chatMessages',chatMessages.length,chatMessages);
        socket.emit('get:chatMessages',chatMessages);
    });

    socket.on('get:signedFileLink',async function (keyPrefix,mimeType)
    {
        con.logRouteC(socket,'get:signedFileLink',keyPrefix);
        let s3Key = keyPrefix+''+uuid.v4();
        [err,url] = await s3Manager.uploadPreSignedUrl(s3Key,{contentType:mimeType});
        //con.log('emit signedFileLink',docType);
        socket.emit('get:signedFileLink',null,url,s3Key);
    });
};

module.exports = {
    socket:socket,
    router:router
};

/*setTimeout(async () => {
    con.log('Send Push');
    //await pushManager.sendPushForChatMsg({userId:2,chatId:1,text:'test'});
},2000)/**/