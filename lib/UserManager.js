const dbManager = require("../lib/DatabaseManager");
const chatManager = require("../lib/ChatManager");
/**
 * @constructor
 */
class UserManager {

    /**
     * Create user in the db
     * @example
     *  const wrapper = async () => {
     *  let [err,user] = await UserManager.create({firstName:'Tim',lastName:'Test'});
     *  }
     * wrapper();
     * @param user
     * @return {Promise<any>}
     */
    create (user)
    {
        let insertUser = this.insert(user);
        return new Promise((resolve, reject) => {
            dbManager.create('users',insertUser,function (err,results)
            {
                insertUser.id = results.insertId;
                if (err)
                {
                    return reject([new Error('User not created'),null]);
                }
                resolve([null,insertUser,results.insertId]);
            });
        })
    }

    insert (user)
    {
        /**
         * @typedef {Object} User
         * @property {string}  firstName               - firstName of a user
         * @property {string}  lastName                - lastName of a user
         * @property {string}  email                   - email of a user
         * @property {string}  phone                   - phone of a user
         * @property {string}  state                   - state of a user
         * @property {string}  img                     - img of a user
         * @property {string}  password                - password of a user
         * @property {Date}    activatedAt             - The date user was activated
         * @property {Date}    createdAt               - The date user was created
         */
        return {
            firstName:this.setVal(user.firstName),
            lastName:this.setVal(user.lastName),
            email:this.setVal(user.email),
            phone:this.setVal(user.phone),
            state:this.setVal(user.state),
            img:this.setVal(user.img),
            password:this.setVal(user.password),
            activatedAt: user.activatedAt,
            createdAt:user.createdAt || new Date(),
        }
    }

    insertPushSub (user)
    {
        /**
         * @typedef {Object} User
         * @property {string}  userId                  - userId of a userPushSub
         * @property {string}  platform                - platform of a userPushSub
         * @property {string}  subscription            - subscription of a userPushSub
         * @property {Date}    createdAt               - The date userPushSub was created
         */
        return {
            userId:this.setVal(user.userId),
            platform:this.setVal(user.platform),
            endpoint:this.setVal(user.endpoint),
            subscription:this.setVal(user.subscription),
            createdAt:user.createdAt || new Date(),
        }
    }


