const Email = require('../Email.js');

class PasswordChanged extends Email {

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
        let txt = 'Forgot Password';
        return txt;
    }

    body ()
    {
        let { user, pw } = this;
        return `${this.greetingLine(user)}
               <p>your passwort was resetted! Your new your password is:</p>
             
               <span class="bold">${pw}</span>
               <br/>
               <br/>
               <p>If this change was not intiated by you please contact support immediately</p>
`
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

module.exports = PasswordChanged;