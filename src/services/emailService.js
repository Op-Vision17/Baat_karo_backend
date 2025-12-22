const sgMail = require('@sendgrid/mail');

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendEmail = async (to, subject, text) => {
  try {
const msg = {
  to,
  from: process.env.EMAIL_FROM,
  subject: "Your Baatkro Login OTP",
  text: `Your OTP is ${otp}`,
  html: `
  <div style="background:#f4f6f8;padding:30px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      
      <!-- Header -->
      <div style="background:#4f46e5;padding:24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:26px;letter-spacing:1px;">
          Baatkro
        </h1>
        <p style="margin:8px 0 0;color:#c7d2fe;font-size:14px;">
          Secure Login Verification
        </p>
      </div>

      <!-- Body -->
      <div style="padding:28px;color:#111827;">
        <p style="font-size:15px;margin:0 0 16px;">
          Hi 👋
        </p>

        <p style="font-size:15px;margin:0 0 24px;line-height:1.6;color:#374151;">
          Use the following One-Time Password (OTP) to log in to your Baatkro account.
          This OTP is valid for <strong>5 minutes</strong>.
        </p>

        <!-- OTP Box -->
        <div style="text-align:center;margin:30px 0;">
          <div style="
            display:inline-block;
            padding:14px 28px;
            font-size:28px;
            font-weight:bold;
            letter-spacing:6px;
            color:#4f46e5;
            background:#eef2ff;
            border-radius:10px;
          ">
            ${otp}
          </div>
        </div>

        <p style="font-size:14px;color:#6b7280;line-height:1.6;">
          If you didn’t request this login, you can safely ignore this email.
        </p>

        <p style="font-size:14px;color:#6b7280;margin-top:20px;">
          — Team <strong>Baatkro</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#9ca3af;">
        © ${new Date().getFullYear()} Baatkro. All rights reserved.
      </div>

    </div>
  </div>
  `,
};


    await sgMail.send(msg);
    console.log(`✅ Email sent to: ${to}`);
    
  } catch (error) {
    console.error('❌ Email error:', error.message);
    
    // Log more details for debugging
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    
    throw error;
  }
};