# Wobble Basket 2v2

A tiny browser basketball game (2v2) built with plain HTML/CSS/JS.

## Quick start

From this repository directory (`/workspace/games`):

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open:

- `http://127.0.0.1:4173/`
- or explicitly: `http://127.0.0.1:4173/index.html`

## If you see a directory listing instead of the game

That usually means the server was started in the wrong folder.

### Check your current folder

```bash
pwd
```

It should print:

```text
/workspace/games
```

### Verify required files exist in the served folder

```bash
ls -1
```

You should see at least:

- `index.html`
- `style.css`
- `game.js`

### Start server from the correct location explicitly

If you are not in `/workspace/games`, run:

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory /workspace/games
```

Then open:

- `http://127.0.0.1:4173/index.html`

## Controls

- Red team: `W`, `E`
- Blue team: `I`, `O`
- Hold key: jump + raise hands + move.
- Release key: throw/pass if holding the ball.

## Dev check

```bash
node --check game.js
```
