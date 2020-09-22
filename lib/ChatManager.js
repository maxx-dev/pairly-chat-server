const dbManager = require("../lib/DatabaseManager");
/**
 * @constructor
 */
class ChatManager {

    /**
     * Create chat in the db
     * @example
     *  const wrapper = async () => {
     *  let [err,chat] = await ChatManager.create({firstName:'Tim',lastName:'Test'});
     *  }
     * wrapper();
     * @param chat
     * @return {Promise<any>}
     */
    create (chat)
    {
        let insertChat = this.insert(chat);
        return new Promise((resolve, reject) => {
            dbManager.create('chats',insertChat,function (err,results)
            {
                insertChat.id = results.insertId;
                if (err)
                {
                    return reject([new Error('Chat not created'),null]);
                }
                resolve([null,insertChat,results.insertId]);
            });
        })
    }

    createUserChat (msg)
    {
        let insertChat = this.insertUserChat(msg);
        return new Promise((resolve, reject) => {
            dbManager.create('userChats',insertChat,function (err,results)
            {
                insertChat.id = results.insertId;
                if (err)
                {
                    return reject([new Error('UserChat not created'),null]);
                }
                resolve([null,insertChat,results.insertId]);
            });
        })
    }

    insert (chat)
    {
        /**
         * @typedef {Object} Chat
         * @property {string}  title               - title of a chat
         * @property {Date}    createdAt               - The date chat was created
         */
        return {
            title:this.setVal(chat.title),
            createdAt:chat.createdAt || new Date(),
        }
    }

    insertUserChat (chat)
    {
        /**
         * @typedef {Object} Chat
         * @property {string}  userId               - userId of a chat
         * @property {string}  chatId               - chatId of a chat
         * @property {Date}    createdAt            - The date the chatId was created
         */
        return {
            userId:this.setVal(chat.userId),
            chatId:this.setVal(chat.chatId),
            createdAt:chat.createdAt || new Date(),
        }
    }

    insertMsg (msg)
    {
        /**
         * @typedef {Object} Chat
         * @property {string}  title               - title of a chat
         * @property {Date}    createdAt               - The date chat was created
         */
        return {
            uuid:this.setVal(msg.uuid),
            text:this.setVal(msg.text),
            userId:this.setVal(msg.userId),
            chatId:this.setVal(msg.chatId),
            type:this.setVal(msg.type) || 'TEXT',
            mimeType:this.setVal(msg.mimeType),
            state:this.setVal(msg.state),
            metaData:msg.metaData ? JSON.stringify(msg.metaData,false,4) : null,
            createdAt:msg.createdAt || new Date(),
        }
    }

    createMsg (msg)
    {
        let insertChat = this.insertMsg(msg);
        return new Promise((resolve, reject) => {
            dbManager.create('chatMessages',insertChat,function (err,results)
            {
                insertChat.id = results.insertId;
                if (err)
                {
                    return reject([new Error('ChatMsg not created'),null]);
                }
                resolve([null,insertChat,results.insertId]);
            });
        })
    }

    setVal (val)
    {
        if ( typeof val === 'string' && val)
        {
            return val.trim()
        }
        return val;
    }

    /**
     * Get chat from db
     * @param {string} property
     * @param {string|number} value
     * @return {Promise<any>}
     */
    getBy (property,value)
    {
        return new Promise((resolve, reject) =>
        {
            dbManager.select('SELECT * FROM chats WHERE '+property+' = ?',[value],function (err,results)
            {
                if (!results || results.length !== 1)
                {
                    return resolve([new Error('Chat not found for '+property+' and val '+value),null]);
                }
                resolve([null,results[0]]);
            })
        })
    }

    /**
     * Get chat by id - convenience function
     * @param {number} id
     * @return {Promise<any>}
     */
    getById (id)
    {
        return this.getBy('id',id);
    }

    getChats ()
    {
        return new Promise((resolve, reject) => {
            let query = dbManager.select('SELECT * FROM chats',function (err,results)
            {
                return resolve([err,results]);
            })
        })
    }

    getUsersChats (userId,opts = {})
    {
        return new Promise((resolve, reject) => {
            // LEFT JOIN users as user ON user.id = userChat.userId
            let query = dbManager.select({sql:'SELECT * FROM userChats as userChat WHERE userChat.userId = ?',nestTables: false},[userId],function (err,results)
            {
                let chatIds = [];
                for (let s=0;s<results.length;s++)
                {
                    chatIds.push(results[s].chatId);
                }
                if (opts.onlyChatIds)
                {
                    return resolve([err,chatIds]);
                }
                this.getUsersChatsByChatIds(chatIds,userId).then(function ([err,results])
                {
                    return resolve([err,results,chatIds]);
                })
            }.bind(this))
        })
    }

