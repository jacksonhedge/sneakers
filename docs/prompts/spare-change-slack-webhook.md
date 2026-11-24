# Create the Slack webhook for Spare Change signup and referral alerts (Jackson copies the URL himself)

Paste everything below the line into the Chrome agent.

---

You're setting up a Slack Incoming Webhook so the Sneakers site can post a message to Jackson's Slack for every new Spare Change Millionaire subscriber and every referral that pays out. Jackson is signed in to Slack in this browser. You create the app and the webhook; **Jackson copies the webhook URL himself.**

## Hard rules

1. **Never type, paste, read out, repeat or screenshot the webhook URL** (it starts with `https://hooks.slack.com/services/`). It's a secret. Don't put it in any message, field or file.
2. Only create the one app and the one webhook below. Don't change any other app, setting, member, permission or channel.
3. Don't sign in, type passwords or codes, or accept anything that asks for payment or a paid plan. If Slack asks for any of those, stop and tell Jackson.
4. If Slack says only an admin can install apps or approve them, stop and tell Jackson exactly what it says.

## Steps

1. Open https://api.slack.com/apps and click **Create New App** → **From scratch**.
2. App Name: `Spare Change alerts`. Pick Jackson's workspace (if there's more than one, ask Jackson which, and wait). Click **Create App**.
3. In the left menu, open **Incoming Webhooks** and switch **Activate Incoming Webhooks** on.
4. Click **Add New Webhook to Workspace** (at the bottom of that page).
5. On the channel screen: if a channel named `spare-change-signups` exists, pick it. If not, stop and ask Jackson whether to use an existing channel (and which) or to create `#spare-change-signups` in Slack first, and wait for his answer. Then click **Allow**.
6. Back on the Incoming Webhooks page, a new row shows the channel and a webhook URL with a **Copy** button. Leave this page open. Don't click Copy, and don't touch the URL.
7. Send Jackson: "The Spare Change alerts webhook is ready for #<channel>. On the Incoming Webhooks page, click **Copy** next to the new webhook URL, then tell Claude Code 'it's copied'." Then stop.
