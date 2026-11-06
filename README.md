# MW Chat

Live chat for westchesterguy.com and westchesterhorseproperties.com, answered by
Michael from his own app. It replaces Tawk.to.

- **Visitors** get a chat button on either site. They answer a short pre-chat
  questionnaire, then message Michael live.
- **Michael** uses the chat app at `/chatapp` (it was `/admin`; old links
  redirect). It can be installed on a phone
  from the browser and wrapped as an Android APK. It shows every chat with the
  site it started on, the page the visitor is on right now, their country, city
  and IP address, and their answers. He edits the questionnaire in Settings.
- **Lead emails.** Each new chat is emailed to the addresses entered in
  Settings, Lead emails: the answers, first message, the page it started on,
  location and IP address, with the visitor as Reply-To. Every lead, or only
  those that arrive while he is away. A test button there proves delivery.
- **When Michael is away** (the switch at the top of the app), the visitor is
  told he has their message and will follow up.
- **Photos and PDFs** can be sent by either side from the paperclip in the
  reply bar (or pasted or dropped there). Photos are shrunk in the browser to
  1600 px before upload; files are capped at 4 MB, checked by their contents,
  kept in the database and served only through this app.
- **Call and Email** buttons sit under the visitor's name in a chat once a
  phone number or email is known, from the pre-chat questions or typed in
  the chat.
- **A greeting** draws visitors to the chat: once per visit, after 8 seconds
  or half a page of scrolling, a ring spreads from the chat button and a card
  with Michael's photo "types" a line matched to the page (a town page names
  the town; the horse site and Away have their own). The lines are in
  `src/app/api/v/teaser/route.ts`. Closing it keeps it away for a week.
- **The rescue.** While Michael is online, a visitor who waits 3 minutes
  (set on the developer page) after their last message with no reply gets a
  message saying he has their details and will follow up, and Michael gets a
  second notification and email. Once per chat until he replies. It runs
  when the visitor's browser checks in (no scheduler needed). If Michael
  replies after a visitor has left the site, his messages are emailed to
  them half a minute later, with a link that reopens the chat (`#mwchat`).
- **Notifications** reach his phone when a chat starts or a visitor writes,
  through Web Push. No Firebase project is needed. Sent as high urgency (so
  the push service can wake a phone saving battery) and kept 24 hours for a
  phone that is off or out of signal. A visitor's message skips the phone
  only while Michael is actually watching that chat (on screen, in focus,
  used in the last two minutes, checked within 10 seconds); a chat merely
  left open still alerts. Every send is in the developer page's
  Notification log, and the chat app's Settings list the Android battery
  settings that can hold alerts back.

## Developer page

`/developer`, for a web browser only (it is outside the app's scope, never
linked from it, and says so if opened inside the installed app). Its own
sign-in: `DEVELOPER_PASSWORD`, or `ADMIN_PASSWORD` until that is set, with a
12-hour cookie sent only to `/developer`. Signing in here does not sign in to
the chat app, nor the other way round.

- **Leads:** every chat as a lead, searchable and filterable, with CSV export.
- **Activity:** chats per day by site, start pages, places, time of day,
  reply times.
- **Health:** database, lead emails (with a log of every send and its
  result), notifications, recorded errors, storage, version, which
  environment variables are set.
- **Chat settings:** the greeting (on or off, delay, its four lines), the
  away message, the rescue (on or off, wait, message, second alert),
  emailing replies to visitors who left, visitor attachments, auto-closing
  quiet chats, the chat button per site.
- **AI integration:** an optional AI assistant, **off** until switched on
  there. While off, nothing is sent to any AI service. It can use Claude
  (through Anthropic's SDK) or any OpenAI-style service: ChatGPT, Gemini,
  DeepSeek, Qwen, Mistral, Grok, Kimi, Groq, OpenRouter, the Vercel AI
  Gateway, or another by address. Three modes: drafts for Michael to send,
  covering for him (while away or past the rescue time), or always on
  (stepping back for 30 minutes when he writes). It answers only from the
  context entered there, follows fixed rules (says it is an assistant, no
  invented facts, fair housing, no legal or financing advice), has per-chat
  and monthly limits, a test, and a log. Code in `src/lib/ai/`.
- **Data:** a full JSON backup (no photos, no private keys), deleting one
  person's data, clearing old photos and PDFs.

## Setup on Vercel

1. **Database.** In the Vercel project: Storage, Create Database, Supabase,
   connect to this project. That adds `POSTGRES_URL` and the related variables.
   The tables are created by the next build.
2. **Admin password.** Settings, Environment Variables: add `ADMIN_PASSWORD`
   (Production and Preview), marked Sensitive. Changing it signs every device
   out.
3. **Lead emails.** Add `RESEND_API_KEY`, the same key the sites use. The
   sender's domain must be verified in Resend. Without the key, chats still
   reach the app, they are just not emailed.
4. Redeploy.

Everything else is generated on first use and kept in the database: the key
that signs admin sign-ins and the keys that identify the app for push
notifications.

| Variable | Needed | Purpose |
| --- | --- | --- |
| `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING` | yes | Added by the Supabase integration |
| `ADMIN_PASSWORD` | yes | The chat app's password |
| `DEVELOPER_PASSWORD` | no | A separate password for `/developer` |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `QWEN_API_KEY`, `MISTRAL_API_KEY`, `XAI_API_KEY`, `MOONSHOT_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `AI_GATEWAY_API_KEY`, `AI_CUSTOM_API_KEY` | no | Only for the AI service chosen on the developer page |
| `RESEND_API_KEY` | for lead email | Same key as the sites |
| `LEAD_FROM` | no | Sender for lead email; its domain must be verified in Resend |
| `LEAD_TO` | no | Inbox used until addresses are saved in Settings |
| `APP_URL` | no | This app's public address, if it differs from the request's |
| `ALLOWED_ORIGINS`, `FRAME_ANCESTORS` | no | Override which sites may embed the chat |

## Adding it to a site

```html
<script src="https://CHAT-APP-ADDRESS/widget.js" data-site="westchesterguy" async></script>
```

`data-site` is `westchesterguy` or `horse`. Add `data-launcher="false"` to hide
the round button and open the chat from the site's own button with
`window.MWChat.open()`.

## Phone app

Open `/admin` in Chrome on the phone, sign in, and choose Install app (or Add to
Home screen). Then Settings, Notifications, Turn on for this device.

For an APK, wrap `/admin` as a Trusted Web Activity (for example with
PWABuilder or Bubblewrap). The app needs a stable address first, ideally a
custom domain such as chat.westchesterguy.com.

## Development

```
npm ci
POSTGRES_URL=postgres://... ADMIN_PASSWORD=... npm run build   # also applies migrations
npm start
```

Schema changes go in a new numbered file in `db/migrations/`. Never edit one
that has been applied.
