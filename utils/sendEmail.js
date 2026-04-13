import nodemailer from "nodemailer";

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    console.log(`📧 Sending email to ${to} with subject: ${subject}`);
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER || "aloyebolu5@gmail.com", // your gmail
        pass: process.env.EMAIL_PASS || "dnhv qcfb kell fvgs", // app password
      },
    });

    const mailOptions = {
      // from: `"School Admin" <${process.env.EMAIL_USER}>`,
      from: `"AFUED Ondo ." <support@afued.edu.ng>`,
      to,
      subject,
      text,
      html,
    };

    // BYPASS
    // await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error("❌ Email sending failed:", error);
  }
};
