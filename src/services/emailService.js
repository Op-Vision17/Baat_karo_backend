const sgMail = require('@sendgrid/mail');
const { getOTPEmailHTML } = require('../template/email_template');

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendEmail = async (to, subject, text) => {
  try {
    const msg = {
  to: to,
  from: {
    email: process.env.EMAIL_FROM, // Keep @gmail.com for now
    name: 'Baatkaro Team' // This helps slightly
  },
  subject: `[Baatkaro] ${subject}`, // Add brand prefix
  text: text,
  html: getOTPEmailHTML(text),
  
  // Add these headers
  headers: {
    'X-Priority': '1',
    'Importance': 'high'
  },
  
  // Reduce spam score
  trackingSettings: {
    clickTracking: { enable: false },
    openTracking: { enable: false }
  }
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