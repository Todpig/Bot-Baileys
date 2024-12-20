const express = require("express");
const fs = require("fs");
const routes = express.Router();
const fuzz = require("fuzzball");
const { ClientW } = require("./Client");

/**
 * @typedef {Object} ClientWrapper
 * @property {ClientW} client
 */

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {string} chatName
 * @property {string} message
 */

/** @type {Map<string, ClientWrapper>} */
const clients = new Map();

/** @type {Map<string, Message>} */
const messages = new Map();

const sessionsPath = "sessions/";

routes.get("/", (req, res) => {
  res.json({ message: "Hello World!" });
});

routes.post("/client", (req, res) => {
  const { sessionName } = req.body;
  clients.set(sessionName, { client: new ClientW(sessionName) });
  clients
    .get(sessionName)
    .client.connectWASocket()
    .then((qr) => {
      res.end(JSON.stringify({ qr }));
    });
});

routes.post("/message/send", async (req, res) => {
  const { sessionName, chatName, message } = req.body;
  const { id, text } = message;
  if (!clients.get(sessionName)) return res.end("Client not found");
  messages.set(id, { chatName, text });
  res.end("Sending message!");
});

routes.delete("/message/:messageId", (req, res) => {
  const { messageId } = req.params;
  Array.from(clients.keys()).forEach((client) => {
    clients.get(client).client.cancelMessageSending(messageId);
  });
  messages.delete(messageId);
  res.end("Message deleted!");
});

routes.post("/message/poll/send", async (req, res) => {
  const { sessionName, chats, poll } = req.body;
  if (!clients.get(sessionName)) return res.end("Client not found");
  clients.get(sessionName).client.sendMessagePoll(poll, chats);
  res.end("Sending poll!");
});

routes.post("/message/video/send", async (req, res) => {
  const { sessionName, chats, pathMedia } = req.body;
  if (!clients.get(sessionName)) return res.end("Client not found");
  clients.get(sessionName).client.sendMessageVideo(chats, pathMedia);
  res.end("Sending video!");
});

routes.post("/message/image/send", async (req, res) => {
  const { sessionName, chats, pathMedia } = req.body;
  if (!clients.get(sessionName)) return res.end("Client not found");
  clients.get(sessionName).client.sendMessageImage(chats, pathMedia);
  res.end("Sending image!");
});

routes.post("/message/audio/send", async (req, res) => {
  const { sessionName, chats, pathMedia } = req.body;
  if (!clients.get(sessionName)) return res.end("Client not found");
  clients.get(sessionName).client.sendMessageAudio(chats, pathMedia);
  res.end("Sending audio!");
});

routes.post("/message/sticker/send", async (req, res) => {
  const { sessionName, chatId, pathMedia } = req.body;
  if (!clients.get(sessionName)) return res.end("Client not found");
  clients.get(sessionName).client.sendMessageSticker(chatId, pathMedia);
  res.end("Sending sticker!");
});

function popLastMessage() {
  const lastKey = Array.from(messages.keys()).pop();
  const lastValue = messages.get(lastKey);
  messages.delete(lastKey);
  return lastValue;
}

(function () {
  const sessionName = "558496441982@s.whatsapp.net";
  clients.set(sessionName, { client: new ClientW(sessionName) });
  clients.get(sessionName).client.connectWASocket();

  setInterval(() => {
    if (!messages.size || !clients.size) return;
    const { chatName, text } = popLastMessage();

    const chats = clients
      .get(sessionName)
      .client.chats.filter((chat) => fuzz.ratio(chat.subject, chatName) >= 70);
    clients.get(sessionName).client.sendMessage(text, chats);
  }, 100);
})();

module.exports = { routes };
