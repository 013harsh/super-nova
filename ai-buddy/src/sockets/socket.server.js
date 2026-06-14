const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const { agent } = require("../agent/agent");

async function initSocketServer(httpserver) {
  const io = new Server(httpserver, {});

  io.use((socket, next) => {
    const cookies = socket.handshake.headers?.cookie;

    const { token } = cookies ? cookie.parse(cookies) : {};

    if (!token) {
      return next(new Error("token not provided"));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      socket.token = token;
      next();
    } catch {
      console.log(err.message);
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log("connected user", socket.user, socket.token);

    socket.on("message", async (data) => {
      const agentResponse = await agent.invoke(
        {
          messages: [
            {
              role: "user",
              content: data,
            },
          ],
        },
        {
          metadata: {
            token: socket.token,
          },
        },
      );

      const lastMessage =
        agentResponse.messages[agentResponse.messages.length - 1];
      socket.emit("message", lastMessage.content);
    });
  });
}

module.exports = { initSocketServer };
