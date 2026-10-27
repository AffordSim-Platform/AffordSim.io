# AffordSim project page

This repository contains the private project page for **AffordSim: A Scalable Data Generator and Benchmark for Affordance-Aware Robotic Manipulation**. The page uses figures and a PDF built from the current paper source, and links to the [AffordSim code repository](https://github.com/yangml071/AffordSim).

## Preview locally

From this directory, run:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/> on the same computer. The page is a static site and does not require a build step or external assets.

## Privacy

The GitHub repository is private. No GitHub Pages site or public deployment is configured by this repository. A private repository does not by itself make an independently hosted static site private; use an access-controlled host if remote private access is needed.

## Files

- `index.html`, `style.css`, `script.js`: page markup, styling, and citation-copy interaction.
- `assets/` and `image/`: project figures.
- `paper/main.pdf`: paper compiled from the current AffordSim source.
