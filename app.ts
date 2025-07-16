import { Bot } from "grammy";
import { registerCommands } from "./src/commands";
import { createPaginationKeyboard, searchCommand } from "./src/commands/search";
import { downloadCommand } from "./src/commands/download";

const BOT_TOKEN = process.env.BOT_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!BOT_TOKEN) {
    console.error("❌ Error: BOT_TOKEN is not defined in environment variables");
    console.log("💡 Create a .env file with: BOT_TOKEN=your_token_here");
    process.exit(1);
}

if (!TMDB_API_KEY) {
    console.error("❌ Error: TMDB_API_KEY is not defined in environment variables");
    console.log("💡 Create a .env file with: TMDB_API_KEY=your_api_key_here");
    process.exit(1);
}

interface PaginationData {
    searchResults: any[];
    currentIndex: number;
    timestamp: number;
}

export const paginationHistory: Record<number, PaginationData> = {};

const cleanupOldHistory = () => {
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    
    Object.keys(paginationHistory).forEach(key => {
        const chatId = parseInt(key);
        if (now - paginationHistory[chatId].timestamp > thirtyMinutes) {
            delete paginationHistory[chatId];
        }
    });
};

setInterval(cleanupOldHistory, 10 * 60 * 1000);

const bot = new Bot(BOT_TOKEN);

registerCommands(bot);

bot.on("message", async (ctx) => {
    try {
        if (ctx.message?.text && !ctx.message.text.startsWith('/')) {
            await searchCommand(ctx);
        }
    } catch (error) {
        console.error("❌ Error while processing the message:", error);
        await ctx.reply("😔 Désolé, une erreur s'est produite. Veuillez réessayer.");
    }
});

bot.on('callback_query:data', async (ctx) => {
    try {
        const { data } = ctx.callbackQuery;
        const [action, index] = data.split("_");
        const chatId = ctx.chat?.id || ctx.from?.id || 0;
        
        if (!paginationHistory[chatId]) {
            await ctx.answerCallbackQuery("⚠️ Session expirée. Veuillez effectuer une nouvelle recherche.");
            return;
        }
        
        const history = paginationHistory[chatId];
        
        if (action === "prev") {
            history.currentIndex = Math.max(0, history.currentIndex - 1);
        } else if (action === "next") {
            history.currentIndex = Math.min(history.searchResults.length - 1, history.currentIndex + 1);
        } else if (action === "watch") {
            await downloadCommand(ctx, history.searchResults[history.currentIndex].id);
            return;
        }
        
        history.timestamp = Date.now();
        
        const currentMovie = history.searchResults[history.currentIndex];
        
        await ctx.answerCallbackQuery();
        
        await ctx.editMessageMedia({
            media: `https://image.tmdb.org/t/p/original${currentMovie.poster_path}`,
            type: "photo",
        });
        
        await ctx.editMessageCaption({
            caption: `🎬 *${currentMovie.title}*\n\n${currentMovie.overview || "Aucune description disponible."}\n\n📊 Page ${history.currentIndex + 1}/${history.searchResults.length}`,
            parse_mode: "Markdown",
            reply_markup: createPaginationKeyboard(history.currentIndex, history.searchResults.length, ctx),
        });
        
    } catch (error) {
        console.error("❌ Error while processing the callback query:", error);
        await ctx.answerCallbackQuery("❌ Une erreur s'est produite");
    }
});

bot.catch((err) => {
    console.error("❌ Bot error:", err);
    if (process.env.NODE_ENV === 'development') {
        console.error("Stack trace:", err.stack);
    }
});

async function startBot() {
    try {
        console.log("🚀 Starting Telegram bot...");

        const botInfo = await bot.api.getMe();
        
        console.log(`✅ Bot started successfully!`);
        console.log(`🤖 Bot name: ${botInfo.first_name}`);
        console.log(`🆔 Bot ID: ${botInfo.id}`);
        console.log(`👤 Username: @${botInfo.username}`);
        console.log(`📡 Mode: ${botInfo.can_join_groups ? "Group + Private" : "Private only"}`);
        console.log("🎯 The bot is ready to receive messages!");

        await bot.start();
        
    } catch (error) {
        console.error("❌ Error while starting the bot:", error);
        process.exit(1);
    }
}

process.once("SIGINT", async () => {
    console.log("🛑 Stopping the bot...");
    await bot.stop();
    process.exit(0);
});

process.once("SIGTERM", async () => {
    console.log("🛑 Stopping the bot...");
    await bot.stop();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error("❌ Uncaught error:", error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error("❌ Unhandled rejected promise:", reason);
    process.exit(1);
});

startBot();