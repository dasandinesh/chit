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
    <div>
      <input
        type="text"
        placeholder="Phone Number"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
      />
      <input
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
