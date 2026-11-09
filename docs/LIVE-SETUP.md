# Live search: one-time setup (Gabriel)

Live search lets the trip chat ask Claude, which searches the web for real options and prices. It runs on your Anthropic account. Family members only type a password; they never see or store the key.

## Set it up
1. **Create a key.** In the Anthropic Console (console.anthropic.com), go to API keys and create one named "trip planner".
2. **Set a spend limit.** In the Console's limits settings, set a monthly spend limit. This is the real safety net: whatever happens, the bill can't go past it.
3. **Lock the key with a family password.** In the project folder, run `npm run lock-key`.
   - Paste the key, then type the family password twice. Nothing shows while you type.
   - Use at least 20 characters. Five random words is easiest to say out loud ("orange river lamp tiny boots").
   - This writes `data/claude-key.json`: the key, locked with the password.
4. **Publish it.** Commit `data/claude-key.json` and push. Once GitHub Pages has updated, the Setup page shows a "Live search" box.
5. **Tell the family the password,** in person or by message. Don't put it in the repo or a share link.

## What the password protects, and what it doesn't
- **What's public:** the locked file is public on GitHub. Without the password it is useless, but a short password could be guessed by a computer trying many times. That's why the minimum is 20 characters.
- **What a password holder can do:** anyone who has the password could, with some effort, dig the real key out of their browser. Only give the password to people you'd trust with the key.
- **What the spend limit covers:** the limit from step 2 caps the damage either way.

## If the password or key leaks
1. In the Console, delete the old key and create a new one.
2. Run `npm run lock-key` again with the new key and a new password.
3. Commit and push, then tell the family the new password. Devices that chose "Remember on this device" are asked for it again automatically.

## Turning live search off
Delete `data/claude-key.json`, commit and push. The app then works as before: the rule-based chat and the destination library.
