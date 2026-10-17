/*
 * OscMix Web
 * Copyright (C) 2026 Martin Augustyniak
 * SPDX-License-Identifier: GPL-3.0-or-later
 * https://www.gnu.org/licenses/gpl-3.0.html
 */
"use strict";import{buildPanelShell}from"./panel.js";import{buildEqEditor}from"./eqEditor.js";import{openEditor}from"./editorWindow.js";export function buildEqPanel(strip,dispatch){const{panel,inner}=buildPanelShell("eq","eq"),editor=buildEqEditor(inner,{controls:strip.eq,dispatch,bus:strip.bus,index:strip.index,stereo:strip.stereo,compact:!0,onOpenDetail:()=>openEditor("eq",strip.bus,strip.index)});return panel._cleanup=editor.destroy,panel}
