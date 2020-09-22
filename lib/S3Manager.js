const AWS = require('aws-sdk');

/**
 * @constructor
 */
class S3Manager {

    constructor ()
    {
        let bucket = process.env.AWS_BUCKET;
        //con.log('bucket',bucket);
        AWS.config = new AWS.Config({
            accessKeyId:process.env.ACCESS_KEY_ID,
            secretAccessKey:process.env.SECRET_ACCESS_KEY,
            region:process.env.REGION,
        });
        //AWS.config.loadFromPath(path || 'awsConfig.json');
        AWS.config.signatureVersion = 'v4';
        AWS.config.apiVersion = '2006-03-01';
        this.config = AWS.config;
        this.config.bucket = bucket;
        AWS.config.bucket = bucket;
        this.s3 = new AWS.S3(this.config);
    }

    getBucket ()
    {
        return this.config.bucket;
    }

    /**
     * Returns a signed url to download a file from s3
     * @example
     * s3Manager.getSignedUrl('customers/1/2/docs/2_form.pdf, {exists: true}, function (err, url)
     {
                    //con.log('url',url,'err',err);
                    if (err)
                    {
                        con.error(err);
                    }
     })
     * @param {string} key
     * @param {object} opts
     * @param {function} cb
     */
    getSignedUrl (key,opts,cb)
    {
        return new Promise((resolve, reject) =>
        {
            let params = {Bucket:this.getBucket(), Key: key};
            if (opts)
            {
                if (opts.expires)
                {
                    params.Expires = opts.expires;
                }
                if (opts.responseCacheControl)
                {
                    params.ResponseCacheControl = opts.responseCacheControl;
                }
            }
            if (!params.Expires)
            {
                params.Expires = 60 * 60 * 24; // 24 hours
            }
            //con.log('params',params);
            this.s3.getSignedUrl('getObject', params, function (errSignedUrl, signedUrl)
            {
                if (errSignedUrl)
                {
                    con.error(errSignedUrl);
                }
                if (opts.exists)
                {
                    this.s3.headObject({
                        Bucket:this.getBucket(),
                        Key: key
                    },function (err,url)
                    {
                        //con.log('code',err);
                        if (err)
                        {
                            resolve([url,false]);
                        }
                        else
                        {
                            resolve([errSignedUrl,signedUrl]);
                        }
                    });
                }
                else
                {
                    resolve([errSignedUrl,signedUrl]);
                }
            }.bind(this));
        })
    };

    /**
     * Return a signed url to upload a file to s3
     * @param {string} key
     * @param {object} opts
     */
    uploadPreSignedUrl (key,opts)
    {
        return new Promise((resolve, reject) =>
        {
            let params = {Bucket:this.getBucket(), Key: key};
            if (opts)
            {
                if (opts.publicRead)
                {
                    params.ACL = 'public-read';
                }
                if (opts.body)
                {
                    params.Body = opts.body;
                }
                if (opts.contentType) // Important: when uploading with ajax this needs to be the same
                {
                    params.ContentType = opts.contentType;
                }
                if (opts.metadata)
                {
                    for (let s in opts.metadata)
                    {
                        opts.metadata[s] = opts.metadata[s]+''; // all values need to be string or will be rejected
                    }
                    params.Metadata = opts.metadata;
                }
            }
            //con.log('params',params);
            //params.ACL = 'authenticated-read';
            if (this.local)
            {
                this.onLocalUrl(key);
                return;
            }

            this.s3.getSignedUrl('putObject', params, function (err, url)
            {
                if (err) con.error(err);
                resolve([err,url]);
            });
        })
    };

    /**
     * Download a file from s3
     * @param {string} key
     * @param {function} cb
     * @return {Request<S3.GetObjectOutput, AWSError>}
     */
    getObject (key,cb)
    {
        return new Promise((resolve, reject) =>
        {
            return this.s3.getObject({Bucket:this.getBucket(),Key:key}, function(err, data)
            {
                resolve([err,data]);
            });
        })

    };

