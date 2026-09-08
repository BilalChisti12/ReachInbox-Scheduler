
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.sender.updateMany({
  where: { smtpHost: "smtp.ethereal.email" },
  data: { smtpPort: 587 }
}).then(console.log).finally(() => p.$disconnect());

