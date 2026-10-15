/*
 * OscMix Web
 * Copyright (C) 2026 Martin Augustyniak
 * SPDX-License-Identifier: GPL-3.0-or-later
 * https://www.gnu.org/licenses/gpl-3.0.html
 */
"use strict";import{setAddr}from"./net.js";import{createSwatchPicker}from"./swatchPicker.js";export const StripColor=(()=>{const picker=createSwatchPicker({name:"channel",noneTitle:"Default",onPick:(target,idx)=>{const applied=idx===0?1:idx;target.apply(applied),setAddr(target.address,applied)}});return{showPicker(e,address,apply){picker.show(e,{address,apply})}}})();
