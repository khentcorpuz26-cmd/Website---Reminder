# Ledger — task board + daily n8n reminder

A 3-column task board (To do / In progress / Done) backed by Supabase, plus
an n8n workflow that Telegrams you every morning with whatever isn't done.

## 1. Supabase (5 min)

1. Create a free project at supabase.com.
2. Open **SQL Editor** → paste in `schema.sql` → Run.
3. Go to **Project Settings > API** and copy:
   - **Project URL**
   - **anon public** key (for the website)
   - **service_role** key (for n8n only — never put this in the browser)

## 2. Website

1. Open `config.js` and fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the anon key).
2. Serve the folder (`index.html`, `style.css`, `app.js`, `config.js`) as static
   files — e.g. add an `nginx` service to your existing `docker-compose.yml`
   next to n8n, or drop it in any static host. No build step needed.
3. Open it in a browser. Click **Add task** to create your first one.
   Drag cards between columns, or click a card to edit/delete it.

> Note: `schema.sql` enables Row Level Security with an open policy for the
> anon key, since this is meant as a single-user personal tool. Don't publish
> the link publicly — anyone with it and your anon key can read/edit tasks.
> If that ever changes, swap it for real Supabase Auth.

## 3. n8n workflow

1. In n8n: **Workflows > Import from File** → select `ledger-daily-reminder.json`.
2. Open the **Get Pending Tasks** node → replace `YOUR-PROJECT-REF` in the URL
   and `YOUR-SERVICE-ROLE-KEY` in both headers with your Supabase service_role key.
3. Create a Telegram bot: message **@BotFather** → `/newbot` → copy the token.
4. In n8n, add Telegram credentials with that token, then open the
   **Send Telegram Reminder** node and select that credential.
5. Get your chat ID: message your new bot anything, then visit
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and read `chat.id` from
   the JSON. Paste it into the node's `chatId` field.
6. Open **Every Day 8AM** and adjust the time if 8:00 AM doesn't work for you.
7. Activate the workflow (top-right toggle).

Every morning you'll get a Telegram message grouping your pending tasks into
overdue, due today, and upcoming/no date — or a "clear" message if there's
nothing left.

## Extending later

- Swap the anon-key RLS policy for real Supabase Auth if more than one
  person will use the board.
- Add a `notified_at` column and have the reminder skip tasks you've
  already been pinged about today, if the list gets long.
- Self-host Supabase in the same Docker Compose file as n8n instead of
  using the cloud free tier, once the workflow above is confirmed working.
