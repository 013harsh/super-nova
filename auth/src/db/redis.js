const { Redis } = require("ioredis");
const RedisMock = require("ioredis-mock");

const isTest = process.env.NODE_ENV === "test";

const redis = isTest
  ? new RedisMock()
  : new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
    });

redis.on("connect", () => {
  if (!isTest) {
    console.log("Connected to Redis");
  }
});

module.exports = redis;
