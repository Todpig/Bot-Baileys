const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

async function chat() {
  // [START chat]
  // Make sure to include these imports:
  // import { GoogleGenerativeAI } from "@google/generative-ai";
  const genAI = new GoogleGenerativeAI(
    "AIzaSyB35NjMbK90AEgYXytVVvPgzcKTfRk1UnE"
  );
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: "Olá, tudo bem?, voce entende de algoritimos?" }],
      },
      {
        role: "model",
        parts: [{ text: "Olá, tudo bem , e com voce?. certamente, realize sua pergunta." }],
      },
    ],
  });
  let result = await chat.sendMessage("Gostaria que você me ajudasse a entender um algoritimo");
  console.log(result.response.text());
  result = await chat.sendMessage("Faça uma algoritimo de merge sorte em python.");
  console.log(result.response.text());
}

chat();
