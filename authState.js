const {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
} = require("@whiskeysockets/baileys");
const { BufferJSON, initAuthCreds, proto } = require("@whiskeysockets/baileys");
const { MongoClient } = require("mongodb");

/**@type {{ [T in keyof SignalDataTypeMap]: string }} */
const KEY_MAP = {
  "pre-key": "preKeys",
  session: "sessions",
  "sender-key": "senderKeys",
  "app-state-sync-key": "appStateSyncKeys",
  "app-state-sync-version": "appStateVersions",
  "sender-key-memory": "senderKeyMemory",
};

const { DB_URI = "mongodb://admin:pass@localhost:27017", DB_NAME } =
  process.env;
const client = new MongoClient(DB_URI);

async function connectToMongo() {
  try {
    await client.connect({ client: { w: "majority" } });
  } catch (error) {
    throw error;
  }
}

/**
 * @param {{id: string}} param0
 * @returns {Promise<{ state: AuthenticationState, saveState: () => void, removeSession: (whatsappId : string) => void }>}
 */
const authStateMongo = async ({ id }) => {
  await connectToMongo();
  const sessionsCollection = client.db(DB_NAME).collection("sessions");
  const keysCollection = client.db(DB_NAME).collection("keys");

  /**@type {AuthenticationCreds} */
  let creds = initAuthCreds();

  /**
   * @param {string} type
   * @param {string} key
   * @param {*} value
   */
  const saveKey = async (type, key, value) => {
    try {
      await keysCollection.updateOne(
        { id, type, key },
        { $set: { value: JSON.stringify(value) } },
        { upsert: true }
      );
    } catch (error) {
      console.error(`Error saving key: ${error.message}`);
    }
  };

  /**
   * @param {string} type
   * @param {string} key
   * @returns
   */
  const getKey = async (type, key) => {
    try {
      const result = await keysCollection.findOne({ whatsappId, type, key });
      return result ? JSON.parse(result.value) : null;
    } catch (error) {
      return null;
    }
  };

  /**
   * @param {string} type
   * @param {string} key
   */
  const removeKey = async (type, key) => {
    try {
      await keysCollection.deleteOne({ id, type, key });
    } catch (error) {
      console.error(`Error deleting key: ${error.message}`);
    }
  };

  const saveState = async () => {
    try {
      await sessionsCollection.updateOne(
        { id },
        {
          $set: {
            session: JSON.stringify(
              { creds, keys: {} },
              BufferJSON.replacer,
              0
            ),
          },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error("Error saving state:", error);
    }
  };

  /**
   * @param {string} whatsappId
   */
  const removeSession = async (whatsappId) => {
    try {
      await sessionsCollection.deleteOne({ id: whatsappId });
      await keysCollection.deleteMany({ whatsappId });
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const sessionDataB = await sessionsCollection.findOne({ id });
  if (sessionDataB) {
    const resultB = JSON.parse(sessionDataB.session, BufferJSON.reviver);
    creds = resultB.creds;
    const { keys } = resultB;

    if (Object.keys(keys).length) {
      const TYPE_MAP = {
        preKeys: "pre-key",
        sessions: "session",
        senderKeys: "sender-key",
        appStateSyncKeys: "app-state-sync-key",
        appStateVersions: "app-state-sync-version",
        senderKeyMemory: "sender-key-memory",
      };

      for (const oldType of Object.keys(keys)) {
        const newType = TYPE_MAP[oldType];
        for (const key of Object.keys(keys[oldType])) {
          await saveKey(newType, key, keys[oldType][key]);
        }
      }
      await saveState();
    }
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          /**
           * @type {{ [_: string]: SignalDataTypeMap[typeof type] }}
           */
          const data = {};
          for (const id of ids) {
            try {
              let value = await getKey(type, id);
              if (value && type === "app-state-sync-key") {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            } catch (error) {
              console.error("Error getting key:", error);
            }
          }
          return data;
        },
        set: async (data) => {
          /**
           * @type {Promise<void>[]}
           */
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              tasks.push(
                value ? saveKey(category, id, value) : removeKey(category, id)
              );
            }
          }
          await Promise.all(tasks);
        },
        clear: async (type) => {
          try {
            await keysCollection.deleteMany({ id, type });
          } catch (error) {
            console.error(`Error clearing keys: ${error.message}`);
          }
        },
      },
    },
    saveState,
    removeSession,
  };
};

module.exports = authStateMongo;
