# Odyssey 🎥

A Telegram bot to search, download, and convert movies and series using cinepulse's api.

## Features
- Search for movies and TV series via Telegram
- Download movies or specific episodes of series
- Convert m3u8 streams to mp4 files
- Pagination and navigation for search results
- Simple and clear user interface

## Prerequisites
- [Bun](https://bun.com)
- [ffmpeg](https://ffmpeg.org/) installed and available in your PATH
- A Telegram bot token ([How to get one?](https://core.telegram.org/bots#6-botfather))
- A TMDB API key ([Get one here](https://www.themoviedb.org/settings/api))
- Cinepulse's current URL

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Paylicier/OdysseyBot
   cd OdysseyBot
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Configure environment variables**
   Edit the .env file to add your things

4. **Start the bot**
   ```bash
   bun app.ts
   ```

## Usage

Send a serie or film name to the bot then follow its instructions. Non-m3u8 sources (like mp4) will be displayed as links

### Conversion
When you select a source, the bot will convert the m3u8 stream to mp4 and send you a message when the file is ready.

## Notes
- As Cinepulse is french, downloaded medias will be in french.
- Make sure ffmpeg is installed and accessible from your command line.
- The bot will create folders for movies and series automatically.
- For best results, run the bot on a server with good bandwidth and disk space.
