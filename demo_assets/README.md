# Sample collection

`ATTRIBUTION.json` records the 20 selected Wikimedia Commons file pages, original titles, creators, original download URLs, license names/links, and transformations. The downloader uses this pinned selection on fresh clones.

Run `python -m app.setup_demo` from `backend/` to obtain the images and generate real-model demo history. Photos are stored under ignored `backend/data/samples/`; copied prediction images are under `backend/data/uploads/`.

Each image retains its original CC BY, CC BY-SA, CC0, or Public Domain terms. Resizing, metadata removal, and JPEG conversion are documented transformations. For ShareAlike photos, those photo derivatives retain the same applicable ShareAlike license; this does not assign a license to unrelated application code. Keep credit, source, license, and change notices with shared copies. No endorsement by the photographer or pictured people is implied.

The first setup selected images using official Commons API metadata and allowed only CC BY/CC BY-SA/CC0/Public Domain assets. Optional network failures do not prevent uploading a user's own image. Sample outputs are actual model predictions, not ground-truth labels.
