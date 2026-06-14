const amqlib = require("amqplib");
let channel, connection;

async function connect() {
  if (connection) return connection;
  try {
    connection = await amqlib.connect(process.env.RABBIT_URL);
    console.log("connected rabbitMQ");
    
    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err.message);
    });
    
    connection.on("close", () => {
      console.log("RabbitMQ connection closed");
    });

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

async function suscribeToQueue(queueName, callbackPromise) {
  if (!channel || !connection) await connect();

  await channel.assertQueue(queueName, {
    durable: true,
  });
  await channel.consume(queueName, async (msg) => {
    if (msg) {
      const data = JSON.parse(msg.content.toString());
      await callbackPromise(data);
      channel.ack(msg);
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
