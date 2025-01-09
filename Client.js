const qrcode = require("qrcode-terminal");
const { WASocket } = require("./WASocket");
const { delay, isJidGroup } = require("@whiskeysockets/baileys");
const fs = require("fs");
const sessionPath = "sessions/";

class ClientW {
  constructor(id) {
    this.sock = null;
    this.messagesBeingSent = new Map();
    this.isCancelSending = false;
    this.usersResponded = new Set();
    this.chats = [];
    this.id = id;
  }

  disconectClient() {
    if (this.sock) {
      this.sock.end();
    }
  }

  deleteKeys() {
    this.sock.authState.keys.clear && this.sock.authState.keys.clear();
  }

  async cancelMessageSending() {
    this.isCancelSending = true;
  }

  async deleteMessageChats(chats) {
    if (!chats.length || !this.messagesBeingSent.size) return false;
    try {
      for (let chat of chats) {
        const messageKey = this.messagesBeingSent.get(chat.id);
        if (!messageKey) return;
        await delay(1500);
        await this.sock.sendMessage(chat.id, { delete: messageKey });
        this.messagesBeingSent.delete(chat.id);
      }
    } catch (error) {
      console.log(error);
    }
  }

  async sendMessagePoll(
    { question, answers, isAllowMultipleResponses },
    chatsToSend
  ) {
    if (!question || !answers) return;
    try {
      const selectableCount = isAllowMultipleResponses ? null : 1;
      for (let chat of chatsToSend) {
        await this.sock.sendMessage(chat, {
          poll: { name: question, values: answers, selectableCount },
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  async sendMessageSticker(chatId, pathMedia) {
    try {
      await this.sock.sendMessage(chatId, {
        sticker: {
          url: pathMedia,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async sendMessageAudio(chats, pathMedia) {
    try {
      for (let chat of chats) {
        await this.sock.sendMessage(chat, {
          audio: {
            url: pathMedia,
          },
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  async sendMessageImage(chats, pathMedia) {
    try {
      for (let chat of chats) {
        await this.sock.sendMessage(chat, {
          image: {
            url: pathMedia,
          },
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  async sendMessageVideo(chats, pathMedia) {
    try {
      for (let chat of chats) {
        await this.sock.sendMessage(chat, {
          video: {
            url: pathMedia,
          },
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  async getchats() {
    this.chats = Object.values(await this.sock.groupFetchAllParticipating());
    return this.chats;
  }

  replyMessages(message) {
    const clientJid = message.key.remoteJid;

    if (
      !clientJid.includes("@g.us") &&
      !message.key.fromMe &&
      !this.hasUserResponded(clientJid)
    ) {
      this.sock.sendMessage(clientJid, {
        text: "Hola, soy un bot",
      });
      this.usersResponded.add({ date: new Date(), clientJid });
    }
  }

  hasUserResponded(clientJid) {
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    for (let user of this.usersResponded) {
      if (user.clientJid === clientJid) {
        const timeDifference = now - new Date(user.date);
        if (timeDifference < oneDayInMs) {
          return true;
        }
      }
    }
    return false;
  }

  async connectWASocket() {
    try {
      const WASock = new WASocket({ id: this.id });
      const { removeSession, socket } = await WASock.getWASocket();
      this.sock = socket;
      return new Promise((resolve, reject) => {
        this.sock.ev.on("connection.update", async (update) => {
          const { connection, qr, lastDisconnect } = update;
          const statusCode = lastDisconnect?.error?.output?.statusCode;

          if (connection === "open") {
            console.log(`${this.id} connected!`);
            await this.getchats();
          }

          if (connection === "close") {
            if (statusCode === 515) {
              return this.connectWASocket();
            }
            this.deleteKeys();
          }

          if (qr && this.id) {
            qrcode.generate(qr, { small: true });
            resolve(qr);
            setTimeout(() => {
              if (!this.sock.user) {
                this.disconectClient();
                removeSession(this.id);
              }
            }, 50 * 1000);
          }
        });
        this.sock.ev.on("messages.upsert", (update) => {
          const message = update.messages[0];
          this.replyMessages(message);
        });
      });
    } catch (error) {
      console.log("Error connecting to WASocket:", error);
    }
  }

  async deleteSession() {
    try {
      fs.rmSync(sessionPath + this.id, { recursive: true });
    } catch (error) {
      console.log("Error deleting session:", error);
    }
  }

  async sendMessage(message, chatsToSend) {
    try {
      if (!this.chats.length) {
        await this.getchats();
        return false;
      }
      for (let chat of chatsToSend) {
        if (this.isCancelSending) break;
        await delay(1500);

        const sentMessage = await this.sock.sendMessage(
          chat.id,
          {
            text: message,
          },
          {
            ephemeralExpiration:
              (await this.sock.groupMetadata(chat.id).ephemeralDuration) ||
              60 * 60 * 24 * 7,
          }
        );
        console.log("Message sent");
        this.messagesBeingSent.set(chat.id, sentMessage.key);
      }
      if (this.isCancelSending) {
        this.isCancelSending = false;
        await this.deleteMessageChats(chatsToSend);
        return false;
      }
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
}

module.exports = { ClientW };
