const sgMail = require('@sendgrid/mail');
const { getOTPEmailHTML } = require('../template/email_template');

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendEmail = async (to, subject, text) => {
  try {
    const msg = {
      to: to,
      from: process.env.EMAIL_FROM,
      subject: subject,
      text: text, // Plain text fallback
      html: getOTPEmailHTML(text), // 🔥 Beautiful HTML template
    };

    await sgMail.send(msg);
    console.log(`✅ Email sent to: ${to}`);
    
  } catch (error) {
    console.error('❌ Email error:', error.message);
    
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    
    throw error;
  }
};