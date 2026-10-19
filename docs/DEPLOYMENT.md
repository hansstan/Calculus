# Deployment

Use the same order every time:

1. Commit and push the app changes.
2. Deploy the app with `./deploy.sh`.
3. Commit and push the `version.txt` change separately.

The script builds and publishes the .NET 10 app, adds `calculus.ini`, `calculus.caddy`, and the next version to the bundle, and gives `/srv/stage/calculus.zip` to deployd. It configures the service to keep per-user logs in `/srv/www/data/calculus`, outside the replaceable app directory. User log filenames use PascalCase (for example, `HansMustermann.log` and `HansMustermann-History.log`). The Caddy overlay prevents stale page and service-worker caches from delaying PWA updates.

The deployment route is `http://hasta-home.com/Calculus/` (domain `hasta-home.com`, path `/Calculus`).

Each multiplication run appends a JSON record to `<Name>-History.log`. The readable activity log, `<Name>.log`, records completed activities and history deletions. Clearing a player's history truncates only the history file; the activity log remains available for the overall activity overview.
