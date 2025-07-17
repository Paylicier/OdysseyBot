export const checkMovieAvailability = async (movieId: number) => {
    const response = await fetch(`${process.env.CINEPULSE_API}/sheet/details?type=movie&tmdbId=${movieId}`);
    return response.ok;
};

function generateRandomKey(length: number = 8): string {
    const chars = "abceghjklmnopqrtuvwxyzABCEGHIJKLMNOPQRTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * 55)];
    }
    return result;
}

function encodeValue(value: string | number, type: string): string {
    const valueStr = String(value);

    if (type === "id") {
        let encoded = "";
        for (const char of valueStr) {
            if (/\d/.test(char)) {
                encoded += String((parseInt(char) + 7) % 10);
            } else {
                encoded += char;
            }
        }
        return `c${btoa(encoded)}`;
    }

    if (type === "type") {
        let encoded = "";
        const key = "k";
        for (let i = 0; i < valueStr.length; i++) {
            encoded += String.fromCharCode(valueStr.charCodeAt(i) ^ key.charCodeAt(0));
        }
        return `t${btoa(encoded)}`;
    }

    if (type === "season") {
        const numValue = parseInt(valueStr);
        const shifted = String(numValue + 5);
        let encoded = "";
        for (const char of shifted) {
            encoded += String((parseInt(char) + 3) % 10);
        }
        return `s${encoded}`;
    }

    if (type === "episode") {
        const numValue = parseInt(valueStr);
        const shifted = String(numValue + 9);
        let encoded = "";
        for (const char of shifted) {
            encoded += String((parseInt(char) + 4) % 10);
        }
        return `e${encoded}`;
    }

    if (type === "exp") {
        const hexString = Array.from(valueStr)
            .map(char => char.charCodeAt(0).toString(16))
            .join("");
        return `x${btoa(hexString)}`;
    }

    return `d${btoa(valueStr)}`;
}

interface ObfuscateParams {
    tmdbId?: string | number;
    type?: string;
    season?: number;
    episode?: number;
}

function obfuscateParams(params: ObfuscateParams): Record<string, string> {
    const result: Record<string, string> = {};
    const expiration = Date.now() + 60000;

    result[generateRandomKey()] = encodeValue(expiration, "exp");

    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) {
            continue;
        }

        let encodeType = key.substring(0, 2);
        if (key === "tmdbId") {
            encodeType = "id";
        } else if (key === "type") {
            encodeType = "type";
        } else if (key === "season") {
            encodeType = "season";
        } else if (key === "episode") {
            encodeType = "episode";
        }

        result[generateRandomKey()] = encodeValue(value, encodeType);
    }

    const junkLetters = ["q", "w", "p", "z", "h", "j"];
    const junkCount = 10 + Math.floor(Math.random() * 10);

    for (let i = 0; i < junkCount; i++) {
        const junkPrefix = junkLetters[Math.floor(Math.random() * junkLetters.length)];
        const junkValue = btoa(generateRandomKey(8 + Math.floor(Math.random() * 8)));
        result[generateRandomKey()] = `${junkPrefix}${junkValue}`;
    }

    return result;
}

function generateWatchSourcesUrl(
    baseUrl: string,
    tmdbId: string | number,
    mediaType: string,
    season: number = -1,
    episode: number = -1
): string {
    const params: ObfuscateParams = {
        tmdbId,
        type: mediaType,
        ...(season !== -1 && { season }),
        ...(episode !== -1 && { episode })
    };

    const obfuscatedParams = obfuscateParams(params);
    const queryString = new URLSearchParams(obfuscatedParams).toString();
    return `${baseUrl}/watch/sources?${queryString}`;
}

export const getMovieSources = async (movieId: number): Promise<any[]> => {
    try {
        const url = generateWatchSourcesUrl(
            process.env.CINEPULSE_API as string,
            movieId.toString(),
            'movie'
        );

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();

        return Array.isArray(data.data?.items) ? data.data?.items : [];

    } catch (error) {
        console.error('Error fetching movie sources:', error);
        return [];
    }
};

export const getSeriesSources = async (seriesId: number, season: number, episode: number): Promise<any[]> => {
    try {
        const url = generateWatchSourcesUrl(
            process.env.CINEPULSE_API as string,
            seriesId.toString(),
            'tv',
            season,
            episode
        );

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();

        return Array.isArray(data.data?.items) ? data.data?.items : [];

    } catch (error) {
        console.error('Error fetching series sources:', error);
        return [];
    }
};

export const getSeriesSeasonsAndEpisodes = async (seriesId: number): Promise<any> => {
    try {
        const response = await fetch(
            `https://api.themoviedb.org/3/tv/${seriesId}?api_key=${process.env.TMDB_API_KEY}&language=${process.env.LANG}`
        );
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        const data = await response.json();
        return data.seasons;
    } catch (error) {
        console.error('Erreur lors de la récupération des saisons:', error);
        return [];
    }
};

export const getEpisodesForSeason = async (seriesId: number, seasonNumber: number): Promise<any> => {
    try {
        const response = await fetch(
            `https://api.themoviedb.org/3/tv/${seriesId}/season/${seasonNumber}?api_key=${process.env.TMDB_API_KEY}&language=${process.env.LANG}`
        );
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        const data = await response.json();
        return data.episodes;
    } catch (error) {
        console.error('Erreur lors de la récupération des épisodes:', error);
        return [];
    }
};
