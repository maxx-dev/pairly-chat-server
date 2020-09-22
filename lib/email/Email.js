const fs = require('fs');
const cheerio = require('cheerio');
class Email {

    constructor ()
    {
        this.defaultMails = {
            team:process.env.MAIL_TEAM_USER,
        };
        //con.log('process.env.MAIL_TEAM_USER',process.env.MAIL_TEAM_USER);
        this.appName = 'Pairly';
        this.defaultPlaceHolders = {
            Greeting:'Regards',
            GreetingBottom:'Your Pairly Team',
            //SentBy:'Gesendet von Modrena UG (haftungsbeschränkt), Bismarckstraße 14A 76275 Ettlingen',
            ContactPhone:'+49 (0) 151 529 111 11',
            ContactEmail:process.env.INFO_MAIL,
            SocialMedia:this.socialMediaInfo(),
            Apps:this.appInfo(),
            LegalFooter:this.legalFooter()
        };
        this.primaryColor = '#111111';
        this.primaryFontColor = '#EE1315';
        this.template = fs.readFileSync(__dirname+('/templates/main.html'), 'utf8');
        //this.userName = 'Max';
    }

    from ()
    {
        let { author } = this;
        return {
            address:this.defaultMails.team, // for mail composer
            name:(author && author.userName ? author.userName+' von ' : '')+this.appName
        };
    }

    replyTo ()
    {
        return {
            address:this.defaultMails.team,
            name:this.appName
        };
    }

    fillTemplate (template,placeholders,styles)
    {
        if (!placeholders['PublicRequestId'])
        {
            placeholders['PublicRequestId'] = '';
        }
        if (!placeholders['TicketId'])
        {
            placeholders['TicketId'] = '';
        }
        let fillPlaceHolders = function (placeholders_)
        {
            for (let prop in placeholders_)
            {
                //console.log(prop);
                let val = placeholders_[prop];
                let variable = '$'+prop+'$';
                if (placeholders_.hasOwnProperty(prop) && val && val.length !== 0)
                {
                    while (template.indexOf(variable) != -1)
                    {
                        template = template.replace(variable, val);
                    }
                }
                if (!val || val.length !== 0)
                {
                    while (template.indexOf(variable) != -1)
                    {
                        template = template.replace(variable, '');
                    }
                }
            }
        };
        for (let key in this.defaultPlaceHolders)
        {
            if (!placeholders[key])
            {
                placeholders[key] = this.defaultPlaceHolders[key];
            }
        }
        fillPlaceHolders(placeholders);
        /*if (!placeholders.Greeting)
        {
            fillPlaceHolders(this.defaultPlaceHolders);
        }*/
        template = this.applyInlineStyles(template,styles || {});
        return template;
    }

    button (text,link)
    {
        return '<a clicktracking="off" href="'+link+'" class="button">'+text+'</a>';
    };

    ticketId (ticketId)
    {
        return `<tr><td class="content ticketId"></td></tr>`;
    }

    publicRequestId (publicRequestId,ticketId)
    {
        return `<tr><td class="content publicRequestId">${ticketId ? '<span class="ticketId">Auftrags-Nr: '+ticketId+'</span>' : ''} <span>Antrags-Id: ${publicRequestId}</span></td></tr>`;
    }

    toAppBtn (that,customText)
    {
        let text = 'Zu '+that.appName;
        if (customText) text = customText;
        return this.button(text, process.env.APP_URL_WEBPACK);
    }

    greetingLine (user)
    {
        return `<p class="greetingLine">Hi ${user.firstName ? user.firstName+',' : 'Dear Pairly-User,'}</p>`;
    }

    socialMediaInfo ()
    {
        return ''
    }

    getAssetLink ()
    {
        return '';
    }

    legalFooter ()
    {
        return `.`
    }

    appInfo ()
    {
        let getAppLink = function (title,link,logo)
        {
            return `<td width="10" align="center" style="font-size:0px;line-height:0px;">&nbsp;</td>
                                                        <td align="center">
                                                            <a href="${link}" target="_blank" title="${title}"><img src="${logo}" style="display:block;font-family:Arial,sans-serif;font-size:9px;color:#999999;display:block;line-height:10px;word-wrap:break-word;" width="32" height="60" border="0" alt="${title}" title="${title}" /></a>
                                                        </td>`
            //return `<a title="${title}" href='${link}'><img alt="${title}" src='${logo}'/></a>`
        };
        let s3CDN = this.getAssetLink();
        return [
            //getAppLink('iOS',process.env.IOS_APP_LINK,'https://linkmaker.itunes.apple.com/de-de/badge-lrg.svg?releaseDate=2019-08-28&kind=iossoftware&bubble=ios_apps'),
            getAppLink('iOS',process.env.IOS_APP_LINK,s3CDN+'appStoreBadge.png'),
            //getAppLink('Android',process.env.TWITTER_TWEET_LINK,''),
        ].join('')
    }

