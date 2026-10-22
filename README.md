# Old Gold RFC website

Static site for [oldgoldrfc.com](https://oldgoldrfc.com), hosted free on GitHub Pages.

## Updating the site (no coding needed)

All the words live in the `content/` folder as Markdown files. To change something, open the file on GitHub, click the pencil icon (Edit), make your change, and click **Commit changes**. The site updates in about a minute.

| File | What it controls |
|---|---|
| `content/fixtures.md` | Schedule and scores. The home page's next match, last result, and record are worked out from this file automatically. |
| `content/home.md` | The "about the club" text on the home page |
| `content/join.md` | The Join page: practice time and place, what to bring, contact |
| `content/sponsors.md` | Sponsor logos on the home page |

### Posting a score

In `content/fixtures.md`, find the match row and fill in the Result column with W, L, or D, then the score with Old Gold first:

```
| 2026-10-24 | Boston      | Away    | W 24-10 |
```

### Starting a new season

Change the `# Fall 2026 Season` heading and replace the rows in the table. Dates must be written `YYYY-MM-DD`.

## Files you normally won't touch

- `index.html`, `fixtures/`, `join/`, `404.html`: page layouts
- `assets/site.css`: colors and styling
- `assets/site.js`: reads the Markdown files and builds the fixtures and score cards
- `CNAME`: tells GitHub Pages to serve the site at oldgoldrfc.com

## Previewing locally

The pages load the Markdown with `fetch()`, so opening `index.html` straight from your computer won't work. From this folder, run `python3 -m http.server` and visit http://localhost:8000.
