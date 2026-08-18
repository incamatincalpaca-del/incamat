const crypto = require("crypto");

const scrypt = (password, salt) => new Promise((resolve, reject) => {
  crypto.scrypt(password, salt, 64, (error, derivedKey) => error ? reject(error) : resolve(derivedKey.toString("hex")));
});

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt);
  return `${salt}:${hash}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, originalHash] = stored.split(":");
  const calculatedHash = await scrypt(password, salt);
  return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), Buffer.from(calculatedHash, "hex"));
}

module.exports = { hashPassword, verifyPassword };
