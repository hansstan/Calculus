# Deployment

Use the same order every time:

1. Commit and push the app changes.
2. Deploy the app with `./deploy.sh`.
3. Commit and push the `version.txt` change separately.

The script builds and publishes the .NET 10 app, adds `calculus.ini`, `calculus.caddy`, and the next version to the bundle, and gives `/srv/stage/calculus.zip` to deployd. It configures the service to keep per-user logs in `/srv/www/calculus-data`, outside the replaceable app directory. The Caddy overlay prevents stale page and service-worker caches from delaying PWA updates.

The deployment route is `http://hasta-home.com/Calculus/` (domain `hasta-home.com`, path `/Calculus`).

Each run appends a JSON record to `<Name>-History.log`. It also appends the requested readable session summary to `<Name>.log`. Clearing a player's history truncates only the history file; the session log remains as the activity log.
