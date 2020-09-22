const chatManager = require("./ChatManager");
const userManager = require("./UserManager");
const webpush = require("web-push");
var apn = require('apn');
//con.log('IOS_PUSH_TOKEN_KEY_ID',process.env.IOS_PUSH_TOKEN_KEY_ID,'IOS_PUSH_TOKEN_TEAM_ID',process.env.IOS_PUSH_TOKEN_TEAM_ID,'IOS_PUSH_TOKEN_KEY',process.env.IOS_PUSH_TOKEN_KEY);
let err, chatMembers, pushSubs, msgAuthor;
class PushManager
{
	constructor()
	{
		this.apnConnection = new apn.Provider( {
			token:{
				key:process.env.IOS_PUSH_TOKEN_KEY,
				keyId:process.env.IOS_PUSH_TOKEN_KEY_ID,
				teamId:process.env.IOS_PUSH_TOKEN_TEAM_ID,
			},
			production:process.env.IOS_PUSH_TOKEN_PRODUCTION === '1'
		});
	}

	async sendWebPush (push,msg)
	{
		const options = {
			vapidDetails: {
				subject: 'https://developers.google.com/web/fundamentals/',
				publicKey: process.env.WEB_PUSH_PUBLIC_KEY,
				privateKey: process.env.WEB_PUSH_PRIVATE_KEY,
			},
			TTL: 60 * 60 // 1 hour in seconds.
		};

		webpush.sendNotification(
			push.subscription,
			push.data,
			options
		)
			.then((res) => {
				con.log('Sent iOS-Push to',msg.userId,'for chat', msg.chatId,'code',res.statusCode);
			})
			.catch((err) => {

				con.log('Push Msg failed',err.statusCode,err);
			});
	}

	async sendIosPush (pushSub,msg)
	{
		let notification = await this.getIosPusNotification({alert:msg.text,payload:{uuid:msg.uuid,chatId:msg.chatId}});
		this.apnConnection.send(notification, pushSub.endpoint).then(function (response)
		{
			//con.log('response',response);
			if (response.sent.length === 1)
			{
				con.log('Sent iOS-Push to',pushSub.userId,'for chat', msg.chatId);
			}
			else
			{
				con.log('response',response);
				con.log('response',response.failed[0].response);
			}
		});
	}

	async sendPushForChatMsg (msg)
	{
		[err,chatMembers] = await chatManager.getUsersChatsByChatIds([msg.chatId],msg.userId);
		//con.log('chatMembers',chatMembers);
		let userIds = chatMembers.reduce( (arr,elem) => arr.concat(elem.user.id),[]);
		//con.log('userIds',userIds);
		[err,msgAuthor] = await userManager.getById(msg.userId);
		[err,pushSubs] = await userManager.getPushSubBy('userId',userIds);
		let title = msgAuthor.firstName+' '+msgAuthor.lastName;
		for (let s=0;s<pushSubs.length;s++)
		{
			let pushSub = pushSubs[s];
			if (pushSub.subscription)
			{
				if (pushSub.platform === 'web')
				{
					let sub = {subscription:JSON.parse(pushSub.subscription),data:JSON.stringify({title:title,body:msg.text})};
					con.log('Will Send Web-Push to',pushSub.userId,'for chat', msg.chatId);
					this.sendWebPush(sub,msg);
				}
				if (pushSub.platform === 'ios')
				{
					con.log('Will Send iOS-Push to',pushSub.userId,'for chat', msg.chatId);
					this.sendIosPush(pushSub,msg)
				}
			}
		}
	}

	async getIosPusNotification (note)
	{
		let notification = new apn.Notification();
		notification.expiry = note.expires || Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
		notification.badge = note.badge || 1;
		notification.topic = process.env.IOS_BUNDLE_ID; // specifies app
		//note.sound = "knock.aiff";
		notification.alert = note.alert;
		notification.payload = note.payload || {};
		return notification;
	}
}

module.exports = new PushManager();