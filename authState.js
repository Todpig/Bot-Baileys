const {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
} = require("@whiskeysockets/baileys");
const { BufferJSON, initAuthCreds, proto } = require("@whiskeysockets/baileys");
const Whatsapp = require("../models/Whatsapp");
const { MongoClient } = require("mongodb");
const { logger } = require("../utils/logger");

/**@type {{ [T in keyof SignalDataTypeMap]: string }} */
const KEY_MAP = {
  "pre-key": "preKeys",
  session: "sessions",
  "sender-key": "senderKeys",
  "app-state-sync-key": "appStateSyncKeys",
  "app-state-sync-version": "appStateVersions",
  "sender-key-memory": "senderKeyMemory",
};

const { DB_URI = "mongodb://localhost:27017", DB_NAME } = process.env;
const client = new MongoClient(DB_URI);

async function connectToMongo() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

/**
 * @param {Whatsapp} whatsapp
 * @returns {Promise<{ state: AuthenticationState, saveState: () => void }>}
 */
const authStateMongo = async (whatsapp) => {
  await connectToMongo();
  const sessionsCollection = client.db(DB_NAME).collection("sessions");
  const keysCollection = client.db(DB_NAME).collection("keys");

  /**@type {AuthenticationCreds} */
  let creds = initAuthCreds();
  const whatsappId = whatsapp.id;

  /**
   * @param {string} type
   * @param {string} key
   * @param {*} value
   */
  const saveKey = async (type, key, value) => {
    logger.debug(
      `Storing key whatsappId: ${whatsappId} type: ${type} key: ${key}`
    );
    try {
      await keysCollection.updateOne(
        { whatsappId, type, key },
        { $set: { value: JSON.stringify(value) } },
        { upsert: true }
      );
    } catch (error) {
      logger.error(`Error storing key: ${error.message}`);
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
      logger.debug(
        `${
          result ? "Successfully" : "Failed to"
        } recover key whatsappId: ${whatsappId} type: ${type} key: ${key}`
      );
      return result ? JSON.parse(result.value) : null;
    } catch (error) {
      logger.error(`Error retrieving key: ${error.message}`);
      return null;
    }
  };

  /**
   * @param {string} type
   * @param {string} key
   */
  const removeKey = async (type, key) => {
    logger.debug(
      `Deleting key whatsappId: ${whatsappId} type: ${type} key: ${key}`
    );
    try {
      await keysCollection.deleteOne({ whatsappId, type, key });
    } catch (error) {
      logger.error(`Error deleting key: ${error.message}`);
    }
  };

  const saveState = async () => {
    try {
      await sessionsCollection.updateOne(
        { id: whatsappId },
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

  const sessionDataB = await sessionsCollection.findOne({ id: whatsappId });
  if (sessionDataB) {
    const resultB = JSON.parse(sessionDataB.session, BufferJSON.reviver);
    creds = resultB.creds;
    const { keys } = resultB;

    if (Object.keys(keys).length) {
      logger.debug("Starting conversion of keys to new format");
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
        logger.debug(`Converting keys of type ${oldType} to ${newType}`);
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
              logger.error(`Error retrieving keys: ${error.message}`);
              logger.error(`Stack trace: ${error.stack}`);
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
      },
    },
    saveState,
  };
};

export default authStateMongo;
