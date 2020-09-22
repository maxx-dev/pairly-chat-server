const chatManager = require("./ChatManager");
const userManager = require("./UserManager");

class SocketManager
{
	async statusChanged (socket,status,chats)
	{
		let err;
		if (!chats)
		{
			[err,chats] = await chatManager.getUsersChats(status.userId,{onlyChatIds:false});
		}
		//con.log('chats',chats);
		for (let s=0;s<chats.length;s++)
		{
			let chat = chats[s];
			//con.log('chat',chat.userChat.chatId,chat.user.id);
			let data = {userId:status.userId,isOnline:status.isOnline};
			userManager.updateOnlineState(status.userId,status.isOnline);
			if (!status.isOnline)
			{
				data.lastOnlineAt = new Date();
			}
			// inform chat buddies
			for (var socketId in app.io.sockets.connected) {
				let socket = app.io.sockets.connected[socketId];
				if (socket.userId === chat.user.id)
				{
					//con.log('broadcast statusChanged to',socket.userId);
					socket.emit('put:statusChanged',data);
				}
			}
		}
	}
}

module.exports = new SocketManager();