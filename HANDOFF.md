# Handoff to Claude Code

The repository is complete and committed (2 commits on `main`). Claude Code on your laptop can create the GitHub repo and push it; this cloud session cannot create repos.

## Steps (5 minutes)

1. Unzip `trip-planner-with-git.zip` into your personal code folder (not `Codes/DI`, this is a personal project):
   ```
   unzip ~/Downloads/trip-planner-with-git.zip -d ~/Codes/
   cd ~/Codes/trip-planner
   ```
2. Check it runs:
   ```
   npm install
   npm test            # 21 tests should pass
   npm run serve       # then open http://localhost:8000/
   ```
3. Start Claude Code in the folder and paste the prompt below:
   ```
   claude
   ```

## Prompt for Claude Code

> Read CLAUDE.md, README.md and docs/superpowers/plans/2026-11-08-v1-build.md. This is my personal trip-planner app, already committed on main.
> 1. Set the git author to my GitHub noreply address, then create a private GitHub repository called `trip-planner` on my personal account (gabilevie-ctrl) with `gh repo create gabilevie-ctrl/trip-planner --private --source=. --push`.
> 2. Enable GitHub Pages from the `main` branch, root folder (`gh api` on the pages endpoint or tell me the exact clicks), and give me the Pages URL.
> 3. Run `npm test` and `npm run validate` and confirm both are green.
> 4. Then open docs/ROADMAP.md and propose the next three tasks as a superpowers plan; do not start them until I say so.

## After that, in future sessions

- `cd ~/Codes/trip-planner && claude` and describe what you want. The conventions Claude Code follows are in `CLAUDE.md`; specs and plans go under `docs/superpowers/`.
- Adding a destination: either edit a JSON in `data/destinations/` or add a block to `scripts/seed-routes.cjs` and run `npm run seed`; then `npm run validate`.
- The Claude artifact link stays as a second deployment; the GitHub Pages URL becomes the one to share once it is on.
