/*
 * OscMix Web
 * Copyright (C) 2026 Martin Augustyniak
 * SPDX-License-Identifier: GPL-3.0-or-later
 * https://www.gnu.org/licenses/gpl-3.0.html
 */
"use strict";import{getMeta,putMeta}from"./net.js";const PUT_DEBOUNCE_MS=400;let data={},timer=null;export async function loadMeta(){try{data=(await getMeta()).meta??{}}catch{data={}}return data}export function metaGet(key,fallback=null){return data[key]??fallback}export function metaSet(key,value){data[key]=value,clearTimeout(timer),timer=setTimeout(()=>{timer=null,putMeta(data)},PUT_DEBOUNCE_MS)}export function metaChanged(next){timer||(data=next??{})}
