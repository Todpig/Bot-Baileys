const qrcode = require("qrcode-terminal");
const { WASocket, DisconnectReason } = require("./WASocket");
const { delay } = require("@whiskeysockets/baileys");
const fs = require("fs");
const sessionPath = "sessions/";

class ClientW {
  constructor(sessionName) {
    this.sessionName = sessionName;
    this.sock = null;
    this.messagesBeingSent = new Map();
    this.isCancelSending = false;
    this.chats = [];
  }

  disconectClient() {
    if (this.sock) {
      this.sock.end();
    }
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
        console.log(messageKey);
        await delay(1500);
        await this.sock.sendMessage(chat.id, { delete: messageKey });
        this.messagesBeingSent.delete(chat.id);
      }
    } catch (error) {
      console.log(error);
    }
  }

  async getchats() {
    this.chats = Object.values(await this.sock.groupFetchAllParticipating());
  }

  async connectWASocket() {
    try {
      const WASock = new WASocket(sessionPath, this.sessionName);
      this.sock = await WASock.getWASocket();
      return new Promise((resolve, reject) => {
        this.sock.ev.on("connection.update", async (update) => {
          const { connection, qr, lastDisconnect } = update;
          const statusCode = lastDisconnect?.error?.output?.statusCode;

          if (connection === "open") {
            console.log(`${this.sessionName} connected!`);
            await this.getchats();
          }

          if (connection === "close") {
            if (
              statusCode === 515 ||
              statusCode === DisconnectReason.timedOut
            ) {
              console.log("Reconnecting...");
              return this.connectWASocket();
            }
          }

          if (qr && this.sessionName) {
            qrcode.generate(qr, { small: true });
            resolve(qr);
            setTimeout(() => {
              if (!this.sock.user) {
                this.disconectClient();
                this.deleteSession();
              }
            }, 50 * 1000);
          }
        });
      });
    } catch (error) {
      console.log("Error connecting to WASocket:", error);
    }
  }

  async deleteSession() {
    try {
      fs.rmSync(sessionPath + this.sessionName, { recursive: true });
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
        const sentMessage = await this.sock.sendMessage(chat.id, {
          text: message,
        });
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
