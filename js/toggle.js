/*
 * OscMix Web
 * Copyright (C) 2026 Martin Augustyniak
 * SPDX-License-Identifier: GPL-3.0-or-later
 * https://www.gnu.org/licenses/gpl-3.0.html
 */
"use strict";import{setAddr}from"./net.js";import{Button}from"./button.js";const TOGGLES={mute:{label:"M",modifier:"mute"},solo:{label:"S",modifier:"solo"}};export const PARAM_LABELS={stereo:"stereo",phase:"phase",msproc:"MS proc.","48v":"48V",instrument:"Inst",pad:"Pad",autoset:"AutoSet",gain:"gain",width:"width",fxsend:"send FX",fxreturn:"return FX",reflevel:"ref. level",crossfeed:"crossfeed"};export function renderToggle(c,dispatch,opts={}){const variant=opts.variant??"btn",preset=variant==="btn"?TOGGLES[c.param]??{label:(c.param[0]||"?").toUpperCase(),modifier:""}:{label:PARAM_LABELS[c.param]??c.param,modifier:""},button=new Button({variant,modifier:opts.modifier??preset.modifier,className:opts.className,label:opts.label??preset.label,onLabel:opts.onLabel,offLabel:opts.offLabel,title:opts.title??c.tooltip,guard:opts.guard,active:(c.value??0)>=.5});return button.element.addEventListener("user-change",e=>setAddr(c.address,e.detail.active)),dispatch.set(c.address,v=>{c.value=v,button.active=v>=.5}),button.element}
