"use strict";

const { Plugin, PluginSettingTab, Setting } = require("obsidian");

const GRAPH_VIEW_TYPES = ["graph", "localgraph"];

const DEFAULT_SETTINGS = {
  startColor: "#ffffff", // shallowest folder depth present — achromatic by default
  endColor: "#555555",   // deepest folder depth present
};

function hexToInt(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return Number.isFinite(n) ? n : 0xffffff;
}

function lerpInt(c0, c1, t) {
  const r0 = (c0 >> 16) & 255, g0 = (c0 >> 8) & 255, b0 = c0 & 255;
  const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
  const r = Math.round(r0 + (r1 - r0) * t);
  const g = Math.round(g0 + (g1 - g0) * t);
  const b = Math.round(b0 + (b1 - b0) * t);
  return (r << 16) | (g << 8) | b;
}

module.exports = class GraphDepthGradient extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.renderers = new Set();

    this.addSettingTab(new GDGSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.patchAllGraphLeaves();
      this.refresh();
    });
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      this.patchAllGraphLeaves();
      this.refresh();
    }));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
      this.patchAllGraphLeaves();
    }));
    // Folder depth changes when files move/rename or are created.
    this.registerEvent(this.app.vault.on("rename", () => this.refresh()));
    this.registerEvent(this.app.vault.on("create", () => this.refresh()));

    // Re-apply after the renderer rebuilds its node data.
    this.registerInterval(window.setInterval(() => this.refresh(), 1200));

    this.register(() => this.restoreAll());
  }

  onunload() {
    this.restoreAll();
  }

  nodeList(r) {
    const raw = r && r.nodes;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : Object.values(raw);
  }

  patchAllGraphLeaves() {
    this.renderers.clear();
    for (const type of GRAPH_VIEW_TYPES) {
      for (const leaf of this.app.workspace.getLeavesOfType(type)) {
        const r = leaf.view && leaf.view.renderer;
        if (r) this.renderers.add(r);
      }
    }
  }

  restoreAll() {
    for (const r of this.renderers) {
      for (const n of this.nodeList(r)) {
        if (n && "_gdgOrig" in n) {
          n.color = n._gdgOrig;
          delete n._gdgOrig;
        }
      }
      if (r.changed) r.changed();
    }
  }

  // depth = number of parent folders in the path ("a/b/c.md" -> 2)
  folderDepth(path) {
    return String(path).split("/").length - 1;
  }

  // section = top-level folder (first path segment). Files at the vault root
  // share the "" section. Each section gets its own gradient, so a section's
  // root note takes the start color and its deepest descendant the end color.
  sectionKey(path) {
    const parts = String(path).split("/");
    return parts.length > 1 ? parts[0] : "";
  }

  refresh() {
    const startCol = hexToInt(this.settings.startColor);
    const endCol = hexToInt(this.settings.endColor);

    for (const r of this.renderers) {
      const nodes = this.nodeList(r);

      // First pass: per section, find the folder-depth range so each section
      // spans start→end independently (shallowest note → start color, deepest
      // descendant → end color).
      const ranges = new Map();
      for (const n of nodes) {
        if (!n || n.id == null) continue;
        if (!this.app.vault.getAbstractFileByPath(n.id)) continue;

        const section = this.sectionKey(n.id);
        const depth = this.folderDepth(n.id);
        const range = ranges.get(section);
        if (!range) {
          ranges.set(section, { min: depth, max: depth });
          continue;
        }

        if (depth < range.min) range.min = depth;
        if (depth > range.max) range.max = depth;
      }

      // Second pass: map each node within its own section's depth range.
      for (const n of nodes) {
        if (!n || n.id == null) continue;
        if (!("_gdgOrig" in n)) {
          n._gdgOrig = n.color;
        }

        // Only color real files (skip tags / unresolved / attachments-less nodes)
        const file = this.app.vault.getAbstractFileByPath(n.id);
        if (!file) {
          n.color = n._gdgOrig;
          continue;
        }

        const range = ranges.get(this.sectionKey(n.id));
        const span = range.max - range.min;
        const t = span > 0 ? (this.folderDepth(n.id) - range.min) / span : 0;
        n.color = { a: 1, rgb: lerpInt(startCol, endCol, t) };
      }

      if (r.changed) r.changed();
    }
  }
};

class GDGSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Start color (section root)")
      .setDesc("Color for each top-level section's shallowest note (its root). Default is achromatic (white).")
      .addColorPicker((c) =>
        c.setValue(this.plugin.settings.startColor).onChange(async (v) => {
          this.plugin.settings.startColor = v;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh();
        })
      );

    new Setting(containerEl)
      .setName("End color (deepest)")
      .setDesc("Color for each top-level section's deepest note. Default is achromatic (dark gray).")
      .addColorPicker((c) =>
        c.setValue(this.plugin.settings.endColor).onChange(async (v) => {
          this.plugin.settings.endColor = v;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh();
        })
      );
  }
}
