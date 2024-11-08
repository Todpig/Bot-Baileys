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
    const { state, saveState } = await authStateMongo(this.session.id);
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
    WASock.ev.on("creds.update", saveState);
    return WASock;
  }
}

module.exports = { WASocket };
