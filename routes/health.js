const express = require('express');
const router = express.Router();

router.get("/health", (req, res) => {
    res.json({version:packageJSON.version})
    //res.sendFile(path.join(__dirname, "../public/index.html"));
});

let servePath = __dirname+'/../../client/';
router.get("/webAuthFaceId.html", (req, res) => {

    console.log('ss');
    res.sendFile('webAuthFaceId.html',{'root':servePath+'tests/'});
});


module.exports = {
    socket:null,
    router:router
};
