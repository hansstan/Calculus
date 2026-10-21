# Deployment

Use the same order every time:

1. Commit and push the app changes.
2. Deploy the app with `./deploy.sh`.
3. Commit and push the `version.txt` change separately.

The script builds and publishes the .NET 10 app, adds `calculus.ini`, `calculus.caddy`, and the next version to the bundle, and gives `/srv/stage/calculus.zip` to deployd. It configures the service to keep per-user logs in `/srv/www/data/calculus`, outside the replaceable app directory. User log filenames use PascalCase (for example, `HansMustermann.log` and `HansMustermann-History.log`). The Caddy overlay prevents stale page and service-worker caches from delaying PWA updates.

The deployment route is `http://hasta-home.com/Calculus/` (domain `hasta-home.com`, path `/Calculus`).

Each multiplication run appends a JSON record to `<Name>-History.log`. Completed prime-factor exercises and timed prime-factor rounds are also recorded in the readable activity log, `<Name>.log`, along with the selected maximum number (4–15,000; default 5,000) and history deletions. Clearing a player's history truncates only the history file; the activity log remains available for the overall activity overview.

Activity and player-history lists are grouped by local calendar date, with the newest day first and entries numbered chronologically within each day. Day headings use a bold date with a solid divider; entry times do not repeat the date. The all-player activity overview is compact on portrait mobile screens and abbreviates multiplication as `1 x 1` and prime-factorization as `PFZ`. Entries for Lena are highlighted pink and entries for Lukas blue. The prime-factor practice page displays divisibility rules for 2, 5, 3, and 9 above the exercise.
