# Dota 2 stream custom emoji

The bot uses the published [`Dota 2 Stream Providers`](https://t.me/addemoji/Dota2StreamProviders)
pack. Its public custom emoji IDs are already configured in `src/bot/streams.ts`.

## Ready-to-upload files

Every file in `upload/` is a static, full-color, lossless 100x100 WEBP with a transparent margin.
Upload them as files in numeric order and keep adaptive repainting disabled. The **Pack emoji**
values are used only to assign files in @Stickers and as Telegram's mandatory placeholders inside
custom emoji entities. Telegram may display a placeholder where the custom emoji cannot be rendered,
such as a system notification or a forwarded message. The bot never uses these placeholders as
standalone provider labels.

| Order | File               | Provider | Pack emoji | Source                                                                                                                   |
| ----: | ------------------ | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
|     1 | `01-facebook.webp` | Facebook | 🔵         | [Google Play](https://play.google.com/store/apps/details?id=com.facebook.katana)                                         |
|     2 | `02-kick.webp`     | Kick     | 🟢         | [Google Play](https://play.google.com/store/apps/details?id=com.kick.mobile)                                             |
|     3 | `03-steam.webp`    | Steam    | ⚙️         | [Google Play](https://play.google.com/store/apps/details?id=com.valvesoftware.android.steam.community)                   |
|     4 | `04-trovo.webp`    | Trovo    | 🟩         | [Google Play](https://web.archive.org/web/20250926000000/https://play.google.com/store/apps/details?id=com.tlive.madcat) |
|     5 | `05-twitch.webp`   | Twitch   | 🟣         | [Google Play](https://play.google.com/store/apps/details?id=tv.twitch.android.app)                                       |
|     6 | `06-vk-video.webp` | VK Video | 🔷         | [Google Play](https://play.google.com/store/apps/details?id=com.vk.vkvideo)                                              |
|     7 | `07-youtube.webp`  | YouTube  | 🔴         | [Google Play](https://play.google.com/store/apps/details?id=com.google.android.youtube)                                  |

## Rebuild or replace an icon

Install [ImageMagick](https://imagemagick.org/), download a high-resolution icon from the relevant
source and convert it to Telegram's static custom emoji format:

```sh
magick input.png \
  -background none \
  -resize '88x88>' \
  -gravity center \
  -extent 100x100 \
  -define webp:lossless=true \
  upload/NN-provider.webp
```

Use a transparent input when possible. If the source contains unwanted padding or a background,
clean it before conversion. Verify the result with:

```sh
magick identify -format '%f %wx%h\n' upload/*.webp
```

Telegram accepts static custom emoji as PNG or WEBP at exactly 100x100 pixels. Create an independent
pack through [@Stickers](https://t.me/Stickers), assign the ordinary emoji from the table, publish
it, then replace the corresponding `customEmojiId` values in `src/bot/streams.ts` and run
`bun check`.
