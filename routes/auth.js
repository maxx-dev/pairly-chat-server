const express = require('express');
const fs = require('fs');
const router = express.Router();
//const con = require('@modrena/logger');
const serverHelper = require('../lib/Helper');
const packageJSON = require('../package.json');
const userManager = require("../lib/UserManager");
const chatManager = require("../lib/ChatManager");
const socketManager = require("../lib/SocketManager");
const { v4: uuidv4 } = require('uuid');

// 2FA
const speakeasy = require('speakeasy');
const utils = require('../lib/auth/utils.js');
const base64url = require('base64url');
const QRCode = require('qrcode');

let doLogin = async function (login,cb)
{
    let devLogin = (login) =>  process.env.DEV_LOGIN === '1' && process.env.ENV === 'DEVELOPMENT' && (login.password === '12345678!' || login.password === '123');
    let loginRes = 'ERROR';
    let err, user;
    if (login.biometricLoginToken)
    {
        [err,user] = await userManager.getBy('biometricLoginToken',login.biometricLoginToken,{pw:true});
    }
    else
    {
        [err,user] = await userManager.getBy('email',login.email,{pw:true});
    }
    if (user)
    {
        let token = false;
        let userDataForClient;
        con.log('login',login);
        //con.log('user.webAuthActive',user.webAuthActive);
        //con.log('login.biometricLoginToken',login.biometricLoginToken);
        let verifyLogin;
        if (user && user.webAuthActive && login.biometricLoginToken)
        {
            let webAuthResInfo = JSON.parse(user.webAuthResInfos);
            token = serverHelper.createToken({userId:user.id},1440); // 2 months
            //con.log('webAuthResInfo',webAuthResInfo);
            let getAssertion = utils.generateServerGetAssertion(webAuthResInfo);
            getAssertion.status = 'ok';
            //con.log('getAssertion',getAssertion);
            return ['WEBAUTH',token,{email:user.email,webAuthResInfo:{assertion:getAssertion,webAuthResInfo:webAuthResInfo}}];
        }
        if (login.biometricLoginToken)
        {
            verifyLogin = "SUCCESS";
        }
        else
        {
            verifyLogin = serverHelper.verifyLogin(login.password,user.password);
        }
        let isDevLogin = devLogin(login);
        if (user && (verifyLogin=== 'SUCCESS' || isDevLogin))
        {
            if (isDevLogin) con.log('Login of dev user',user ? user.email : false);
            loginRes = 'SUCCESS';
            if (!user.activatedAt) [err,_] = await userManager.update({activatedAt:new Date()},user.id);
            token = serverHelper.createToken({userId:user.id},1440); // 2 months
            if (user.lockedAt)
            {
                con.log('LOGIN TRY OF LOCKED CUSTOMER FOR',user.email);
                loginRes = 'ACCOUNT_LOCKED';
                token = null;
            }
        }
        if (loginRes !== 'SUCCESS') con.log('LOGIN FAILED FOR',login.email,'RES',verifyLogin);
        if (loginRes === 'SUCCESS')
        {
            con.log('LOGIN SUCCESS FOR',user.email);
            userDataForClient = await userManager.getUserDataForClient(user);
        }
        //con.log('loginRes',loginRes,token,login.password,user.password);
        return [loginRes,token,userDataForClient];
    }
    else
    {
        con.log('No User found for',login);
        return [loginRes,null,null];
    }
};

let doWebAuthVerify = async function (webAuthnResp,isLogin,email)
{
    let result;
    con.log('-----------');
    con.log('webAuthnResp',webAuthnResp);
    con.log('isLogin',isLogin);
    con.log('email',email);
    con.log('-----------');
    if (webAuthnResp.response.attestationObject !== undefined)   // Verify attestation
    {
        result = utils.verifyAuthenticatorAttestationResponse(webAuthnResp);
    }
    else if (webAuthnResp.response.authenticatorData !== undefined)
    {
        //let authenticators = socket.webAuth.webAuthResInfo;
        let authenticators = webAuthnResp.webAuthResInfo.webAuthResInfo;
        //con.log('authenticators',authenticators);
        result = utils.verifyAuthenticatorAssertionResponse(webAuthnResp, authenticators)
    }
    else
    {
        socket.emit('put:auth/webAuthVerify','INVALID_RESPONSE');
        return;
    }
    //con.log('result',result);

    if (result.verified)
    {
        let token = uuidv4();
        if (!isLogin)
        {
            await userManager.updateBy({twoFaActive:0,twoFaSecret:null,webAuthActive:1,webAuthResInfos:JSON.stringify([result.authrInfo],false,4),biometricLoginToken:token},'email',email);
        }
        let appInfos = getAppInfos();
        let [err,user] = await userManager.getBy('email',email,{pw:false});
        if (isLogin)
        {
            token = serverHelper.createToken({userId:user.id},1440); // 2 months
        }
        let userDataForClient = await userManager.getUserDataForClient(user);
        //socket.emit('put:auth/webAuthVerify',null,token,userDataForClient,appInfos);
        return [null,token,userDataForClient,appInfos];
    }
    else
    {
        con.log('Result not verified',result);
        await userManager.updateBy({twoFaActive:0,twoFaSecret:null,webAuthActive:0,webAuthResInfos:null},'email',email);
        return ['SIGNATURE_AUTH_ERROR']
    }
}