    /**
     * Create pushSub in db
     * @example
     *  const wrapper = async () => {
     *  let [err,user] = await UserManager.create({firstName:'Tim',lastName:'Test'});
     *  }
     * wrapper();
     * @param pushSub
     * @return {Promise<any>}
     */
    createPushSubscription (pushSub)
    {
        let insertPushSub = this.insertPushSub(pushSub);
        return new Promise((resolve, reject) => {
            dbManager.create('usersPushSubscriptions',insertPushSub,function (err,results)
            {
                insertPushSub.id = results.insertId;
                if (err)
                {
                    return reject([new Error('PushSub not created'),null]);
                }
                resolve([null,insertPushSub,results.insertId]);
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
     * Get user from db
     * @param {string} property
     * @param {string|number} value
     * @param {object} opts
     * @return {Promise<any>}
     */
    getBy (property,value,opts = {})
    {
        return new Promise((resolve, reject) =>
        {
            dbManager.select('SELECT id, email, username, '+(opts.pw ? 'password, ' : '')+' firstName, lastName, phone, img, webAuthActive, webAuthResInfos, biometricLoginToken, darkModeActive, reducedMotionActive, createdAt FROM users WHERE '+property+' = ?',[value],function (err,results)
            {
                if (!results || results.length !== 1)
                {
                    return resolve([new Error('User not found for '+property+' and val '+value),null]);
                }
                resolve([null,results[0]]);
            })
        })
    }


    async getUserDataForClient (user)
    {
        let userDataForClient = {
            id:user.id,
            email:user.email,
            firstName:user.firstName,
            lastName:user.lastName,
            img:user.img,
            phone:user.phone,
            state:user.state || '',
            webAuthActive:user.webAuthActive,
            biometricLoginToken:user.biometricLoginToken,
            darkModeActive:user.darkModeActive,
            reducedMotionActive:user.reducedMotionActive,
        };
        if (user.betaFeatures) userDataForClient.betaFeatures = user.betaFeatures;
        if (user.debugFeatures) userDataForClient.debugFeatures = user.debugFeatures;
        if (user.canSwitchEnv) userDataForClient.canSwitchEnv = user.canSwitchEnv;
        if (user.isTravelManager) userDataForClient.isTravelManager = user.isTravelManager;

        /*userDataForClient.featureFlags = {
            SYNC_ACCOUNT:process.env.SYNC_ACCOUNT,
            PAYPAL_ACTIVE:process.env.PAYPAL_ACTIVE,
        };*/

        // Overwrite with custom featureFlags
        //if (user.featureFlags) userDataForClient.featureFlags = JSON.parse(user.featureFlags);
        let err, chats,chatIds, chatMessages, chatMessagesLatest;
        [err,chats,chatIds] = await chatManager.getUsersChats(user.id);
        //[err,chatMessages] = await chatManager.getChatMessages(chatIds);
        [err,chatMessagesLatest] = await chatManager.getLatestMessageForChatIds(chatIds);
        //con.log('chatMessagesLatest',chatMessagesLatest);
        //con.log('chats',chats);
        for (let s=0;s<chats.length;s++)
        {
            let chat = chats[s];
            chat.active = false;
            chat.msgs = [];
            chat.user.chats = [];
            chat.user.isOnline = false;
            chat.latestMsg = null;
            if (app.users[chat.user.id])
            {
                chat.user.isOnline = app.users[chat.user.id].isOnline;
                chat.user.lastOnlineAt = app.users[chat.user.id].lastOnlineAt;
            }
            for (let m=0;m<chatMessagesLatest.length;m++)
            {
                let msg = chatMessagesLatest[m];
                if (msg.chatId === chat.userChat.chatId)
                {
                    chat.latestMsg = msg;
                }
            }
        }
        userDataForClient.chats = chats;
        //userDataForClient.chats = [];
        return userDataForClient;
    };

    /**
     * Get pushSub from db
     * @param {string} property
     * @param {string|number} value
     * @param {object} opts
     * @return {Promise<any>}
     */
    getPushSubBy (property,value,opts = {})
    {
        return new Promise((resolve, reject) =>
        {
            let sql = 'SELECT * FROM usersPushSubscriptions WHERE '+property+' ';
            if (Array.isArray(value))
            {
                sql += ' IN (?)'
            }
            else
            {
                sql += '= ?'
            }
            dbManager.select(sql,[value],function (err,results)
            {
                let res = results;
                if (!Array.isArray(value)) res = results[0];
                resolve([null,res]);
            })
        })
    }

    /**
     * Get user by id - convenience function
     * @param {number} id
     * @return {Promise<any>}
     */
    getById (id)
    {
        return this.getBy('id',id);
    }

    /**
     * Get user by email - convenience function
     * @param {string} email
     * @return {Promise<any>}
     */
    getByEmail (email)
    {
        return this.getBy('email',email);
    }

    getUsers ()
    {
        return new Promise((resolve, reject) => {
            let query = dbManager.select('SELECT * FROM users',function (err,results)
            {
                return resolve([err,results]);
            })
        })
    }

    /**
     * Update user by property
     * @param {object} update
     * @param {string} property
     * @param {string|number} value
     * @param {Object} opts
     * @return {Promise<any>}
     */
    updateBy (update,property,value,opts = {})
    {
        return new Promise((resolve, reject) => {
            dbManager.update(opts.table || 'users',update,property,value,function (err,results)
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
     * Update user in the db
     * @param {object} update
     * @param {number} userId
     * @return {Promise<any>}
     */
    update (update,userId)
    {
        return this.updateBy(update,'id',userId);
    }

    /**
     * Delete user in db by property
     * @param {string} property
     * @param {string|number} val
     * @return {Promise<any>}
     */
    deleteBy (property,val)
    {
        return new Promise((resolve, reject) => {
            dbManager.delete('users',property,val,function (err,results)
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
     * Delete pushSub in db by property
     * @param {string} property
     * @param {string|number} val
     * @return {Promise<any>}
     */
    deletePushSubBy (property,val)
    {
        return new Promise((resolve, reject) => {
            dbManager.delete('usersPushSubscriptions',property,val,function (err,results)
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
     * Delete user by id - convenience function
     * @param {number} userId
     * @return {Promise<any>}
     */
    delete (userId)
    {
        return this.deleteBy('id',userId);
    }

    updateOnlineState (userId,isOnline)
    {
        if (!app.users[userId])
        {
            app.users[userId] = {isOnline:isOnline};
        }
        if (app.users[userId])
        {
            app.users[userId].lastOnlineAt = new Date();
            app.users[userId].isOnline = isOnline;
        }

    }
}

module.exports = new UserManager();