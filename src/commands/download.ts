import { Context } from "grammy";
import { getMovieSources } from "../../utils";

export const description = "Télécharger un film";

export const downloadCommand = async (ctx: Context, movieId?: number) => {
    movieId = movieId || Number(ctx.match);
    const sources = await getMovieSources(movieId || 0);
    const sourceButtons = sources.map((source: any) => {
        return {
            text: "🎥 "+source.label,
            url: source.url
        }
    });
    await ctx.reply(
        `🎥 Sources disponibles pour le film:`,
        {
            reply_markup: {
                inline_keyboard: [sourceButtons]
            }
        }
    )
};