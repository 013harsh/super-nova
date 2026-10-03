const amqlib = require("amqplib");
let channel, connection;

async function connect() {
  if (connection) return connection;
  try {
    connection = await amqlib.connect(process.env.RABBIT_URL);
    console.log("connected rabbitMQ");
    channel = await connection.createChannel();
  } catch (err) {
    console.log("ERROR connecting to RabbiitMQ:", err);
  }
}

async function publishToQueue(queueName, data = {}) {
  if (!channel || !connection) await connect();

  await channel.assertQueue(queueName, {
    durable: true,
  });
  await channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)));
  console.log("Message published to queue: ", queueName, data);
}

async function suscribeToQueue(queueName, callback) {
  if (!channel || !connection) await connect();

  await channel.assertQueue(queueName, {
    durable: true,
  });
  await channel.consume(queueName, async (msg) => {
    if (msg) {
      try {
        const data = JSON.parse(msg.content.toString());
        await callback(data);
        channel.ack(msg);
      } catch (error) {
        console.error("Error in queue callback:", error);
        // Acknowledge the message so it doesn't get stuck in an infinite retry loop
        // Or handle it based on your retry logic (e.g., channel.nack)
        channel.ack(msg); 
      }
    }
  });
}

module.exports = {
  connect,
  channel,
  connection,
  publishToQueue,
  suscribeToQueue,
};
