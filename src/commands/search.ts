import { Context, InlineKeyboard } from "grammy";
import { paginationHistory } from "../../app";
import { checkMovieAvailability } from "../../utils";

interface MovieResult {
    id: number;
    title: string;
    overview: string;
    poster_path: string;
    release_date: string;
    vote_average: number;
}

interface TMDBResponse {
    results: MovieResult[];
    total_results: number;
    total_pages: number;
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";
const MAX_SEARCH_LENGTH = 100;
const SEARCH_TIMEOUT = 10000;

const validateAndCleanSearch = (search: string): string | null => {
    if (!search || typeof search !== 'string') {
        return null;
    }
    const cleaned = search.trim();
    if (cleaned.length === 0 || cleaned.length > MAX_SEARCH_LENGTH) {
        return null;
    }
    return cleaned;
};

const performSearch = async (query: string): Promise<TMDBResponse | null> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);
        const response = await fetch(
            `${TMDB_BASE_URL}/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR&include_adult=false`,
            {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                }
            }
        );
        clearTimeout(timeoutId);
        if (!response.ok) {
            console.error(`❌ API TMDB error: ${response.status} ${response.statusText}`);
            return null;
        }
        const data: TMDBResponse = await response.json();
        const availabilityChecks = await Promise.all(
            data.results.map(async (movie) => ({
              movie,
              available: await checkMovieAvailability(movie.id),
            }))
          );
        const resultsAvailable = availabilityChecks
            .filter(result => result.available)
            .map(result => result.movie);
        return {
            ...data,
            results: resultsAvailable
        };
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                console.error("❌ TMDB search timeout");
            } else {
                console.error("❌ TMDB search error:", error.message);
            }
        }
        return null;
    }
};

const formatMovieDescription = (movie: MovieResult): string => {
    const title = movie.title || "Unknown title";
    const overview = movie.overview || "No description available.";
    const releaseDate = movie.release_date ? new Date(movie.release_date).getFullYear() : "Unknown date";
    const rating = movie.vote_average ? `⭐ ${movie.vote_average.toFixed(1)}/10` : "";
    return `🎬 *${title}* (${releaseDate})\n\n${overview}\n\n${rating}`;
};

export const searchCommand = async (ctx: Context) => {
    try {
        const searchText = typeof ctx.match === 'string' ? ctx.match : ctx.message?.text || "";
        if (searchText === "/search") {
            await ctx.reply("🫤 Please specify the name of the movie or series you want to search for.\n\nExample: `/search Avengers`", {
                parse_mode: "Markdown"
            });
            return;
        }
        const cleanedSearch = validateAndCleanSearch(searchText);
        if (!cleanedSearch) {
            await ctx.reply("❌ Invalid search. Please enter a valid movie title (max 100 characters).");
            return;
        }
        const loadingMessage = await ctx.reply("🔍 Searching...");
        const data = await performSearch(cleanedSearch);
        try {
            await ctx.api.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
        } catch (error) {}
        if (!data || !data.results || data.results.length === 0) {
            await ctx.reply("😔 No movie found for your search. Please try with another title.");
            return;
        }
        const chatId = ctx.chat?.id || ctx.from?.id || 0;
        paginationHistory[chatId] = {
            searchResults: data.results,
            currentIndex: 0,
            timestamp: Date.now(),
        };
        const currentMovie = data.results[0];
        const paginationKeyboard = createPaginationKeyboard(0, data.results.length, ctx);
        await ctx.replyWithPhoto(
            `${TMDB_IMAGE_BASE_URL}${currentMovie.poster_path}`,
            {
                caption: `${formatMovieDescription(currentMovie)}\n\n📊 Page 1/${data.results.length}`,
                parse_mode: "Markdown",
                reply_markup: paginationKeyboard,
            }
        );
    } catch (error) {
        console.error("❌ Error during search:", error);
        await ctx.reply("😔 Sorry, an error occurred during the search. Please try again.");
    }
};

export const createPaginationKeyboard = (currentIndex: number, totalResults: number, ctx: Context): InlineKeyboard => {
    const keyboard = new InlineKeyboard();
    if (currentIndex > 0) {
        keyboard.text("‹", `prev_${currentIndex}`);
    }
    keyboard.url("🌐", `${process.env.CINEPULSE_MAIN}/sheet/movie-${paginationHistory[ctx.chat?.id || ctx.from?.id || 0].searchResults[paginationHistory[ctx.chat?.id || ctx.from?.id || 0].currentIndex].id}`);
    keyboard.text("⬇️", `watch_${currentIndex}`);
    if (currentIndex < totalResults - 1) {
        keyboard.text("›", `next_${currentIndex}`);
    }
    return keyboard;
};