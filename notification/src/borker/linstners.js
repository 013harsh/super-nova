const { suscribeToQueue } = require("./borker");
const { sendEmail } = require("../email");

module.exports = function () {
  suscribeToQueue("AUTH_notification.user_created", (data) => {
    const emailHTMLTemplate = `
      <h1>Welcome ${data.fullName.firstname + " " + data.fullName.lastname}</h1>
      <p>Your account has been created successfully</p>
    `;
    sendEmail(data.email, "Welcome to our services", "", emailHTMLTemplate);
  });
};
