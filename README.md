> [!CAUTION]  
> This repository is for educational purposes only. Downloading or sharing copyrighted content (aka movues/series) without authorization is illegal in many places and can lead to severe penalties. You are solely responsible for understanding and complying with all applicable laws in your jurisdiction. To prevent illicit usage of this tool, cinepulse's current url isn't included in this repo

# Odyssey 🎥

A simple telegram bot to download your favorite movies and series from cinepulse (private/unofficial) api.

## How ?

The bot fetches tmdb's api to get your content's tmdb id then get the source list from cinepulse's reverse engineered api.
If the source provides a mp4 file, the bot will give you the link to that mp4 file. Else, if the source provides a m3u8 playlist file, it will use ffmpeg to download the content from the m3u8 file.

## Installation

### Prerequisites
- [Bun](https://bun.com)
- FFMPEG
- A Telegram bot token
- A TMDB api key
- Cinepulse's current url

### Steps

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

5. **Start the bot**
   ```bash
   bun app.ts
   ```

### Usage

Send a serie or film name to the bot then follow its instructions. Non-m3u8 sources (like mp4) will be displayed as links, m3u8 sources will be displayed as buttons

After downloading an m3u8 file, the bot will give you its output path

> [!NOTE]  
> The downloaded media is in french as cinepulse in a french streaming website

## Screenshots

<img width="543" height="757" alt="image" src="https://github.com/user-attachments/assets/793ae527-cc00-4d00-b357-cf578b575ea2" />

<img width="403" height="399" alt="image" src="https://github.com/user-attachments/assets/f4c44f97-f9e6-4242-8f9b-2d2c3579954e" />
