const { default: pino } = require("pino");
const {
  useMultiFileAuthState,
  default: makeWASocket,
  Browsers,
  delay,
} = require("@whiskeysockets/baileys");
const { v4 } = require("uuid");
const authStateMongo = require("./authState");

class WASocket {
  constructor(sessionPath, sockPath) {
    this.sessionPath = sessionPath;
    this.sockPath = sockPath;
    this.link_review_timeout = 30 * 1000;
  }
  async getWASocket() {
    const { state, saveCreds } = await authStateMongo({ id: v4() });
    const WASock = makeWASocket({
      auth: state,
      options: {
        timeout: this.link_review_timeout,
      },
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: false,
      logger: pino({ level: "fatal" }),
      linkPreviewImageThumbnailWidth: 852,
      generateHighQualityLinkPreview: true,
      defaultQueryTimeoutMs: undefined,
    });
    WASock.ev.on("creds.update", saveCreds);
    return WASock;
  }
}

module.exports = { WASocket };