    /**
     * Returns metadata of a file on s3
     * @param {string} key
     * @param {function} cb
     * @return {Request<S3.HeadObjectOutput, AWSError>}
     */
    headObject (key,cb)
    {
        return new Promise((resolve, reject) =>
        {
            return this.s3.headObject({Bucket:this.getBucket(),Key:key}, function(err, data)
            {
                resolve([err,data]);
            });
        })
    };

    /**
     * Delete a file from 3
     * Does not throw if file does not exist!
     * @param {string} key
     */
    deleteObject (key)
    {
        return new Promise((resolve, reject) =>
        {
            this.s3.deleteObject({Bucket:this.getBucket(),Key:key}, function(err, data)
            {
                resolve([err,data]);
            });
        })
    };

    /**
     * Delete files recursively that match a certain key
     * @param {string} key
     * @param {function} cb
     */
    deleteObjects (key,cb)
    {
        return new Promise((resolve, reject) =>
        {
            let keysArr = [];
            this.listObjects(key,{waitUntilDone:true},function (keys)
            {
                for (let s=0;s<keys.length;s++)
                {
                    keysArr.push({Key:keys[s].Key});
                }
                if (keysArr.length === 0)
                {
                    resolve([null,null]);
                    return;
                }
                this.s3.deleteObjects({Bucket:this.getBucket(),Delete:{Objects:keysArr}}, function(err, data)
                {
                    resolve([err,data]);
                }.bind(this))/* */
            }.bind(this))
        })
    };

    /**
     * Copy a file from on key to another in s3
     * @param {string} copyKey
     * @param {string} key
     * @param {object} opts
     * @return {Request<S3.CopyObjectOutput, AWSError>}
     */
    copyObject (copyKey,key,opts = {})
    {
        let params = {Bucket:this.getBucket(),CopySource:this.getBucket()+'/'+copyKey,Key:key};
        if (opts.metaData) {
            params.MetadataDirective = 'REPLACE';
            params.Metadata = opts.metaData;
        }
        if (opts.contentType)
        {
            params.ContentType = opts.contentType;
        }
        //con.log('params',params);
        return new Promise((resolve, reject) =>
        {
            return this.s3.copyObject(params, function(err, data)
            {
                resolve([err,data]);
            });
        })
    };

    /**
     * Can deliver multiple cbs if not ally keys (limit 1000 can be received within on request
     * @param {string} prefix
     * @param {object} options
     */
    listObjects (prefix,options)
    {
        return new Promise((resolve, reject) =>
        {
            let dataCache = [];
            let list = function (prefix,options)
            {
                options = options || {};
                let params = {
                    Bucket:this.getBucket(),
                    Prefix:prefix,
                };
                if (options.continuationToken)
                {
                    params.ContinuationToken = options.continuationToken;
                }
                this.s3.listObjectsV2(params, function(err, data)
                {
                    if (data && data.Contents)
                    {
                        dataCache = dataCache.concat(data.Contents);
                    }
                    //con.log('data',data);
                    if (data.NextContinuationToken)
                    {
                        list(prefix,{continuationToken:data.NextContinuationToken});
                    }
                    else
                    {
                        data.done = true;
                    }

                    if (options.waitUntilDone)
                    {
                        if (data.done)
                        {
                            resolve([err,dataCache]);
                        }
                    }
                    else
                    {
                        resolve([err,dataCache]);
                    }
                }.bind(this));
            }.bind(this);
            list(prefix,options);
        })
    }

    /**
     * Upload a file to s3
     * @param {object} params
     * @param {object} opts
     * @param {function} cb
     * @return {ManagedUpload}
     */
    upload (params, opts,cb)
    {
        return this.s3.upload(params, opts,cb)
    };

    /**
     * Uploads an file to s3
     * @param {string} key
     * @param {*} body
     * @param {object} opts
     */
    putObject (key,body,opts)
    {
        return new Promise((resolve, reject) =>
        {
            let params = {
                Body: body,
                Bucket: this.getBucket(),
                Key: key
            };
            if (opts.contentType)
            {
                params.ContentType = opts.contentType;
            }
            this.s3.putObject(params, function(err, data)
            {
                resolve([err,data]);
            });
        })
    };
}

module.exports = new S3Manager();