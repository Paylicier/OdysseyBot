import { Bot } from "grammy";
import { registerCommands } from "./src/commands";
import { createPaginationKeyboard, searchCommand, handleSearchType } from "./src/commands/search";
import { downloadCommand } from "./src/commands/download";
import { convertCommand } from "./src/commands/convert";
import { getSeriesSeasonsAndEpisodes, getEpisodesForSeason } from "./utils";

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
    type?: 'movie' | 'tv';
}

export const paginationHistory: Record<number, PaginationData> = {};
export const m3u8History: Record<string, string> = {};

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
        await ctx.reply("😔 Sorry, an error occurred. Please try again.");
    }
});

bot.on('callback_query:data', async (ctx) => {
    try {
        const { data } = ctx.callbackQuery;
        if (data.startsWith('searchtype_')) {
            await handleSearchType(ctx);
            return;
        }
        const [action, index] = data.split("_");
        const chatId = ctx.chat?.id || ctx.from?.id || 0;

        if (!paginationHistory[chatId]) {
            await ctx.answerCallbackQuery("⚠️ Session expired. Please perform a new search.");
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
        } else if (action === "watchtv") {
            const serie = history.searchResults[history.currentIndex];
            const seasons = await getSeriesSeasonsAndEpisodes(serie.id);
            if (!seasons.length) {
                await ctx.reply("No seasons found for this series.");
                return;
            }
            const keyboard = { inline_keyboard: [] as any[] };
            for (const season of seasons) {
                if (season.season_number === 0) continue;
                keyboard.inline_keyboard.push([
                    { text: `Season ${season.season_number} (${season.episode_count} episodes)`, callback_data: `selectseason_${serie.id}_${season.season_number}` }
                ]);
            }
            await ctx.reply("Select a season:", { reply_markup: keyboard });
            return;
        } else if (action === "selectseason") {
            const [_, serieId, seasonNumber] = data.split("_");
            const episodes = await getEpisodesForSeason(Number(serieId), Number(seasonNumber));
            if (!episodes.length) {
                await ctx.reply("No episodes found for this season.");
                return;
            }
            const keyboard = { inline_keyboard: [] as any[] };
            for (const ep of episodes) {
                keyboard.inline_keyboard.push([
                    { text: `Episode ${ep.episode_number} - ${ep.name}`, callback_data: `downloadep_${serieId}_${seasonNumber}_${ep.episode_number}` }
                ]);
            }
            keyboard.inline_keyboard.push([
                { text: "⬇️ Download the whole season", callback_data: `downloadseason_${serieId}_${seasonNumber}` }
            ]);
            await ctx.reply(`Season ${seasonNumber}: choose an episode or the whole season`, { reply_markup: keyboard });
            return;
        } else if (action === "downloadep") {
            const [_, serieId, seasonNumber, episodeNumber] = data.split("_");
            await downloadCommand(ctx, `serie:${serieId}:${seasonNumber}:${episodeNumber}`);
            return;
        } else if (action === "downloadseason") {
            const [_, serieId, seasonNumber] = data.split("_");
            const episodes = await getEpisodesForSeason(Number(serieId), Number(seasonNumber));
            if (!episodes.length) {
                await ctx.reply("No episodes found for this season.");
                return;
            }
            await ctx.reply(`Downloading season ${seasonNumber} (${episodes.length} episodes)...`);
            for (const ep of episodes) {
                await downloadCommand(ctx, `serie:${serieId}:${seasonNumber}:${ep.episode_number}`);
            }
            return;
        } else if (action === "m3u8") {
            let meta: any = m3u8History[index];
            console.log(m3u8History[index])
            const chatId = ctx.chat?.id || ctx.from?.id || 0;
            const history = paginationHistory[chatId];
            if (history && history.type === 'tv') {
                const current = history.searchResults[history.currentIndex];
                meta.type = 'series';
                meta.name = current.name || current.title || '';
            } else if (history) {
                const current = history.searchResults[history.currentIndex];
                meta.type = 'movie';
                meta.name = current.title || '';
            }
            await convertCommand(ctx, meta);
            return;
        }

        history.timestamp = Date.now();

        const current = history.searchResults[history.currentIndex];
        await ctx.answerCallbackQuery();
        await ctx.editMessageMedia({
            media: `https://image.tmdb.org/t/p/original${current.poster_path}`,
            type: "photo",
        });
        let caption = "";
        if (history.type === 'tv') {
            caption = `📺 *${current.name}*\n\n${current.overview || "No description available."}\n\n📊 Page ${history.currentIndex + 1}/${history.searchResults.length}`;
        } else {
            caption = `🎬 *${current.title}*\n\n${current.overview || "No description available."}\n\n📊 Page ${history.currentIndex + 1}/${history.searchResults.length}`;
        }
        await ctx.editMessageCaption({
            caption,
            parse_mode: "Markdown",
            reply_markup: createPaginationKeyboard(history.currentIndex, history.searchResults.length, ctx, history.type || 'movie'),
        });
    } catch (error) {
        console.error("❌ Error while processing the callback query:", error);
        await ctx.answerCallbackQuery("❌ An error occurred");
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
