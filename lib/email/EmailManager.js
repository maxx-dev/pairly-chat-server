let ses;
const fs = require('fs');
const mailcomposer = require('mailcomposer');
const AWS = require('aws-sdk');
/**
 * @constructor
 */
class EmailManager
{
    constructor ()
    {
        AWS.config = new AWS.Config({
            "accessKeyId": process.env.AWS_ACCESS_KEY_ID,
            "secretAccessKey": process.env.AWS_SECRET_ACCESS_KEY,
            "region": process.env.AWS_REGION
        });
        ses = new AWS.SES({apiVersion: '2010-12-01',  region: 'eu-west-1'}); // ses has only one region in europe
    }

    /**
     * Send an email
     * @example
     * let emailManager = require('@modrena/lametrain-email-manager');
     * emailManager.send('REQUEST_REJECTED',{
     *     customer:{id:1,email:'test@lametrain.icu'},
     *     request:{publicId:1}
     * });
     * @param {string} emailType - The type of the email
     * @param {object} mailData - The email object
     * @return {Email}
     */
    async send (emailType,mailData)
    {
        let email = this.getEmailData(emailType,mailData);
        //con.log('mailData',mailData);
        return await this.send_(email,emailType,mailData);
        //return email;
    };

    /**
     * Get an email object
     * @param {string} emailType - The type of the email
     * @param {object} mailData - The mail data
     * @return {Email}
     */
    getEmailData (emailType,mailData)
    {
        let email = {};
        let args = Array.prototype.slice.call(arguments); // cut the first argument and converts arguments to real array
        args.shift();
        //con.log('args',args);
        if (!EmailManager.emailTypes[emailType] && typeof emailType !== 'function')
        {
            con.error('Unknown emailtype',emailType);
            return;
        }
        if (typeof emailType === 'function')
        {
            email = emailType.apply(this,args);
        }
        else
        {
            email = new EmailManager.emailTypes[emailType](mailData);
        }
        return email;
    }

    send_ (email,emailType,mailData)
    {
        return new Promise((resolve, reject) =>
        {
            let mailObject = email.create();
            const mail = mailcomposer({
                from: email.from(),
                replyTo: email.replyTo(),
                to: mailObject.to,
                subject: mailObject.subject,
                html:mailObject.html,
                headers: [],
                attachments:mailObject.attachments || []
            });
            let sendRawEmailPromise;

            let tags = [
                {
                    Name: 'EmailType',
                    Value: emailType,
                },
                {
                    Name: 'App',
                    Value: 'Pairly',
                },
                {
                    Name: 'Env',
                    Value: process.env.ENV,
                }
            ]

            mail.build((err, message) =>
            {
                if (err)
                {
                    resolve([`MAIL BUILD ERROR ${err}`,null]);
                    return;
                }
                //fs.writeFileSync('./custom/RawMail.txt',message);
                //con.log('mailData',mailData);
                sendRawEmailPromise = ses.sendRawEmail({RawMessage: {Data: message},Tags:tags},function(err, data) // data={RequestId:'',MessageId:''}
                {
                    con.log('MAIL TO',mailObject.to,'TYPE', emailType,data && data && data.MessageId ? data.MessageId : 'ERROR');
                    if (err) con.error('MAIL ERROR:',err);
                    if (data && data.MessageId && mailData.customer && mailData.customer.id)
                    {
                        //con.log('EmailKey',key);
                    }
                    resolve([err,data])
                });
            });
        })
    };
}

EmailManager.emailTypes = {

    FORGOT_PASSWORD:require('./emails/ForgotPassword'), //
    REGISTRATION:require('./emails/Registration'), //
};

module.exports = new EmailManager();