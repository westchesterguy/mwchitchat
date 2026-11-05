# MW Chat

Live chat for westchesterguy.com and westchesterhorseproperties.com, answered by
Michael from his own app. It replaces Tawk.to.

- **Visitors** get a chat button on either site. They answer a short pre-chat
  questionnaire, then message Michael live.
- **Michael** uses the admin app at `/admin`. It can be installed on a phone
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
- **Notifications** reach his phone when a chat starts or a visitor writes,
  through Web Push. No Firebase project is needed.

## Developer page

`/developer`, for a web browser only (it is outside the app's scope, never
linked from it, and says so if opened inside the installed app). Its own
sign-in: `DEVELOPER_PASSWORD`, or `ADMIN_PASSWORD` until that is set, with a
12-hour cookie sent only to `/developer`. Signing in here does not sign in to
the admin app, nor the other way round.

- **Leads:** every chat as a lead, searchable and filterable, with CSV export.
- **Activity:** chats per day by site, start pages, places, time of day,
  reply times.
- **Health:** database, lead emails (with a log of every send and its
  result), notifications, recorded errors, storage, version, which
  environment variables are set.
- **Chat settings:** the greeting (on or off, delay, its four lines), the
  away message, visitor attachments, auto-closing quiet chats, the chat
  button per site.
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
| `ADMIN_PASSWORD` | yes | The admin app's password |
| `DEVELOPER_PASSWORD` | no | A separate password for `/developer` |
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