    getUsersChatsByChatIds (chatIds,excludedUserId)
    {
        //console.log('chatIds',chatIds,'excludedUserId',excludedUserId);
        return new Promise((resolve, reject) => {
            // LEFT JOIN users as user ON user.id = userChat.userId
            let query = dbManager.select({sql:'SELECT * FROM userChats as userChat LEFT JOIN users as user ON userChat.userId = user.id LEFT JOIN chats as chat ON chat.id = userChat.chatId  WHERE userChat.chatId IN (?) AND userChat.userId != ?',nestTables: true},[chatIds,excludedUserId],function (err,results)
            {
                results.map( (result) => {

                    let chat = result.chat;
                    result.id = chat.id;
                    result.title = chat.title;
                    result.createdAt = chat.createdAt;
                    delete result.chat;
                });
                return resolve([err,results]);
            })
        })
    }

    getChatsFirstMessage (chatId,opts = {})
    {
        return new Promise((resolve, reject) => {
            let sql = 'SELECT * FROM chatMessages WHERE chatId = ? ORDER BY createdAt LIMIT 1';
            let query = dbManager.select({sql:sql,nestTables: false},[chatId],function (err,results)
            {
                this.prepareChatMessages(results);
                return resolve([err,results[0] ? results[0] : false]);
            }.bind(this))
        })
    }

    getChatMessages (chatIds,opts = {})
    {
        return new Promise((resolve, reject) => {

            let params = [chatIds];
            // LEFT JOIN users as user ON user.id = userChat.userId
            let sql = 'SELECT * FROM chatMessages WHERE chatId IN (?) ';
            if (opts.from)
            {
                sql += 'AND createdAt > ? ';
                params.push(opts.from);
            }
            if (opts.to)
            {
                sql += 'AND createdAt < ? ';
                params.push(opts.to);
            }
            sql += 'ORDER BY chatMessages.createdAt DESC ';
            if (opts.limit)
            {
                sql += 'LIMIT ? ';
                params.push(opts.limit);
            }
            //con.log('sql',sql);
            let query = dbManager.select({sql:sql,nestTables: false},params,function (err,results)
            {
                this.prepareChatMessages(results);
                results = results.reverse(); // Getting oldest msg first but in chronologial order
                return resolve([err,results]);
            }.bind(this))
        })
    }

    // Gets last message for each chatId provided
    getLatestMessageForChatIds (chatIds)
    {
        return new Promise((resolve, reject) => {
            let sql = 'SELECT msg.id, msg.uuid, msg.chatId, msg.userId, msg.text, msg.type, msg.state, msg.metaData, msg.createdAt FROM chatMessages msg INNER JOIN (SELECT chatId, max(createdAt) AS MaxDate FROM chatMessages GROUP BY chatId) tm ON msg.chatId = tm.chatId AND msg.createdAt = tm.MaxDate WHERE msg.chatId IN (?)';
            let query = dbManager.select({sql:sql,nestTables: false},[chatIds],function (err,results)
            {
                this.prepareChatMessages(results);
                return resolve([err,results]);
            }.bind(this))
        })
    }

    prepareChatMessages (results)
    {
        results.map( (result) => {

            if (result.metaData) {
                //con.log('result.metaData',result.metaData);
                result.metaData = JSON.parse(result.metaData);
            }
        });
    }

    /**
     * Update chat by property
     * @param {object} update
     * @param {string} property
     * @param {string|number} value
     * @param {Object} opts
     * @return {Promise<any>}
     */
    updateBy (update,property,value,opts = {})
    {
        return new Promise((resolve, reject) => {
            dbManager.update(opts.table || 'chats',update,property,value,function (err,results)
            {
                if (err)
                {
                    return resolve([err,null]);
                }
                resolve([null,results]);
            })
        })
    }

    /**
     * Update chat by property
     * @param {object} chatId
     * @param {object} userId
     * @return {Promise<any>}
     */
    markMessagesAsRead (chatId,userId)
    {
        return new Promise((resolve, reject) => {
            dbManager.query('UPDATE chatMessages SET state = 2 WHERE chatId = ? AND userId = ?',[chatId,userId],function (err,results)
            {
                if (err)
                {
                    return resolve([err,null]);
                }
                resolve([null,results]);
            })
        })
    }

    /**
     * Update chat in the db
     * @param {object} update
     * @param {number} chatId
     * @return {Promise<any>}
     */
    update (update,chatId)
    {
        return this.updateBy(update,'id',chatId);
    }

    /**
     * Delete chat in db by property
     * @param {string} property
     * @param {string|number} val
     * @return {Promise<any>}
     */
    deleteBy (property,val)
    {
        return new Promise((resolve, reject) => {
            dbManager.delete('chats',property,val,function (err,results)
            {
                if (err)
                {
                    return resolve([err,null]);
                }
                resolve([null,results]);
            })
        })
    }

    /**
     * Delete chat by id - convenience function
     * @param {number} chatId
     * @return {Promise<any>}
     */
    delete (chatId)
    {
        return this.deleteBy('id',chatId);
    }
}

module.exports = new ChatManager();