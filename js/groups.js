/*
 * OscMix Web
 * Copyright (C) 2026 Martin Augustyniak
 * SPDX-License-Identifier: GPL-3.0-or-later
 * https://www.gnu.org/licenses/gpl-3.0.html
 */
"use strict";import{setAddr}from"./net.js";import{createSwatchPicker}from"./swatchPicker.js";export const groupAddr=(c,leaf)=>c.address.replace(/[^/]+$/,leaf);const half=group=>group-1>>2,picker=createSwatchPicker({name:"groups",noneTitle:"No group",onPick:(c,group)=>{for(const k of[0,1])setAddr(groupAddr(c,`groupflags/${k}`),group&&half(group)===k?4096<<(group-1&3):0)}});export function attachGroup(c,widget,dispatch){widget.setCapColor(c.group),widget.onThumbContextMenu=e=>picker.show(e,c);for(const k of[0,1])dispatch.set(groupAddr(c,`groupflags/${k}`),v=>{const bits=v>>12&15;bits?c.group=4*k+Math.log2(bits)+1:c.group&&half(c.group)===k&&(c.group=0),widget.setCapColor(c.group)})}
