import { Context } from "grammy";
import { getMovieSources } from "../../utils";
import { getSeriesSources } from "../../utils";
import { m3u8History } from "../../app";
import { createHash } from "crypto";
import { paginationHistory } from "../../app";

export const description = "Download a movie or a series";

export const downloadCommand = async (ctx: Context, idOrArgs?: string) => {
    let movieId: number | undefined;
    let seriesId: number | undefined;
    let season: number | undefined;
    let episode: number | undefined;
    let isSeries = false;

    const arg = idOrArgs?.toString() || ctx.match?.toString() || "";
    const serieMatch = arg.match(/^serie:(\d+):(\d+):(\d+)$/i);
    if (serieMatch) {
        isSeries = true;
        seriesId = Number(serieMatch[1]);
        season = Number(serieMatch[2]);
        episode = Number(serieMatch[3]);
    } else {
        movieId = Number(arg) || Number(ctx.match);
    }

    let sources: any[] = [];
    if (isSeries && seriesId && season && episode) {
        sources = await getSeriesSources(seriesId, season, episode);
    } else if (movieId) {
        sources = await getMovieSources(movieId);
    } else {
        await ctx.reply("Please provide a movie or series identifier in the format:\n- movie: `/download 1234`\n- series: `/download serie:1234:1:2` (id, season, episode)");
        return;
    }

    if (!sources.length) {
        await ctx.reply("No sources found for this content.");
        return;
    }

    const sourceButtons = sources.map((source: any) => {
        if (source.url && source.url.includes('.m3u8')) {
            const hash = createHash("sha256").update(source.url).digest("hex").slice(0, 16)
            let meta: any = { url: source.url };
            if (isSeries && seriesId && season && episode) {
                let seriesName = '';
                const chatId = ctx.chat?.id || ctx.from?.id || 0;
                const history = paginationHistory[chatId];
                if (history && history.type === 'tv') {
                    const current = history.searchResults[history.currentIndex];
                    seriesName = current.name || current.title || '';
                }
                meta = {
                    url: source.url,
                    type: 'series',
                    name: seriesName,
                    season: season,
                    episode: episode
                };
            } else if (movieId) {
                let movieName = '';
                const chatId = ctx.chat?.id || ctx.from?.id || 0;
                const history = paginationHistory[chatId];
                if (history && history.type !== 'tv') {
                    const current = history.searchResults[history.currentIndex];
                    movieName = current.title || '';
                }
                meta = {
                    url: source.url,
                    type: 'movie',
                    name: movieName
                };
            }
            m3u8History[hash] = meta;
            return {
                text: "🎥 " + source.label,
                callback_data: `m3u8_${hash}`
            }
        }
        return {
            text: "🎥 " + source.label,
            url: source.url
        }
    });
    await ctx.reply(
        isSeries ? `🎥 Available sources for the series (S${season}E${episode}):` : `🎥 Available sources for the movie:`,
        {
            reply_markup: {
                inline_keyboard: [sourceButtons]
            }
        }
    )
};
