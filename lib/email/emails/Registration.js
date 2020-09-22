const Email = require('../Email.js');

class Registration extends Email {

    constructor ({user,pw})
    {
        super();
        this.user = user;
        this.pw = pw;
    }

    to ()
    {
        return this.user.email;
    }

    subject ()
    {
        let { request } = this;
        let txt = 'Welcome to Pairly';
        return txt;
    }

    body ()
    {
        let {user, pw} = this;
        return `${this.greetingLine(user)}
               <p>Thanks for joining Pairly. Your password for Pairly is:
               </p>
               <span class="bold">${pw}</span>
               <br/>
               <br/>
               
               <p>Please save your password to a secure place and do not share it with anyone else.</p>
               <p>You can change your password after your first login.</p>`
    }

    placeholders ()
    {
        return {
            Subject:this.subject(),
            Body:this.body()
        }
    }

    create ()
    {
        return {
            to:this.to(),
            subject:this.subject(),
            html:this.fillTemplate(this.template,this.placeholders(),{})
        };
    };
}

module.exports = Registration;