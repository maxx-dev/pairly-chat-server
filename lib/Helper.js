const jwt2 = require('jsonwebtoken');
const crypto = require ('crypto');
let jwtTokenSecret = process.env.LOGIN_TOKEN;
const helper = {};

helper.createToken = function (iss,expireHours,customSecret)
{
    let now = new Date();
    now.setHours(now.getHours() + (expireHours || 72));
    let expires = now.getTime();
    let plain = {iss: iss, exp: expires };
    if (typeof iss === 'object')
    {
        plain = iss;
        plain.exp = expires;
    }
    let token = jwt2.sign(plain,customSecret || jwtTokenSecret);
    if (!token)
    {
        console.error('Token is undefined');
    }
    return token;
};

helper.verifyToken = function (token,canFail)
{
    if (!token || token === 'undefined' || token === 'false')
    {
        return ['INVALID',null];
    }
    try {
        let now = new Date();
        let decoded = jwt2.verify(token,jwtTokenSecret);
        if (decoded.exp)
        {
            let expires = new Date(decoded.exp);
            if (expires.getTime() <= now.getTime()) // Expired
            {
                return ['EXPIRED',decoded];
            }
        }
        return [null,decoded];
    }
    catch (err)
    {
        if (!canFail)
        {
            console.error('Token could not get verified',token);
        }
    }
    return ['INVALID',null];
};

/*let token = helper.createToken({userId:2},999999999);
let [err,user] = helper.verifyToken(token);
console.log('TOKEN',err,token);/**/

helper.verifyLogin = function (userPw,pwHash)
{
    let userPwHashed = helper.hashString(userPw);
    let res = null;
    if (userPwHashed)
    {
        if (userPwHashed === pwHash)
        {
            res = 'SUCCESS';
        }
        else
        {
            res = 'WRONG_CREDENTIALS';
        }
    }
    else
    {
        res = 'WRONG_CREDENTIALS';
    }
    return res;
};

helper.hashString = function (str)
{
    let sha256 = crypto.createHash("sha256");
    sha256.update(str, "utf8");
    str = sha256.digest("base64");
    return str;
};

helper.randomAlpaNumericStr = function (length)
{
    return [...Array(length)].map(i=>(~~(Math.random()*36)).toString(36)).join('')
};

helper.generatePassword = function ()
{
    let pw = helper.randomAlpaNumericStr(12);
    return {
        raw:pw,
        hash:helper.hashString(pw)
    }
};

helper.clone = function (json)
{
    return JSON.parse(JSON.stringify(json));
};

module.exports = helper;