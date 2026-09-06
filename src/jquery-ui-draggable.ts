/**
 * @license GPL-3.0-or-later
 * Copyright (c) 2021, Clément Grennerat
 * Fork / contributions : A-S-T-U-C-E — https://github.com/A-S-T-U-C-E/HackCable
 *
 * @file Imports jQuery UI minimaux requis par draw2d (droppable / draggable).
 *
 * Responsabilités :
 * - Charger jQuery + widgets droppable/draggable (Canvas.init draw2d)
 * - Le DnD catalogue reste en HTML5 natif ; le menu contextuel est custom
 */
import $ from "jquery";
import "jquery-ui/ui/version";
import "jquery-ui/ui/widget";
import "jquery-ui/ui/data";
import "jquery-ui/ui/scroll-parent";
import "jquery-ui/ui/widgets/mouse";
import "jquery-ui/ui/widgets/draggable";
import "jquery-ui/ui/widgets/droppable";
import "jquery-ui/themes/base/core.css";
import "jquery-ui/themes/base/draggable.css";

// Compat jQuery 3+ : draw2d embarque un vieux jquery-contextMenu qui appelle andSelf.
const jqFn = $.fn as typeof $.fn & { andSelf?: typeof $.fn.addBack };
if (typeof jqFn.andSelf !== "function" && typeof jqFn.addBack === "function") {
    jqFn.andSelf = jqFn.addBack;
}