let joinChats = async function (socket,user)
{
    //socket.user.id = socket.id;
    if (user.chats)
    {
        for (let s=0;s<user.chats.length;s++)
        {
            let chat = user.chats[s];
            //chat.user.isOnline = false;
            //con.log('socket.userId',socket.userId);
            let chatId = user.chats[s].userChat.chatId;
            //console.log('join chatId',chatId);
            socket.join('chat_'+chatId);
            //app.io.to(socket.id).emit("user_id", socket.id);
            //app.io.in('chat_'+chatId).emit('statusChanged', {userId:user.id,isOnline:true});
        }
    }
}

let onAuth = async function (token,opts = {})
{
    return new Promise((resolve, reject) =>
    {
        let [err,data] = serverHelper.verifyToken(token,true);
        //let socketObj = {id:socket.id,userId:data && data.userId ? data.userId : false};
        con.log(data ? data.userId : '-','get:auth','version',(opts.version || '-')+'/'+packageJSON.version,'token',token);
        let appInfos = getAppInfos();
        if (data && data.userId)
        {
            userManager.getById(data.userId).then(async function ([err,user])
            {
                if (user)
                {
                    if (user && socket) socket.userId = user.id;
                    let userDataForClient = await userManager.getUserDataForClient(user);
                    userDataForClient.token = token;
                    //await joinChats(socket,userDataForClient);  // Join Rooms/Chats
                    resolve([null,userDataForClient,appInfos])
                }
                else
                {
                    resolve(['NO_USER',false,appInfos])
                }
            });
        }
        else
        {
            resolve(['NO_DATA',false,appInfos])
        }
    })
};

let doRegister = async function (data)
{
    let customerExists,customerInsert, err, update;
    [err,customerExists] = await userManager.getByEmail(data.email); // check for existing customer
    //con.log('customerExists',customerExists);
    if (customerExists && customerExists.activatedAccountAt) // if no customer or customer but not activated account yet
    {
        return ['EXISTS',null];
    }
    let customer = {};
    customer.activatedAccountSource = data.activatedAccountSource;
    customer.activatedAccountAt = new Date();
    let {pw,pwHash} = serverHelper.generatePassword();
    customer.password = pwHash;
    //con.log('customer',customer);
    if (!customerExists)
    {
        customer.publicId = serverHelper.createCustomerPublicId();
        customer.email = data.email;
        [err,customerInsert] = await userManager.create(customer);
        customer.id = customerInsert.id;
    }
    else
    {
        //[err,update] = await userManager.update(customer,customerExists.id);
        customer = customerExists;
    }
    return [err,customer];
};

let getAppInfos = function ()
{
    //let appInfos = {buildTime:process.env.BUILD_TIME,version:process.env.VERSION,currentServerTime:new Date()};
    let appInfos = {
        buildTime:process.env.BUILD_TIME,
        version:packageJSON.version,
        currentServerTime:new Date(),
        swVersion:process.env.SERVICE_WORKER_VERSION
    };
    return appInfos;
};

let getIp = function (socket)
{
    if (socket.request && socket.request.connection)
    {
        return socket.request.connection.remoteAddress;
    }
    return false;
};


router.post("/login", async (req, res) =>
{
    con.log('/api/auth/login',req.body);
    let [err,token,user] = await doLogin(req.body);
    if (user) {
        user.token = token;
        socket.userId = user.id;
    }
    let appInfos = getAppInfos();
    res.json({
        err:err,
        user:user,
        appInfos:appInfos
    })
});

router.put("/webAuthVerify", async (req, res) =>
{
    con.log('/api/auth/webAuthVerify',req.body);
    let [err,token,user] = await doWebAuthVerify(req.body.makeCredResponse,req.body.isLogin,req.body.email);
    if (user) {
        user.token = token;
    }
    let appInfos = getAppInfos();
    res.json({
        err:err,
        user:user,
        appInfos:appInfos
    })
});

router.post("/", async (req, res) =>
{
    con.log('/api/auth',req.body);
    let [err,user,appInfos] = await onAuth(req.body.token,{});
    user.token = req.body.token;
    res.json({
        err:err,
        user:user,
        appInfos:appInfos
    })
});

