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

interface TVResult {
    id: number;
    name: string;
    overview: string;
    poster_path: string;
    first_air_date: string;
    vote_average: number;
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";
const IMAGE_NOT_FOUND_URL = "https://placehold.co/853x1280.png?text=Cover\n%20Not%20Found"
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

const performSearch = async (query: string, type: 'movie' | 'tv'): Promise<TMDBResponse | null> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);
        const response = await fetch(
            `${TMDB_BASE_URL}/search/${type}?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=${process.env.LANG}&include_adult=false`,
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
        const data = await response.json();
        if (type === 'movie') {
            const availabilityChecks = await Promise.all(
                data.results.map(async (movie: any) => ({
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
        } else {
            return data;
        }
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

const formatTVDescription = (tv: TVResult): string => {
    const title = tv.name || "Unknown title";
    const overview = tv.overview || "No description available.";
    const releaseDate = tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : "Unknown date";
    const rating = tv.vote_average ? `⭐ ${tv.vote_average.toFixed(1)}/10` : "";
    return `📺 *${title}* (${releaseDate})\n\n${overview}\n\n${rating}`;
};

export const searchCommand = async (ctx: Context) => {
    try {
        const searchText = typeof ctx.match === 'string' ? ctx.match : ctx.message?.text || "";
        if (searchText === "/search") {
            await ctx.reply("🫤 Please specify the name of the movie or series to search for.\n\nExample: `/search Avengers`", {
                parse_mode: "Markdown"
            });
            return;
        }
        const cleanedSearch = validateAndCleanSearch(searchText);
        if (!cleanedSearch) {
            await ctx.reply("❌ Invalid search. Please enter a valid title (max 100 characters).");
            return;
        }
        const keyboard = new InlineKeyboard()
            .text("🎬 Movie", `searchtype_movie_${cleanedSearch}`)
            .text("📺 Series", `searchtype_tv_${cleanedSearch}`);
        await ctx.reply("What type of content do you want to search for?", { reply_markup: keyboard });
    } catch (error) {
        console.error("❌ Error during search:", error);
        await ctx.reply("😔 Sorry, an error occurred during the search. Please try again.");
    }
};

export const handleSearchType = async (ctx: Context) => {
    const data = ctx.callbackQuery?.data || "";
    const match = data.match(/^searchtype_(movie|tv)_(.+)$/);
    if (!match) return;
    const type = match[1] as 'movie' | 'tv';
    const query = match[2];
    await ctx.answerCallbackQuery();
    const loadingMessage = await ctx.reply("🔍 Searching...");
    const results = await performSearch(query, type);
    try {
        await ctx.api.deleteMessage(ctx.chat!.id, loadingMessage.message_id);
    } catch (error) { }
    if (!results || !results.results || results.results.length === 0) {
        await ctx.reply("😔 No results found for your search.");
        return;
    }
    const chatId = ctx.chat?.id || ctx.from?.id || 0;
    paginationHistory[chatId] = {
        searchResults: results.results,
        currentIndex: 0,
        timestamp: Date.now(),
        type,
    };
    const current = results.results[0];
    const paginationKeyboard = createPaginationKeyboard(0, results.results.length, ctx, type);
    await ctx.replyWithPhoto(
        current.poster_path ? `${TMDB_IMAGE_BASE_URL}${current.poster_path}` : `${IMAGE_NOT_FOUND_URL}`,
        {
            caption: type === 'movie' ? `${formatMovieDescription(current)}\n\n📊 Page 1/${results.results.length}` : `${formatTVDescription(current as unknown as TVResult)}\n\n📊 Page 1/${results.results.length}`,
            parse_mode: "Markdown",
            reply_markup: paginationKeyboard,
        }
    );
};

export const createPaginationKeyboard = (currentIndex: number, totalResults: number, ctx: Context, type: 'movie' | 'tv' = 'movie'): InlineKeyboard => {
    const keyboard = new InlineKeyboard();
    if (currentIndex > 0) {
        keyboard.text("‹", `prev_${currentIndex}`);
    }
    const id = paginationHistory[ctx.chat?.id || ctx.from?.id || 0].searchResults[paginationHistory[ctx.chat?.id || ctx.from?.id || 0].currentIndex].id;
    if (type === 'movie') {
        keyboard.url("🌐", `${process.env.CINEPULSE_MAIN}/sheet/movie-${id}`);
        keyboard.text("⬇️", `watch_${currentIndex}`);
    } else {
        keyboard.url("🌐", `${process.env.CINEPULSE_MAIN}/sheet/tv-${id}`);
        keyboard.text("⬇️", `watchtv_${currentIndex}`);
    }
    if (currentIndex < totalResults - 1) {
        keyboard.text("›", `next_${currentIndex}`);
    }
    return keyboard;
};
