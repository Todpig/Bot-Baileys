const { default: pino } = require("pino");
const {
  useMultiFileAuthState,
  default: makeWASocket,
  Browsers,
  delay,
} = require("@whiskeysockets/baileys");
const authStateMongo = require("./authState");

class WASocket {
  constructor(session) {
    this.session = session;
    this.link_review_timeout = 30 * 1000;
  }
  async getWASocket() {
    const { state, saveState, removeSession } = await authStateMongo(
      this.session
    );
    const socket = makeWASocket({
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
    socket.ev.on("creds.update", saveState);
    return { socket, removeSession };
  }
}

module.exports = { WASocket };
