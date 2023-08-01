const transporter = require('../config/emailTransporter');
const nodemailer = require('nodemailer');

const sendActivationEmail = async (email, token) => {
  const info = await transporter.sendMail({
    from: 'My App <info@my-app.com>',
    to: email,
    subject: 'Account activation',
    html: `
            <div>Token is: </div>
        <div>${token}</div>
        `,
  });
  if (process.env.NODE_ENV === 'developement') {
    console.log('url: ' + nodemailer.getTestMessageUrl(info));
  }
};

module.exports = { sendActivationEmail };
