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

  suscribeToQueue("PAYMENT_NOTIFICATION.PAYMENT_SUCCESS", (data) => {
    const emailHTMLTemplate = `
     <h1>Welcome ${data.username}</h1>
      <h1>Payment Successful</h1>
      <p>we have successfully recived your payment ${data.amount} for order id ${data.orderId}</p>
    `;
    sendEmail(data.email, "Payment Successful", "", emailHTMLTemplate);
  });

  suscribeToQueue("PAYMENT_NOTIFICATION.PAYMENT_FAILED", (data) => {
    const emailHTMLTemplate = `
     <h1>Welcome ${data.username}</h1>
      <h1>Payment Failed</h1>
      <p>we have failed to receive your payment ${data.amount} for order id ${data.orderId}</p>
      <p>kindly retry the payment</p>
    `;
    sendEmail(data.email, "Payment Failed", "", emailHTMLTemplate);
  });
};
