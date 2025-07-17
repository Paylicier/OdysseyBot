import { Context } from "grammy";
import { m3u8History } from "../../app";
import { createHash } from "crypto";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export const description = "Convert an m3u8 file to mp4";

export const convertCommand = async (ctx: Context, urlOrMeta?: string | { url: string, type: 'movie' | 'series', name: string, season?: number, episode?: number }) => {
    let url: string | undefined;
    let type: 'movie' | 'series' = 'movie';
    let name = '';
    let season: number | undefined;
    let episode: number | undefined;

    console.log(urlOrMeta)

    if (typeof urlOrMeta === 'object' && urlOrMeta !== null) {
        url = urlOrMeta.url;
        type = urlOrMeta.type;
        name = urlOrMeta.name;
        season = urlOrMeta.season;
        episode = urlOrMeta.episode;
    } else {
        url = urlOrMeta || ctx.match?.toString();
    }

    if (url && url.length < 40 && m3u8History[url]) {
        url = m3u8History[url];
    }

    if (!url) {
        await ctx.reply("m3u8 URL not provided or unknown.");
        return;
    }

    const statusMsg = await ctx.reply("Conversion in progress...");

    let outputPath = '';
    if (type === 'series' && name && season && episode) {
        const safeName = name.replace(/[^a-zA-Z0-9\-_ ]/g, '_');
        const seasonStr = `S${String(season).padStart(2, '0')}`;
        const episodeStr = `E${String(episode).padStart(2, '0')}`;
        const dir = path.join(__dirname, `../../videos/series/${safeName}/${seasonStr}`);
        fs.mkdirSync(dir, { recursive: true });
        outputPath = path.join(dir, `${episodeStr}.mp4`);
    } else if (type === 'movie' && name) {
        const safeName = name.replace(/[^a-zA-Z0-9\-_ ]/g, '_');
        const dir = path.join(__dirname, `../../videos/movies/`);
        fs.mkdirSync(dir, { recursive: true });
        outputPath = path.join(dir, `${safeName}.mp4`);
    } else {
        outputPath = path.join(__dirname, `../../videos/output_${Date.now()}.mp4`);
    }

    const ffmpeg = spawn("ffmpeg", [
        "-i", url,
        "-c", "copy",
        "-bsf:a", "aac_adtstoasc",
        outputPath
    ]);

    let lastPercent = 0;
    let interval = setInterval(() => {
        if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            const percent = Math.min(99, Math.floor(stats.size / 1000000));
            if (percent !== lastPercent && ctx.chat) {
                ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `Conversion in progress... ${percent}%`);
                lastPercent = percent;
            }
        }
    }, 2000);

    ffmpeg.on("close", async (code) => {
        clearInterval(interval);
        if (code === 0 && fs.existsSync(outputPath)) {
            if (ctx.chat) {
                await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `Conversion complete, file available at: ${outputPath}`);
            }
        } else {
            if (ctx.chat) {
                await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "Error during conversion.");
            }
        }
    });
};
