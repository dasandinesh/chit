import React, { useState } from "react";
import axios from "axios";

const SendMessage = () => {
  const [message, setMessage] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const sendMessage = async () => {
    try {
      const response = await axios.post(
        "https://messaging.googleapis.com/v1/messages:send",
        {
          phoneNumber: "962608100",
          message: {
            text: message,
          },
        },
        {
          headers: {
            Authorization: "Bearer YOUR_ACCESS_TOKEN",
          },
        }
      );
      console.log("Message sent successfully:", response.data);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <div className="message-page">
      <h2>Send Message</h2>
      <label htmlFor="message-phone">Phone Number</label>
      <input
        id="message-phone"
        type="tel"
        placeholder="Phone Number"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
      />
      <label htmlFor="message-text">Message</label>
      <input
        id="message-text"
        type="text"
        placeholder="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={sendMessage}>Send Message</button>
    </div>
  );
};

export default SendMessage;
