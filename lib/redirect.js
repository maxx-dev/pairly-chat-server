const express = require("express");
const http = require("http");
let setRedirect = (port) => {

    const httpApp = express();
    httpApp.set('port', port);
    http.createServer(httpApp).listen(httpApp.get('port'), function() {
        con.log('Express HTTP server listening on port ' + httpApp.get('port'));
    });
    httpApp.get('/health', function (req, res)
    {
        res.json({status:200});
    });
    httpApp.get('*', function(req, res)
    {
        res.redirect('https://' + req.headers.host + req.url);
    });
    httpApp.get('/', function(req, res)
    {
        res.redirect('https://' + req.headers.host + req.url);
    });
};

module.exports = setRedirect;