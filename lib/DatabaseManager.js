const mysql = require('mysql');
//var pool;

let getDefConfig = () => {

    let defaultConfig = {
        /*connectionLimit : 100,
        connectTimeout  : 60 * 60 * 1000,
        acquireTimeout  : 60 * 60 * 1000,
        timeout         : 60 * 60 * 1000,*/
        database:process.env.MYSQL_DATABASE,
        user : process.env.MYSQL_USER,
        password : process.env.MYSQL_PASSWORD,
        port:3306,
        socketPath : process.env.MYSQL_SOCKET_PATH,
        timezone:'+00:00', // dates in db are saved as utc
        //acquireTimeout: 500000, // DANGER!!!! -> if we set this to a high number (Default 10000), mysql waits forever until connection is made
        //queueLimit:2
    };
    if (process.env.MYSQL_SOCKET_PATH)
    {
        defaultConfig.socketPath = process.env.MYSQL_SOCKET_PATH || '/Applications/MAMP/tmp/mysql/mysql.sock';
    }
    else
    {
        defaultConfig.host = process.env.MYSQL_HOST || 'localhost';
    }
    return defaultConfig;
};

let defaultConfig = getDefConfig();

class DBManager
{
    constructor (dbConfig,cb)
    {
        this.pool = null;
        this.init(dbConfig,cb);
    }

    init (dbConfig,cb)
    {
        //console.log('dbConfig',dbConfig);
        this.pool = mysql.createPool(dbConfig || defaultConfig);
        this.pool.on('acquire', function (connection)
        {
            //console.log('Connection %d acquired', connection.threadId);
            //if (cb) cb(connection);
        });
        this.pool.getConnection(function(err, connection)
        {
            if (err) console.error(new Date().toISOString(),"FAILED TO GET DATABASE CONNECTION",err);
            if (cb) cb(err,connection);
        });
    }

    getPool ()
    {
        return this.pool;
    }

    query ()
    {
        var sql_args = [];
        var args = Array.prototype.slice.call(arguments);
        var callback = args[args.length-1]; //last arg is callback
        //console.log('before connection');
        if(args.length > 2)
        {
            sql_args = args[1];
        }
        //https://github.com/mysqljs/mysql/issues/1202 + pool.getConnection() + connection.query() + connection.release()
        return this.pool.query(args[0], sql_args, function(err, results)
        {
            //console.log('query',err);
            if(err)
            {
                console.error(err);
                callback(err, results);
                return;
            }
            callback(null, results);
        });
    }

    select (query,values,cb)
    {
        return this.query(query, values,function (err, results, fields)
        {
            if (err) throw err;
            cb(err,results,fields);
        });
    }

    create (table,data,cb)
    {
        //var data  = {id: 1, title: 'Hello MySQL'};
        return this.query('INSERT INTO '+table+' SET ?', data, function (err, results, fields)
        {
            if (err) throw err;
            if (cb)
            {
                cb(err,results,fields);
            }
        });
    }

    createBulk (table,data,cb)
    {
        var str = 'INSERT INTO '+table;
        var cols = [];
        var first = data[0];
        var values = [];
        for (var prop in first)
        {
            cols.push('`'+prop+'`');
        }
        for (var s=0;s<data.length;s++)
        {
            var row = data[s];
            var rowArr = [];
            for (var key in row)
            {
                rowArr.push(row[key]);
            }
            values.push(rowArr);
        }
        var sql = str+' ('+cols.join(', ')+') VALUES ?';
        //console.log('sql',sql);
        //console.log('values',values);
        return this.query(sql, [values], function (err, results, fields)
        {
            if (err) throw err;
            //console.log('bulk results',results);
            var insertId = results.insertId;
            for (var s=0;s<data.length;s++)
            {
                data[s].id = insertId;
                insertId++;
            }
            cb(err,data,results,fields);
        });
    }

    update (table,data,col,id,cb)
    {
        var cb_ = function (err,results,fields)
        {
            if (err) throw err;
            cb(err,results,fields);
        }
        var updateStr = '';
        var vals = [];
        var sql;
        for (var key in data)
        {
            updateStr += '`'+key+'` = ?, ';
            vals.push(data[key]);
        }
        vals.push(id);
        updateStr = updateStr.substr(0,updateStr.length - 2);
        //console.log('updateStr',updateStr,'vals',vals);
        if (Array.isArray(id))
        {
            if (id.length == 0)
            {
                cb_(null,null,null);
                return;
            }
            id = '('+id.join(',')+')';
            sql = 'UPDATE '+table+' SET '+updateStr+' WHERE '+col+' IN '+id;
        }
        else
        {
            sql = 'UPDATE '+table+' SET '+updateStr+' WHERE '+col+' = ?';
        }
        //console.log('sql',sql,'id',id);
        return this.query(sql, vals, cb_);
    }

    delete (table,col,id,cb)
    {
        var cb_ = function (err,results,fields)
        {
            if (err) throw err;
            cb(err,results,fields);
        }
        if (Array.isArray(id))
        {
            if (id.length == 0)
            {
                cb_(null,null,null);
                return;
            }
            // DELETE FROM table WHERE id IN (1, 4, 6, 7)
            id = '('+id.join(',')+')';
            var sql = 'DELETE FROM '+table+' WHERE '+col+' IN '+id;
            //console.log('sql',sql,'id',id);
            return this.query(sql,cb_);
        }
        else
        {
            return this.query('DELETE FROM '+table+' WHERE '+col+' = ?',[id],cb_);
        }
    }

    close (cb)
    {
        this.pool.end(function (err) {
            // all connections in the pool have ended
            cb();
        });
    }
}

module.exports = new DBManager();
