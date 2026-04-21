import { Telegraf, Markup } from "telegraf";
import "dotenv/config";
import { editions, getRandomQuestion, getEditionsList } from "./questions.js";

const BOT_TOKEN = process.env.BOT_TOKEN;

const bot = new Telegraf(BOT_TOKEN);

const state = new Map();

const getState = (chatId) => {
  if (!state.has(chatId)) {
    state.set(chatId, {
      gameActive: false,
      currentEdition: null,
      currentQuestion: null,
      questionsAsked: []
    });
  }
  return state.get(chatId);
};

const mainMenuKeyboard = () => {
  const editionList = getEditionsList();
  const buttons = editionList.map((ed) =>
    Markup.button.callback(`${ed.emoji} ${ed.name}`, `play_${ed.id}`)
  );
  
  const randomBtn = Markup.button.callback("🎲 Random", "play_random");
  
  return Markup.inlineKeyboard([
    ...buttons.map((btn) => [btn]),
    [randomBtn]
  ]);
};

const gameKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🎴 Next Card", "next_card")],
    [Markup.button.callback("❌ End Game", "end_game")]
  ]);
};

const formatQuestion = (q) => {
  let text = `📚 *${q.edition}*`;
  if (q.levelName) {
    text += ` • ${q.levelName}`;
  }
  text += `\n\n${q.text}`;
  return text;
};

bot.start(async (ctx) => {
  const chatId = ctx.message.chat.id;
  const userState = getState(chatId);
  userState.gameActive = false;
  userState.currentEdition = null;
  userState.questionsAsked = [];
  
  await ctx.reply(
    "🃏 *Actually Curious*\n\nA conversation card game that brings people closer.\n\nChoose an edition to play:",
    {
      parse_mode: "Markdown",
      ...mainMenuKeyboard()
    }
  );
});

bot.command("play", async (ctx) => {
  const args = ctx.message.text.split(" ");
  const editionArg = args[1]?.toLowerCase();
  const chatId = ctx.message.chat.id;
  const userState = getState(chatId);
  
  if (editionArg && editionArg !== "random") {
    if (!editions[editionArg]) {
      await ctx.reply("Unknown edition. Use /play with curiosity, happyHour, culture, ourFuture, or humanRights.");
      return;
    }
    userState.currentEdition = editionArg;
  } else {
    const editionKeys = Object.keys(editions);
    userState.currentEdition = editionKeys[Math.floor(Math.random() * editionKeys.length)];
  }
  
  userState.gameActive = true;
  userState.questionsAsked = [];
  
  const question = getRandomQuestion(userState.currentEdition);
  userState.currentQuestion = question;
  userState.questionsAsked.push(question.text);
  
  await ctx.reply(
    `🎮 Playing *${editions[userState.currentEdition].name}*\n\n---\n` + formatQuestion(question),
    {
      parse_mode: "Markdown",
      ...gameKeyboard()
    }
  );
});

bot.command("next", async (ctx) => {
  const chatId = ctx.message.chat.id;
  const userState = getState(chatId);
  
  if (!userState.gameActive) {
    await ctx.reply("No active game. Use /start to begin!", mainMenuKeyboard());
    return;
  }
  
  const question = getRandomQuestion(userState.currentEdition);
  userState.currentQuestion = question;
  userState.questionsAsked.push(question.text);
  
  await ctx.reply(
    formatQuestion(question),
    {
      parse_mode: "Markdown",
      ...gameKeyboard()
    }
  );
});

bot.command("end", async (ctx) => {
  const chatId = ctx.message.chat.id;
  const userState = getState(chatId);
  
  if (!userState.gameActive) {
    await ctx.reply("No active game to end. Use /start to begin!");
    return;
  }
  
  const count = userState.questionsAsked.length;
  userState.gameActive = false;
  userState.currentEdition = null;
  userState.currentQuestion = null;
  
  await ctx.reply(
    `🏁 Game ended!\n\nYou discussed ${count} question${count !== 1 ? "s" : ""}.\n\nUse /start to play again!`,
    mainMenuKeyboard()
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    "�_help Actually Curious_\n\n" +
    "_A conversation card game that brings people closer_\n\n" +
    "Commands:\n" +
    "/start - Choose edition & begin\n" +
    "/play [edition] - Quick play (or /play random)\n" +
    "/next - Get next card\n" +
    "/end - End current game\n" +
    "/help - Show this message\n\n" +
    "Editions:\n" +
    "• curiosity - 4 levels from light to deep\n" +
    "• happyHour - happiness & dreams\n" +
    "• culture - movies, music & art\n" +
    "• ourFuture - hopes & dreams\n" +
    "• humanRights - society & values",
    { parse_mode: "Markdown" }
  );
});

bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const chatId = ctx.callbackQuery.message?.chat?.id;
  const messageId = ctx.callbackQuery.message?.message_id;
  
  if (!chatId) {
    await ctx.answerCbQuery("Error: unable to process");
    return;
  }
  
  const userState = getState(chatId);
  
  if (callbackData === "next_card") {
    if (!userState.gameActive) {
      await ctx.answerCbQuery("No active game. Start a new one!");
      return;
    }
    
    const question = getRandomQuestion(userState.currentEdition);
    userState.currentQuestion = question;
    userState.questionsAsked.push(question.text);
    
    await ctx.editMessageText(
      formatQuestion(question),
      {
        parse_mode: "Markdown",
        ...gameKeyboard()
      }
    );
    await ctx.answerCbQuery();
    return;
  }
  
  if (callbackData === "end_game") {
    if (!userState.gameActive) {
      await ctx.answerCbQuery("No active game");
      return;
    }
    
    const count = userState.questionsAsked.length;
    userState.gameActive = false;
    userState.currentEdition = null;
    userState.currentQuestion = null;
    
    await ctx.editMessageText(
      `🏁 Game ended!\n\nYou discussed ${count} question${count !== 1 ? "s" : ""}.\n\nUse /start to play again!`,
      mainMenuKeyboard()
    );
    await ctx.answerCbQuery();
    return;
  }
  
  if (callbackData.startsWith("play_")) {
    const edition = callbackData.replace("play_", "");
    const chatId = ctx.callbackQuery.message?.chat?.id;
    const userState = getState(chatId);
    
    if (edition === "random") {
      const editionKeys = Object.keys(editions);
      userState.currentEdition = editionKeys[Math.floor(Math.random() * editionKeys.length)];
    } else {
      userState.currentEdition = edition;
    }
    
    userState.gameActive = true;
    userState.questionsAsked = [];
    
    const question = getRandomQuestion(userState.currentEdition);
    userState.currentQuestion = question;
    userState.questionsAsked.push(question.text);
    
    await ctx.editMessageText(
      `🎮 Playing *${editions[userState.currentEdition].name}*\n\n---\n` + formatQuestion(question),
      {
        parse_mode: "Markdown",
        ...gameKeyboard()
      }
    );
    await ctx.answerCbQuery();
    return;
  }
  
  await ctx.answerCbQuery("Unknown action");
});

bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("Something went wrong. Please try again.");
});

export default function handler(req, res) {
  if (req.method === "POST") {
    bot.handleUpdate(req.body, res);
  } else {
    res.status(200).send("OK");
  }
}