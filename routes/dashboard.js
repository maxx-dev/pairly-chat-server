const express = require('express');
const router = express.Router();
const fs = require("fs");
let kpisPath = './custom/appMetrics.json';
if (!fs.existsSync('./custom')) fs.mkdirSync('./custom');
if (!fs.existsSync(kpisPath)) fs.writeFileSync(kpisPath,JSON.stringify({},false,4));

let err,_;

let getLatestKPI = (title,appType,appMetrics) => {

    if (!appMetrics[title] || !appMetrics[title][appType]) return false;
    let keys = Object.keys(appMetrics[title][appType]);
    return appMetrics[title][appType][keys[keys.length -1]];
}

router.post("/appMetric", async (req, res) =>
{
    con.log('/api/dashboard/appMetric',req.body.appType,'title', req.body.title,'end', req.body.end);
    let appMetric = req.body;

    let file = fs.readFileSync(kpisPath);
    let appMetrics = JSON.parse(file ? file : '{}');
    if (!appMetrics[appMetric.title]) appMetrics[appMetric.title] = {};
    if (!appMetrics[appMetric.title][appMetric.appType]) appMetrics[appMetric.title][appMetric.appType] = {};
    let vals = appMetrics[appMetric.title][appMetric.appType];
    if (Object.keys(vals).length > 10)
    {
        //con.log('Delete oldest');
        delete vals[Object.keys(vals)[0]]
    }

    let latestAppLaunchTime = getLatestKPI('LAUNCH_TIME',appMetric.appType,appMetrics);
    if (!latestAppLaunchTime)
    {
        //con.log('LaunchTime not set');
    }
    if (latestAppLaunchTime)
    {
        appMetric.value = (appMetric.end - latestAppLaunchTime.end)/1000;
        con.log('TOTAL',appMetric.title,appMetric.appType," => ",appMetric.value)
    }
    appMetrics[appMetric.title][appMetric.appType][new Date().toISOString()] = {value:appMetric.value, end : appMetric.end};

    fs.writeFileSync(kpisPath,JSON.stringify(appMetrics,false,4));
    res.json({err:null})
});

let createMetricTable = (vals,title) =>
{
    let html = [];
    let sum = 0;
    let variance = 0;
    let numVals = Object.keys(vals).length;
    for (let timeStamp in vals)
    {
        let val = vals[timeStamp].value * 1000;
        sum += val;
        html.push(`<tr>
            <td>${timeStamp}</td>
            <td>${val}</td>
            </tr>`)
    }
    let average = sum / numVals;
    for (let timeStamp in vals)
    {
        let val = vals[timeStamp].value * 1000;
        let diff = val - average;
        variance += diff * diff;
    }
    variance = variance / numVals;
    let derivation = Math.sqrt(variance);
    html.push(`<tr><td>Average</td><td>${average}</td></tr>`);
    html.push(`<tr><td>Variance</td><td>${variance}</td></tr>`);
    html.push(`<tr><td>Derivation</td><td>${derivation}</td></tr>`);

    return `<table style="width:100%; border-bottom:10px;" border="1" cellspacing="0" cellpadding="1">
        <tr>
        <th>Time ${title}</th>
        <th>Value</th>
        </tr>
        ${html.join(' ')}
        </table>`
}
router.get("/appMetric", async (req, res) =>
{
    con.log('get/dashboard/appMetric');
    let file = fs.readFileSync(kpisPath);
    let appMetrics = JSON.parse(file ? file : '{}');
    if (req.query.metric)
    {
        let vals = appMetrics[req.query.metric];
        if (req.query.appType && vals && vals[req.query.appType])
        {
            vals = vals[req.query.appType];
            let html = createMetricTable(vals);
            res.send(html)
        }
        else
        {
            let tables = [];
            if (vals)
            {
                tables.push(createMetricTable(vals['PWA'] || {},'PWA'));
                tables.push(createMetricTable(vals['IOS'] || {},'IOS'));
                res.send(tables.join(' '));
            }
            else
            {
                con.log('No metrics for',req.query.metric);
                res.json(vals);
            }
        }
    }
    else
    {
        res.json(appMetrics);
    }
})

let socket = function (socket)
{
    socket.on("get:dashboard", async () =>
    {
        con.logRouteC(socket, 'get:dashboard');
        let file = fs.readFileSync(kpisPath);
        let appMetrics = JSON.parse(file ? file : '{}');
        socket.emit('get:dashboard',appMetrics)
    });
};


module.exports = {
    socket:socket,
    router:router
};