let socket = function (socket)
{
    //con.log('handshake query',socket.handshake.query)
    if (socket.handshake && socket.handshake.query && socket.handshake.query.token)
    {
        let token = socket.handshake.query.token;
        onAuth(token,{version:socket.handshake.query.version}).then( async ([err,user,appInfos]) =>
        {
            con.logRouteC(socket,' -> get:auth','err',err,'user',user ? user.id : false);
            if (user)
            {
                if (user && socket) socket.userId = user.id;
                let userDataForClient = await userManager.getUserDataForClient(user);
                userDataForClient.token = token;
                await joinChats(socket, userDataForClient);  // Join Rooms/Chats
                socketManager.statusChanged(socket, {userId: user.id, isOnline: true}, user.chats).then(() => {})
            }
            socket.emit('get:auth',{
                err,
                user,
                appInfos
            });/**/
        })
    }
    let onevent = socket.onevent;
    socket.onevent = function (packet) // Catch all events for token auth
    {
        let args = packet.data || [];
        //con.log('args',args);
        let event = args[0];
        let catchAllPacket = JSON.parse(JSON.stringify(packet));
        catchAllPacket.data = ["*"].concat(args);
        onevent.call(this, catchAllPacket);// catch-all
        //con.log('isvalid',socket.validAuth,packet,'event',event);
        //con.log(event,socket.handshake.query);
        socket.validAuth = false;
        if (event === 'get:auth'
            || event === 'get:auth/login'
            || event === 'post:auth/register'
            || event === 'post:auth/forgotPassword'
            || event === 'get:checkCustomer'
            || event === 'put:auth/webAuthVerify'
            || event === 'get:auth/verifyTwoFaToken'
            || event === 'get:dashboard'
            || event === 'disconnect'
        )
        {
            onevent.call (this, packet);// original call
        }
        else
        {
            // AUTH token can be last argument, or if func has callback the second last
            let indexOfToken = packet.data.length-1;
            let tokenArg = packet.data[indexOfToken];
            if (typeof tokenArg === 'function')
            {
                indexOfToken--;
                tokenArg = packet.data[indexOfToken];
            }
            packet.data.splice(indexOfToken,1); // Remove token from args
            //con.log('packet.data',packet.data);
            let [err,user] = serverHelper.verifyToken(tokenArg);

            if (!err)
            {
                //con.log('isValid Auth',user);
                socket.userId = user.userId;
                socket.validAuth = true;
                onevent.call (this, packet);// original call
            }
            else
            {
                con.log('UNAUTHENTICATED_CALL TO',event,user ? user.id : '-',err);
                if (err === 'EXPIRED' || err === 'INVALID')
                {
                    socket.emit('get:auth',err);
                }
                // dont forward call!
            }
        }
    };
    socket.on('get:auth/login', async function(login)
    {
        con.logSep(35);
        con.logRouteC(socket,'get:auth/login',getIp(socket),login.email,login.biometricLoginToken);
        let [err,token,user] = await doLogin(login);
        if (user) {
            user.token = token;
            socket.userId = user.id;
        }
        let appInfos = getAppInfos();
        socket.emit('get:auth/login',{
            err,
            user,
            appInfos
        });
    });

    socket.on('get:auth', async function(token)
    {
        let [err,user,appInfos] = await onAuth(token,socket,{});
        user.token = token;
        socket.emit('get:auth',{
            err,
            user,
            appInfos
        });/**/
    });

    socket.on('post:auth/forgotPassword', async function(data)
    {
        con.logRouteC(socket,'post:auth/forgotPassword',data);
        if (data && data.email)
        {
            let [err,customerExists] = await userManager.getByEmail(data.email); // check for existing customer
            //if (err) con.error(err);
            con.log('customerExists',customerExists ? customerExists.id : false);
            if (customerExists) // Dont give infos that users exists
            {
                let {pw,pwHash} = serverHelper.generatePassword();
                let [err,update] = await userManager.update({password:pwHash},customerExists.id);
                /*notManager.send(notManager.types.FORGOTPASSWORD,{
                    customer:customerExists,
                    pw:pw
                });*/
            }
            socket.emit('post:auth/forgotPassword',null);
        }
        else
        {
            socket.emit('post:auth/forgotPassword','INVALID');
        }
    });

    socket.on('post:auth/register', async function(register)
    {
        con.logSep(35);
        con.logRouteC(socket,'post:auth/register',getIp(socket),register);
        let [err,customerInsert] = await doRegister(register);
        socket.emit('post:auth/register',err,register);
        //serverHelper.sentToAdmin('app:post:event','REGISTER',register);
        if (!err)
        {
           // await slackManager.sendNotification(slackManager.getEventNotification('REGISTER',customerInsert, false));
        }
    });

    socket.on('put:auth/loginBiometric', async function(authRequest)
    {
        con.logRouteC(socket,'post:auth/loginBiometric',authRequest);
        await userManager.update({biometricLoginToken:authRequest.biometricLoginToken ?authRequest.biometricLoginToken : null },socket.userId);
        socket.emit('put:auth/loginBiometric');
    });

    // 2FA Touch-ID/ Face-ID
    // active/deactivate 2FA
    socket.on('put:auth/TwoFa', async function(state)
    {
        con.logRoute(socket.userId,'put:auth/TwoFa','state',state);
        let update;
        let secret = speakeasy.generateSecret();
        update = {
            twoFaSecret:state ? secret.base32 : null,
            twoFaActive:state ? 1 : 0
        };

        await userManager.update(update,'id',socket.userId);
        let [err, user] = await userManager.getById(socket.userId);
        if (state)
        {
            secret.otpauth_url = secret.otpauth_url.replace('SecretKey',user.email)+'&issuer=PairlyChat';
            //con.log('secret',secret);
            QRCode.toDataURL(secret.otpauth_url, function(err, data_url)
            {
                //con.log(data_url);
                socket.emit('put:auth/TwoFa',data_url);
            });
        }
        else
        {
            socket.emit('put:auth/TwoFa',false);
        }
    });

    socket.on('get:auth/verifyTwoFaToken', async function(email,twoFaToken)
    {
        con.logRoute(socket.userId,'get:auth/verifyTwoFaToken','email',email,'twoFaToken',twoFaToken);
        let val = socket.userId;
        let prop = 'id';
        if (email)
        {
            prop = 'email';
            val = email;
        }
        let [err,user] = await userManager.getBy(prop,val);
        if (user)
        {
            let base32secret = user.twoFaSecret;
            //con.log('base32secret',base32secret);
            let verified = speakeasy.totp.verify({ secret: base32secret,
                encoding: 'base32',
                token: twoFaToken });
            //con.log('verified',verified);
            let token = serverHelper.createToken({userId:user.id},96);
            if (!verified)
            {
                socket.emit('get:auth/verifyTwoFaToken','SUCCESS',user,token);
            }
            else
            {
                socket.emit('get:auth/verifyTwoFaToken','ERROR',false,false);
            }

            if (!user.twoFaActive && verified)
            {
                let update = {
                    twoFaActive:1,
                    webAuthActive:0,
                    webAuthResInfos:null
                };
                lameTrain.dbManager.update('admins',update,'id',socket.userId,function () {})
            }
        }
        else
        {
            socket.emit('get:auth/verifyTwoFaToken','ERROR');
        }

    });

    // Setup for TouchId
    socket.on('put:auth/touchId', async function(email,enabled)
    {
        con.logRoute(socket.userId,'put:auth/touchId','email',email,enabled);
        if (enabled)
        {
            let webAuthId = utils.randomBase64URLBuffer();
            //let webAuthId = Uint8Array.from("XXXXXX", c => c.charCodeAt(0)),
            let type = 'platform';
            let username = email;
            let displayName = email;
            let challengeMakeCred = utils.generateServerCredentialsChallenge(username, displayName, webAuthId, type);
            challengeMakeCred.status = 'ok';
            socket.webAuth = {
                id:webAuthId,
                challenge:challengeMakeCred.challenge
            };
            con.log('Challenge is',challengeMakeCred.challenge);
            socket.emit('put:auth/touchId',null,challengeMakeCred);
        }
        else
        {
            await userManager.updateBy({webAuthActive:0,webAuthResInfos:null},'email',email);
            socket.emit('put:auth/touchId',null,null);
        }
    });

    // Login via Face/TouchId
    socket.on('put:auth/webAuthVerify', async function(webAuthnResp,email,isLogin)
    {
        con.logRoute(socket.userId,'put:auth/webAuthVerify',email);
        let [err,token,userDataForClient,appInfos] = await doWebAuthVerify(webAuthnResp,isLogin,email);
        socket.emit('put:auth/webAuthVerify',err,token,userDataForClient,appInfos);
    });

    socket.on('get:appInfos', function()
    {
        con.logRouteC(socket,'get:appInfos',getIp(socket));
        let appInfos = getAppInfos();
        socket.emit('get:appInfos',appInfos);
    });

    socket.on('get:auth/logout', function()
    {
        con.logRouteC(socket,'get:auth/logout',getIp(socket));
        con.logSep(35);
    });

    socket.on("disconnect", async () => {
        con.logRouteC(socket,'disconnect',getIp(socket));
        if (socket.userId)
        {
            await socketManager.statusChanged(socket, {userId:socket.userId,isOnline:false},false);
        }
    });
};

module.exports = {
    socket:socket,
    router:router
};