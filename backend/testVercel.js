
const https = require("https");
const data = JSON.stringify({
  from: "thalia.keebler@ethereal.email",
  to: "test@example.com",
  subject: "Test from local",
  html: "<p>test</p>",
  smtpHost: "smtp.ethereal.email",
  smtpPort: 587,
  smtpUser: "thalia.keebler@ethereal.email",
  smtpPass: "HKXRXces7qevQh7T9H"
});

const req = https.request({
  hostname: "reach-inbox-scheduler-nine.vercel.app",
  path: "/api/send-email",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-internal-secret": "reachinbox-bridge-secret-2026"
  }
}, res => {
  let body = "";
  res.on("data", c => body += c);
  res.on("end", () => console.log(res.statusCode, body));
});
req.on("error", console.error);
req.write(data);
req.end();