    getBucketForEnv ()
    {
        if (process.env.ENV === 'DEVELOPMENT') return '';
        if (process.env.ENV === 'STAGE') return '';
        return '';
    }

    applyInlineStyles (template,styles)
    {
        let primaryColor = styles.bgColor || this.primaryColor;
        let primaryFontColor = styles.bgColor || this.primaryFontColor;
        let $ = cheerio.load(template);

        $('h1').each(function(i, elem) {

            elem.attribs.style += 'color:#FFF;font-size:32px;';
        });

        $('*').each(function(i, elem) {

            //console.log('elem',elem);
            //console.log('elem',elem.attribs);
            elem.attribs.style +=
                'margin: 0;padding: 0;' +
                'font-size: 100%;' +
                'font-family: "Roboto",sans-serif;' +
                'font-weight:300;' +
                'line-height: 1.65;'+
                'font-smoothing: antialiased;'+
                '-webkit-font-smoothing: subpixel-antialiased;'+
                '-moz-font-smoothing: antialiased;'+
                '-o-font-smoothing: antialiased;';
            if (elem.attribs && elem.attribs.class && elem.attribs.class.indexOf('material-icons') !== -1)
            {
                elem.attribs.style = `font-family: 'Material Icons', serif;`
            }
        });

        $('p').each(function(i, elem) {

            elem.attribs.style +=
                'color:#000'
        });

        $('.logo').each(function(i, elem) {

            elem.attribs.style =
                'padding-top:15px;'
        });

        $('.legal').each(function(i, elem) {

            elem.attribs.style +=
                'margin:5px;'
        });

        $('.footer').each(function(i, elem) {

            elem.attribs.style =
                'color:black;'+
                'font-size:11px;' +
                'font-weight: 300;'
        });

        $('p').each(function(i, elem) {

            elem.attribs.style =
                'color:black;'+
                'font-size:14px;' +
                'font-weight: 300;'+
                'margin: 0px;';
        });

        $('.greetingLine').each(function(i, elem) {

            elem.attribs.style =
                'color:black;'+
                'font-size:14px;' +
                'font-weight: 300;'+
                'margin-top: 20px;';
        });

        $('.greetingEnd').each(function(i, elem) {

            elem.attribs.style =
                'color:black;'+
                'font-size:14px;' +
                'font-weight: 300;'+
                'margin-top: 20px;';
        });

        $('a').each(function(i, elem) {

            elem.attribs.style += 'text-decoration: none; color: '+primaryFontColor;
        });

        $('body').each(function(i, elem) {

            elem.attribs.style += '' +
                //'font-family: "Roboto",sans-serif;' +
                'width: 100% !important;'+
                'height: 100%;'+
                'background: #efefef;'+
                '-webkit-font-smoothing: antialiased;'+
                '-webkit-text-size-adjust: none;'
        });

        $('.body-wrap').each(function(i, elem) {

            elem.attribs.style +=
                'width: 100% !important;'+
                'height: 100%;'+
                'background: #efefef;'+
                '-webkit-font-smoothing: antialiased;'+
                '-webkit-text-size-adjust: none;'
        });

        $('.bold').each(function(i, elem) {

            elem.attribs.style =
                'font-weight: 500;'
        });

        $('.button').each(function(i, elem) {

            elem.attribs.style =
                'display: inline-block;'+
                'color: #FFF;'+
                'text-decoration:none;'+
                'background: '+primaryColor+';'+
                'border: solid '+primaryColor+';'+
                'border-width: 5px 20px 5px;'+
                'font-weight: 300;'+
                'border-radius: 4px;';
        });

        $('table').each(function(i, elem) {

            elem.attribs.style += 'width: 100% !important; border-collapse: collapse;';
        });

        $('.container').each(function(i, elem) {

            elem.attribs.style +=
                'display: block !important;'+
                'clear: both !important;'+
                'margin: 0 auto !important;'+
                'max-width: 580px !important';
        });

        $('.socialMedia').each(function(i, elem) {

            /* elem.attribs.style +=
                 'display: none !important;'*/
        });

        $('.container table').each(function(i, elem) {

            elem.attribs.style += 'width: 100% !important;border-collapse: collapse;';
        });

        $('.container .masthead').each(function(i, elem) {

            elem.attribs.style += 'color:white; padding: 20px 20px 20px 20px;background: '+primaryColor+';';
        });

        $('.container .masthead h1').each(function(i, elem) {

            elem.attribs.style +=
                'margin: 0 auto !important;'+
                'max-width: 90%;'
        });

        $('.container .content').each(function(i, elem) {

            elem.attribs.style += 'background: white;padding: 30px 35px;';
        });

        $('.container .content .footer').each(function(i, elem) {

            elem.attribs.style += 'background: none;';
        });

        $('.container .content .footer p').each(function(i, elem) {

            elem.attribs.style +=`
        margin-bottom: 0;
        text-align: center;
        font-size: 14px;`;
        });

        $('.container .content .footer a').each(function(i, elem) {

            elem.attribs.style +=`
        color: #888;
        text-decoration: none;
        font-weight: bold;`;
        });

        $('h1').each(function(i, elem) {

            elem.attribs.style += 'font-size: 32px;color:white; margin-bottom: 20px;line-height: 1.25;';
        });

        $('h2').each(function(i, elem) {

            elem.attribs.style += 'font-size: 28px;color:black; margin-bottom: 20px;line-height: 1.25;';
        });

        $('h3').each(function(i, elem) {

            elem.attribs.style += 'font-size: 24px;color:black; margin-bottom: 0px;line-height: 1.25;';
        });

        $('h4').each(function(i, elem) {

            elem.attribs.style += 'font-size: 20px;color:black; margin-bottom: 20px;line-height: 1.25;';
        });

        $('h5').each(function(i, elem) {

            elem.attribs.style += 'font-size: 16px;color:black; margin-bottom: 20px;line-height: 1.25;';
        });

        $('h6').each(function(i, elem) {

            elem.attribs.style += 'font-size: 12px;color:black; margin-bottom: 20px;line-height: 1.25;';
        });

        $('ul').each(function(i, elem) {

            elem.attribs.style += 'font-size: 14px;color:black; margin-left: 20px;line-height: 1.25;';
        });

        $('.reviewText').each(function (i, elem)
        {
            elem.attribs.style += 'background-color:rgba(220,221,226,0.3); padding: 4px 20px';
        });

        $('.event').each(function (i, elem)
        {
            elem.attribs.style += 'position:relative; float:left; width:100%; margin-bottom:40px;';
        });

        $('.splitBlock').each(function (i, elem)
        {
            elem.attribs.style += 'border-top: 2px solid rgba(220,221,226,0.3); position:relative; float:left; width:100%;';
        });

        $('.splitBlock .icon').each(function (i, elem)
        {
            elem.attribs.style += 'position:relative; float:left; width:50px; height:50px;  padding:5px 0px;';
        });

        $('.material-icons').each(function (i, elem)
        {
            elem.attribs.style += 'color:'+primaryFontColor;
        });

        $('.event .contentBlock.customer .text span').each(function (i, elem)
        {
            elem.attribs.style += 'position:relative; float:left; padding: 5px 6px;';
        });

        $('.splitBlock .icon i').each(function (i, elem)
        {
            elem.attribs.style += 'font-size:40px; line-height: 50px;';
        });

        $('.splitBlock .contentBlock').each(function (i, elem)
        {
            elem.attribs.style += 'position:relative; float:left; width:calc(100% - 50px); padding:5px 0px;';
        });

        $('.splitBlock .contentBlock .text').each(function (i, elem)
        {
            elem.attribs.style += 'position:relative; float:left; width:100%; font-size:14px;';
        });

        $('.splitBlock .contentBlock .headline').each(function (i, elem)
        {
            elem.attribs.style += 'font-weight:500';
        });

        $('.publicRequestId').each(function (i, elem)
        {
            elem.attribs.style += ` 
                      padding:0px 5px;
                      text-align:right;
                      margin-top:0; 
                      font-size:13px;`;
        })

        $('.publicRequestId .ticketId').each(function (i, elem)
        {
            elem.attribs.style += `
                position: relative;
                float: left;
                text-align:left;`;
        })


        $('.referralLink').each(function (i, elem)
        {
            elem.attribs.style += `
        background-color:${this.primaryColor};
        color:#FFF;
        width:100%;
        padding:10px 0;
        user-select:text;
        text-align:center;
        `;
        }.bind(this));

        $('.referralLink a').each(function (i, elem)
        {
            elem.attribs.style = `text-decoration:none; color:#FFF;`;
        }.bind(this));
        $('.referralLink a:visited').each(function (i, elem)
        {
            elem.attribs.style = `color:#FFF;`;
        }.bind(this));

        $('.qrCode').each(function (i, elem)
        {
            elem.attribs.style += `
          display:block;
          position:relative;
          width:400px;
          margin:0 auto;
        `;
        }.bind(this));

        $('.referrerNotice').each(function (i, elem)
        {
            elem.attribs.style += `
          font-size:10px;
          line-height:11px;
          display: block;
        `;
        }.bind(this))

        $('.socialMediaTable img').each(function (i, elem)
        {
            elem.attribs.style += `
            width:50px
        `;
        }.bind(this))

        $('.appsTable img').each(function (i, elem)
        {
            elem.attribs.style += `
            width:135px;
            height:50px;
        `;
        }.bind(this))

        $('.breakText').each(function (i, elem)
        {
            elem.attribs.style += `
            font-size:75% !important;
            overflow-wrap: break-word;
           word-wrap: break-word;
           -ms-word-break: break-all;
           word-break: break-all;
           word-break: break-word;
          -ms-hyphens: auto;
          -moz-hyphens: auto;
          -webkit-hyphens: auto;
          hyphens: auto;
        `;
        }.bind(this))

        return $.html();
    }
}

module.exports = Email;