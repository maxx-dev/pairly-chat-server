const pushManager = require("../lib/PushManager");
const chatManager = require("../lib/ChatManager");
const s3Manager = require("../lib/S3Manager");
const uuid = require("uuid");

let err, newMsg, url;
class MsgManager
{
    async post (msg,opts)
    {
        msg.createdAt = new Date();
        //msg.userId = opts.userId;
        msg.state = 0;

        if (this.isFileMsg(msg))
        {
            let keyPrefix = '';
            if (msg.type === 'AUDIO') keyPrefix = 'audio/';
            if (msg.type === 'VIDEO') keyPrefix = 'video/';
            if (msg.type === 'IMAGE') keyPrefix = 'image/';
            if (msg.type === 'OTHER') keyPrefix = 'other/';
            let s3Key = keyPrefix+''+uuid.v4();
            msg.mimeType = msg.mimeType || 'audio/mp3';
            [err,url] = await s3Manager.uploadPreSignedUrl(s3Key,{contentType:msg.mimeType});
            msg.text = s3Key;
            msg.uploadUrl = url;
        }
        //con.log('msg before create',msg);
        [err,newMsg] = await chatManager.createMsg(msg);
        msg.id = newMsg.id;
        if (msg.metaData && typeof msg.metaData === 'string') msg.metaData = JSON.parse(msg.metaData);
        await pushManager.sendPushForChatMsg(msg);


        if (this.isFileMsg(msg))
        {
            //con.log('IS UPLOAD READY',msg.id,msg.uploadUrl);
            //socket.emit('post:message/uploadReady',msg);
        }

        if (!this.isFileMsg(msg))
        {
            this.emit(msg);
        }
        return [null,msg];
    }

    emit (msg)
    {
        app.io.in('chat_'+msg.chatId).emit("post:message", msg);
        //socket.broadcast.to('chat_'+msg.chatId).emit('put:messageArrived',msg);
    }

    isFileMsg (msg)
    {
        return msg.type === 'AUDIO' || msg.type === 'VIDEO' || msg.type === 'IMAGE'
    }
}

module.exports = new MsgManager();