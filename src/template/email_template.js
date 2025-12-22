exports.getOTPEmailHTML = (otp, recipientName = 'User') => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Baatkro OTP</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 0;">
        <tr>
            <td align="center">
                <!-- Main Container -->
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                    
                    <!-- Header with Gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">
                                💬 Baatkro
                            </h1>
                            <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">
                                Your Real-Time Chat Platform
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 50px 40px;">
                            <h2 style="margin: 0 0 20px 0; color: #2d3748; font-size: 24px; font-weight: 600;">
                                Hello ${recipientName}! 👋
                            </h2>
                            
                            <p style="margin: 0 0 30px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                                Welcome to <strong>Baatkro</strong>! We're excited to have you join our community. 
                                To complete your login, please use the OTP code below:
                            </p>
                            
                            <!-- OTP Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px;">
                                        <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
                                            Your OTP Code
                                        </p>
                                        <p style="margin: 0; color: #ffffff; font-size: 48px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                                            ${otp}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 30px 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                                This code will expire in <strong style="color: #e53e3e;">5 minutes</strong>. 
                                If you didn't request this code, please ignore this email.
                            </p>
                            
                            <!-- Security Tips -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #edf2f7; border-radius: 8px; padding: 20px; margin: 30px 0;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 10px 0; color: #2d3748; font-size: 14px; font-weight: 600;">
                                            🔒 Security Tips:
                                        </p>
                                        <ul style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
                                            <li>Never share your OTP with anyone</li>
                                            <li>Baatkro will never ask for your OTP via phone or email</li>
                                            <li>Always verify the sender's email address</li>
                                        </ul>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f7fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 15px 0; color: #718096; font-size: 14px;">
                                Need help? Contact us at 
                                <a href="mailto:support@baatkro.com" style="color: #667eea; text-decoration: none; font-weight: 600;">
                                    support@baatkro.com
                                </a>
                            </p>
                            
                            <p style="margin: 0 0 15px 0; color: #a0aec0; font-size: 12px;">
                                © ${new Date().getFullYear()} Baatkro. All rights reserved.
                            </p>
                            
                            <!-- Social Links (Optional) -->
                            <div style="margin-top: 20px;">
                                <a href="#" style="display: inline-block; margin: 0 10px; color: #667eea; text-decoration: none; font-size: 24px;">
                                    📘
                                </a>
                                <a href="#" style="display: inline-block; margin: 0 10px; color: #667eea; text-decoration: none; font-size: 24px;">
                                    🐦
                                </a>
                                <a href="#" style="display: inline-block; margin: 0 10px; color: #667eea; text-decoration: none; font-size: 24px;">
                                    📷
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                </table>
                
                <!-- Unsubscribe Link -->
                <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                    <tr>
                        <td align="center" style="padding: 20px;">
                            <p style="margin: 0; color: #a0aec0; font-size: 12px;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
                
            </td>
        </tr>
    </table>
</body>
</html>
  `;
};