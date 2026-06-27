# Graph Depth Gradient

An Obsidian plugin that colors **graph view** nodes by their **folder depth**, as a gradient between two colors — so notes near the vault root look one color and deeply nested notes fade toward another. Defaults to a neutral (achromatic) gradient.

## How depth is measured

Each node is colored by how deep its file sits in the folder tree — simply the number of parent folders in its path:

- `note.md` → depth `0`
- `area/note.md` → depth `1`
- `area/topic/sub/note.md` → depth `3`

The depth is mapped onto a gradient: depth `0` gets the **start color**, and the configured **max depth** (and anything deeper) gets the **end color**, with values in between interpolated linearly. Notes that aren't files in the vault (tags, attachments-less/unresolved nodes) keep their original color.

This is stable and independent of which note is selected — the coloring reflects your folder structure, not the active note.

## How the color is applied

The plugin sets each node's color on the graph renderer directly and refreshes when the vault changes.

> Because it overrides node colors, this plugin is **mutually exclusive with other graph node-coloring plugins** (including Obsidian's Graph color groups for the affected nodes, and any other recoloring plugin). A graph node can only hold one color at a time, so run one coloring scheme at a time. It does **not** conflict with non-coloring plugins (panning, layout, etc.). Disabling the plugin restores the original colors.

Works in both the global **Graph view** and the **Local graph**.

## Settings

- **Start color (folder root)** — color for notes at the vault root (depth 0). Default: achromatic (white).
- **End color (deepest)** — color for the deepest folders. Default: achromatic (dark gray).
- **Max folder depth** — folder depth mapped to the end color; deeper notes clamp to it.

## Notes

This plugin draws into the graph view's internal renderer (setting per-node colors). It relies on internal renderer APIs that are not part of the public plugin API and may change in future Obsidian versions. It is desktop-only.

## License

[MIT](LICENSE)
